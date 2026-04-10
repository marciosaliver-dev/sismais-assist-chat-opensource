import { MessageSquare, Zap, DollarSign, Timer, Target, BookOpen } from 'lucide-react'
import type { SessionMetrics } from '@/hooks/usePlaygroundSession'

interface Props {
  metrics: SessionMetrics
}

const cards = [
  { key: 'totalMessages', label: 'Mensagens', icon: MessageSquare, format: (v: number) => String(v) },
  { key: 'totalTokens', label: 'Tokens', icon: Zap, format: (v: number) => v.toLocaleString() },
  { key: 'totalCost', label: 'Custo (USD)', icon: DollarSign, format: (v: number) => `$${v.toFixed(4)}` },
  { key: 'avgLatency', label: 'Latência Média', icon: Timer, format: (v: number) => `${Math.round(v)}ms` },
  { key: 'avgConfidence', label: 'Confiança Média', icon: Target, format: (v: number) => `${Math.round(v * 100)}%` },
  { key: 'ragHits', label: 'RAG Hits', icon: BookOpen, format: (v: number) => String(v) },
] as const

export default function PlaygroundMetrics({ metrics }: Props) {
  return (
    <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-800">
      {cards.map(({ key, label, icon: Icon, format }) => (
        <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50">
          <Icon className="w-3.5 h-3.5 text-[#45E5E5] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wider truncate">{label}</p>
            <p className="text-sm font-semibold text-slate-200">{format(metrics[key])}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
