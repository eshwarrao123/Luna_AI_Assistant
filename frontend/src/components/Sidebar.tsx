// /frontend/src/components/Sidebar.tsx
type View = "chat" | "privacy" | "settings";

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onNewChat: () => void;
}

function NavItem({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors duration-150 ${
        active
          ? "bg-white text-black font-medium"
          : "text-[#888] hover:text-white hover:bg-[#1a1a1a]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Sidebar({ currentView, onNavigate, onNewChat }: SidebarProps) {
  return (
    <div className="flex flex-col w-64 shrink-0 bg-[#0a0a0a] border-r border-[#222] px-3 py-4">
      <button
        onClick={onNewChat}
        className="flex items-center justify-center gap-2 mb-6 rounded-lg bg-white hover:bg-gray-200 text-black text-sm font-medium py-2 transition-colors duration-150"
      >
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
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Chat
      </button>

      <div className="flex flex-col gap-1">
        <NavItem
          label="Chat"
          active={currentView === "chat"}
          onClick={() => onNavigate("chat")}
          icon={
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
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          }
        />
        <NavItem
          label="Privacy"
          active={currentView === "privacy"}
          onClick={() => onNavigate("privacy")}
          icon={
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        />
        <NavItem
          label="Settings"
          active={currentView === "settings"}
          onClick={() => onNavigate("settings")}
          icon={
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
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005.6 15a1.65 1.65 0 00-1-1.51H4a2 2 0 010-4h.09A1.65 1.65 0 005.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001.51-1H10.5a2 2 0 014 0v.09A1.65 1.65 0 0015 4.6a1.65 1.65 0 001.82.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001 1.51H20.5a2 2 0 010 4h-.09a1.65 1.65 0 00-1 1.49z" />
            </svg>
          }
        />
      </div>

      <div className="mt-auto pt-4 border-t border-[#222] text-xs text-[#555]">
        Luna v0.4.0
      </div>
    </div>
  );
}

export default Sidebar;