// /electron/preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("luna", {
  sendMessage: (message: string): void => {
    ipcRenderer.send("app:sendMessage", message);
  },
  onMessage: (callback: (message: string) => void): void => {
    ipcRenderer.on("app:message", (_e: IpcRendererEvent, message: string) => {
      callback(message);
    });
  },
  openFileDialog: (): Promise<string[] | null> => {
    return ipcRenderer.invoke("dialog:openFile");
  },
  pickFile: (): Promise<unknown> => {
    return ipcRenderer.invoke("dialog:pickFile");
  },
});