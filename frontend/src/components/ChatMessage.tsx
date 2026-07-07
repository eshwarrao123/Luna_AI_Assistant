import ActionCard from "./ActionCard";
import MemoryBadge from "./MemoryBadge";

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
          <ActionCard tool={tool} params={params} result={content} success={success} />
        </div>
      </div>
    );
  }

  const isUser = role === "user";

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
          {isStreaming && (
            <span className="inline-block ml-0.5 animate-pulse text-[#555]">▋</span>
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