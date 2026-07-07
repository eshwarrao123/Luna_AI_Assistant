# /backend/tools.py
import os
import sys
import subprocess
import logging
from pathlib import Path

log = logging.getLogger("luna.tools")

TOOLS = {
    "open_app": {
        "description": "Open an installed application",
        "params": {"name": "string"},
    },
    "open_folder": {
        "description": "Open a folder in file explorer",
        "params": {"path": "string"},
    },
    "create_note": {
        "description": "Create a text note",
        "params": {"title": "string", "content": "string"},
    },
    "search_files": {
        "description": "Search for files by name",
        "params": {"query": "string", "directory": "string"},
    },
    "create_reminder": {
        "description": "Create a reminder",
        "params": {"text": "string", "time": "string"},
    },
}

NOTES_DIR = Path.home() / "LunaNotes"

# Common Windows app aliases → executable that `start` can resolve
_WIN_APP_ALIASES = {
    "code": "code", "vscode": "code",
    "notepad": "notepad", "calc": "calc", "calculator": "calc",
    "chrome": "chrome", "firefox": "firefox", "edge": "msedge",
    "explorer": "explorer", "cmd": "cmd", "powershell": "powershell",
    "paint": "mspaint", "mspaint": "mspaint", "spotify": "spotify",
}


def _expand(path_str: str) -> Path:
    """Expand ~, env vars, and common folder aliases (Windows-safe)."""
    if not path_str:
        return Path.home()
    raw = path_str.strip()
    key = raw.lower().strip("/\\ ")

    aliases = {
        "downloads": Path(os.path.expanduser("~")) / "Downloads",
        "documents": Path(os.path.expanduser("~")) / "Documents",
        "desktop": Path(os.path.expanduser("~")) / "Desktop",
        "pictures": Path(os.path.expanduser("~")) / "Pictures",
        "music": Path(os.path.expanduser("~")) / "Music",
        "videos": Path(os.path.expanduser("~")) / "Videos",
        "home": Path(os.path.expanduser("~")),
    }
    if key in aliases:
        return aliases[key]
    return Path(os.path.expandvars(os.path.expanduser(raw)))


def _open_app(name: str) -> dict:
    log.info("[tools] open_app: %r", name)
    if not name:
        return {"success": False, "message": "No application name provided"}
    try:
        if sys.platform.startswith("win"):
            resolved = _WIN_APP_ALIASES.get(name.lower().strip(), name)
            # `start` via shell resolves apps on PATH and App Paths registry
            subprocess.Popen(f'start "" "{resolved}"', shell=True)
            return {"success": True, "message": f"Opened application: {resolved}"}
        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-a", name])
        else:
            subprocess.Popen([name])
        return {"success": True, "message": f"Opened application: {name}"}
    except Exception as e:
        log.exception("[tools] open_app failed")
        return {"success": False, "message": f"Could not open app '{name}': {e}"}


def _open_folder(path: str) -> dict:
    log.info("[tools] open_folder: %r", path)
    try:
        folder = _expand(path)
        log.info("[tools] resolved folder path: %s", folder)
        if not folder.exists():
            return {"success": False, "message": f"Folder not found: {folder}"}
        if sys.platform.startswith("win"):
            os.startfile(str(folder))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(folder)])
        else:
            subprocess.Popen(["xdg-open", str(folder)])
        return {"success": True, "message": f"Opened folder: {folder}"}
    except Exception as e:
        log.exception("[tools] open_folder failed")
        return {"success": False, "message": f"Could not open folder: {e}"}


def _create_note(title: str, content: str) -> dict:
    log.info("[tools] create_note: title=%r", title)
    try:
        NOTES_DIR.mkdir(parents=True, exist_ok=True)
        safe_title = "".join(
            c for c in title if c.isalnum() or c in (" ", "-", "_")
        ).strip() or "untitled"
        note_path = NOTES_DIR / f"{safe_title}.txt"
        note_path.write_text(content or "", encoding="utf-8")
        return {"success": True, "message": f"Created note '{safe_title}.txt' at {note_path}"}
    except Exception as e:
        log.exception("[tools] create_note failed")
        return {"success": False, "message": f"Could not create note: {e}"}


def _search_files(query: str, directory: str) -> dict:
    log.info("[tools] search_files: query=%r dir=%r", query, directory)
    try:
        base = _expand(directory) if directory else Path.home()
        if not base.exists():
            return {"success": False, "message": f"Directory not found: {base}"}
        q = (query or "").lower()
        matches: list[str] = []
        for root, _dirs, files in os.walk(base):
            for f in files:
                if q in f.lower():
                    matches.append(str(Path(root) / f))
            if len(matches) >= 20:
                break
        if not matches:
            return {"success": True, "message": f"No files matching '{query}' found in {base}"}
        preview = "\n".join(matches[:20])
        return {"success": True, "message": f"Found {len(matches)} match(es) for '{query}':\n{preview}"}
    except Exception as e:
        log.exception("[tools] search_files failed")
        return {"success": False, "message": f"Search failed: {e}"}


def _create_reminder(text: str, time: str) -> dict:
    log.info("[tools] create_reminder: text=%r time=%r", text, time)
    label = f"{text} (at {time})" if time else text
    try:
        from plyer import notification
        notification.notify(title="Luna Reminder", message=label, timeout=10)
        return {"success": True, "message": f"Reminder set: {label}"}
    except Exception as e:
        print(f"[Luna reminder fallback] {label} ({e})")
        return {"success": True, "message": f"Reminder set (console): {label}"}


def execute_tool(tool_name: str, params: dict) -> dict:
    log.info("[tools] execute_tool called: tool=%s params=%s", tool_name, params)
    params = params or {}
    if tool_name not in TOOLS:
        return {"success": False, "message": f"Unknown tool: {tool_name}"}
    try:
        if tool_name == "open_app":
            result = _open_app(params.get("name", ""))
        elif tool_name == "open_folder":
            result = _open_folder(params.get("path", ""))
        elif tool_name == "create_note":
            result = _create_note(params.get("title", ""), params.get("content", ""))
        elif tool_name == "search_files":
            result = _search_files(params.get("query", ""), params.get("directory", ""))
        elif tool_name == "create_reminder":
            result = _create_reminder(params.get("text", ""), params.get("time", ""))
        else:
            result = {"success": False, "message": f"Tool '{tool_name}' has no handler"}
    except Exception as e:
        log.exception("[tools] execution error")
        result = {"success": False, "message": f"Execution error: {e}"}
    log.info("[tools] execute_tool result: %s", result)
    return result