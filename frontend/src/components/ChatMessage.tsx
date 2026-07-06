import ActionCard from "./ActionCard";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  type?: "text" | "action";
  tool?: string;
  params?: Record<string, unknown>;
  success?: boolean;
}

function ChatMessage({
  role,
  content,
  isStreaming,
  type = "text",
  tool,
  params,
  success,
}: ChatMessageProps) {
  // Action messages render as an ActionCard regardless of role
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

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[75%] bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm whitespace-pre-wrap break-words"
            : "max-w-[75%] bg-[#1a1a1a] border border-gray-800 text-gray-100 px-4 py-2.5 rounded-2xl rounded-tl-sm whitespace-pre-wrap break-words"
        }
      >
        {content}
        {isStreaming && (
          <span className="inline-block ml-0.5 animate-pulse text-gray-400">
            ▋
          </span>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
