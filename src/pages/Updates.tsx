import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSystemUpdates, type SystemUpdate } from '@/hooks/useSystemUpdates'
import {
  Sparkles, Calendar, ArrowRight, CheckCheck, Bell,
  Rocket, Wrench, ShieldCheck, Zap, Bug, Package,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mapeia nome de seção a ícone e cor
function getSectionMeta(name: string) {
  const lower = name.toLowerCase()
  if (lower.includes('novidade') || lower.includes('new'))
    return { icon: Sparkles, color: '#45E5E5', bg: '#E8F9F9', label: 'Novidades' }
  if (lower.includes('melhoria') || lower.includes('improve'))
    return { icon: Zap, color: '#FFB800', bg: '#FFFBEB', label: 'Melhorias' }
  if (lower.includes('correç') || lower.includes('fix') || lower.includes('bug'))
    return { icon: Bug, color: '#DC2626', bg: '#FEF2F2', label: 'Correções' }
  if (lower.includes('segurança') || lower.includes('security'))
    return { icon: ShieldCheck, color: '#7C3AED', bg: '#F5F3FF', label: 'Segurança' }
  return { icon: Wrench, color: '#666666', bg: '#F5F5F5', label: name }
}

export default function Updates() {
  const { updates, isLoading, unreadCount, markAllAsRead } = useSystemUpdates()
  const navigate = useNavigate()

  useEffect(() => {
    if (unreadCount > 0) {
      markAllAsRead.mutate()
    }
  }, [unreadCount]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto min-h-0">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F9F9] flex items-center justify-center">
              <Rocket className="w-5 h-5 text-[#10293F]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#10293F] dark:text-foreground font-[Poppins,sans-serif]">
                Atualizações
              </h1>
              <p className="text-sm text-[#666666] dark:text-muted-foreground">
                Novidades, melhorias e correções do GMS
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs border-[#E5E5E5] hover:border-[#45E5E5] hover:bg-[#E8F9F9]"
              onClick={() => markAllAsRead.mutate()}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar tudo como lido
            </Button>
          )}
        </div>

        {/* Stats resumo */}
        {updates.length > 0 && (
          <div className="flex items-center gap-4 mb-8 ml-[52px] text-xs text-[#666666] dark:text-muted-foreground">
            <span>{updates.length} atualizações</span>
            {updates[0]?.version && (
              <>
                <span className="text-[#E5E5E5]">·</span>
                <span>Versão atual: <span className="font-mono font-semibold text-[#10293F] dark:text-foreground">v{updates[0].version}</span></span>
              </>
            )}
          </div>
        )}

        {/* Empty */}
        {updates.length === 0 ? (
          <div className="text-center py-20 text-[#666666]">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">Nenhuma atualização disponível</p>
            <p className="text-xs mt-1 opacity-60">Novas atualizações aparecerão aqui</p>
          </div>
        ) : (
          /* Timeline */
          <div className="relative">
            {/* Linha vertical da timeline */}
            <div className="absolute left-[19px] top-4 bottom-4 w-px bg-[#E5E5E5] dark:bg-border" />

            <div className="space-y-1">
              {updates.map((update, idx) => (
                <UpdateCard
                  key={update.id}
                  update={update}
                  isFirst={idx === 0}
                  onNavigate={(path) => navigate(path)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 mt-4">
          <p className="text-xs text-[#CCCCCC] dark:text-muted-foreground">
            Mostrando as últimas {updates.length} atualizações
          </p>
        </div>
      </div>
    </div>
  )
}

function UpdateCard({
  update,
  isFirst,
  onNavigate,
}: {
  update: SystemUpdate
  isFirst: boolean
  onNavigate: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(isFirst || !update.is_read)
  const date = new Date(update.published_at)
  const formattedDate = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const sections = update.sections as any[]

  return (
    <div className="relative pl-12 pb-6 group">
      {/* Dot na timeline */}
      <div
        className={cn(
          'absolute left-[12px] top-[18px] w-[15px] h-[15px] rounded-full border-[3px] transition-colors z-10',
          !update.is_read
            ? 'bg-[#45E5E5] border-[#45E5E5] shadow-[0_0_0_4px_rgba(69,229,229,0.2)]'
            : isFirst
              ? 'bg-[#10293F] border-[#10293F] shadow-[0_0_0_4px_rgba(16,41,63,0.1)]'
              : 'bg-white dark:bg-background border-[#E5E5E5] dark:border-border group-hover:border-[#45E5E5]'
        )}
      />

      {/* Card */}
      <div
        className={cn(
          'rounded-xl border bg-card transition-all cursor-pointer',
          !update.is_read
            ? 'border-[#45E5E5]/40 shadow-[0_0_0_1px_rgba(69,229,229,0.15),0_4px_12px_rgba(16,41,63,0.08)]'
            : 'border-border hover:border-[#E5E5E5] hover:shadow-[0_4px_12px_rgba(16,41,63,0.06)]'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-[#10293F] dark:text-foreground text-[15px] truncate">
                {update.title}
              </h3>
              {!update.is_read && (
                <span className="inline-flex items-center bg-[#45E5E5] text-[#10293F] text-[9px] font-bold px-1.5 py-px rounded-full uppercase tracking-wider">
                  Novo
                </span>
              )}
            </div>
            {update.description && (
              <p className="text-xs text-[#666666] dark:text-muted-foreground mt-0.5 line-clamp-2 break-words">
                {update.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {update.version && (
              <span className="text-[11px] font-mono font-semibold text-[#10293F] dark:text-foreground bg-[#F5F5F5] dark:bg-muted px-2 py-0.5 rounded-md">
                v{update.version}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-[#999999] dark:text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {formattedDate}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-[#CCCCCC]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#CCCCCC]" />
            )}
          </div>
        </div>

        {/* Content expandido */}
        {expanded && (
          <div className="border-t border-border px-4 py-4 space-y-4 max-h-[500px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
            {sections.map((section: any, i: number) => {
              const meta = getSectionMeta(section.name)
              const Icon = meta.icon
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: meta.bg }}
                    >
                      <Icon className="w-3 h-3" style={{ color: meta.color }} />
                    </div>
                    <span className="text-sm font-semibold text-[#10293F] dark:text-foreground">
                      {section.name}
                    </span>
                  </div>
                  <div className="space-y-1 ml-7">
                    {(section.items || []).map((item: any, j: number) => (
                      <div
                        key={j}
                        className={cn(
                          'flex items-start gap-2 py-1 rounded-md group/item -ml-1 pl-1',
                          item.path && 'hover:bg-[#F8FAFC] dark:hover:bg-muted/50 cursor-pointer'
                        )}
                        onClick={(e) => {
                          if (item.path) {
                            e.stopPropagation()
                            onNavigate(item.path)
                          }
                        }}
                      >
                        <span
                          className="mt-[7px] w-1 h-1 rounded-full shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-sm text-[#333333] dark:text-foreground leading-relaxed flex-1">
                          {item.text}
                        </span>
                        {item.path && (
                          <span className="opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 mt-0.5">
                            <ExternalLink className="w-3.5 h-3.5 text-[#45E5E5]" />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
