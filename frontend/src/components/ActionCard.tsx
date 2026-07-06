interface ActionCardProps {
  tool: string;
  params?: Record<string, unknown>;
  result: string;
  success?: boolean;
}

const TOOL_ICON: Record<string, string> = {
  open_app: "🚀",
  open_folder: "📂",
  create_note: "📝",
  search_files: "🔍",
  create_reminder: "⏰",
};

const TOOL_LABEL: Record<string, string> = {
  open_app: "Open App",
  open_folder: "Open Folder",
  create_note: "Create Note",
  search_files: "Search Files",
  create_reminder: "Reminder",
};

function ActionCard({ tool, result, success = true }: ActionCardProps) {
  const icon = TOOL_ICON[tool] ?? "⚙️";
  const label = TOOL_LABEL[tool] ?? tool;

  return (
    <div
      className={`bg-[#1a1a1a]/80 border-l-4 ${
        success ? "border-indigo-500" : "border-red-500"
      } rounded-lg p-3 flex gap-3 items-start`}
    >
      <span className="text-xl leading-none mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-200">{label}</div>
        <div className="text-sm text-gray-400 whitespace-pre-wrap break-words">
          {result}
        </div>
      </div>
    </div>
  );
}

export default ActionCard;
