import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  ArrowLeft, Heart, MessageSquare, FileText, Clock, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Star, Calendar, DollarSign, Shield, User,
} from 'lucide-react'

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'text-emerald-500',
  warning: 'text-yellow-500',
  at_risk: 'text-orange-500',
  critical: 'text-red-500',
}

const HEALTH_LABELS: Record<string, string> = {
  healthy: 'Saudavel',
  warning: 'Atencao',
  at_risk: 'Em Risco',
  critical: 'Critico',
}

const LIFECYCLE_LABELS: Record<string, { label: string; color: string }> = {
  prospect: { label: 'Prospecto', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  onboarding: { label: 'Onboarding', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  active: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  at_risk: { label: 'Em Risco', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  churned: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

export default function Customer360() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: customer360, isLoading, error } = useQuery({
    queryKey: ['customer-360', id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('customer-360', {
        body: { client_id: id },
      })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !customer360) {
    return (
      <div className="page-container">
        <div className="page-content text-center py-20">
          <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg text-foreground">Cliente nao encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/clients')}>
            Voltar para Clientes
          </Button>
        </div>
      </div>
    )
  }

  const { client, contracts, health, conversations, activity, lifecycle } = customer360

  const healthScore = health?.score ?? null
  const healthLevel = health?.level || 'healthy'
  const lifecycleInfo = LIFECYCLE_LABELS[lifecycle?.stage || 'active'] || LIFECYCLE_LABELS.active

  return (
    <div className="page-container">
      <div className="page-content space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/clients">Clientes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{client?.name || 'Cliente'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-foreground">{client?.name}</h1>
                <Badge className={lifecycleInfo.color}>{lifecycleInfo.label}</Badge>
              </div>
              {client?.company_name && (
                <p className="text-sm text-muted-foreground mt-0.5">{client.company_name}</p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate(`/clients/${id}`)}>
            <User className="w-4 h-4 mr-2" />
            Detalhes Completos
          </Button>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Health Score */}
          <Card>
            <CardContent className="p-4 text-center">
              <Heart className={`w-5 h-5 mx-auto mb-1 ${HEALTH_COLORS[healthLevel]}`} />
              <p className="text-2xl font-bold text-foreground">{healthScore ?? '--'}</p>
              <p className="text-xs text-muted-foreground uppercase">
                Health Score {healthScore !== null && `(${HEALTH_LABELS[healthLevel]})`}
              </p>
            </CardContent>
          </Card>

          {/* NPS */}
          <Card>
            <CardContent className="p-4 text-center">
              <Star className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
              <p className="text-2xl font-bold text-foreground">{lifecycle?.nps_score ?? '--'}</p>
              <p className="text-xs text-muted-foreground uppercase">NPS</p>
            </CardContent>
          </Card>

          {/* CSAT Medio */}
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
              <p className="text-2xl font-bold text-foreground">{conversations?.avg_csat ?? '--'}</p>
              <p className="text-xs text-muted-foreground uppercase">CSAT Medio</p>
            </CardContent>
          </Card>

          {/* Conversas */}
          <Card>
            <CardContent className="p-4 text-center">
              <MessageSquare className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold text-foreground">{conversations?.total || 0}</p>
              <p className="text-xs text-muted-foreground uppercase">Conversas ({conversations?.open || 0} abertas)</p>
            </CardContent>
          </Card>

          {/* Contratos Ativos */}
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-bold text-foreground">{contracts?.active_count || 0}</p>
              <p className="text-xs text-muted-foreground uppercase">Contratos Ativos</p>
            </CardContent>
          </Card>

          {/* MRR */}
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold text-foreground">
                {lifecycle?.mrr ? `R$${lifecycle.mrr.toFixed(0)}` : '--'}
              </p>
              <p className="text-xs text-muted-foreground uppercase">MRR</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Activity & Alerts */}
          <div className="space-y-4">
            {/* Activity Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Atividade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ultima interacao</span>
                  <span className="text-foreground">
                    {activity?.days_since_last_interaction !== null
                      ? `${activity.days_since_last_interaction}d atras`
                      : 'Nunca'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Msgs ultimos 30d</span>
                  <span className="text-foreground">{activity?.messages_last_30_days || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolvidas por IA</span>
                  <span className="text-foreground">{conversations?.ai_resolved || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente desde</span>
                  <span className="text-foreground">
                    {lifecycle?.customer_since
                      ? new Date(lifecycle.customer_since).toLocaleDateString('pt-BR')
                      : '--'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Renewal Alert */}
            {contracts?.days_to_renewal !== null && contracts.days_to_renewal <= 60 && (
              <Card className="border-orange-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Renovacao em {contracts.days_to_renewal}d</p>
                      <p className="text-xs text-muted-foreground">
                        {contracts.nearest_renewal?.plan_name || 'Contrato'} vence em{' '}
                        {new Date(contracts.nearest_renewal?.end_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Churn Risk Alert */}
            {healthScore !== null && healthScore < 50 && (
              <Card className="border-red-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Risco de Churn</p>
                      <p className="text-xs text-muted-foreground">
                        Health Score {healthScore}/100 - Requer atencao imediata
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Middle Column: Recent Conversations */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Conversas Recentes</CardTitle>
                  <Badge variant="secondary">{conversations?.total || 0} total</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {conversations?.recent && conversations.recent.length > 0 ? (
                  <div className="space-y-2">
                    {conversations.recent.map((conv: any) => (
                      <div
                        key={conv.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/kanban/support?ticket=${conv.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          {conv.status === 'finalizado' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-500 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm text-foreground">
                              {conv.resolution_summary || conv.customer_name || 'Conversa'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(conv.created_at).toLocaleDateString('pt-BR')}{' '}
                              {conv.ai_resolved && '(IA)'}
                              {conv.handler_type === 'human' && '(Humano)'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {conv.csat_score && (
                            <Badge variant="outline" className="text-xs">
                              CSAT {conv.csat_score}
                            </Badge>
                          )}
                          <Badge variant={conv.status === 'finalizado' ? 'default' : 'secondary'} className="text-xs">
                            {conv.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa encontrada</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Annotations */}
        {customer360.annotations && customer360.annotations.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Anotacoes Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {customer360.annotations.slice(0, 5).map((note: any) => (
                  <div key={note.id} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-foreground">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(note.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
