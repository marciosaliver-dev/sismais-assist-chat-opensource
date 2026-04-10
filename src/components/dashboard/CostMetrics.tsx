import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Zap, Lightbulb } from 'lucide-react'

interface CostMetricsProps {
  metrics: {
    totalTokens: number
    totalCostUsd: number
    totalCostBrl: number
    messageCount: number
  } | undefined
}

export function CostMetrics({ metrics }: CostMetricsProps) {
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
  const fmtBrl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

  return (
    <Card className="border-border border-t-[3px] border-t-[#FFB800]">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-[#10293F] dark:text-foreground flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-[#10293F]" />
          </div>
          Custo de IA Hoje
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Zap className="w-3 h-3" /> Tokens
            </div>
            <p className="text-lg font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">{fmt(metrics?.totalTokens || 0)}</p>
            <p className="text-xs text-muted-foreground">{metrics?.messageCount || 0} mensagens</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" /> Custo
            </div>
            <p className="text-lg font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">{fmtBrl(metrics?.totalCostBrl || 0)}</p>
            <p className="text-xs text-muted-foreground">${(metrics?.totalCostUsd || 0).toFixed(4)} USD</p>
          </div>
        </div>
        {(metrics?.messageCount || 0) > 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-[#FFFBEB] border border-[rgba(255,184,0,0.3)] rounded-lg p-3">
            <Lightbulb className="w-3.5 h-3.5 text-[#FFB800] shrink-0 mt-0.5" />
            <span>
              Se os {metrics?.messageCount} atendimentos fossem humanos (15min cada), seriam{' '}
              {Math.round(((metrics?.messageCount || 0) * 15) / 60)}h de trabalho.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
