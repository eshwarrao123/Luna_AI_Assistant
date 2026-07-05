import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("luna", {
  sendMessage: (message: string): void => {
    ipcRenderer.send("app:sendMessage", message);
  },
  onMessage: (callback: (message: string) => void): void => {
    ipcRenderer.on("app:message", (_event: IpcRendererEvent, message: string) => {
      callback(message);
    });
  },
  openFileDialog: (): Promise<string[] | null> => {
    return ipcRenderer.invoke("dialog:openFile");
  }
});
