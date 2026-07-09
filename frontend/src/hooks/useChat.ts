// /frontend/src/hooks/useChat.ts
import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  isStreaming?: boolean;
  type?: "text" | "action";
  tool?: string;
  params?: Record<string, unknown>;
  success?: boolean;
  memories_used?: string[];
  attachment?: string;
  attachmentPreview?: string;
}

export interface PendingAction {
  action: string;
  params: Record<string, unknown>;
  description: string;
}

interface PickedFile {
  name: string;
  ext: string;
  mimeType: string;
  base64: string;
  size: number;
}

const BACKEND_URL = "http://localhost:8000";
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg"]);

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "sess-" + makeId();
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showPermission, setShowPermission] = useState(false);
  const sessionIdRef = useRef<string>(makeSessionId());

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setPendingAction(null);
    setShowPermission(false);
    sessionIdRef.current = makeSessionId();
  }, []);

  const resetChat = clearConversation;

  const sendMessage = useCallback(
    async (text: string, file?: PickedFile | null) => {
      const trimmed = text.trim();
      if ((!trimmed && !file) || isLoading) return;

      setError(null);
      setIsLoading(true);

      const isFileImage = file && IMAGE_EXTS.has(file.ext.toLowerCase());
      const previewDataUrl = isFileImage
        ? `data:${file.mimeType};base64,${file.base64}`
        : undefined;

      const userMsg: ChatMessage = {
        role: "user",
        content: trimmed,
        id: makeId(),
        attachment: file?.name,
        attachmentPreview: previewDataUrl,
      };
      const assistantId = makeId();

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "assistant",
          content: "",
          id: assistantId,
          type: "text",
          isStreaming: true,
        },
      ]);

      const appendChunk = (chunk: string) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + chunk, isStreaming: true }
              : m
          )
        );

      const markStreamingDone = () =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );

      const markMemories = (keys: string[]) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, memories_used: keys } : m
          )
        );

      const dropEmptyAssistant = () =>
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === ""))
        );

      const consumeSSE = async (res: Response) => {
        if (!res.body) throw new Error("No response body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let stopped = false;

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(raw);
            } catch {
              continue;
            }

            if (data.type === "permission_request") {
              dropEmptyAssistant();
              markStreamingDone();
              setPendingAction(data.action as PendingAction);
              setShowPermission(true);
              setIsLoading(false);
              stopped = true;
              try { await reader.cancel(); } catch { /* ignore */ }
              break;
            } else if (data.type === "memories_used") {
              const keys = data.keys;
              if (Array.isArray(keys) && keys.length > 0)
                markMemories(keys as string[]);
            } else if (data.type === "done") {
              markStreamingDone();
              setIsLoading(false);
            } else if (data.type === "chunk" && typeof data.content === "string") {
              appendChunk(data.content);
            }
          }
        }
      };

      try {
        let res: Response;
        if (file) {
          const fd = new FormData();
          fd.append("message", trimmed);
          fd.append("session_id", sessionIdRef.current);
          fd.append("file", base64ToBlob(file.base64, file.mimeType), file.name);
          res = await fetch(`${BACKEND_URL}/chat/upload`, { method: "POST", body: fd });
        } else {
          res = await fetch(`${BACKEND_URL}/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmed,
              session_id: sessionIdRef.current,
            }),
          });
        }

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(String(errBody.detail ?? `HTTP ${res.status}`));
        }

        await consumeSSE(res);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Could not reach backend.";
        setError(msg);
        appendChunk(`[Luna: ${msg}]`);
      } finally {
        markStreamingDone();
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const handlePermission = useCallback(
    async (allowed: boolean) => {
      const action = pendingAction;
      setShowPermission(false);
      setPendingAction(null);
      if (!action) return;

      if (!allowed) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I won't do that without your permission.",
            id: makeId(),
            type: "text",
            isStreaming: false,
          },
        ]);
        return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: action.action,
            params: action.params,
            session_id: sessionIdRef.current,
          }),
        });
        const result = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.message,
            id: makeId(),
            type: "action",
            tool: action.action,
            params: action.params,
            success: result.success,
            isStreaming: false,
          },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "execution failed";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `[Luna: could not execute action: ${msg}]`,
            id: makeId(),
            type: "text",
            isStreaming: false,
          },
        ]);
      }
    },
    [pendingAction]
  );

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    resetChat,
    clearConversation,
    pendingAction,
    showPermission,
    handlePermission,
  };
}