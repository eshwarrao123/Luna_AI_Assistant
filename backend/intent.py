# /backend/intent.py
import json
import re
import logging

from tools import TOOLS

log = logging.getLogger("luna.intent")

CLASSIFIER_PROMPT = (
    "You are an intent classifier for a desktop assistant. Available tools:\n"
    "- open_app (params: name)\n"
    "- open_folder (params: path)\n"
    "- create_note (params: title, content)\n"
    "- search_files (params: query, directory)\n"
    "- create_reminder (params: text, time)\n\n"
    "User said: '{message}'\n\n"
    "Respond ONLY with a single JSON object, no markdown:\n"
    '{{"action": "<tool_name_or_chat>", "params": {{...}}}}\n\n'
    "Examples:\n"
    'User: "open downloads folder" -> {{"action": "open_folder", "params": {{"path": "downloads"}}}}\n'
    'User: "open my documents" -> {{"action": "open_folder", "params": {{"path": "documents"}}}}\n'
    'User: "open vscode" -> {{"action": "open_app", "params": {{"name": "code"}}}}\n'
    'User: "launch notepad" -> {{"action": "open_app", "params": {{"name": "notepad"}}}}\n'
    'User: "make a note called ideas saying buy milk" -> {{"action": "create_note", "params": {{"title": "ideas", "content": "buy milk"}}}}\n'
    'User: "find report.pdf in documents" -> {{"action": "search_files", "params": {{"query": "report.pdf", "directory": "documents"}}}}\n'
    'User: "remind me to call mom at 5pm" -> {{"action": "create_reminder", "params": {{"text": "call mom", "time": "5pm"}}}}\n'
    'User: "how are you" -> {{"action": "chat"}}\n'
    'User: "what is python" -> {{"action": "chat"}}\n\n'
    "JSON only:"
)

# ── Rule-based fast path (runs BEFORE the LLM; deterministic) ──────────────────

_FOLDER_ALIASES = ["downloads", "documents", "desktop", "pictures", "music", "videos", "home"]

_APP_KEYWORDS = {
    "vscode": "code", "vs code": "code", "visual studio code": "code",
    "notepad": "notepad", "calculator": "calc", "calc": "calc",
    "chrome": "chrome", "firefox": "firefox", "edge": "msedge",
    "explorer": "explorer", "spotify": "spotify", "terminal": "cmd",
    "cmd": "cmd", "powershell": "powershell", "paint": "mspaint",
}


def _rule_based(message: str) -> dict | None:
    m = message.lower().strip()

    # open_folder: "open <alias> folder" / "open my <alias>"
    if "open" in m or "show" in m or "go to" in m:
        for alias in _FOLDER_ALIASES:
            if alias in m and ("folder" in m or "open" in m or "show" in m or "go to" in m):
                # avoid matching "open spotify" as folder
                if alias in ("home",) and "folder" not in m:
                    continue
                log.info("[intent] rule-based folder match: %s -> %s", message, alias)
                return {"action": "open_folder", "params": {"path": alias}}

    # open_app: "open <app>" / "launch <app>" / "start <app>"
    if any(w in m for w in ("open", "launch", "start", "run")):
        for kw, app in _APP_KEYWORDS.items():
            if kw in m:
                log.info("[intent] rule-based app match: %s -> %s", message, app)
                return {"action": "open_app", "params": {"name": app}}

    return None


def _extract_json(text: str) -> dict | None:
    if not text:
        return None
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _finalize(action: str, params: dict) -> dict:
    if not isinstance(params, dict):
        params = {}
    allowed = set(TOOLS[action]["params"].keys())
    clean = {k: v for k, v in params.items() if k in allowed}
    result = {
        "action": action,
        "params": clean,
        "description": TOOLS[action]["description"],
    }
    log.info("[intent] FINAL action=%s params=%s", action, clean)
    return result


async def classify_intent(user_message: str, ollama_client) -> dict:
    log.info("[intent] classifying message: %r", user_message)

    # 1. Deterministic rule-based path first
    rule = _rule_based(user_message)
    if rule and rule["action"] in TOOLS:
        return _finalize(rule["action"], rule["params"])

    # 2. LLM fallback
    prompt = CLASSIFIER_PROMPT.format(message=user_message.replace("'", "\\'"))
    messages = [{"role": "user", "content": prompt}]

    try:
        raw = await ollama_client.chat(
            messages, model="qwen2.5:7b", options={"num_predict": 200, "temperature": 0}
        )
    except TypeError:
        raw = await ollama_client.chat(messages, model="qwen2.5:7b")
    except Exception as exc:
        log.warning("[intent] LLM error, defaulting to chat: %s", exc)
        return {"action": "chat"}

    log.info("[intent] raw LLM output: %r", raw)
    parsed = _extract_json(raw)
    log.info("[intent] parsed JSON: %s", parsed)

    if not parsed or not isinstance(parsed, dict):
        return {"action": "chat"}

    action = parsed.get("action")
    if action == "chat" or action not in TOOLS:
        log.info("[intent] resolved to chat (action=%s)", action)
        return {"action": "chat"}

    return _finalize(action, parsed.get("params") or {})