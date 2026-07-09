// /frontend/src/components/PermissionDialog.tsx
import type { PendingAction } from "../hooks/useChat";

interface PermissionDialogProps {
  action: PendingAction | null;
  onRespond: (allowed: boolean) => void;
}

const TOOL_LABELS: Record<string, string> = {
  open_app: "Open Application",
  open_folder: "Open Folder",
  create_note: "Create Note",
  search_files: "Search Files",
  create_reminder: "Set Reminder",
};

function formatParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params || {});
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join("\n");
}

function ShieldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5 text-white"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function PermissionDialog({
  action,
  onRespond,
}: PermissionDialogProps) {
  const open = action !== null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
        }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onRespond(false)}
      />

      {/* Dialog card */}
      <div
        className={`relative z-10 bg-[#111] border border-[#222] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl transform transition-all duration-200 ${open ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
      >
        {/* Close button */}
        <button
          onClick={() => onRespond(false)}
          className="absolute top-4 right-4 text-[#555] hover:text-white transition-colors duration-150"
          aria-label="Dismiss"
        >
          <CloseIcon />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/10 shrink-0">
            <ShieldIcon />
          </div>
          <div>
            <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-0.5">
              Permission Required
            </p>
            <h2 className="text-base font-semibold text-white leading-tight">
              {action ? (TOOL_LABELS[action.action] ?? action.action) : "Action"}
            </h2>
          </div>
        </div>

        {/* Description + params */}
        {action && (
          <div className="mb-5 space-y-3">
            <p className="text-sm text-[#888]">{action.description}</p>

            {Object.keys(action.params).length > 0 && (
              <div className="bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-1.5">
                  Parameters
                </p>
                <pre className="text-xs text-[#888] font-mono whitespace-pre-wrap break-words">
                  {formatParams(action.params)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            onClick={() => onRespond(false)}
            className="flex-1 px-4 py-2 rounded-lg bg-transparent border border-[#222] text-[#888] hover:text-white hover:border-[#444] hover:bg-[#1a1a1a] text-sm font-medium transition-colors duration-150"
          >
            Deny
          </button>
          <button
            onClick={() => onRespond(true)}
            className="flex-1 px-4 py-2 rounded-lg bg-white hover:bg-gray-200 text-black text-sm font-medium transition-colors duration-150"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}