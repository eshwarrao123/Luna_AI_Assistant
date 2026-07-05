import { useState } from "react";

const BACKEND_URL = "http://localhost:8000";

interface ChatEntry {
  role: "user" | "luna";
  content: string;
}

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "luna", content: data.response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "luna", content: "Error: could not reach backend." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 bg-[#161616] border-r border-gray-800 p-4">
        <h2 className="text-lg font-semibold mb-4">Luna</h2>
        <nav className="text-sm text-gray-400 space-y-2">
          <div className="px-2 py-1 rounded bg-[#222] text-gray-200">New Chat</div>
        </nav>
      </aside>

      {/* Main chat area */}
      <main className="flex flex-col flex-1">
        <header className="px-6 py-4 border-b border-gray-800">
          <h1 className="text-xl font-semibold">Luna Assistant</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "text-gray-100" : "text-emerald-300"}
            >
              <span className="font-medium mr-2">
                {m.role === "user" ? "You:" : "Luna:"}
              </span>
              {m.content}
            </div>
          ))}
          {loading && <div className="text-gray-500">Luna is thinking…</div>}
        </div>

        <div className="p-4 border-t border-gray-800 flex gap-2">
          <input
            className="flex-1 rounded bg-[#1a1a1a] border border-gray-700 px-3 py-2 outline-none focus:border-gray-500"
            placeholder="Message Luna…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 font-medium"
          >
            Send
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
