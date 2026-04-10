interface GroupSenderNameProps {
  senderName: string | null;
  senderPhone?: string | null;
}

const SENDER_COLORS = [
  "#DC2626", "#2563EB", "#16A34A", "#7C3AED",
  "#EA580C", "#0891B2", "#CA8A04", "#BE185D",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

export function GroupSenderName({ senderName, senderPhone }: GroupSenderNameProps) {
  const displayName = senderName || senderPhone || "Desconhecido";
  const color = hashColor(displayName);
  return (
    <span className="text-[11px] font-semibold block mb-0.5" style={{ color }}>
      {displayName}
    </span>
  );
}
