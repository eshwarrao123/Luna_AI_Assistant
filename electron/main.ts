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

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

// ─── Programmatic tray icon (16×16 RGBA PNG, no external file) ────────────────

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
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
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
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  createTray();

  const shortcut =
    process.platform === "darwin" ? "Command+Shift+L" : "Ctrl+Shift+L";

  const registered = globalShortcut.register(shortcut, toggleWindow);
  if (!registered) {
    console.warn(`[Luna] Could not register global shortcut "${shortcut}".`);
  } else {
    console.log(`[Luna] Global shortcut registered: ${shortcut}`);
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
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
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

ipcMain.on("app:sendMessage", (_event, message: string) => {
  console.log("[Luna main] received message:", message);
});