import { Link } from 'react-router-dom'
import { BookOpen, ArrowRight, ListOrdered } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const MODULE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  vendas_pdv: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Vendas (PDV)' },
  financeiro: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Financeiro' },
  estoque: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Estoque' },
  fiscal_nfe: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Fiscal (NF-e)' },
  geral: { bg: 'bg-slate-50', text: 'text-slate-700', label: 'Geral' },
}

interface HelpManualCardProps {
  id: string
  title: string
  metadata: Record<string, unknown> | null
  tags?: string[] | null
}

export function HelpManualCard({ id, title, metadata, tags }: HelpManualCardProps) {
  const module = (metadata?.module as string) ?? 'geral'
  const moduleInfo = MODULE_COLORS[module] ?? MODULE_COLORS.geral
  const steps = (metadata?.steps as unknown[]) ?? []
  const stepCount = steps.length

  return (
    <Link
      to={`/help/manuals/${id}`}
      className={cn(
        'group block rounded-2xl border border-border/60 bg-white p-6',
        'hover:shadow-md hover:border-primary/30 transition-all duration-200'
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn('text-xs font-semibold border-0', moduleInfo.bg, moduleInfo.text)}
            >
              {moduleInfo.label}
            </Badge>
            {stepCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ListOrdered className="w-3 h-3" />
                {stepCount} {stepCount === 1 ? 'passo' : 'passos'}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground text-base leading-tight mb-1 line-clamp-2">
            {title}
          </h3>
          {tags && tags.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">
              {tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end text-primary text-sm font-medium group-hover:gap-2 transition-all gap-1">
        Ver Manual
        <ArrowRight className="w-4 h-4" />
      </div>
    </Link>
  )
}
