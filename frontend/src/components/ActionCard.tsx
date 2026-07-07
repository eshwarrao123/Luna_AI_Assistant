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
      className={`bg-[#111] border-l-2 ${
        success ? "border-white" : "border-[#ff4444]"
      } rounded-r-xl p-3 flex gap-3 items-start`}
    >
      <span className="text-xl leading-none mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-sm text-[#888] whitespace-pre-wrap break-words">
          {result}
        </div>
      </div>
    </div>
  );
}

export default ActionCard;
