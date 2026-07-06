import { useState, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  type?: "text" | "action";
  tool?: string;
  params?: Record<string, unknown>;
  success?: boolean;
}

export interface PendingAction {
  action: string;
  params: Record<string, unknown>;
  description: string;
}

const BACKEND_URL = "http://localhost:8000";

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showPermission, setShowPermission] = useState(false);

  const resetChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setPendingAction(null);
    setShowPermission(false);
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
        { role: "assistant", content: "", id: assistantId, type: "text" },
      ]);

      const appendToAssistant = (chunk: string) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      };

      const removeEmptyAssistant = () => {
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === ""))
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
        let stop = false;

        while (!stop) {
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

            let data: any;
            try {
              data = JSON.parse(payload);
            } catch {
              continue;
            }

            if (data.type === "permission_request") {
              // Tool intent detected — remove the empty placeholder,
              // open the permission dialog, and stop reading.
              removeEmptyAssistant();
              setPendingAction(data.action as PendingAction);
              setShowPermission(true);
              setIsLoading(false);
              stop = true;
              try {
                await reader.cancel();
              } catch {
                /* ignore */
              }
              break;
            } else if (data.type === "done") {
              setIsLoading(false);
            } else if (data.type === "chunk" && typeof data.content === "string") {
              appendToAssistant(data.content);
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
    pendingAction,
    showPermission,
    handlePermission,
  };
}
