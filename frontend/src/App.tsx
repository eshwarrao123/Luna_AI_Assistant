// /frontend/src/App.tsx
import { useState, useEffect } from "react";
import { useSettings } from "./hooks/useSettings";
import { useChat } from "./hooks/useChat";
import Sidebar from "./components/Sidebar";
import ChatMessage from "./components/ChatMessage";
import MessageInput from "./components/MessageInput";
import PermissionDialog from "./components/PermissionDialog";
import PrivacyDashboard from "./components/PrivacyDashboard";
import Settings from "./components/Settings";
import Onboarding from "./components/Onboarding";

type View = "chat" | "privacy" | "settings";

function App() {
  const { settings, loading: settingsLoading, saveSettings } = useSettings();
  const {
    messages,
    sendMessage,
    isLoading,
    clearConversation,
    pendingAction,
    showPermission,
    handlePermission,
  } = useChat();

  const [currentView, setCurrentView] = useState<View>("chat");

  useEffect(() => {
    const setAttr = (dark: boolean) =>
      document.documentElement.setAttribute(
        "data-theme",
        dark ? "dark" : "light"
      );
    if (settings.theme === "dark") { setAttr(true); return; }
    if (settings.theme === "light") { setAttr(false); return; }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setAttr(mq.matches);
    const handler = (e: MediaQueryListEvent) => setAttr(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  useEffect(() => {
    const map: Record<string, string> = { sm: "14px", md: "16px", lg: "18px" };
    document.documentElement.style.fontSize = map[settings.font_size] ?? "16px";
  }, [settings.font_size]);

  if (settingsLoading) {
    return <div className="h-screen w-screen bg-black" />;
  }

  if (!settings.onboarding_complete) {
    return (
      <Onboarding
        onComplete={(data) => {
          saveSettings({ ...data, onboarding_complete: true });
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-black text-white overflow-hidden">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        onNewChat={() => {
          clearConversation();
          setCurrentView("chat");
        }}
      />

      {currentView === "privacy" && (
        <PrivacyDashboard onBack={() => setCurrentView("chat")} />
      )}

      {currentView === "settings" && (
        <Settings
          onBack={() => setCurrentView("chat")}
          onNavigatePrivacy={() => setCurrentView("privacy")}
          settings={settings}
          saveSettings={saveSettings}
          loading={settingsLoading}
        />
      )}

      {currentView === "chat" && (
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center px-6 py-4 border-b border-[#222] shrink-0">
            <h1 className="text-lg font-semibold text-white">
              {settings.assistant_name || "Luna"}
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-[#555] text-lg">
                  Hi {settings.user_name || "there"}, how can I help you today?
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                {messages.map((m, i) => (
                  <ChatMessage
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    // ← THE FIX: pass isStreaming from message data,
                    //   with isLoading fallback for the last assistant message
                    isStreaming={
                      m.isStreaming ??
                      (isLoading &&
                        i === messages.length - 1 &&
                        m.role === "assistant")
                    }
                    type={m.type}
                    tool={m.tool}
                    params={m.params}
                    success={m.success}
                    memories_used={m.memories_used}
                  />
                ))}
              </div>
            )}
          </div>

          <MessageInput onSend={sendMessage} disabled={isLoading} />
        </div>
      )}

      {showPermission && (
        <PermissionDialog
          action={pendingAction}
          onRespond={(allowed: boolean) => handlePermission(allowed)}
        />
      )}
    </div>
  );
}

export default App;