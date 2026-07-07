// /frontend/src/components/PermissionDialog.tsx
import type { PendingAction } from "../hooks/useChat";

interface PermissionDialogProps {
  action: PendingAction | null;
  onRespond: (allowed: boolean) => void;
}

function formatParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params || {});
  if (entries.length === 0) return "(no parameters)";
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join("\n");
}

export default function PermissionDialog({ action, onRespond }: PermissionDialogProps) {
  const open = action !== null;
  console.log("[PermissionDialog] render, open =", open, "action =", action);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`bg-[#111] border border-[#222] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-200 ${
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <h2 className="text-lg font-semibold text-white mb-2">
          Luna wants to take action
        </h2>
        {action && (
          <div className="mb-5">
            <p className="text-sm text-[#888] mb-2">{action.description}</p>
            <div className="bg-black border border-[#222] rounded-lg p-3 text-sm text-[#888] whitespace-pre-wrap break-words font-mono">
              <div className="text-white mb-1">{action.action}</div>
              {formatParams(action.params)}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => { console.log("[PermissionDialog] DENY clicked"); onRespond(false); }}
            className="px-4 py-2 rounded-lg bg-transparent border border-[#222] text-[#888] hover:text-white hover:bg-[#1a1a1a] text-sm font-medium transition-colors duration-150"
          >
            Deny
          </button>
          <button
            onClick={() => { console.log("[PermissionDialog] ALLOW clicked"); onRespond(true); }}
            className="px-4 py-2 rounded-lg bg-white hover:bg-gray-200 text-black text-sm font-medium transition-colors duration-150"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}