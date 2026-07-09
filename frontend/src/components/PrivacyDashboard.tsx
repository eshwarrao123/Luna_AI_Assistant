import { useEffect, useState } from "react";

const BACKEND_URL = "http://localhost:8000";

interface Memory {
  id: number;
  key: string;
  value: string;
  category: string;
  created_at: string;
}

interface Activity {
  id: number;
  action_type: string;
  description: string;
  status: "allowed" | "denied" | "completed" | string;
  timestamp: string;
}

interface Permission {
  category: string;
  granted_at: string | null;
}

interface PrivacyDashboardProps {
  onBack?: () => void;
}

type Tab = "memories" | "activity" | "permissions";

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

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Fixed display order + labels for the permission categories the dashboard
// always shows, regardless of which ones the backend currently reports.
const PERMISSION_DISPLAY_ORDER = [
  "Files",
  "Apps",
  "Calendar",
  "Browser",
  "Email",
  "Music",
];

function statusDotClass(status: string): string {
  if (status === "allowed") return "bg-green-500";
  if (status === "denied") return "bg-red-500";
  return "bg-[#888]"; // completed / chat / unknown
}

function statusTextClass(status: string): string {
  if (status === "allowed") return "text-green-500";
  if (status === "denied") return "text-red-500";
  return "text-[#888]";
}

function formatActionLabel(actionType: string): string {
  return actionType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  const d = new Date(ts.includes("T") || ts.includes("Z") ? ts : ts.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PrivacyDashboard({ onBack }: PrivacyDashboardProps) {
  const [tab, setTab] = useState<Tab>("memories");

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const loadMemories = async () => {
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

  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/activity`);
      const data = await res.json();
      setActivities(Array.isArray(data?.activity) ? data.activity : []);
    } catch {
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const loadPermissions = async () => {
    setPermissionsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/permissions`);
      const data = await res.json();
      setPermissions(Array.isArray(data?.permissions) ? data.permissions : []);
    } catch {
      setPermissions([]);
    } finally {
      setPermissionsLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
    loadActivity();
    loadPermissions();
  }, []);

  // Keep Activity + Permissions reasonably fresh while this tab is open,
  // since actions can happen in the chat view in a different part of the app.
  useEffect(() => {
    if (tab === "activity") loadActivity();
    if (tab === "permissions") loadPermissions();
  }, [tab]);

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

  const grantedSet = new Set(permissions.map((p) => p.category));

  const tabs: { key: Tab; label: string }[] = [
    { key: "memories", label: "Memories" },
    { key: "activity", label: "Activity" },
    { key: "permissions", label: "Permissions" },
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

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 border-b border-[#222] shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150 ${tab === t.key
                ? "border-white text-white"
                : "border-transparent text-[#666] hover:text-white"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {tab === "memories" && (
            <>
              <p className="text-sm text-[#555] mb-8">
                Everything Luna remembers about you, stored locally on your device.
              </p>

              <section className="mb-6">
                <div className="flex gap-2 flex-wrap">
                  {categories.map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors duration-150 ${activeCategory === cat.key
                          ? "bg-white text-black border-white"
                          : "bg-[#111] border-[#222] text-[#888] hover:border-[#333] hover:text-white"
                        }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </section>

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
            </>
          )}

          {tab === "activity" && (
            <>
              <p className="text-sm text-[#555] mb-6">
                The last 50 actions Luna has taken or been asked to take.
              </p>
              {activityLoading ? (
                <p className="text-[#555] text-sm">Loading…</p>
              ) : activities.length === 0 ? (
                <div className="bg-[#111] border border-[#222] rounded-xl p-8 text-center">
                  <p className="text-[#555]">No activity yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#222] rounded-xl border border-[#222] overflow-hidden">
                  {activities.map((a) => (
                    <div
                      key={a.id}
                      className="bg-[#0a0a0a] hover:bg-[#111] px-4 py-3 flex items-start gap-3 transition-colors duration-150"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${statusDotClass(a.status)}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-white font-medium text-sm">
                            {formatActionLabel(a.action_type)}
                          </span>
                          <span className="text-xs text-[#555] shrink-0">
                            {formatTimestamp(a.timestamp)}
                          </span>
                        </div>
                        {a.description && (
                          <div className="text-sm text-[#888] break-words mt-0.5">
                            {a.description}
                          </div>
                        )}
                        <div className={`text-xs mt-1 capitalize ${statusTextClass(a.status)}`}>
                          {a.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "permissions" && (
            <>
              <p className="text-sm text-[#555] mb-6">
                What Luna has been granted access to on this device.
              </p>
              {permissionsLoading ? (
                <p className="text-[#555] text-sm">Loading…</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {PERMISSION_DISPLAY_ORDER.map((category) => {
                    const isGranted = grantedSet.has(category);
                    return (
                      <div
                        key={category}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border ${isGranted
                            ? "bg-[#111] border-[#222]"
                            : "bg-[#0a0a0a] border-[#1a1a1a]"
                          }`}
                      >
                        <span
                          className={`text-sm font-medium ${isGranted ? "text-white" : "text-[#555]"
                            }`}
                        >
                          {category}
                        </span>
                        {isGranted ? (
                          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500/20 text-green-500">
                            <CheckIcon />
                          </span>
                        ) : (
                          <span className="text-xs text-[#555]">Not used</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PrivacyDashboard;