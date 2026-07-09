# /backend/database.py
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "luna.db"

# Maps each tool/action_type to the user-facing permission category it belongs to.
# Used to derive "Granted Permissions" from activity_log without a separate table
# having to be kept in sync by hand for every new tool.
TOOL_PERMISSION_CATEGORY: dict[str, str] = {
    "search_files": "Files",
    "create_note": "Files",
    "file_upload": "Files",
    "open_app": "Apps",
    "open_music_player": "Music",
    "open_folder": "Files",
    "create_calendar_event": "Calendar",
    "open_browser": "Browser",
    "search_web": "Browser",
    "draft_email": "Email",
    "create_reminder": "Apps",
}


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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS granted_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT UNIQUE NOT NULL,
                granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

        cur.execute("PRAGMA table_info(activity_log)")
        act_cols = {row["name"] for row in cur.fetchall()}
        if "timestamp" not in act_cols:
            cur.execute(
                "ALTER TABLE activity_log ADD COLUMN timestamp TIMESTAMP DEFAULT NULL"
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


# ── Activity log ─────────────────────────────────────────────────────────────

def log_activity(action_type: str, description: str = "", status: str = "completed") -> None:
    """Record one row in activity_log. status is one of: allowed, denied, completed."""
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO activity_log (action_type, description, status) VALUES (?, ?, ?)",
            (action_type, description or "", status),
        )
        conn.commit()
    finally:
        conn.close()


def get_activity_log(limit: int = 50) -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, action_type, description, status, timestamp
            FROM activity_log
            ORDER BY COALESCE(timestamp, '1970-01-01') DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_activity_stats() -> dict:
    """Summary counts by status, useful for a stats strip in the dashboard."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT status, COUNT(*) as count FROM activity_log GROUP BY status"
        )
        by_status = {row["status"]: row["count"] for row in cur.fetchall()}
        cur.execute("SELECT COUNT(*) as count FROM activity_log")
        total = cur.fetchone()["count"]
        return {
            "total": total,
            "allowed": by_status.get("allowed", 0),
            "denied": by_status.get("denied", 0),
            "completed": by_status.get("completed", 0),
        }
    finally:
        conn.close()


# ── Granted permissions ──────────────────────────────────────────────────────

def grant_permission(category: str) -> None:
    """Record that a permission category has been granted at least once."""
    if not category:
        return
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO granted_permissions (category) VALUES (?) "
            "ON CONFLICT(category) DO NOTHING",
            (category,),
        )
        conn.commit()
    finally:
        conn.close()


def get_granted_permissions() -> list[dict]:
    """
    Returns granted permission categories, sourced from two places:
    1. The granted_permissions table (explicit grants recorded on 'Allow' clicks)
    2. Any action_type in activity_log with status='allowed', mapped through
       TOOL_PERMISSION_CATEGORY — this keeps the list correct even if a grant
       was recorded before this table existed, or if grant_permission() was
       missed for some code path.
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT category, granted_at FROM granted_permissions ORDER BY granted_at ASC"
        )
        explicit = {row["category"]: row["granted_at"] for row in cur.fetchall()}

        cur.execute(
            "SELECT DISTINCT action_type FROM activity_log WHERE status = 'allowed'"
        )
        for row in cur.fetchall():
            category = TOOL_PERMISSION_CATEGORY.get(row["action_type"])
            if category and category not in explicit:
                explicit[category] = None

        return [
            {"category": cat, "granted_at": ts}
            for cat, ts in sorted(explicit.items())
        ]
    finally:
        conn.close()