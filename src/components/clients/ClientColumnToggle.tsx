import { useState } from 'react'
import { Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export const EXTRA_COLUMNS = [
  { key: 'cidade_uf',             label: 'Cidade / UF' },
  { key: 'sistema_utilizado',     label: 'Sistema' },
  { key: 'dias_instalacao',       label: 'Dias Instalação' },
  { key: 'dias_assinatura',       label: 'Dias Assinatura' },
  { key: 'ltv_dias',              label: 'LTV (dias)' },
  { key: 'ultima_verificacao',    label: 'Última Verificação' },
  { key: 'dt_inicio_assinatura',  label: 'Início Assinatura' },
] as const

export type ExtraColumnKey = typeof EXTRA_COLUMNS[number]['key']

const LS_KEY = 'clients_visible_columns'

export function useVisibleColumns() {
  const [visible, setVisible] = useState<ExtraColumnKey[]>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const toggle = (key: ExtraColumnKey) => {
    setVisible(prev => {
      const next = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }

  return { visible, toggle }
}

interface ClientColumnToggleProps {
  visible: ExtraColumnKey[]
  onToggle: (key: ExtraColumnKey) => void
}

export function ClientColumnToggle({ visible, onToggle }: ClientColumnToggleProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Columns3 className="w-3.5 h-3.5" />
          Colunas
          {visible.length > 0 && (
            <span className="bg-[#45E5E5] text-[#10293F] rounded-full px-1.5 text-[10px] font-bold">
              {visible.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3" align="end">
        <p className="text-xs font-semibold text-[#10293F] mb-2 uppercase tracking-wide">
          Colunas extras
        </p>
        {EXTRA_COLUMNS.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1"
          >
            <input
              type="checkbox"
              checked={visible.includes(key)}
              onChange={() => onToggle(key)}
              className="accent-[#45E5E5]"
            />
            <span className="text-xs text-gray-700">{label}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}
