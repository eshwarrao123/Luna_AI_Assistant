// /frontend/src/components/MessageInput.tsx
import { useRef, useState } from "react";

interface PickedFile {
  name: string;
  ext: string;
  mimeType: string;
  base64: string;
  size: number;
}

interface MessageInputProps {
  onSend: (text: string, file?: PickedFile | null) => void;
  disabled?: boolean;
}

const ACCEPTED_EXTS = new Set(["pdf", "txt", "png", "jpg", "jpeg"]);
const ACCEPT_ATTR = ".pdf,.txt,.png,.jpg,.jpeg";
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg"]);
const MAX_SIZE_MB = 10;
const MAX_ROWS = 4;
const LINE_H = 24;
const MIME: Record<string, string> = {
  pdf: "application/pdf", txt: "text/plain",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
};

function readBrowserFile(f: File): Promise<PickedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      resolve({ name: f.name, ext, mimeType: f.type || MIME[ext] || "application/octet-stream", base64, size: f.size });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(f);
  });
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isImg = file && IMAGE_EXTS.has(file.ext.toLowerCase());
  const previewUrl = isImg ? `data:${file.mimeType};base64,${file.base64}` : null;

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE_H * MAX_ROWS + 20)}px`;
  };

  const validate = (picked: PickedFile | null) => {
    setFileError(null);
    if (!picked) return;
    if (picked.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`File exceeds ${MAX_SIZE_MB} MB limit`);
      return;
    }
    if (!ACCEPTED_EXTS.has(picked.ext.toLowerCase())) {
      setFileError(`Unsupported ".${picked.ext}" — use PDF, TXT, PNG, or JPG`);
      return;
    }
    setFile(picked);
  };

  const attach = async () => {
    if (disabled) return;
    setFileError(null);
    try {
      if (typeof window !== "undefined" && (window as Window & { luna?: { pickFile?: () => Promise<unknown> } }).luna?.pickFile) {
        const picked = await (window as Window & { luna: { pickFile: () => Promise<PickedFile | null> } }).luna.pickFile();
        validate(picked);
      } else {
        inputRef.current?.click();
      }
    } catch {
      setFileError("Could not open file picker");
    }
  };

  const onBrowserPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validate(await readBrowserFile(f));
    e.target.value = "";
  };

  const removeFile = () => { setFile(null); setFileError(null); };

  const submit = () => {
    const text = value.trim();
    if ((!text && !file) || disabled) return;
    onSend(text, file);
    setValue("");
    setFile(null);
    setFileError(null);
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <div className="border-t border-[#222] bg-black px-4 pt-3 pb-4">

      {/* ── Attachment chip ── */}
      {(file || fileError) && (
        <div className="mb-2.5">
          {fileError ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-black border border-[#ff4444]/50 px-3 py-1.5 text-sm text-[#ff4444]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{fileError}</span>
              <button onClick={removeFile} className="text-[#ff4444] hover:text-white transition-colors duration-150">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : file ? (
            <div className="inline-flex items-center gap-3 rounded-xl bg-[#111] border border-[#222] px-3 py-2 max-w-xs">
              {previewUrl ? (
                <img src={previewUrl} alt={file.name} className="h-12 w-12 rounded-lg object-cover shrink-0 border border-[#222]" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-[#888]">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm text-white truncate">{file.name}</span>
                <span className="text-xs text-[#555]">
                  {file.size < 1_048_576
                    ? `${(file.size / 1024).toFixed(0)} KB`
                    : `${(file.size / 1_048_576).toFixed(1)} MB`}
                </span>
              </div>
              <button onClick={removeFile} aria-label="Remove file" className="shrink-0 text-[#555] hover:text-white transition-colors duration-150">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Input row ── */}
      <div className="flex items-end gap-2">
        <input ref={inputRef} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={onBrowserPick} />

        {/* Paperclip */}
        <button
          onClick={attach}
          disabled={disabled}
          aria-label="Attach file"
          className={`shrink-0 h-11 w-11 flex items-center justify-center rounded-xl border transition-colors duration-150
            ${file
              ? "bg-white/10 border-[#444] text-white"
              : "bg-[#111] border-[#222] text-[#888] hover:text-white hover:border-[#333]"
            } disabled:opacity-40`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={file ? `Ask about ${file.name}…` : "Message Luna…"}
          onChange={(e) => { setValue(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white outline-none focus:border-white disabled:opacity-50 leading-6 placeholder-[#555] transition-colors duration-150"
        />

        <button
          onClick={submit}
          disabled={disabled || (!value.trim() && !file)}
          aria-label="Send"
          className="shrink-0 h-11 w-11 flex items-center justify-center rounded-xl bg-white hover:bg-gray-200 text-black disabled:opacity-30 transition-colors duration-150"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}