import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { formatBRL } from '@/lib/utils'
import { CONTRACT_STATUS_COLORS } from '../constants'

interface ClientContractsTabProps {
  contracts: any[]
  onAddContract: () => void
}

export function ClientContractsTab({ contracts, onAddContract }: ClientContractsTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-foreground">{contracts.length} contrato(s)</p>
        <Button size="sm" className="gap-1 bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]" onClick={onAddContract}>
          <Plus className="w-4 h-4" /> Novo Contrato
        </Button>
      </div>
      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum contrato cadastrado.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#10293F]">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Plano</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Numero</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Status</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-white/80 uppercase tracking-wide">Valor</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Inicio</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Fim</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {contracts.map((c: any) => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2.5 text-sm font-medium text-foreground">{c.plan_name || 'Sem plano'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{c.contract_number || '--'}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="secondary" className={`text-[10px] ${CONTRACT_STATUS_COLORS[c.status || 'active'] || ''}`}>
                      {c.status === 'active' ? 'Ativo' : c.status === 'suspended' ? 'Suspenso' : 'Cancelado'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-right text-foreground">{c.value ? formatBRL(Number(c.value)) : '--'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.start_date ? format(new Date(c.start_date), 'dd/MM/yy') : '--'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.end_date ? format(new Date(c.end_date), 'dd/MM/yy') : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
