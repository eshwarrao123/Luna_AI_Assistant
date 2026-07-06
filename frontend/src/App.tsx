import { useEffect, useRef, useState } from "react";
import { useChat } from "./hooks/useChat";
import ChatMessage from "./components/ChatMessage";
import MessageInput from "./components/MessageInput";
import PermissionDialog from "./components/PermissionDialog";

const BACKEND_URL = "http://localhost:8000";

function App() {
  const {
    messages,
    sendMessage,
    isLoading,
    resetChat,
    pendingAction,
    showPermission,
    handlePermission,
  } = useChat();
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`);
        const data = await res.json();
        if (active) setConnected(data.status === "ok");
      } catch {
        if (active) setConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const lastIndex = messages.length - 1;

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-gray-100">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 bg-[#141414] border-r border-gray-800 flex flex-col">
        <div className="p-4">
          <button
            onClick={resetChat}
            className="w-full text-left px-3 py-2 rounded-lg bg-[#222] hover:bg-[#2a2a2a] transition-colors text-sm font-medium"
          >
            + New Chat
          </button>
        </div>
        <div className="px-4 text-xs uppercase tracking-wide text-gray-500 mb-2">
          History
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-1 text-sm text-gray-400">
          <div className="px-2 py-1.5 rounded hover:bg-[#1c1c1c] cursor-default truncate">
            Current session
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
          <h1 className="text-lg font-semibold">Luna</h1>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-green-500" : "bg-gray-600"
              }`}
            />
            {connected ? "Connected" : "Offline"}
          </span>
        </header>

        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 text-lg">
              What can I help you with today?
            </p>
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
              {messages.map((m, i) => (
                <ChatMessage
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  type={m.type}
                  tool={m.tool}
                  params={m.params}
                  success={m.success}
                  isStreaming={
                    m.role === "assistant" &&
                    m.type !== "action" &&
                    i === lastIndex &&
                    isLoading
                  }
                />
              ))}
            </div>
          </div>
        )}

        <div className="max-w-3xl w-full mx-auto">
          <MessageInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </main>

      <PermissionDialog
        action={pendingAction}
        open={showPermission}
        onAllow={() => handlePermission(true)}
        onDeny={() => handlePermission(false)}
      />
    </div>
  );
}

export default App;
