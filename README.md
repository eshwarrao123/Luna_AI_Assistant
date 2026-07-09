# Luna Desktop Assistant

A privacy-first AI assistant that runs entirely on your device. No cloud. No accounts. No data leaving your machine.

![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=flat&logo=electron&logoColor=9FEAF9)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)
![Ollama](https://img.shields.io/badge/Ollama-Local_AI-black?style=flat)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## Screenshots

| Chat Interface | Permission Dialog | Privacy Dashboard | Settings |
|---|---|---|---|
| `[screenshot]` | `[screenshot]` | `[screenshot]` | `[screenshot]` |

---

## Features

**Conversational memory** — Luna remembers facts about you across sessions and references them naturally in conversation, without sounding like a database readout.

**Desktop automation** — Open apps, folders, URLs, draft emails, create calendar events, and control your music player through plain English commands.

**Permission system** — Any action that affects your system requires your explicit approval through a clear, dismissible dialog. No silent background operations.

**Privacy dashboard** — A full view of everything Luna knows about you — stored memories, activity history, and granted permissions — with the ability to delete any or all of it.

**AI personality modes** — Switch between Professional, Friendly, Concise, and Creative tones to match your working style.

**System tray integration** — Luna lives in your taskbar and opens instantly with `Ctrl+Shift+L` from anywhere on your desktop.

**Theme support** — Dark, light, and system-follow themes with a cohesive monochrome design system.

**Windows installer** — Distributed as a standard `.exe` setup file. No technical setup required for end users.

---

## Privacy

Luna is built on a single principle: **your data never leaves your machine.**

- The AI model runs locally via [Ollama](https://ollama.com). No API keys. No external inference servers.
- Conversation history and memory are stored in a local SQLite database under your user profile.
- Desktop automation actions require your approval before execution.
- There is no telemetry, no analytics, no crash reporting sent anywhere.
- Uninstalling Luna removes all associated data.

---

## Download

> _Installer will be available here once the first release is published._

`Luna-Setup-1.0.0.exe` — Windows 10 / 11 (64-bit)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Electron Shell                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              React Frontend (Vite)                │   │
│  │                                                   │   │
│  │   Chat UI  │  Settings  │  Privacy  │  Onboarding │   │
│  │                                                   │   │
│  │   Tailwind CSS  ·  TypeScript  ·  SSE streaming   │   │
│  └───────────────────────┬──────────────────────────┘   │
│                           │ HTTP + SSE (localhost:8000)  │
│  ┌────────────────────────▼────────────────────────┐    │
│  │              Python FastAPI Backend              │    │
│  │                                                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │    │
│  │  │  main.py │  │ tools.py │  │ memory_engine │  │    │
│  │  │  (chat,  │  │ (desktop │  │ (extract +    │  │    │
│  │  │  stream) │  │  actions)│  │  inject facts)│  │    │
│  │  └────┬─────┘  └──────────┘  └───────┬───────┘  │    │
│  │       │                               │          │    │
│  │  ┌────▼───────────────────────────────▼──────┐  │    │
│  │  │              SQLite Database               │  │    │
│  │  │    conversations · memories · settings     │  │    │
│  │  └────────────────────────────────────────────┘  │    │
│  │                                                  │    │
│  │  ┌──────────────────────────────────────────┐   │    │
│  │  │           Ollama  (local LLM)            │   │    │
│  │  │         qwen2.5:7b  ·  localhost:11434   │   │    │
│  │  └──────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Data flow for a chat message:**

1. User types a message in the React UI.
2. Frontend sends a POST request to `/chat/stream` and opens an SSE stream.
3. FastAPI classifies the intent (conversation vs. automation).
4. If automation: a permission event is streamed back; user approves or denies in the dialog.
5. If conversation: relevant memories are injected into the system prompt, then the request is forwarded to Ollama.
6. Ollama streams tokens back through FastAPI to the frontend in real time.
7. After the turn, the conversation is analysed and any new facts are extracted and saved to memory.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 28 |
| Frontend framework | React 19 + TypeScript |
| Styling | Tailwind CSS 3 |
| Build tool | Vite 5 |
| Backend | Python 3.10+ · FastAPI · Uvicorn |
| Database | SQLite (via Python `sqlite3`) |
| Local AI | Ollama (`qwen2.5:7b` default) |
| Packaging | electron-builder · NSIS installer |

---

## Quick Start (Development)

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Python](https://python.org/) 3.10 or later
- [Ollama](https://ollama.com/) installed and running
- The `qwen2.5:7b` model pulled:
  ```bash
  ollama pull qwen2.5:7b
  ```

### 1. Clone the repository

```bash
git clone https://github.com/eshwarrao123/Luna_AI_Assistant
cd luna-desktop
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd backend

# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
cd ..
```

### 4. Start the backend

```bash
cd backend
.venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 5. Start the Electron app (in a new terminal)

```bash
npm run dev
```

Luna will open. Press `Ctrl+Shift+L` at any time to bring it to focus.

---

## Building the Windows Installer

```bash
# 1. Build the React frontend
npm run build:frontend

# 2. Compile the Electron main process TypeScript
npm run build:electron

# 3. Package as .exe installer + portable executable
npm run dist:win
```

Output is written to the `release/` folder:
- `Luna Setup 1.0.0.exe` — Standard NSIS installer
- `Luna 1.0.0.exe` — Standalone portable executable (no install required)

---

## Project Structure

```
luna/
├── electron/
│   ├── main.ts              # Main process: window, tray, IPC, backend lifecycle
│   ├── preload.ts           # Context bridge (safe APIs exposed to renderer)
│   └── electron.d.ts        # Type declarations for Electron IPC APIs
│
├── frontend/
│   ├── index.html           # App entry point HTML
│   ├── vite.config.ts       # Vite build config (base './' for Electron file://)
│   └── src/
│       ├── App.tsx           # Root component — view routing (chat/privacy/settings)
│       ├── main.tsx          # React entry point
│       ├── index.css         # Global styles + Tailwind + design tokens
│       ├── components/
│       │   ├── Onboarding.tsx       # First-launch welcome + user setup screen
│       │   ├── ChatMessage.tsx      # Single message bubble (user / assistant)
│       │   ├── MessageInput.tsx     # Chat input bar (text + file attachment)
│       │   ├── MemoryBadge.tsx      # "Used N memories" badge on assistant replies
│       │   ├── ActionCard.tsx       # Card shown when a desktop tool executes
│       │   ├── PermissionDialog.tsx # Approval dialog before any OS action
│       │   ├── PrivacyDashboard.tsx # Memory list, activity history, permissions
│       │   ├── Settings.tsx         # Theme / personality / model settings
│       │   └── Sidebar.tsx          # Left nav (New Chat, Privacy, Settings)
│       └── hooks/
│           ├── useChat.ts       # SSE streaming, session management, memory badges
│           └── useSettings.ts   # Settings state (name, theme, personality)
│
├── backend/
│   ├── main.py              # FastAPI app — all routes (/chat/stream, /memories, …)
│   ├── database.py          # SQLite schema init and query helpers
│   ├── memory_engine.py     # Memory extraction, storage, injection, CRUD
│   ├── intent.py            # Classifies user message as chat or desktop action
│   ├── tools.py             # Executes desktop actions (apps, folders, browser, …)
│   ├── ollama_client.py     # HTTP client for Ollama (streaming + single-shot)
│   ├── settings.py          # User settings persistence endpoints
│   ├── file_handler.py      # Handles uploaded file saving from the UI
│   ├── file_processor.py    # Reads and summarises file contents for the LLM
│   └── requirements.txt     # Python dependencies
│
├── package.json             # Root: scripts, electron-builder config
├── tsconfig.json            # TypeScript config (React renderer)
├── tsconfig.electron.json   # TypeScript config (Electron main process)
├── tailwind.config.js       # Tailwind configuration
├── postcss.config.js        # PostCSS configuration
└── .gitignore
```

---

## Configuration

Luna's settings are stored in SQLite and accessible through the Settings panel in the app. There are no configuration files to edit manually.

| Setting | Default | Description |
|---|---|---|
| AI model | `qwen2.5:7b` | Any model available in your local Ollama installation |
| Personality | Friendly | Professional · Friendly · Concise · Creative |
| Theme | Dark | Dark · Light · System |
| Global shortcut | `Ctrl+Shift+L` | Bring Luna to focus from anywhere on your desktop |

---

## Supported Automation Actions

| Category | Examples |
|---|---|
| Applications | "Open WhatsApp", "Launch Spotify", "Start Chrome" |
| Folders | "Open Downloads", "Open Desktop", "Open Documents" |
| Browser | "Open YouTube", "Search for React hooks tutorial" |
| Email | "Draft an email to Sarah about the meeting" |
| Calendar | "Create an event for Friday at 3pm" |
| Music | "Play something", "Pause music", "Next track" |

All actions display a permission dialog before execution. Users can allow an action once or remember the decision for future requests.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a pull request.

Please open an issue before starting significant work so the approach can be discussed first.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*Luna runs on your machine. It always will.*
