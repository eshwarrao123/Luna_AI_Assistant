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

# Patterns that indicate a garbled/garbage key or value produced by a weak
# extraction pass, mapped to how they should be repaired.
_GARBAGE_KEY_NAME_PATTERN = re.compile(r"^(pref_|prefers_|preference_)?name$", re.IGNORECASE)
_GARBLED_NAME_VALUE_PATTERN = re.compile(
    r"(?:tells?_name_|name_is_|my_name_is_|called_)([a-zA-Z]+)", re.IGNORECASE
)
_SNAKE_TO_WORDS = re.compile(r"[_\-]+")


def _strip_code_fences(text: str) -> str:
    """Remove ```json / ``` fences (and any other language tag) from a response."""
    text = text.strip()
    text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def clean_memory_key(key: str) -> str:
    """Normalize a possibly-garbage extracted key into a clean, readable key."""
    if not key:
        return key

    raw = key.strip()

    # "pref_name", "prefers_name", "preference_name" -> "user_name"
    if _GARBAGE_KEY_NAME_PATTERN.match(raw):
        return "user_name"

    # Any key that starts with "pref_" but isn't a real preference toggle
    # (e.g. "pref_name_eshwar") and mentions "name" -> user_name
    if raw.lower().startswith("pref_") and "name" in raw.lower():
        return "user_name"

    # Garbled patterns like "tells_name_eshwar" that leaked into the key itself
    match = _GARBLED_NAME_VALUE_PATTERN.search(raw)
    if match:
        return "user_name"

    # Otherwise just normalize to clean snake_case
    words = [w for w in _SNAKE_TO_WORDS.split(raw.lower()) if w]
    return "_".join(words) if words else raw


def _extract_name_from_garbage(value: str) -> str | None:
    """Try to pull an actual name out of a garbled value like 'tells_name_eshwar'."""
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

    # If the key was repaired to user_name (from a garbage pref_/name pattern),
    # the value is likely garbled too — try to recover the real name from
    # either the value or the original key.
    if key == "user_name" and original_key != "user_name":
        recovered = _extract_name_from_garbage(value) or _extract_name_from_garbage(
            original_key
        )
        if recovered:
            value = recovered
        else:
            # Fall back to stripping obvious garbage tokens/underscores.
            value = value.replace("_", " ").strip()
            value = re.sub(
                r"^(tells|name|is|my)\s+", "", value, flags=re.IGNORECASE
            ).strip()
            if value:
                value = value.title()

    # Generic garbled-value repair even when the key itself was already clean
    # (e.g. key="user_name", value="tells_name_eshwar").
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


async def extract_memories(conversation: list[dict], ollama_client) -> list[dict]:
    """Extract structured facts about the user from recent conversation turns."""
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

    # Fall back to locating the first '[' ... last ']' span.
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
            "MEMORY STATE: You currently know NOTHING about this user. "
            "Do not invent, assume, or guess any personal details. "
            'If asked what you know, say exactly: "I don\'t know much about you yet. '
            'Tell me about yourself!"'
        )
    numbered = "\n".join(
        f"  {i + 1}. {_humanize_key(m['key'])}: {m['value']}"
        for i, m in enumerate(memories)
    )
    return (
        "MEMORY STATE: You have the following VERIFIED FACTS about this user "
        "from previous conversations. These are the ONLY personal details you "
        "are allowed to reference. You MUST NOT invent, infer, or hallucinate "
        "any additional personal information beyond this exact list.\n\n"
        f"Known facts ({len(memories)}):\n"
        f"{numbered}\n\n"
        "When asked what you know about the user, reference ONLY the items "
        "above, word-for-word. If a topic is not in the list, say you don't "
        "have information about that."
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