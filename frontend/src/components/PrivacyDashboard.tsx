import { useEffect, useState } from "react";

const BACKEND_URL = "http://localhost:8000";

interface Memory {
  id: number;
  key: string;
  value: string;
  category: string;
  created_at: string;
}

interface PrivacyDashboardProps {
  onBack?: () => void;
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function PrivacyDashboard({ onBack }: PrivacyDashboardProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/memories`);
      const data = await res.json();
      setMemories(Array.isArray(data) ? data : []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deleteMemory = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/memories/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {
      /* ignore */
    }
  };

  const clearAll = async () => {
    try {
      await fetch(`${BACKEND_URL}/memories`, { method: "DELETE" });
      setMemories([]);
    } catch {
      /* ignore */
    } finally {
      setConfirmClear(false);
    }
  };

  const counts = {
    all: memories.length,
    preference: memories.filter((m) => m.category === "preference").length,
    habit: memories.filter((m) => m.category === "habit").length,
    fact: memories.filter((m) => m.category === "fact").length,
  };

  const filtered =
    activeCategory === "all"
      ? memories
      : memories.filter((m) => m.category === activeCategory);

  const categories = [
    { key: "all", label: `All (${counts.all})` },
    { key: "preference", label: `Preferences (${counts.preference})` },
    { key: "habit", label: `Habits (${counts.habit})` },
    { key: "fact", label: `Facts (${counts.fact})` },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#222] shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] text-[#888] hover:text-white transition-colors duration-150"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-semibold text-white">Privacy Dashboard</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-sm text-[#555] mb-8">
            Everything Luna remembers about you, stored locally on your device.
          </p>

          {/* Category filter pills */}
          <section className="mb-6">
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors duration-150 ${
                    activeCategory === cat.key
                      ? "bg-white text-black border-white"
                      : "bg-[#111] border-[#222] text-[#888] hover:border-[#333] hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </section>

          {/* Memory list */}
          <section className="mb-8">
            {loading ? (
              <p className="text-[#555] text-sm">Loading…</p>
            ) : filtered.length === 0 ? (
              <div className="bg-[#111] border border-[#222] rounded-xl p-8 text-center">
                <p className="text-[#555]">
                  {memories.length === 0
                    ? "No memories stored yet. Chat with Luna and she'll learn about you."
                    : "No memories in this category."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#222] rounded-xl border border-[#222] overflow-hidden">
                {filtered.map((m) => (
                  <div
                    key={m.id}
                    className="bg-[#0a0a0a] hover:bg-[#111] px-4 py-3 flex items-start justify-between gap-4 transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-medium text-sm">{m.key}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-white text-xs">
                          {m.category}
                        </span>
                      </div>
                      <div className="text-sm text-[#888] break-words">{m.value}</div>
                      <div className="text-xs text-[#555] mt-1">{m.created_at}</div>
                    </div>
                    <button
                      onClick={() => deleteMemory(m.id)}
                      aria-label="Delete memory"
                      className="shrink-0 text-[#555] hover:text-[#ff4444] transition-colors duration-150 p-1"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Clear all */}
          {memories.length > 0 && (
            <section>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="px-4 py-2 rounded-lg border border-[#ff4444]/40 text-[#ff4444] hover:bg-[#ff4444]/10 text-sm font-medium transition-colors duration-150"
                >
                  Clear All
                </button>
              ) : (
                <div className="bg-black border border-[#ff4444]/30 rounded-lg p-4">
                  <p className="text-sm text-white mb-3">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-4 py-2 rounded-lg border border-[#222] hover:bg-[#1a1a1a] text-[#888] hover:text-white text-sm font-medium transition-colors duration-150"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={clearAll}
                      className="px-4 py-2 rounded-lg bg-[#ff4444] hover:bg-[#ff4444]/80 text-black text-sm font-medium transition-colors duration-150"
                    >
                      Yes, delete everything
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default PrivacyDashboard;
