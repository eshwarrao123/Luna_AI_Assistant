import { useState, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
}

const BACKEND_URL = "http://localhost:8000";

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      setIsLoading(true);

      const userMsg: ChatMessage = {
        role: "user",
        content: trimmed,
        id: makeId(),
      };
      const assistantId = makeId();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "", id: assistantId },
      ]);

      const appendToAssistant = (chunk: string) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      };

      try {
        const res = await fetch(`${BACKEND_URL}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const data = JSON.parse(payload);
              if (data.done) {
                setIsLoading(false);
              } else if (typeof data.content === "string") {
                appendToAssistant(data.content);
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Could not reach backend.";
        setError(msg);
        appendToAssistant(`[Luna: connection error: ${msg}]`);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  return { messages, sendMessage, isLoading, error, resetChat };
}
