import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Bot, ArrowRight, Layers, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { usePlatformAIConfigs } from '@/hooks/usePlatformAIConfig'
import { useModelCatalog } from '@/hooks/useModelCatalog'
import { cn } from '@/lib/utils'

const SPECIALTY_LABELS: Record<string, string> = {
  triage: 'Triagem',
  support: 'Suporte',
  financial: 'Financeiro',
  sales: 'Vendas',
  sdr: 'Vendas / SDR',
  copilot: 'Copiloto',
  analytics: 'Analítico',
}

const SPECIALTY_COLORS: Record<string, string> = {
  triage: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  support: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  financial: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  sales: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  sdr: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  copilot: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  analytics: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
}

const SQUAD_FEATURE_MAP: Record<string, string> = {
  triage: 'default_model_triage',
  support: 'default_model_support',
  financial: 'default_model_financial',
  sales: 'default_model_sales',
  sdr: 'default_model_sales',
  copilot: 'default_model_copilot',
}

export function WizardStepAgents() {
  const { data: agents, isLoading: loadingAgents } = useQuery({
    queryKey: ['ai-agents-wizard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, specialty, model, is_active, provider')
        .order('name')
      if (error) throw error
      return data
    },
  })

  const { data: configs } = usePlatformAIConfigs()
  const { data: models = [] } = useModelCatalog({ activeOnly: true })

  if (loadingAgents) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
  }

  const getSquadModel = (specialty: string) => {
    const feature = SQUAD_FEATURE_MAP[specialty]
    if (!feature) return null
    const config = configs?.find(c => c.feature === feature)
    return config?.model || null
  }

  const getModelDisplayName = (modelId: string) => {
    const model = models.find(m => m.model_id === modelId)
    return model?.display_name || modelId
  }

  const activeAgents = agents?.filter(a => a.is_active) || []
  const inactiveAgents = agents?.filter(a => !a.is_active) || []
  const agentsWithOverride = agents?.filter(a => a.model) || []
  const agentsInheriting = agents?.filter(a => !a.model) || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Agentes IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Veja como seus agentes estão configurados e se estão usando modelo próprio ou herdado do Squad.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{agents?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{activeAgents.length}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{agentsInheriting.length}</p>
            <p className="text-xs text-muted-foreground">Herdando Squad</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{agentsWithOverride.length}</p>
            <p className="text-xs text-muted-foreground">Modelo Próprio</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent List */}
      <div className="space-y-2">
        {agents?.map(agent => {
          const squadModel = getSquadModel(agent.specialty || '')
          const isInheriting = !agent.model
          const effectiveModel = agent.model || squadModel || 'Não definido'

          return (
            <Card key={agent.id} className={cn(!agent.is_active && 'opacity-60')}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-[#10293F] dark:text-[#45E5E5]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{agent.name}</span>
                    {agent.specialty && (
                      <Badge className={cn('text-xs', SPECIALTY_COLORS[agent.specialty] || 'bg-gray-100 text-gray-700')}>
                        {SPECIALTY_LABELS[agent.specialty] || agent.specialty}
                      </Badge>
                    )}
                    {!agent.is_active && (
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {isInheriting ? (
                      <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                        <Layers className="w-3 h-3" />
                        <span>Herdado do Squad: {getModelDisplayName(effectiveModel)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Modelo próprio: {getModelDisplayName(effectiveModel)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button variant="ghost" size="sm" asChild>
                  <Link to="/agents">
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}

        {(!agents || agents.length === 0) && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <Bot className="w-10 h-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Nenhum agente criado</p>
              <p className="text-sm text-muted-foreground mt-1">Crie agentes IA para começar a atender seus clientes automaticamente.</p>
            </div>
            <Button asChild className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]">
              <Link to="/agents">
                <Bot className="w-4 h-4 mr-1" />
                Criar Agente
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
