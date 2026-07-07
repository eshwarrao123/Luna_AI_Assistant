// /frontend/src/components/Onboarding.tsx
import { useState } from "react";
import type { LunaSettings } from "../hooks/useSettings";

interface OnboardingProps {
    defaultAssistantName?: string;
    onComplete: (values: Partial<LunaSettings>) => Promise<void> | void;
}

const LANGUAGES = ["English", "Spanish", "French", "German"];
const MODELS = ["qwen2.5:7b", "llama3.2", "phi4"];

type Screen = 1 | 2 | 3;

function Onboarding({ defaultAssistantName, onComplete }: OnboardingProps) {
    const [screen, setScreen] = useState<Screen>(1);
    const [userName, setUserName] = useState("");
    const [assistantName, setAssistantName] = useState(defaultAssistantName || "Luna");
    const [language, setLanguage] = useState("English");
    const [model, setModel] = useState("qwen2.5:7b");
    const [submitting, setSubmitting] = useState(false);

    const goToScreen = (s: Screen) => setScreen(s);

    const handleFinish = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await onComplete({
                user_name: userName.trim(),
                assistant_name: assistantName.trim() || "Luna",
                language,
                model,
                theme: "dark",
                onboarding_complete: true,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative h-screen w-full overflow-hidden bg-black text-white flex items-center justify-center">
            {/* Subtle monochrome radial background */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background: "radial-gradient(ellipse at center, #111 0%, #000 70%)",
                }}
            />

            <style>{`
        @keyframes lunaFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .luna-fade-in { animation: lunaFadeIn 0.35s ease-out; }
      `}</style>

            <div className="relative z-10 w-full max-w-lg px-8">
                {/* Progress dots */}
                <div className="flex justify-center gap-2 mb-10">
                    {[1, 2, 3].map((s) => (
                        <span
                            key={s}
                            className={`h-1.5 rounded-full transition-all duration-300 ${s === screen ? "w-8 bg-white" : "w-1.5 bg-[#333]"
                                }`}
                        />
                    ))}
                </div>

                {screen === 1 && (
                    <div className="luna-fade-in text-center">
                        {/* Mascot */}
                        <div className="flex justify-center mb-6">
                            <svg
                                className="w-20 h-20 text-white animate-float"
                                viewBox="0 0 48 48"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ filter: "drop-shadow(0 0 15px rgba(255,255,255,0.2))" }}
                            >
                                <path d="M38.1,18.8c-0.2-1.5-0.5-7.8-2-9.8c-5.3-4.2-12-4-12-4s-6.7-0.2-12,4c-1.4,2-1.9,8.3-2,9.8l0.5,9.2v0.2c0,0,1.9,8.3,2.7,9.7c0.9,1.8,3.6,5.2,5.8,6.5c0.9,0.5,3.3,0.6,5,0.6c1.9,0,4.2-0.2,5-0.6c2.2-1.1,4.8-4.6,5.8-6.5c0.8-1.4,2.7-9.7,2.7-9.7v-0.2L38.1,18.8z" />
                                <path d="M34.9,29c-0.5,0.6-3.4,6.2-3.4,6.2s-0.5,2.2,0,4.2c0.5,2-0.5,2.2-0.5,2.2l-1.2,1.4l-2.2-0.9h-6.7l-2.2,0.9l-1.2-1.4c0,0-0.9-0.2-0.5-2.2c0.5-2,0-4.2,0-4.2s-3.4-5.5-3.9-6.2c-0.5-0.6-0.8-2.8-0.8-2.8l1.2-3.5l-0.3-10.6c0,0,0.9-1.4,2.2-2.3c1.1-0.8,4.2-1.7,4.2-1.7l1.1,7.8c0,0,0.3,1.7,0.3,1.8c0,0.2,1.1,0.5,1.1,0.5h4.1c0,0,1.1-0.3,1.1-0.5c0-0.2,0.3-1.8,0.3-1.8l1.1-7.8c0,0,3.1,0.8,4.2,1.7c0.9,0.9,2,2.3,2,2.3l-0.3,10.5l1.2,3.5C35.7,26.2,35.4,28.4,34.9,29z" />
                                <circle cx="18" cy="26" r="2" />
                                <circle cx="30" cy="26" r="2" />
                            </svg>
                        </div>

                        <h1 className="luna-glow text-6xl font-bold tracking-tight text-white mb-4">
                            Luna
                        </h1>
                        <p className="text-[#888] text-lg mb-10">
                            Your AI, on your device, for your privacy.
                        </p>
                        <button
                            onClick={() => goToScreen(2)}
                            className="px-8 py-3 rounded-xl bg-white hover:bg-gray-200 text-black font-medium transition-colors duration-150"
                        >
                            Get Started
                        </button>
                    </div>
                )}

                {screen === 2 && (
                    <div className="luna-fade-in">
                        <h2 className="text-2xl font-semibold text-center mb-8">
                            Let's personalize Luna
                        </h2>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm text-[#888] mb-1.5">
                                    What should I call you?
                                </label>
                                <input
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    placeholder="Your name"
                                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3.5 py-2.5 text-white placeholder-[#555] outline-none focus:border-white transition-colors duration-150"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-[#888] mb-1.5">
                                    What should you call me?
                                </label>
                                <input
                                    value={assistantName}
                                    onChange={(e) => setAssistantName(e.target.value)}
                                    placeholder="Luna"
                                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3.5 py-2.5 text-white placeholder-[#555] outline-none focus:border-white transition-colors duration-150"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-[#888] mb-1.5">
                                    Language
                                </label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3.5 py-2.5 text-white outline-none focus:border-white transition-colors duration-150"
                                >
                                    {LANGUAGES.map((l) => (
                                        <option key={l} value={l} className="bg-[#111] text-white">
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-[#888] mb-1.5">
                                    AI Model
                                </label>
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3.5 py-2.5 text-white outline-none focus:border-white transition-colors duration-150"
                                >
                                    {MODELS.map((m) => (
                                        <option key={m} value={m} className="bg-[#111] text-white">
                                            {m}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-between mt-10">
                            <button
                                onClick={() => goToScreen(1)}
                                className="px-5 py-2.5 rounded-xl bg-transparent border border-[#222] text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors duration-150"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => goToScreen(3)}
                                className="px-8 py-2.5 rounded-xl bg-white hover:bg-gray-200 text-black font-medium transition-colors duration-150"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {screen === 3 && (
                    <div className="luna-fade-in text-center">
                        <div className="flex justify-center mb-6">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-16 w-16 text-white"
                            >
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <path d="M9 12l2 2 4-4" />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-semibold mb-3">Privacy First</h2>
                        <p className="text-[#888] mb-8 max-w-md mx-auto">
                            Everything stays on your device. No cloud. No tracking. Your data
                            is yours.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
                            {[
                                {
                                    label: "Local AI",
                                    icon: (
                                        <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                                    ),
                                },
                                {
                                    label: "Encrypted Storage",
                                    icon: (
                                        <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    ),
                                },
                                {
                                    label: "Full Control",
                                    icon: (
                                        <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.245a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.379-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                    ),
                                },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="bg-[#111] border border-[#222] rounded-xl p-4 flex flex-col items-center gap-2"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={1.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-6 w-6 text-white"
                                    >
                                        {item.icon}
                                    </svg>
                                    <span className="text-sm text-[#888]">{item.label}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between">
                            <button
                                onClick={() => goToScreen(2)}
                                className="px-5 py-2.5 rounded-xl bg-transparent border border-[#222] text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors duration-150"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleFinish}
                                disabled={submitting}
                                className="px-8 py-2.5 rounded-xl bg-white hover:bg-gray-200 text-black font-medium disabled:opacity-50 transition-colors duration-150"
                            >
                                {submitting ? "Starting…" : "Start Using Luna"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Onboarding;