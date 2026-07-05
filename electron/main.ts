import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";

const isDev = process.env.NODE_ENV === "development";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Luna Assistant",
    backgroundColor: "#0f0f0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC: open a native file dialog and return selected paths
ipcMain.handle("dialog:openFile", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"]
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths;
});

// IPC: receive a message from renderer (reserved for future main-process work)
ipcMain.on("app:sendMessage", (_event, message: string) => {
  console.log("[Luna main] received message:", message);
});
