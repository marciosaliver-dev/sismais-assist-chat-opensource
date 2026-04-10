import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Building2, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClientGLStatusBannerProps {
  phone: string | null
  cnpj?: string | null
}

interface GLLicense {
  gl_id: number
  source_system: string | null
  nome: string | null
  fantasia: string | null
  cpf_cnpj: string | null
  email: string | null
  telefone1: string | null
  celular: string | null
  status_pessoa: string | null
  sistema_utilizado: string | null
  support_eligible: boolean | null
  synced_at: string | null
}

function getStatusConfig(status: string | null) {
  switch (status) {
    case 'Ativo':
    case 'Trial 7 Dias':
      return {
        color: 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]',
        icon: ShieldCheck,
        label: status,
        dotColor: 'bg-[#16A34A]',
      }
    case 'Bloqueado':
      return {
        color: 'bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]',
        icon: ShieldX,
        label: 'Bloqueado',
        dotColor: 'bg-[#DC2626]',
      }
    case 'Cancelado':
      return {
        color: 'bg-[#FFFBEB] text-[#10293F] border-[rgba(255,184,0,0.5)]',
        icon: ShieldAlert,
        label: 'Cancelado',
        dotColor: 'bg-[#FFB800]',
      }
    default:
      return {
        color: 'bg-[#F5F5F5] text-[#444] border-[#E5E5E5]',
        icon: ShieldQuestion,
        label: status || 'Desconhecido',
        dotColor: 'bg-[#666]',
      }
  }
}

function getSystemLabel(source: string | null, sistema: string | null) {
  if (sistema) return sistema
  if (source === 'mais_simples') return 'Mais Simples'
  if (source === 'maxpro') return 'Maxpro'
  return source || null
}

export function ClientGLStatusBanner({ phone, cnpj }: ClientGLStatusBannerProps) {
  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ['gl-licenses-banner', phone, cnpj],
    queryFn: async () => {
      if (!phone && !cnpj) return []

      const filters: string[] = []

      if (phone) {
        const digits = phone.replace(/\D/g, '')
        const lastDigits = digits.slice(-8)
        if (lastDigits.length >= 8) {
          filters.push(`telefone1.ilike.%${lastDigits}%`)
          filters.push(`celular.ilike.%${lastDigits}%`)
        }
      }

      if (cnpj) {
        const cnpjDigits = cnpj.replace(/\D/g, '')
        if (cnpjDigits.length >= 11) {
          filters.push(`cpf_cnpj.eq.${cnpjDigits}`)
        }
      }

      if (filters.length === 0) return []

      const { data, error } = await (supabase as any)
        .from('gl_client_licenses')
        .select('gl_id, source_system, nome, fantasia, cpf_cnpj, email, telefone1, celular, status_pessoa, sistema_utilizado, support_eligible, synced_at')
        .or(filters.join(','))
        .limit(10)

      if (error) throw error
      return (data || []) as GLLicense[]
    },
    enabled: !!(phone || cnpj),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading || licenses.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Building2 className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Licenças GL ({licenses.length})
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {licenses.map((lic) => {
          const statusCfg = getStatusConfig(lic.status_pessoa)
          const StatusIcon = statusCfg.icon
          const displayName = lic.fantasia || lic.nome || 'Sem nome'
          const systemLabel = getSystemLabel(lic.source_system, lic.sistema_utilizado)

          return (
            <div
              key={`${lic.gl_id}-${lic.source_system}`}
              className="bg-secondary rounded-xl p-3 border border-border space-y-2"
              style={{ borderLeftWidth: '3px', borderLeftColor: statusCfg.dotColor.replace('bg-[', '').replace(']', '') }}
            >
              {/* Name + System */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {displayName}
                  </span>
                  {systemLabel && (
                    <Badge className="text-[9px] font-bold bg-[#10293F] text-white border-[#10293F] shrink-0">
                      {systemLabel}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Status Badge - prominent */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn(
                  'text-[11px] font-bold border gap-1.5 px-2.5 py-1 shrink-0',
                  statusCfg.color
                )}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusCfg.label}
                </Badge>
                {lic.support_eligible === true && (
                  <Badge className="text-[9px] font-bold bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)] gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Suporte ativo
                  </Badge>
                )}
                {lic.support_eligible === false && (
                  <Badge className="text-[9px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[rgba(220,38,38,0.3)] gap-1">
                    <ShieldX className="w-2.5 h-2.5" />
                    Sem suporte
                  </Badge>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
