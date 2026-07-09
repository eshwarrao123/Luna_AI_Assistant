// /electron/main.ts
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  globalShortcut,
  nativeImage,
  screen,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import * as zlib from "zlib";
import * as child_process from "child_process";

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let backendProcess: child_process.ChildProcess | null = null;

// ─── Logging (writes to a file so you can debug packaged builds) ─────────────

const logPath = path.join(app.getPath("userData"), "luna-debug.log");
function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logPath, line);
  console.log(msg);
}

// ─── Path resolution (use this everywhere, not __dirname directly) ────────────

/**
 * In development:  __dirname = dist-electron/  (after tsc)
 * In production:   __dirname = resources/app/dist-electron/
 *
 * The frontend (vite build output) lands at:
 *   dev:  dist/index.html           (relative to project root)
 *   prod: resources/app/dist/index.html
 *
 * So "../dist/index.html" relative to dist-electron/ is correct in both cases.
 */
function getRendererPath(): string {
  return path.join(__dirname, "..", "dist", "index.html");
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

// ─── Backend: find Python ─────────────────────────────────────────────────────

/**
 * On Windows in a packaged app, PATH is often stripped or minimal.
 * We probe several known locations before giving up.
 */
function findPython(): string | null {
  const candidates: string[] = [];

  if (process.platform === "win32") {
    candidates.push(
      "python",
      "python3",
      // Windows Store Python
      path.join(
        process.env["LOCALAPPDATA"] ?? "C:\\Users\\Default\\AppData\\Local",
        "Programs",
        "Python",
        "Python311",
        "python.exe"
      ),
      path.join(
        process.env["LOCALAPPDATA"] ?? "C:\\Users\\Default\\AppData\\Local",
        "Programs",
        "Python",
        "Python310",
        "python.exe"
      ),
      path.join(
        process.env["LOCALAPPDATA"] ?? "C:\\Users\\Default\\AppData\\Local",
        "Programs",
        "Python",
        "Python312",
        "python.exe"
      ),
      // Miniconda / Anaconda in user home
      path.join(
        process.env["USERPROFILE"] ?? "C:\\Users\\Default",
        "miniconda3",
        "python.exe"
      ),
      path.join(
        process.env["USERPROFILE"] ?? "C:\\Users\\Default",
        "anaconda3",
        "python.exe"
      ),
      // Common system-wide installs
      "C:\\Python311\\python.exe",
      "C:\\Python310\\python.exe",
      "C:\\Python312\\python.exe",
    );
  } else {
    candidates.push("python3", "python", "/usr/bin/python3", "/usr/local/bin/python3");
  }

  for (const candidate of candidates) {
    try {
      child_process.execFileSync(candidate, ["--version"], {
        stdio: "pipe",
        timeout: 3000,
      });
      log(`[Backend] Found Python at: ${candidate}`);
      return candidate;
    } catch {
      // not found or not executable, try next
    }
  }

  return null;
}

// ─── Backend Startup ─────────────────────────────────────────────────────────

function startBackend(): void {
  const isPackaged = app.isPackaged;

  let backendPath: string;
  let cwd: string;

  if (isPackaged) {
    // process.resourcesPath = <install>/resources  (both NSIS and portable)
    backendPath = path.join(process.resourcesPath, "backend", "main.py");
    cwd = path.join(process.resourcesPath, "backend");
  } else {
    // Development: electron/main.ts → __dirname after tsc is dist-electron/
    // backend/ is at project root, two levels up from dist-electron/
    backendPath = path.join(__dirname, "..", "..", "backend", "main.py");
    cwd = path.join(__dirname, "..", "..", "backend");
  }

  log(`[Backend] isPackaged=${isPackaged}`);
  log(`[Backend] backendPath=${backendPath}`);
  log(`[Backend] cwd=${cwd}`);
  log(`[Backend] resourcesPath=${process.resourcesPath}`);

  // Verify the backend file actually exists before spawning
  if (!fs.existsSync(backendPath)) {
    const msg =
      `Luna could not find its backend at:\n${backendPath}\n\n` +
      `This is likely a build/packaging issue.\n` +
      `Debug log: ${logPath}`;
    log(`[Backend] ERROR: main.py not found at ${backendPath}`);
    dialog.showErrorBox("Luna – Backend Missing", msg);
    return;
  }

  const pythonCmd = findPython();

  if (!pythonCmd) {
    const msg =
      `Luna requires Python 3.10+ to be installed.\n\n` +
      `Please download it from https://python.org and ensure\n` +
      `"Add Python to PATH" is checked during installation.\n\n` +
      `Then restart Luna.\n\nDebug log: ${logPath}`;
    log("[Backend] ERROR: No Python found on this system");
    dialog.showErrorBox("Python Required", msg);
    // Still show the window — frontend will show a "backend offline" state
    return;
  }

  log(`[Backend] Spawning: ${pythonCmd} ${backendPath}`);

  backendProcess = child_process.spawn(pythonCmd, [backendPath], {
    cwd,
    stdio: "pipe",
    // Ensure we inherit a usable environment with PATH
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
  });

  backendProcess.stdout?.on("data", (data: Buffer) => {
    log(`[Backend stdout] ${data.toString().trim()}`);
  });

  backendProcess.stderr?.on("data", (data: Buffer) => {
    log(`[Backend stderr] ${data.toString().trim()}`);
  });

  backendProcess.on("error", (err) => {
    log(`[Backend] Spawn error: ${err.message}`);
  });

  backendProcess.on("close", (code) => {
    log(`[Backend] Process exited with code ${code}`);
    backendProcess = null;
  });
}

function killBackend(): void {
  if (backendProcess) {
    log("[Backend] Killing backend process...");
    if (process.platform === "win32") {
      child_process.spawn("taskkill", [
        "/pid",
        String(backendProcess.pid),
        "/f",
        "/t",
      ]);
    } else {
      backendProcess.kill("SIGTERM");
    }
    backendProcess = null;
  }
}

// ─── Programmatic tray icon (16×16 RGBA PNG) ──────────────────────────────────

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (0xedb88320 ^ (crc >>> 1)) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(size: number, r: number, g: number, b: number): Buffer {
  const ihdr = Buffer.alloc(13, 0);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = 1 + size * 4;
  const raw = Buffer.alloc(size * stride, 0);
  const mid = (size - 1) / 2;
  const radius = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      if (Math.sqrt((x - mid) ** 2 + (y - mid) ** 2) <= radius) {
        const i = y * stride + 1 + x * 4;
        raw[i] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
        raw[i + 3] = 255;
      }
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function buildTrayIcon(): Electron.NativeImage {
  const isMac = process.platform === "darwin";
  const [r, g, b] = isMac ? [0, 0, 0] : [0x63, 0x66, 0xf1];
  const icon = nativeImage.createFromBuffer(makePNG(16, r, g, b), {
    scaleFactor: 1.0,
  });
  if (isMac) icon.setTemplateImage(true);
  return icon;
}

// ─── Window helpers ───────────────────────────────────────────────────────────

function showWindow(): void {
  if (!mainWindow) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setBounds({
    x: Math.round((sw - 1200) / 2),
    y: Math.round((sh - 800) / 2),
    width: 1200,
    height: 800,
  });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideWindow(): void {
  mainWindow?.hide();
}

function toggleWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    hideWindow();
  } else {
    showWindow();
  }
}

// ─── System tray ─────────────────────────────────────────────────────────────

function createTray(): void {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip("Luna Assistant");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Luna", click: showWindow },
    {
      label: "Settings",
      click: () => {
        showWindow();
        mainWindow?.webContents.send("app:navigate", "privacy");
      },
    },
    {
      label: "Open Debug Log", click: () => {
        // Opens the log file with the system default text viewer
        child_process.spawn("explorer", [logPath], { detached: true });
      }
    },
    { type: "separator" },
    {
      label: "Quit Luna",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  if (process.platform !== "darwin") {
    tray.on("click", toggleWindow);
  }
  tray.on("double-click", showWindow);
}

// ─── BrowserWindow ────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Luna Assistant",
    backgroundColor: "#0f0f0f",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    const rendererPath = getRendererPath();
    log(`[Renderer] Loading from: ${rendererPath}`);
    log(`[Renderer] File exists: ${fs.existsSync(rendererPath)}`);

    if (!fs.existsSync(rendererPath)) {
      // Last-resort: show a plain error page in-window instead of blank
      mainWindow.loadURL(
        `data:text/html,<html><body style="background:#0f0f0f;color:#fff;font-family:sans-serif;padding:40px">` +
        `<h2>Luna – UI Build Missing</h2>` +
        `<p>Could not find: <code>${rendererPath}</code></p>` +
        `<p>This is a packaging error. Debug log: <code>${logPath}</code></p>` +
        `</body></html>`
      );
    } else {
      mainWindow.loadFile(rendererPath);
    }
  }

  mainWindow.once("ready-to-show", showWindow);

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      hideWindow();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Catch renderer-side crashes and white screens
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log(`[Renderer] Process gone: ${details.reason}`);
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    log(`[Renderer] Failed to load ${url}: ${code} ${desc}`);
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  log("=== Luna starting ===");
  log(`[App] version=${app.getVersion()} packaged=${app.isPackaged}`);
  log(`[App] __dirname=${__dirname}`);
  log(`[App] resourcesPath=${process.resourcesPath}`);
  log(`[App] userData=${app.getPath("userData")}`);

  startBackend();
  createWindow();
  createTray();

  const shortcut =
    process.platform === "darwin" ? "Command+Shift+L" : "Ctrl+Shift+L";

  const registered = globalShortcut.register(shortcut, toggleWindow);
  if (!registered) {
    log(`[App] Could not register global shortcut "${shortcut}".`);
  } else {
    log(`[App] Global shortcut registered: ${shortcut}`);
  }
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
  else showWindow();
});

app.on("window-all-closed", () => {
  /* keep process alive; exit only via tray → Quit Luna */
});

app.on("before-quit", () => {
  isQuitting = true;
  killBackend();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
  log("=== Luna quit ===");
});

// ─── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle("dialog:openFile", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openFile"] });
  return result.canceled ? null : result.filePaths;
});

ipcMain.handle("dialog:pickFile", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Supported", extensions: ["pdf", "txt", "png", "jpg", "jpeg"] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const buf = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    ext,
    mimeType: MIME[ext] ?? "application/octet-stream",
    base64: buf.toString("base64"),
    size: buf.length,
  };
});

// Expose log path to renderer so it can show "open debug log" UI
ipcMain.handle("app:getLogPath", () => logPath);

ipcMain.on("app:sendMessage", (_event, message: string) => {
  log(`[IPC] app:sendMessage: ${message}`);
});