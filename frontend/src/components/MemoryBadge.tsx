interface MemoryBadgeProps {
  memories: string[];
}

function MemoryBadge({ memories }: MemoryBadgeProps) {
  if (!memories || memories.length === 0) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full bg-[#111] border border-[#222] text-xs text-[#555]"
      title={`Memories used: ${memories.join(", ")}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white" />
      <span>
        Used {memories.length} memor{memories.length === 1 ? "y" : "ies"}
      </span>
    </div>
  );
}

export default MemoryBadge;
