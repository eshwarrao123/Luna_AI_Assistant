import { useEffect, useState } from "react";
import ActionCard from "./ActionCard";
import MemoryBadge from "./MemoryBadge";
import { AiFillAliwangwang } from "react-icons/ai";

function ThinkingIndicator() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex justify-start mb-1">
      <div className="bg-[#111] border border-[#222] rounded-2xl rounded-tl-sm px-5 py-4">
        <div className="flex items-center gap-3">
          <AiFillAliwangwang className="text-white" />
          <span className="text-[#888] text-sm">Luna is thinking</span>
          <span className="flex gap-1">
            <span
              className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "0s" }}
            />
            <span
              className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "0.4s" }}
            />
          </span>
        </div>
        {slow && (
          <p className="text-[#555] text-xs mt-2">This may take a moment…</p>
        )}
      </div>
    </div>
  );
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  type?: "text" | "action";
  tool?: string;
  params?: Record<string, unknown>;
  success?: boolean;
  memories_used?: string[];
}

function ChatMessage({
  role,
  content,
  isStreaming,
  type = "text",
  tool,
  params,
  success,
  memories_used,
}: ChatMessageProps) {
  if (type === "action" && tool) {
    return (
      <div className="flex w-full justify-start">
        <div className="max-w-[75%] w-full">
          <ActionCard
            tool={tool}
            params={params}
            result={content}
            success={success}
          />
        </div>
      </div>
    );
  }

  const isUser = role === "user";

  // Show ThinkingIndicator while waiting for first chunk
  if (!isUser && isStreaming && !content) {
    return <ThinkingIndicator />;
  }

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[75%]">
        <div
          className={
            isUser
              ? "bg-white text-black px-4 py-2.5 rounded-2xl rounded-tr-sm whitespace-pre-wrap break-words"
              : "luna-assistant-bubble px-4 py-2.5 rounded-2xl rounded-tl-sm whitespace-pre-wrap break-words"
          }
        >
          {content}
          {isStreaming && content && (
            <span className="inline-block ml-0.5 w-[2px] h-[14px] bg-[#555] align-middle animate-pulse" />
          )}
        </div>
        {!isUser && memories_used && memories_used.length > 0 && (
          <MemoryBadge memories={memories_used} />
        )}
      </div>
    </div>
  );
}

export default ChatMessage;