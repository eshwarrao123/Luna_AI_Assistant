import type { PendingAction } from "../hooks/useChat";

interface PermissionDialogProps {
  action: PendingAction | null;
  open: boolean;
  onAllow: () => void;
  onDeny: () => void;
}

function formatParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params || {});
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join("\n");
}

function PermissionDialog({
  action,
  open,
  onAllow,
  onDeny,
}: PermissionDialogProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`bg-[#1a1a1a] border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-200 ${
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <h2 className="text-lg font-semibold text-gray-100 mb-2">
          Luna wants to take action
        </h2>
        {action && (
          <div className="mb-5">
            <p className="text-sm text-gray-300 mb-2">{action.description}</p>
            <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-3 text-sm text-gray-400 whitespace-pre-wrap break-words font-mono">
              <div className="text-indigo-400 mb-1">{action.action}</div>
              {formatParams(action.params)}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onDeny}
            className="px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-gray-200 text-sm font-medium transition-colors"
          >
            Deny
          </button>
          <button
            onClick={onAllow}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

export default PermissionDialog;
