interface MetricCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
}

export function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-cyan/10 text-cyan flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-white/50">{label}</div>
      </div>
    </div>
  )
}
