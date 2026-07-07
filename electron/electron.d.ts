// /frontend/src/electron.d.ts
export { };

declare global {
    interface PickedFile {
        name: string;
        ext: string;
        mimeType: string;
        base64: string;
        size: number;
    }

    interface LunaBridge {
        sendMessage: (message: string) => void;
        onMessage: (cb: (message: string) => void) => void;
        openFileDialog: () => Promise<string[] | null>;
        pickFile: () => Promise<PickedFile | null>;
    }

    interface Window {
        luna?: LunaBridge;
    }
}