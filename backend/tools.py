import os
import sys
import subprocess
from pathlib import Path

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


def _get_shell_folder(folder_name: str) -> Path | None:
    """Use Windows Shell COM to resolve known folder paths (handles redirection)."""
    if not sys.platform.startswith("win"):
        return None
    shell_map = {
        "downloads": "shell:Downloads",
        "documents": "shell:Personal",
        "desktop": "shell:Desktop",
        "pictures": "shell:My Pictures",
        "music": "shell:My Music",
        "videos": "shell:My Video",
    }
    shell_key = shell_map.get(folder_name.lower())
    if not shell_key:
        return None
    try:
        import subprocess as _sp
        result = _sp.run(
            ["powershell", "-NoProfile", "-Command",
             f"(New-Object -ComObject Shell.Application).NameSpace('{shell_key}').Self.Path"],
            capture_output=True, text=True, timeout=5,
        )
        resolved = result.stdout.strip()
        if resolved and Path(resolved).exists():
            return Path(resolved)
    except Exception:
        pass
    return None


def _expand(path_str: str) -> Path:
    """Expand ~, environment vars, and common folder aliases."""
    if not path_str:
        return Path.home()
    raw = path_str.strip()
    key = raw.lower().strip("/\\ ")

    # Try Windows Shell resolution first (handles redirected folders)
    shell_path = _get_shell_folder(key)
    if shell_path:
        return shell_path

    # Fallback to home-relative aliases
    aliases = {
        "downloads": Path.home() / "Downloads",
        "documents": Path.home() / "Documents",
        "desktop": Path.home() / "Desktop",
        "home": Path.home(),
        "pictures": Path.home() / "Pictures",
        "music": Path.home() / "Music",
    }
    if key in aliases:
        return aliases[key]
    return Path(os.path.expandvars(os.path.expanduser(raw)))


def _open_path(target: str) -> None:
    """Open a file/folder/app path with the OS default handler."""
    if sys.platform.startswith("win"):
        os.startfile(target)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", target])
    else:
        subprocess.Popen(["xdg-open", target])


def _open_app(name: str) -> dict:
    try:
        if sys.platform.startswith("win"):
            subprocess.Popen(["cmd", "/c", "start", "", name], shell=False)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-a", name])
        else:
            subprocess.Popen([name])
        return {"success": True, "message": f"Opened application: {name}"}
    except Exception as e:  # noqa: BLE001
        return {"success": False, "message": f"Could not open app '{name}': {e}"}


def _open_folder(path: str) -> dict:
    try:
        folder = _expand(path)
        if not folder.exists():
            return {"success": False, "message": f"Folder not found: {folder}"}
        _open_path(str(folder))
        return {"success": True, "message": f"Opened folder: {folder}"}
    except Exception as e:  # noqa: BLE001
        return {"success": False, "message": f"Could not open folder: {e}"}


def _create_note(title: str, content: str) -> dict:
    try:
        NOTES_DIR.mkdir(parents=True, exist_ok=True)
        safe_title = "".join(
            c for c in title if c.isalnum() or c in (" ", "-", "_")
        ).strip() or "untitled"
        note_path = NOTES_DIR / f"{safe_title}.txt"
        note_path.write_text(content or "", encoding="utf-8")
        return {
            "success": True,
            "message": f"Created note '{safe_title}.txt' at {note_path}",
        }
    except Exception as e:  # noqa: BLE001
        return {"success": False, "message": f"Could not create note: {e}"}


def _search_files(query: str, directory: str) -> dict:
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
            return {
                "success": True,
                "message": f"No files matching '{query}' found in {base}",
            }
        preview = "\n".join(matches[:20])
        return {
            "success": True,
            "message": f"Found {len(matches)} match(es) for '{query}':\n{preview}",
        }
    except Exception as e:  # noqa: BLE001
        return {"success": False, "message": f"Search failed: {e}"}


def _create_reminder(text: str, time: str) -> dict:
    label = f"{text} (at {time})" if time else text
    try:
        # pyrefly: ignore [missing-import]
        from plyer import notification

        notification.notify(
            title="Luna Reminder",
            message=label,
            timeout=10,
        )
        return {"success": True, "message": f"Reminder set: {label}"}
    except Exception as e:  # noqa: BLE001
        print(f"[Luna reminder fallback] {label} ({e})")
        return {"success": True, "message": f"Reminder set (console): {label}"}


def execute_tool(tool_name: str, params: dict) -> dict:
    """Dispatch a tool call. Returns {'success': bool, 'message': str}."""
    params = params or {}
    if tool_name not in TOOLS:
        return {"success": False, "message": f"Unknown tool: {tool_name}"}

    try:
        if tool_name == "open_app":
            return _open_app(params.get("name", ""))
        if tool_name == "open_folder":
            return _open_folder(params.get("path", ""))
        if tool_name == "create_note":
            return _create_note(params.get("title", ""), params.get("content", ""))
        if tool_name == "search_files":
            return _search_files(params.get("query", ""), params.get("directory", ""))
        if tool_name == "create_reminder":
            return _create_reminder(params.get("text", ""), params.get("time", ""))
    except Exception as e:  # noqa: BLE001
        return {"success": False, "message": f"Execution error: {e}"}

    return {"success": False, "message": f"Tool '{tool_name}' has no handler"}
