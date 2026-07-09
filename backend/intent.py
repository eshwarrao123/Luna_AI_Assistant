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
    "- create_reminder (params: text, time)\n"
    "- open_browser (params: url)\n"
    "- create_calendar_event (params: title, date, time)\n"
    "- draft_email (params: to, subject, body)\n"
    "- open_music_player (params: app_name)\n"
    "- search_web (params: query)\n\n"
    "User said: '{message}'\n\n"
    "Respond ONLY with a single JSON object, no markdown:\n"
    '{{"action": "<tool_name_or_chat>", "params": {{...}}}}\n\n'
    "Examples:\n"
    'User: "open downloads folder" -> {{"action": "open_folder", "params": {{"path": "downloads"}}}}\n'
    'User: "open my documents" -> {{"action": "open_folder", "params": {{"path": "documents"}}}}\n'
    'User: "open vscode" -> {{"action": "open_app", "params": {{"name": "vscode"}}}}\n'
    'User: "open whatsapp" -> {{"action": "open_app", "params": {{"name": "whatsapp"}}}}\n'
    'User: "launch telegram" -> {{"action": "open_app", "params": {{"name": "telegram"}}}}\n'
    'User: "open chrome" -> {{"action": "open_app", "params": {{"name": "chrome"}}}}\n'
    'User: "launch notepad" -> {{"action": "open_app", "params": {{"name": "notepad"}}}}\n'
    'User: "make a note called ideas saying buy milk" -> {{"action": "create_note", "params": {{"title": "ideas", "content": "buy milk"}}}}\n'
    'User: "find report.pdf in documents" -> {{"action": "search_files", "params": {{"query": "report.pdf", "directory": "documents"}}}}\n'
    'User: "remind me to call mom at 5pm" -> {{"action": "create_reminder", "params": {{"text": "call mom", "time": "5pm"}}}}\n'
    'User: "open google.com" -> {{"action": "open_browser", "params": {{"url": "google.com"}}}}\n'
    'User: "open youtube in browser" -> {{"action": "open_browser", "params": {{"url": "youtube.com"}}}}\n'
    'User: "open my browser" -> {{"action": "open_browser", "params": {{}}}}\n'
    'User: "search for react tutorials" -> {{"action": "search_web", "params": {{"query": "react tutorials"}}}}\n'
    'User: "google best pizza near me" -> {{"action": "search_web", "params": {{"query": "best pizza near me"}}}}\n'
    'User: "create a meeting for tomorrow at 3pm" -> {{"action": "create_calendar_event", "params": {{"title": "Meeting", "date": "", "time": "3pm"}}}}\n'
    'User: "schedule a dentist appointment on 25th july at 10am" -> {{"action": "create_calendar_event", "params": {{"title": "Dentist appointment", "date": "20260725", "time": "10am"}}}}\n'
    'User: "email john about the project" -> {{"action": "draft_email", "params": {{"to": "john", "subject": "The project", "body": ""}}}}\n'
    'User: "send an email to sara@example.com saying I will be late" -> {{"action": "draft_email", "params": {{"to": "sara@example.com", "subject": "", "body": "I will be late"}}}}\n'
    'User: "play music" -> {{"action": "open_music_player", "params": {{}}}}\n'
    'User: "open spotify" -> {{"action": "open_music_player", "params": {{"app_name": "spotify"}}}}\n'
    'User: "play some music on itunes" -> {{"action": "open_music_player", "params": {{"app_name": "itunes"}}}}\n'
    'User: "how are you" -> {{"action": "chat"}}\n'
    'User: "what is python" -> {{"action": "chat"}}\n\n'
    "JSON only:"
)

# ── Rule-based fast path ────────────────────────────────────────────────────

_FOLDER_ALIASES = [
    "downloads", "documents", "desktop", "pictures", "music", "videos", "home",
]

# Maps trigger keywords → canonical app name (must match COMMON_APPS keys in tools.py)
_APP_KEYWORDS: dict[str, str] = {
    # Editors / IDEs
    "vscode": "vscode",
    "vs code": "vscode",
    "visual studio code": "vscode",
    "cursor": "cursor",
    # Messaging / social
    "whatsapp": "whatsapp",
    "telegram": "telegram",
    "discord": "discord",
    "slack": "slack",
    "teams": "teams",
    "microsoft teams": "teams",
    # Media
    "zoom": "zoom",
    # Browsers
    "chrome": "chrome",
    "google chrome": "chrome",
    "firefox": "firefox",
    "edge": "edge",
    "microsoft edge": "edge",
    # Productivity
    "notion": "notion",
    "obsidian": "obsidian",
    "outlook": "outlook",
    # System
    "notepad": "notepad",
    "calculator": "calculator",
    "calc": "calculator",
    "paint": "paint",
    "explorer": "explorer",
    "file explorer": "explorer",
    "cmd": "cmd",
    "command prompt": "cmd",
    "terminal": "terminal",
    "powershell": "powershell",
    "task manager": "task manager",
    "settings": "settings",
}

_OPEN_VERBS = {"open", "launch", "start", "run", "show"}

# Music-player triggers handled separately so "open spotify" routes to
# open_music_player instead of the generic open_app path.
_MUSIC_KEYWORDS: dict[str, str] = {
    "spotify": "spotify",
    "itunes": "itunes",
    "windows media player": "music",
    "media player": "music",
}
_MUSIC_VERBS = {"play", "open", "launch", "start"}

_BROWSER_HOSTS_RE = re.compile(
    r"\b([a-z0-9-]+\.(?:com|org|net|io|dev|co|in|edu|gov))\b", re.IGNORECASE
)

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def _rule_based(message: str) -> dict | None:
    m = message.lower().strip()

    # music player: "play music", "open spotify", "play something on itunes"
    if any(v in m for v in _MUSIC_VERBS):
        for kw, app in _MUSIC_KEYWORDS.items():
            if kw in m:
                log.info("[intent] rule-based music: %s -> %s", message, app)
                return {"action": "open_music_player", "params": {"app_name": app}}
        if "music" in m and "play" in m:
            log.info("[intent] rule-based music (generic): %s", message)
            return {"action": "open_music_player", "params": {}}

    # search_web: "search for X", "google X"
    search_match = re.match(r"^(?:search(?: the web)? for|google)\s+(.+)$", m)
    if search_match:
        query = search_match.group(1).strip()
        log.info("[intent] rule-based search_web: %s -> %s", message, query)
        return {"action": "search_web", "params": {"query": query}}

    # open_browser: explicit domain mentioned with an open verb
    if any(v in m for v in _OPEN_VERBS):
        host_match = _BROWSER_HOSTS_RE.search(m)
        if host_match:
            log.info("[intent] rule-based browser: %s -> %s", message, host_match.group(1))
            return {"action": "open_browser", "params": {"url": host_match.group(1)}}

    # open_folder: "open <alias> folder" / "show <alias>"
    if any(v in m for v in ("open", "show", "go to")):
        for alias in _FOLDER_ALIASES:
            if alias in m and any(w in m for w in ("folder", "open", "show", "go to")):
                if alias == "home" and "folder" not in m:
                    continue
                log.info("[intent] rule-based folder: %s -> %s", message, alias)
                return {"action": "open_folder", "params": {"path": alias}}

    # open_app: check every known keyword (longest match first to avoid "edge" matching "vs code")
    if any(v in m for v in _OPEN_VERBS):
        for kw in sorted(_APP_KEYWORDS, key=len, reverse=True):
            if kw in m:
                app = _APP_KEYWORDS[kw]
                log.info("[intent] rule-based app: %s -> %s", message, app)
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