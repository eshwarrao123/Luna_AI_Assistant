import json
import re

from tools import TOOLS

CLASSIFIER_PROMPT = (
    "You are an intent classifier. Available tools: open_app, open_folder, "
    "create_note, search_files, create_reminder.\n"
    "User said: '{message}'.\n"
    "Respond ONLY with JSON in one of these forms:\n"
    '{{"action": "tool_name", "params": {{...}}}} or {{"action": "chat"}}.\n'
    "Rules: choose a tool only when the user clearly requests a desktop action. "
    "For open_folder use param 'path'. For open_app use 'name'. For create_note use "
    "'title' and 'content'. For search_files use 'query' and 'directory'. For "
    "create_reminder use 'text' and 'time'. Otherwise return {{\"action\": \"chat\"}}. "
    "No prose, no markdown, JSON only."
)


def _extract_json(text: str) -> dict | None:
    """Pull the first JSON object out of a possibly noisy model reply."""
    if not text:
        return None
    text = text.strip()
    # strip code fences
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


async def classify_intent(user_message: str, ollama_client) -> dict:
    """Classify a user message into a tool action or plain chat.

    Returns: {"action": "chat"} OR
             {"action": "<tool>", "params": {...}, "description": "..."}
    """
    prompt = CLASSIFIER_PROMPT.format(message=user_message.replace("'", "\\'"))
    messages = [{"role": "user", "content": prompt}]

    try:
        raw = await ollama_client.chat(
            messages,
            model="qwen2.5:7b",
            options={"num_predict": 200, "temperature": 0},
        )
    except TypeError:
        # ollama_client.chat may not accept options in older signature
        raw = await ollama_client.chat(messages, model="qwen2.5:7b")
    except Exception:  # noqa: BLE001
        return {"action": "chat"}

    parsed = _extract_json(raw)
    if not parsed or not isinstance(parsed, dict):
        return {"action": "chat"}

    action = parsed.get("action")
    if action == "chat" or action not in TOOLS:
        return {"action": "chat"}

    params = parsed.get("params") or {}
    if not isinstance(params, dict):
        params = {}

    # Keep only known params for this tool
    allowed = set(TOOLS[action]["params"].keys())
    clean_params = {k: v for k, v in params.items() if k in allowed}

    return {
        "action": action,
        "params": clean_params,
        "description": TOOLS[action]["description"],
    }
