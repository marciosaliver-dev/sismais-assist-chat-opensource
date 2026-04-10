import { Users } from "lucide-react";

interface GroupBadgeProps {
  groupName?: string | null;
  className?: string;
}

export function GroupBadge({ groupName, className = "" }: GroupBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)] ${className}`}>
      <Users size={10} />
      {groupName || "Grupo"}
    </span>
  );
}
