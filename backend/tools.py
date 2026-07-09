# /backend/tools.py
import glob
import os
import sys
import subprocess
import logging
import webbrowser
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from database import log_activity

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
    "open_browser": {
        "description": "Open a URL in the default web browser",
        "params": {"url": "string"},
    },
    "create_calendar_event": {
        "description": "Create a calendar event (.ics file)",
        "params": {"title": "string", "date": "string", "time": "string"},
    },
    "draft_email": {
        "description": "Open a draft email in the default email client",
        "params": {"to": "string", "subject": "string", "body": "string"},
    },
    "open_music_player": {
        "description": "Open a music player application",
        "params": {"app_name": "string"},
    },
    "search_web": {
        "description": "Search the web via Google",
        "params": {"query": "string"},
    },
}

NOTES_DIR = Path.home() / "LunaNotes"
CALENDAR_DIR = Path.home() / "LunaCalendar"

# lowercase user input → proper Windows display name used by `start` command
COMMON_APPS: dict[str, str] = {
    "whatsapp": "WhatsApp",
    "telegram": "Telegram",
    "telegram desktop": "Telegram",
    "discord": "Discord",
    "slack": "Slack",
    "spotify": "Spotify",
    "zoom": "Zoom",
    "notion": "Notion",
    "obsidian": "Obsidian",
    "chrome": "chrome",
    "google chrome": "chrome",
    "firefox": "firefox",
    "edge": "msedge",
    "microsoft edge": "msedge",
    "notepad": "notepad",
    "calculator": "calc",
    "calc": "calc",
    "paint": "mspaint",
    "mspaint": "mspaint",
    "explorer": "explorer",
    "file explorer": "explorer",
    "cmd": "cmd",
    "command prompt": "cmd",
    "terminal": "wt",
    "windows terminal": "wt",
    "powershell": "powershell",
    "task manager": "taskmgr",
    "settings": "ms-settings:",
    "vscode": "code",
    "vs code": "code",
    "visual studio code": "code",
    "cursor": "Cursor",
    "teams": "Teams",
    "microsoft teams": "Teams",
    "outlook": "outlook",
    "word": "winword",
    "excel": "excel",
    "powerpoint": "powerpnt",
    "steam": "steam",
    "epic games": "EpicGamesLauncher",
    "itunes": "iTunes",
    "music": "ms-settings:music",
}

# Folder aliases → subfolder name under home
COMMON_FOLDERS: dict[str, str] = {
    "downloads": "Downloads",
    "documents": "Documents",
    "desktop": "Desktop",
    "pictures": "Pictures",
    "photos": "Pictures",
    "videos": "Videos",
    "music": "Music",
    "home": "",
}

# URI-scheme apps handled via os.startfile
_URI_SCHEMES = {"ms-settings:", "ms-settings:music"}


def resolve_app_name(name: str) -> str:
    """Map a user-given name to the proper Windows display name."""
    return COMMON_APPS.get(name.lower().strip(), name)


def _win_dirs() -> dict[str, Path]:
    home = Path.home()
    return {
        "la": Path(os.environ.get("LOCALAPPDATA") or str(home / "AppData" / "Local")),
        "ra": Path(os.environ.get("APPDATA") or str(home / "AppData" / "Roaming")),
        "pf": Path(os.environ.get("PROGRAMFILES") or "C:/Program Files"),
        "pf86": Path(os.environ.get("PROGRAMFILES(X86)") or "C:/Program Files (x86)"),
    }


def _find_win_exe(lower_key: str) -> Path | None:
    """Search disk + registry for a known app executable. Uses lowercase key."""
    d = _win_dirs()
    la, ra, pf, pf86 = d["la"], d["ra"], d["pf"], d["pf86"]

    candidates: dict[str, list[str]] = {
        "whatsapp": [str(la / "WhatsApp" / "WhatsApp.exe")],
        "telegram": [
            str(ra / "Telegram Desktop" / "Telegram.exe"),
            str(la / "Telegram Desktop" / "Telegram.exe"),
        ],
        "spotify": [
            str(ra / "Spotify" / "Spotify.exe"),
            str(la / "Spotify" / "Spotify.exe"),
        ],
        "chrome": [
            str(pf / "Google" / "Chrome" / "Application" / "chrome.exe"),
            str(pf86 / "Google" / "Chrome" / "Application" / "chrome.exe"),
            str(la / "Google" / "Chrome" / "Application" / "chrome.exe"),
        ],
        "discord": [str(la / "Discord" / "app-*" / "Discord.exe")],  # glob
        "slack": [
            str(la / "slack" / "slack.exe"),
            str(pf / "Slack" / "slack.exe"),
        ],
        "zoom": [
            str(la / "Programs" / "Zoom" / "bin" / "Zoom.exe"),
            str(pf / "Zoom" / "bin" / "Zoom.exe"),
        ],
        "notion": [
            str(la / "Programs" / "Notion.exe"),
            str(la / "Programs" / "notion" / "Notion.exe"),
        ],
        "obsidian": [
            str(la / "Programs" / "obsidian" / "Obsidian.exe"),
            str(la / "Obsidian.exe"),
        ],
        "cursor": [
            str(la / "Programs" / "cursor" / "Cursor.exe"),
            str(la / "cursor" / "Cursor.exe"),
            str(la / "Programs" / "Cursor" / "Cursor.exe"),
        ],
        "teams": [
            str(la / "Microsoft" / "Teams" / "current" / "Teams.exe"),
            str(la / "Microsoft" / "MSTeams" / "MSTeams.exe"),
        ],
        "msedge": [
            str(pf / "Microsoft" / "Edge" / "Application" / "msedge.exe"),
            str(pf86 / "Microsoft" / "Edge" / "Application" / "msedge.exe"),
        ],
        "firefox": [
            str(pf / "Mozilla Firefox" / "firefox.exe"),
            str(pf86 / "Mozilla Firefox" / "firefox.exe"),
        ],
        "steam": [
            str(pf / "Steam" / "steam.exe"),
            str(pf86 / "Steam" / "steam.exe"),
        ],
    }

    for pattern in candidates.get(lower_key, []):
        if "*" in pattern:
            matches = sorted(glob.glob(pattern))
            if matches:
                log.info("[tools] glob match: %s", matches[-1])
                return Path(matches[-1])
        else:
            p = Path(pattern)
            if p.exists():
                log.info("[tools] direct path match: %s", p)
                return p

    # Registry App Paths (catches code, notepad, calc, etc.)
    try:
        import winreg
        for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            try:
                reg_key = winreg.OpenKey(
                    hive,
                    f"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{lower_key}.exe",
                )
                exe_path, _ = winreg.QueryValueEx(reg_key, "")
                winreg.CloseKey(reg_key)
                p = Path(exe_path)
                if p.exists():
                    log.info("[tools] registry match: %s", p)
                    return p
            except OSError:
                pass
    except ImportError:
        pass

    return None


def _expand(path_str: str) -> Path:
    """Expand ~, env vars, and common folder aliases."""
    if not path_str:
        return Path.home()
    raw = path_str.strip()
    key = raw.lower().strip("/\\ ")

    if key in COMMON_FOLDERS:
        sub = COMMON_FOLDERS[key]
        return Path.home() / sub if sub else Path.home()

    return Path(os.path.expandvars(os.path.expanduser(raw)))


def _is_installed(lower_key: str) -> bool:
    """Best-effort check for whether a known app can be found on disk/registry."""
    if sys.platform.startswith("win"):
        return _find_win_exe(lower_key) is not None
    # Non-Windows: we can't easily verify; assume available and let the OS fail if not.
    return True


def _open_app(name: str) -> dict:
    log.info("[tools] open_app: %r", name)
    if not name:
        return {"success": False, "message": "No application name provided."}

    try:
        if sys.platform.startswith("win"):
            lower = name.lower().strip()
            # Proper-case display name for `start` (e.g. "WhatsApp", not "whatsapp")
            display = resolve_app_name(name)
            log.info("[tools] display name: %r", display)

            # URI scheme (ms-settings: etc.)
            if display in _URI_SCHEMES or display.endswith(":"):
                os.startfile(display)  # type: ignore[attr-defined]
                return {"success": True, "message": f"Opened {name}."}

            # Strategy 1 — find exe on disk and launch directly (most reliable)
            exe = _find_win_exe(lower)
            if exe:
                log.info("[tools] launching exe directly: %s", exe)
                subprocess.Popen(
                    [str(exe)],
                    creationflags=subprocess.DETACHED_PROCESS,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return {"success": True, "message": f"Opened {name}."}

            # Strategy 2 — `start` via cmd with CREATE_NO_WINDOW so no dialog appears
            log.info("[tools] using start command with display name: %s", display)
            subprocess.Popen(
                ["cmd", "/c", "start", "", display],
                creationflags=subprocess.CREATE_NO_WINDOW,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return {"success": True, "message": f"Opened {name}."}

        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-a", name])
            return {"success": True, "message": f"Opened {name}."}
        else:
            subprocess.Popen([name])
            return {"success": True, "message": f"Opened {name}."}

    except Exception as e:
        log.exception("[tools] open_app failed")
        return {
            "success": False,
            "message": f"Could not open {name}. Make sure it's installed.",
        }


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
        safe_title = (
            "".join(c for c in title if c.isalnum() or c in (" ", "-", "_")).strip()
            or "untitled"
        )
        note_path = NOTES_DIR / f"{safe_title}.txt"
        note_path.write_text(content or "", encoding="utf-8")
        return {
            "success": True,
            "message": f"Created note '{safe_title}.txt' at {note_path}",
        }
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
            return {
                "success": True,
                "message": f"No files matching '{query}' found in {base}",
            }
        preview = "\n".join(matches[:20])
        return {
            "success": True,
            "message": f"Found {len(matches)} match(es) for '{query}':\n{preview}",
        }
    except Exception as e:
        log.exception("[tools] search_files failed")
        return {"success": False, "message": f"Search failed: {e}"}


def _create_reminder(text: str, time: str) -> dict:
    log.info("[tools] create_reminder: text=%r time=%r", text, time)
    label = f"{text} (at {time})" if time else text
    try:
        # pyrefly: ignore [import-not-found, missing-import]
        from plyer import notification
        notification.notify(title="Luna Reminder", message=label, timeout=10)
        return {"success": True, "message": f"Reminder set: {label}"}
    except Exception as e:
        print(f"[Luna reminder fallback] {label} ({e})")
        return {"success": True, "message": f"Reminder set (console): {label}"}


def _open_browser(url: str | None) -> dict:
    log.info("[tools] open_browser: url=%r", url)
    try:
        target = (url or "").strip()
        if not target:
            target = "https://www.google.com"
        elif not re_has_scheme(target):
            target = f"https://{target}"

        opened = webbrowser.open(target)
        if not opened and sys.platform.startswith("win"):
            os.startfile(target)  # type: ignore[attr-defined]

        return {"success": True, "message": f"Opened browser: {target}"}
    except Exception as e:
        log.exception("[tools] open_browser failed")
        return {"success": False, "message": f"Could not open browser: {e}"}


def re_has_scheme(url: str) -> bool:
    return "://" in url


def _create_calendar_event(title: str, date: str | None, time: str | None) -> dict:
    log.info("[tools] create_calendar_event: title=%r date=%r time=%r", title, date, time)
    try:
        safe_title = (
            "".join(c for c in (title or "") if c.isalnum() or c in (" ", "-", "_")).strip()
            or "Untitled Event"
        )

        if date:
            date_clean = date.strip().replace("-", "").replace("/", "")
        else:
            date_clean = (datetime.now() + timedelta(days=1)).strftime("%Y%m%d")

        if time:
            time_clean = time.strip().replace(":", "").upper()
            time_clean = time_clean.replace("AM", "").replace("PM", "").strip()
            if len(time_clean) == 4:
                time_clean += "00"
            elif len(time_clean) != 6:
                time_clean = "090000"
            date_time = f"{date_clean}T{time_clean}"
        else:
            date_time = date_clean

        ics_content = (
            "BEGIN:VCALENDAR\r\n"
            "VERSION:2.0\r\n"
            "PRODID:-//Luna//EN\r\n"
            "BEGIN:VEVENT\r\n"
            f"SUMMARY:{safe_title}\r\n"
            f"DTSTART:{date_time}\r\n"
            "END:VEVENT\r\n"
            "END:VCALENDAR\r\n"
        )

        CALENDAR_DIR.mkdir(parents=True, exist_ok=True)
        ics_path = CALENDAR_DIR / f"{safe_title}.ics"
        ics_path.write_text(ics_content, encoding="utf-8")

        try:
            if sys.platform.startswith("win"):
                os.startfile(str(ics_path))  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(ics_path)])
            else:
                subprocess.Popen(["xdg-open", str(ics_path)])
        except Exception:
            log.exception("[tools] could not auto-open .ics file")

        return {"success": True, "message": f"Created calendar event: {safe_title}"}
    except Exception as e:
        log.exception("[tools] create_calendar_event failed")
        return {"success": False, "message": f"Could not create calendar event: {e}"}


def _draft_email(to: str | None, subject: str | None, body: str | None) -> dict:
    log.info("[tools] draft_email: to=%r subject=%r body=%r", to, subject, body)
    try:
        params = {}
        if subject:
            params["subject"] = subject
        if body:
            params["body"] = body

        query = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
        mailto = f"mailto:{to or ''}"
        if query:
            mailto += f"?{query}"

        opened = webbrowser.open(mailto)
        if not opened and sys.platform.startswith("win"):
            os.startfile(mailto)  # type: ignore[attr-defined]

        return {"success": True, "message": "Opened email draft"}
    except Exception as e:
        log.exception("[tools] draft_email failed")
        return {"success": False, "message": f"Could not open email draft: {e}"}


def _open_music_player(app_name: str | None) -> dict:
    log.info("[tools] open_music_player: app_name=%r", app_name)
    try:
        chosen = (app_name or "").strip()

        if not chosen:
            if sys.platform.startswith("win") and _is_installed("spotify"):
                chosen = "spotify"
            elif sys.platform.startswith("win"):
                chosen = "Windows Media Player"
            else:
                chosen = "spotify"

        result = _open_app(chosen)
        if result.get("success"):
            return {"success": True, "message": f"Opened music player: {chosen}"}
        return {
            "success": False,
            "message": f"Could not open music player: {chosen}. Make sure it's installed.",
        }
    except Exception as e:
        log.exception("[tools] open_music_player failed")
        return {"success": False, "message": f"Could not open music player: {e}"}


def _search_web(query: str) -> dict:
    log.info("[tools] search_web: query=%r", query)
    try:
        q = (query or "").strip()
        if not q:
            return {"success": False, "message": "No search query provided."}
        search_url = f"https://www.google.com/search?q={urllib.parse.quote(q)}"
        opened = webbrowser.open(search_url)
        if not opened and sys.platform.startswith("win"):
            os.startfile(search_url)  # type: ignore[attr-defined]
        return {"success": True, "message": f"Searched: {q}"}
    except Exception as e:
        log.exception("[tools] search_web failed")
        return {"success": False, "message": f"Could not search: {e}"}


def execute_tool(tool_name: str, params: dict) -> dict:
    log.info("[tools] execute_tool: tool=%s params=%s", tool_name, params)
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
        elif tool_name == "open_browser":
            result = _open_browser(params.get("url"))
        elif tool_name == "create_calendar_event":
            result = _create_calendar_event(
                params.get("title", ""), params.get("date"), params.get("time")
            )
        elif tool_name == "draft_email":
            result = _draft_email(
                params.get("to"), params.get("subject"), params.get("body")
            )
        elif tool_name == "open_music_player":
            result = _open_music_player(params.get("app_name"))
        elif tool_name == "search_web":
            result = _search_web(params.get("query", ""))
        else:
            result = {"success": False, "message": f"Tool '{tool_name}' has no handler"}
    except Exception as e:
        log.exception("[tools] execution error")
        result = {"success": False, "message": f"Execution error: {e}"}

    # Every call into execute_tool() means the user already approved this
    # action (denials are intercepted earlier in main.py and never reach
    # here), so a successful result logs as "allowed". A raised/caught
    # execution error still logs as "allowed" (permission was granted —
    # the tool itself just failed), so status here reflects permission
    # state, not success/failure of the OS call.
    try:
        log_activity(
            action_type=tool_name,
            description=result.get("message", "")[:200],
            status="allowed",
        )
    except Exception:
        log.exception("[tools] failed to log activity")

    log.info("[tools] result: %s", result)
    return result