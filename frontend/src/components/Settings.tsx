// /frontend/src/components/Settings.tsx
import { useEffect, useState, useCallback } from "react";
import { LunaSettings } from "../hooks/useSettings";

interface SettingsProps {
    onBack: () => void;
    onNavigatePrivacy: () => void;
    settings: LunaSettings;
    saveSettings: (partial: Partial<LunaSettings>) => Promise<LunaSettings>;
    loading: boolean;
}

const BACKEND_URL = "http://localhost:8000";
const MODELS = ["qwen2.5:7b", "llama3.2", "phi4"];

type Theme = "dark" | "light" | "system";
type FontSize = "sm" | "md" | "lg";
type ResponseStyle = "concise" | "balanced" | "detailed";

function applyThemeNow(v: Theme) {
    const setAttr = (dark: boolean) =>
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    if (v === "dark") { setAttr(true); return; }
    if (v === "light") { setAttr(false); return; }
    setAttr(window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function applyFontNow(v: FontSize) {
    const map: Record<FontSize, string> = { sm: "14px", md: "16px", lg: "18px" };
    document.documentElement.style.fontSize = map[v];
}

function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    disabled,
}: {
    options: { label: string; value: T }[];
    value: T;
    onChange: (v: T) => void;
    disabled?: boolean;
}) {
    return (
        <div className="inline-flex gap-0.5 rounded-full bg-black border border-[#222] p-1">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.value)}
                    className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors duration-150 disabled:opacity-40 ${value === opt.value
                            ? "bg-white text-black"
                            : "text-[#888] hover:text-white hover:bg-[#1a1a1a]"
                        }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="w-full rounded-xl bg-[#111] border border-[#222] p-5 transition-all duration-150 hover:border-[#333]">
            <h3 className="text-[10px] font-semibold text-[#555] mb-4 tracking-widest uppercase">
                {title}
            </h3>
            {children}
        </div>
    );
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export default function Settings({
    onBack,
    onNavigatePrivacy,
    settings,
    saveSettings,
    loading,
}: SettingsProps) {
    const [userName, setUserName] = useState("");
    const [assistantName, setAssistantName] = useState("");
    const [theme, setTheme] = useState<Theme>("dark");
    const [fontSize, setFontSize] = useState<FontSize>("md");
    const [model, setModel] = useState(MODELS[0]);
    const [responseStyle, setResponseStyle] = useState<ResponseStyle>("balanced");

    const [toast, setToast] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [resettingOnboarding, setResettingOnboarding] = useState(false);

    useEffect(() => {
        if (!settings) return;
        setUserName(settings.user_name ?? "");
        setAssistantName(settings.assistant_name ?? "Luna");
        setTheme((settings.theme as Theme) || "dark");
        setFontSize((settings.font_size as FontSize) || "md");
        setModel(settings.model || MODELS[0]);
        setResponseStyle((settings.response_style as ResponseStyle) || "balanced");
    }, [settings]);

    const flashToast = useCallback(() => {
        setToast(true);
        setTimeout(() => setToast(false), 1800);
    }, []);

    const persist = useCallback(
        async (partial: Partial<LunaSettings>) => {
            try {
                await saveSettings(partial);
                flashToast();
            } catch {
                /* silently ignore */
            }
        },
        [saveSettings, flashToast]
    );

    const saveProfile = useCallback(async () => {
        await persist({ user_name: userName, assistant_name: assistantName });
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 1500);
    }, [persist, userName, assistantName]);

    const handleTheme = (v: Theme) => {
        setTheme(v);
        applyThemeNow(v);
        persist({ theme: v });
    };

    const handleFontSize = (v: FontSize) => {
        setFontSize(v);
        applyFontNow(v);
        persist({ font_size: v });
    };

    const handleModel = (v: string) => {
        setModel(v);
        persist({ model: v });
    };

    const handleResponseStyle = (v: ResponseStyle) => {
        setResponseStyle(v);
        persist({ response_style: v });
    };

    const clearMemories = async () => {
        setClearing(true);
        try {
            await fetch(`${BACKEND_URL}/memories`, { method: "DELETE" });
            flashToast();
        } finally {
            setClearing(false);
            setConfirmClear(false);
        }
    };

    const resetOnboarding = async () => {
        setResettingOnboarding(true);
        try {
            await fetch(`${BACKEND_URL}/settings/reset-onboarding`, { method: "POST" });
            window.location.reload();
        } finally {
            setResettingOnboarding(false);
        }
    };

    return (
        <div className="luna-settings-enter flex flex-col flex-1 min-w-0 h-full bg-black text-white">

            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#222] shrink-0">
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

                <h1 className="text-lg font-semibold text-white">Settings</h1>

                <span
                    className={`ml-auto flex items-center gap-1.5 text-sm text-white transition-opacity duration-300 ${toast ? "opacity-100" : "opacity-0 pointer-events-none"
                        }`}
                >
                    <CheckIcon />
                    Saved
                </span>
            </div>

            {/* ── Scrollable body ── */}
            <div
                className="flex-1 overflow-y-auto px-6 py-6"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#333 #000" } as React.CSSProperties}
            >
                <div className="w-full max-w-2xl mx-auto flex flex-col gap-5">

                    {/* Profile */}
                    <Card title="Profile">
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs text-[#555] mb-1.5">Your name</label>
                                <input
                                    type="text"
                                    value={userName}
                                    disabled={loading}
                                    onChange={(e) => setUserName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && saveProfile()}
                                    placeholder="What should Luna call you?"
                                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-white focus:ring-1 focus:ring-white/10 disabled:opacity-50 transition-colors duration-150"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-[#555] mb-1.5">Assistant name</label>
                                <input
                                    type="text"
                                    value={assistantName}
                                    disabled={loading}
                                    onChange={(e) => setAssistantName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && saveProfile()}
                                    placeholder="Luna"
                                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-white focus:ring-1 focus:ring-white/10 disabled:opacity-50 transition-colors duration-150"
                                />
                            </div>
                            <button
                                onClick={saveProfile}
                                disabled={loading}
                                className="self-start flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-200 text-black text-sm font-medium transition-colors duration-150 active:scale-95 disabled:opacity-40"
                            >
                                {profileSaved && <CheckIcon />}
                                {profileSaved ? "Saved!" : "Save"}
                            </button>
                        </div>
                    </Card>

                    {/* Appearance */}
                    <Card title="Appearance">
                        <div className="flex flex-col gap-5">
                            <div>
                                <p className="text-xs text-[#555] mb-3">Theme</p>
                                <SegmentedControl<Theme>
                                    disabled={loading}
                                    value={theme}
                                    onChange={handleTheme}
                                    options={[
                                        { label: "Dark", value: "dark" },
                                        { label: "Light", value: "light" },
                                        { label: "System", value: "system" },
                                    ]}
                                />
                            </div>
                            <div>
                                <p className="text-xs text-[#555] mb-3">Font size</p>
                                <SegmentedControl<FontSize>
                                    disabled={loading}
                                    value={fontSize}
                                    onChange={handleFontSize}
                                    options={[
                                        { label: "Small", value: "sm" },
                                        { label: "Medium", value: "md" },
                                        { label: "Large", value: "lg" },
                                    ]}
                                />
                            </div>
                        </div>
                    </Card>

                    {/* AI */}
                    <Card title="AI">
                        <div className="flex flex-col gap-5">
                            <div>
                                <label className="block text-xs text-[#555] mb-2">Model</label>
                                <select
                                    value={model}
                                    disabled={loading}
                                    onChange={(e) => handleModel(e.target.value)}
                                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white/10 disabled:opacity-50 transition-colors duration-150"
                                >
                                    {MODELS.map((m) => (
                                        <option key={m} value={m} className="bg-[#111] text-white">
                                            {m}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <p className="text-xs text-[#555] mb-3">Response style</p>
                                <SegmentedControl<ResponseStyle>
                                    disabled={loading}
                                    value={responseStyle}
                                    onChange={handleResponseStyle}
                                    options={[
                                        { label: "Concise", value: "concise" },
                                        { label: "Balanced", value: "balanced" },
                                        { label: "Detailed", value: "detailed" },
                                    ]}
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Memory */}
                    <Card title="Memory">
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={onNavigatePrivacy}
                                className="self-start px-4 py-2 rounded-lg border border-[#222] text-[#888] hover:text-white hover:bg-[#1a1a1a] text-sm font-medium transition-colors duration-150"
                            >
                                Manage Memories
                            </button>

                            {!confirmClear ? (
                                <button
                                    onClick={() => setConfirmClear(true)}
                                    className="self-start px-4 py-2 rounded-lg border border-[#ff4444]/40 text-[#ff4444] hover:bg-[#ff4444]/10 text-sm font-medium transition-colors duration-150"
                                >
                                    Clear All Memories
                                </button>
                            ) : (
                                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-black border border-[#ff4444]/30 px-4 py-3">
                                    <span className="text-sm text-[#888] flex-1">
                                        Permanently delete all remembered facts?
                                    </span>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={clearMemories}
                                            disabled={clearing}
                                            className="px-3 py-1.5 rounded-md bg-[#ff4444] hover:bg-[#ff4444]/80 text-black text-sm font-medium transition-colors duration-150 disabled:opacity-50"
                                        >
                                            {clearing ? "Clearing…" : "Yes, clear"}
                                        </button>
                                        <button
                                            onClick={() => setConfirmClear(false)}
                                            disabled={clearing}
                                            className="px-3 py-1.5 rounded-md border border-[#222] hover:bg-[#1a1a1a] text-sm text-[#888] hover:text-white transition-colors duration-150 disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* About */}
                    <Card title="About">
                        <p className="text-sm text-white font-medium mb-0.5">Luna v0.4.0</p>
                        <p className="text-sm text-[#888]">
                            Your AI, on your device, for your privacy.
                        </p>
                    </Card>

                    {/* Dev Tools */}
                    <div className="pt-2 pb-4 flex justify-center">
                        <button
                            onClick={resetOnboarding}
                            disabled={resettingOnboarding}
                            className="text-xs text-[#555] hover:text-[#ff4444] transition-colors duration-150 disabled:opacity-40"
                        >
                            {resettingOnboarding ? "Resetting…" : "Reset Onboarding"}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}