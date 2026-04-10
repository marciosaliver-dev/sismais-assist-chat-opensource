import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import {
  Phone, Mail, Building2, Star, CheckCircle2,
  Clock, User, Plus, Activity, TrendingDown, Crown,
  AlertTriangle,
} from 'lucide-react'
import { HealthScoreRing } from '@/components/clients/HealthScoreRing'
import { DataSourceBadge } from '@/components/clients/DataSourceBadge'
import { PRODUCT_BG, PLAN_LEVEL_COLORS, TIER_COLORS, productLabel } from './constants'
import type { ExtendedClient } from './types'

function MetricCard({ icon: Icon, label, value, small }: { icon: any; label: string; value: string | number; small?: boolean }) {
  return (
    <div className="border rounded-lg p-2 text-center space-y-0.5 hover:shadow-sm transition-shadow">
      <Icon className="w-4 h-4 mx-auto text-muted-foreground" />
      <p className={`font-semibold text-foreground ${small ? 'text-xs' : 'text-sm'}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

interface ClientSidebarProps {
  client: ExtendedClient
  c360: any
  c360Loading: boolean
  contacts: any[]
  contracts: any[]
  conversations: any[]
  onAddContact: () => void
}

export function ClientSidebar({ client, c360, c360Loading, contacts, contracts, conversations, onAddContact }: ClientSidebarProps) {
  const initials = client.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const product = client.subscribed_product || 'outro'

  const healthScore = c360?.client?.health_score ?? null
  const engagementScore = c360?.client?.engagement_score ?? null
  const churnRisk = c360?.client?.churn_risk ?? false
  const customerTier = c360?.client?.customer_tier ?? null
  const mrrTotal = c360?.client?.mrr_total ?? null
  const debtTotal = c360?.client?.debt_total ?? null
  const activeContracts = c360?.client?.active_contracts_count ?? contracts.filter((c: any) => c.status === 'active').length
  const dataSources = c360?.data_sources ?? []

  const totalTickets = conversations.length
  const resolvedTickets = conversations.filter((c: any) => c.status === 'resolved' || c.status === 'closed').length
  const csatRatings = conversations.filter((c: any) => c.csat_rating).map((c: any) => c.csat_rating!)
  const avgCsat = csatRatings.length > 0 ? (csatRatings.reduce((a: number, b: number) => a + b, 0) / csatRatings.length).toFixed(1) : '--'
  const lastContact = conversations.length > 0 ? conversations[0].started_at : null

  return (
    <div className="w-80 shrink-0 border-r border-border overflow-y-auto p-4 space-y-4 max-lg:hidden">
      {/* Avatar & Name */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-16 h-16 rounded-full bg-[#10293F] flex items-center justify-center text-xl font-bold text-[#45E5E5]">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-foreground">{client.name}</p>
          {client.company_name && <p className="text-sm text-muted-foreground">{client.company_name}</p>}
        </div>
      </div>

      {/* Health Score Ring */}
      {c360Loading ? (
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="w-24 h-24 rounded-full" />
          <Skeleton className="w-20 h-4" />
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <HealthScoreRing score={healthScore} size="lg" label="Health Score" />
        </div>
      )}

      {/* Sub-scores row */}
      {c360Loading ? (
        <div className="flex justify-center gap-2">
          <Skeleton className="w-24 h-6 rounded-full" />
          <Skeleton className="w-24 h-6 rounded-full" />
        </div>
      ) : (
        <div className="flex justify-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1">
            <Activity className="w-3 h-3" />
            Engajamento: {engagementScore ?? '--'}
          </Badge>
          {churnRisk ? (
            <Badge variant="destructive" className="text-xs gap-1">
              <TrendingDown className="w-3 h-3" />
              Risco Churn
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3" />
              Sem risco
            </Badge>
          )}
        </div>
      )}

      <Separator />

      {/* Status GL — Fonte principal */}
      {c360Loading ? (
        <div className="space-y-2"><Skeleton className="w-full h-20 rounded-lg" /></div>
      ) : (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status da Licença</p>
          {client.gl_status_mais_simples || client.gl_status_maxpro ? (
            <div className="space-y-2">
              {client.gl_status_mais_simples && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Mais Simples</span>
                  <Badge className={
                    client.gl_status_mais_simples === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    client.gl_status_mais_simples === 'Bloqueado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                    client.gl_status_mais_simples === 'Trial 7 Dias' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }>
                    {client.gl_status_mais_simples === 'Ativo' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {client.gl_status_mais_simples === 'Bloqueado' && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {client.gl_status_mais_simples === 'Trial 7 Dias' && <Clock className="w-3 h-3 mr-1" />}
                    {client.gl_status_mais_simples}
                  </Badge>
                </div>
              )}
              {client.gl_status_maxpro && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Maxpro</span>
                  <Badge className={
                    client.gl_status_maxpro === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    client.gl_status_maxpro === 'Bloqueado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }>
                    {client.gl_status_maxpro}
                  </Badge>
                </div>
              )}
              {client.last_synced_at && (
                <p className="text-[10px] text-muted-foreground/60 text-right">
                  Sync: {format(new Date(client.last_synced_at), 'dd/MM HH:mm')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Não sincronizado</p>
          )}

          {/* Manter engagement e tier */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <p className="text-[10px] text-muted-foreground">Contratos Ativos</p>
              <p className="text-sm font-semibold text-foreground">{activeContracts}/{contracts.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Tier</p>
              {customerTier ? (
                <Badge className={`text-[10px] ${TIER_COLORS[customerTier] || 'bg-muted text-muted-foreground'}`}>
                  <Crown className="w-3 h-3 mr-0.5" />
                  {customerTier.charAt(0).toUpperCase() + customerTier.slice(1)}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">--</p>
              )}
            </div>
          </div>
        </div>
      )}

      {client.support_eligible === false && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 dark:bg-red-950/20 dark:border-red-900/30">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Sem direito a suporte</p>
            {client.support_block_reason && (
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">{client.support_block_reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Data Sources */}
      {c360Loading ? (
        <div className="flex gap-1.5">{[1,2,3,4].map(i => <Skeleton key={i} className="w-16 h-5 rounded-full" />)}</div>
      ) : (
        dataSources.length > 0 && <DataSourceBadge sources={dataSources} className="justify-center" />
      )}

      <Separator />

      {/* Contact info */}
      <div className="space-y-2 text-sm">
        {client.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4 shrink-0" /> <span>{client.phone}</span>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-4 h-4 shrink-0" /> <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.cnpj && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="w-4 h-4 shrink-0" /> <span>{client.cnpj}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Grid 2×2 compacto */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Tickets', value: totalTickets, color: '#10293F' },
          { label: 'Resolvidos', value: resolvedTickets, color: '#16A34A' },
          { label: 'Dívida', value: debtTotal != null && debtTotal > 0 ? `R$${debtTotal.toFixed(0)}` : 'R$0', color: debtTotal != null && debtTotal > 0 ? '#DC2626' : '#16A34A' },
          { label: 'Engajamento', value: engagementScore ?? '—', color: '#10293F' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border bg-muted/30 p-2.5 text-center">
            <div className="text-lg font-bold" style={{ color, fontFamily: 'Poppins, sans-serif' }}>{value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <Separator />

      {/* Contacts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Contatos</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onAddContact}>
            <Plus className="w-3 h-3" /> Adicionar
          </Button>
        </div>
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum contato cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {contacts.map((c: any) => (
              <div key={c.id} className="border rounded-md p-2 text-xs space-y-0.5">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="font-medium text-foreground">{c.name}</span>
                  {c.is_primary && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                </div>
                {c.role && <p className="text-muted-foreground">{c.role}</p>}
                {c.phone && <p className="text-muted-foreground">{c.phone}</p>}
                {c.email && <p className="text-muted-foreground truncate">{c.email}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Product Card */}
      {product !== 'outro' && (
        <div className={`rounded-lg bg-gradient-to-r ${PRODUCT_BG[product] || PRODUCT_BG.outro} p-3 text-center text-white`}>
          <p className="text-xs opacity-80">Produto Assinante</p>
          <p className="font-semibold">{productLabel(product)}</p>
        </div>
      )}

      {/* Sistema + Plan Level */}
      {(client.sistema || client.plan_level) && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {client.sistema && <Badge variant="outline" className="text-xs gap-1">{client.sistema}</Badge>}
          {client.plan_level && (
            <Badge variant="secondary" className={`text-xs ${PLAN_LEVEL_COLORS[client.plan_level] || ''}`}>
              {client.plan_level}
            </Badge>
          )}
        </div>
      )}

    </div>
  )
}
