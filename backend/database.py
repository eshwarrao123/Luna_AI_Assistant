# /backend/database.py
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "luna.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE,
                value TEXT,
                category TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)

        # ── Migrations ────────────────────────────────────────────────────────
        # SQLite ALTER TABLE ADD COLUMN only accepts constant defaults,
        # so use DEFAULT NULL for both migrations; existing rows get NULL,
        # new rows use the CURRENT_TIMESTAMP in the CREATE TABLE definition.

        cur.execute("PRAGMA table_info(conversations)")
        conv_cols = {row["name"] for row in cur.fetchall()}
        if "created_at" not in conv_cols:
            cur.execute(
                "ALTER TABLE conversations ADD COLUMN created_at TIMESTAMP DEFAULT NULL"
            )

        cur.execute("PRAGMA table_info(memories)")
        mem_cols = {row["name"] for row in cur.fetchall()}
        if "updated_at" not in mem_cols:
            cur.execute(
                "ALTER TABLE memories ADD COLUMN updated_at TIMESTAMP DEFAULT NULL"
            )

        conn.commit()
    finally:
        conn.close()


def save_message(session_id: str, role: str, content: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO conversations (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )
        conn.commit()
    finally:
        conn.close()


def get_recent_messages(session_id: str, limit: int = 10) -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        # Use rowid as fallback ordering when created_at is NULL (pre-migration rows)
        cur.execute(
            """
            SELECT role, content FROM conversations
            WHERE session_id = ?
            ORDER BY COALESCE(created_at, '1970-01-01') ASC, id ASC
            LIMIT ?
            """,
            (session_id, limit),
        )
        rows = cur.fetchall()
        # We fetched ASC already; reverse to get newest-N then re-reverse for display order
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_conversation(session_id: str, limit: int = 50) -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT role, content FROM conversations
            WHERE session_id = ?
            ORDER BY COALESCE(created_at, '1970-01-01') ASC, id ASC
            LIMIT ?
            """,
            (session_id, limit),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_last_messages(session_id: str, limit: int = 5) -> list[dict]:
    return get_conversation(session_id, limit=limit)


def get_setting(key: str, default: str | None = None) -> str | None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cur.fetchone()
        return row["value"] if row else default
    finally:
        conn.close()


def get_all_settings() -> dict[str, str]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT key, value FROM settings")
        return {row["key"]: row["value"] for row in cur.fetchall()}
    finally:
        conn.close()


def set_setting(key: str, value: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        conn.commit()
    finally:
        conn.close()


def set_settings(values: dict) -> None:
    if not values:
        return
    conn = get_connection()
    try:
        for key, value in values.items():
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, str(value)),
            )
        conn.commit()
    finally:
        conn.close()