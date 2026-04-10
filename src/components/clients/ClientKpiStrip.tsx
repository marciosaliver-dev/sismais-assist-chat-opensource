import type { KpiCounts } from '@/hooks/useClientUnifiedSearch'

interface ClientKpiStripProps {
  counts: KpiCounts
  activeFilter: string
  onFilterChange: (status: string) => void
}

const KPI_CONFIG = [
  { key: '',          label: 'Total',      color: '#10293F', bg: 'white',   border: '#10293F' },
  { key: 'Ativo',     label: 'Ativos',     color: '#16A34A', bg: '#F0FDF4', border: '#16A34A' },
  { key: 'Bloqueado', label: 'Bloqueados', color: '#DC2626', bg: '#FEF2F2', border: '#DC2626' },
  { key: 'Trial',     label: 'Trial',      color: '#92400E', bg: '#FFFBEB', border: '#FFB800' },
  { key: 'Inativo',   label: 'Inativos',   color: '#666666', bg: '#F5F5F5', border: '#666666' },
]

const COUNT_KEY: Record<string, keyof KpiCounts> = {
  '': 'total',
  'Ativo': 'ativos',
  'Bloqueado': 'bloqueados',
  'Trial': 'trial',
  'Inativo': 'inativos',
}

export function ClientKpiStrip({ counts, activeFilter, onFilterChange }: ClientKpiStripProps) {
  return (
    <div className="flex gap-3 mb-4">
      {KPI_CONFIG.map(({ key, label, color, bg, border }) => {
        const isActive = activeFilter === key
        const count = counts[COUNT_KEY[key]] ?? 0
        return (
          <button
            key={key}
            onClick={() => onFilterChange(isActive ? '' : key)}
            className="flex-1 rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              background: isActive ? bg : 'white',
              borderColor: isActive ? border : '#E5E5E5',
              borderTopWidth: isActive ? 3 : 1,
              borderTopColor: isActive ? border : '#E5E5E5',
            }}
          >
            <div
              className="text-2xl font-bold"
              style={{ color: isActive ? color : '#10293F', fontFamily: 'Poppins, sans-serif' }}
            >
              {count.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#666' }}>{label}</div>
          </button>
        )
      })}
    </div>
  )
}
