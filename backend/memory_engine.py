# /backend/memory_engine.py
import json
import re
import sqlite3
from database import get_connection

EXTRACTION_PROMPT = """You are a precise memory extractor. Extract ONLY clear, factual information about the user from this conversation.
CONVERSATION:
{conversation}
RULES:
- Extract ONLY explicit facts the user stated about themselves
- Use simple, readable keys like: user_name, favorite_color, job_title, prefers_dark_mode, works_late
- Values must be the EXACT information, not descriptions of it
- If user says "My name is Eshwar", extract: {{"key": "user_name", "value": "Eshwar", "category": "fact"}}
- If user says "I prefer dark mode", extract: {{"key": "prefers_dark_mode", "value": "true", "category": "preference"}}
- If user says "I work late", extract: {{"key": "works_late", "value": "true", "category": "habit"}}
- NEVER use vague keys like "pref_name" or "tells_name_eshwar"
- NEVER include descriptions in the value field
- Return ONLY a JSON array. No markdown, no explanation.
OUTPUT FORMAT (JSON array only):
[
  {{"key": "user_name", "value": "Eshwar", "category": "fact"}}
]
"""

VALID_CATEGORIES = {"fact", "preference", "habit"}

_GARBAGE_KEY_NAME_PATTERN = re.compile(r"^(pref_|prefers_|preference_)?name$", re.IGNORECASE)
_GARBLED_NAME_VALUE_PATTERN = re.compile(
    r"(?:tells?_name_|name_is_|my_name_is_|called_)([a-zA-Z]+)", re.IGNORECASE
)
_SNAKE_TO_WORDS = re.compile(r"[_\-]+")


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def clean_memory_key(key: str) -> str:
    if not key:
        return key

    raw = key.strip()

    if _GARBAGE_KEY_NAME_PATTERN.match(raw):
        return "user_name"

    if raw.lower().startswith("pref_") and "name" in raw.lower():
        return "user_name"

    match = _GARBLED_NAME_VALUE_PATTERN.search(raw)
    if match:
        return "user_name"

    words = [w for w in _SNAKE_TO_WORDS.split(raw.lower()) if w]
    return "_".join(words) if words else raw


def _extract_name_from_garbage(value: str) -> str | None:
    if not value:
        return None
    match = _GARBLED_NAME_VALUE_PATTERN.search(value)
    if match:
        return match.group(1).capitalize()
    return None


def _clean_memory_item(item: dict) -> dict | None:
    if not isinstance(item, dict):
        return None

    key = str(item.get("key", "")).strip()
    value = str(item.get("value", "")).strip()
    category = str(item.get("category", "fact")).strip().lower()

    if not key or not value:
        return None

    original_key = key
    key = clean_memory_key(key)

    if key == "user_name" and original_key != "user_name":
        recovered = _extract_name_from_garbage(value) or _extract_name_from_garbage(
            original_key
        )
        if recovered:
            value = recovered
        else:
            value = value.replace("_", " ").strip()
            value = re.sub(
                r"^(tells|name|is|my)\s+", "", value, flags=re.IGNORECASE
            ).strip()
            if value:
                value = value.title()

    if key == "user_name":
        recovered = _extract_name_from_garbage(value)
        if recovered:
            value = recovered

    if category not in VALID_CATEGORIES:
        category = "fact"

    if not key or not value:
        return None

    return {"key": key, "value": value, "category": category}


def _humanize_key(key: str) -> str:
    words = key.replace("_", " ").strip()
    return words[0].upper() + words[1:] if words else words


_BOOL_TRUE = {"true", "yes", "1"}
_BOOL_FALSE = {"false", "no", "0"}


def _as_bool(value: str) -> bool | None:
    v = value.strip().lower()
    if v in _BOOL_TRUE:
        return True
    if v in _BOOL_FALSE:
        return False
    return None


def _memory_to_sentence(m: dict) -> str:
    key = m["key"]
    value = m["value"]
    lower_key = key.lower()
    bool_val = _as_bool(value)

    if lower_key == "user_name":
        return f"Their name is {value}."

    if lower_key == "job_title":
        return f"Their job title is {value}."

    if bool_val is not None and (lower_key.startswith("prefers_") or lower_key.startswith("likes_")):
        prefix = "prefers_" if lower_key.startswith("prefers_") else "likes_"
        thing = key[len(prefix):].replace("_", " ").strip()
        verb = "prefers" if prefix == "prefers_" else "likes"
        if bool_val:
            return f"They {verb} {thing}."
        return f"They do NOT {verb} {thing}."

    if bool_val is not None and lower_key.startswith("works_"):
        habit = key[len("works_"):].replace("_", " ").strip()
        if bool_val:
            return f"They work {habit}."
        return f"They do not work {habit}."

    if bool_val is not None:
        cleaned = key.replace("_", " ").strip()
        if bool_val:
            return f"They {cleaned}."
        return f"They do NOT {cleaned}."

    cleaned = key.replace("_", " ").strip()
    return f"Their {cleaned} is {value}."


async def extract_memories(conversation: list[dict], ollama_client) -> list[dict]:
    if not conversation:
        return []

    convo_text = "\n".join(
        f"{turn.get('role', 'user')}: {turn.get('content', '')}"
        for turn in conversation
        if turn.get("content")
    )
    if not convo_text.strip():
        return []

    prompt = EXTRACTION_PROMPT.format(conversation=convo_text)

    raw = await ollama_client.chat(
        [{"role": "user", "content": prompt}],
        options={"num_predict": 300, "temperature": 0},
    )

    raw = _strip_code_fences(raw)

    parsed = _extract_json_array(raw)
    if parsed is None:
        return []

    cleaned: list[dict] = []
    seen_keys: set[str] = set()
    for item in parsed:
        fixed = _clean_memory_item(item)
        if fixed is None:
            continue
        if fixed["key"] in seen_keys:
            continue
        seen_keys.add(fixed["key"])
        cleaned.append(fixed)

    return cleaned


def _extract_json_array(text: str):
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        return None
    return None


def get_relevant_memories(query: str = "", limit: int = 10) -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        if query:
            like = f"%{query}%"
            cur.execute(
                """
                SELECT id, key, value, category, updated_at
                FROM memories
                WHERE key LIKE ? OR value LIKE ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (like, like, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, key, value, category, updated_at
                FROM memories
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (limit,),
            )
        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def inject_memories_into_system_prompt(memories: list[dict]) -> str:
    if not memories:
        return (
            "You are meeting this user for the first time. You don't know "
            "anything about them yet. Be friendly and curious — feel free to "
            "ask about them naturally as the conversation goes on. If they "
            "ask what you know about them, just say you don't know much yet "
            "and ask them to tell you a bit about themselves."
        )

    sentences = "\n".join(f"- {_memory_to_sentence(m)}" for m in memories)

    return (
        "You know the following about the user from previous conversations:\n"
        f"{sentences}\n\n"
        "Use these naturally in conversation, the way a friend who remembers "
        "things about you would — don't recite them like a list unless asked. "
        "Only state personal details that are listed above; don't invent or "
        "guess anything else about the user.\n\n"
        "CRITICAL: If the user asks about something you don't know, respond "
        "naturally and just ask them to tell you. NEVER say things like "
        "\"MEMORY STATE\", \"database\", \"facts not found\", \"not in my "
        "records\", or any other technical/system language. You are a "
        "friendly assistant having a conversation, not a computer system "
        "reporting on its own internals."
    )


def save_memories(memories: list[dict]) -> None:
    if not memories:
        return
    conn = get_connection()
    try:
        cur = conn.cursor()
        for m in memories:
            key = m.get("key")
            value = m.get("value")
            category = m.get("category", "fact")
            if not key or not value:
                continue
            cur.execute(
                """
                INSERT INTO memories (key, value, category, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    category = excluded.category,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (key, value, category),
            )
        conn.commit()
    finally:
        conn.close()


def get_all_memories() -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, key, value, category, updated_at FROM memories ORDER BY updated_at DESC"
        )
        return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def delete_memory(memory_id: int) -> bool:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def clear_all_memories() -> int:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM memories")
        count = cur.fetchone()[0]
        cur.execute("DELETE FROM memories")
        conn.commit()
        return count
    finally:
        conn.close()