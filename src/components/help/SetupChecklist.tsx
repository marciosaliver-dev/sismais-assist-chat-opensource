import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertTriangle, Circle, RefreshCw, ArrowRight, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckResult {
  passed: boolean
  warning?: boolean
  message: string
  detail?: string
  actionLabel?: string
  actionHref?: string
  guideHref?: string
}

async function runChecks(): Promise<Record<string, CheckResult>> {
  const [instancesRes, agentsRes, kbRes] = await Promise.all([
    (supabase as any).from('uazapi_instances_public').select('id, status, instance_name').eq('is_active', true),
    supabase.from('ai_agents').select('id, name, description, system_prompt, is_active').eq('is_active', true),
    supabase.from('ai_knowledge_base').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const instances = instancesRes.data ?? []
  const agents = agentsRes.data ?? []
  const kbCount = kbRes.count ?? 0

  const connectedInstances = instances.filter((i) => i.status === 'connected' || i.status === 'open')
  const agentsWithDesc = agents.filter((a) => a.description && a.description.trim() !== '')
  const agentsWithPrompt = agents.filter((a) => a.system_prompt && a.system_prompt.trim() !== '')

  return {
    whatsapp: {
      passed: connectedInstances.length > 0,
      message: connectedInstances.length > 0
        ? `${connectedInstances.length} instância(s) conectada(s)`
        : 'Nenhuma instância conectada',
      detail: connectedInstances.length === 0
        ? 'Sem WhatsApp conectado, nenhuma mensagem será recebida.'
        : undefined,
      actionLabel: connectedInstances.length === 0 ? 'Conectar WhatsApp' : undefined,
      actionHref: '/whatsapp-instances',
    },
    agents: {
      passed: agents.length > 0,
      message: agents.length > 0 ? `${agents.length} agente(s) ativo(s)` : 'Nenhum agente ativo',
      detail: agents.length === 0 ? 'Sem agentes, a IA não pode responder clientes.' : undefined,
      actionLabel: agents.length === 0 ? 'Criar Agente' : undefined,
      actionHref: '/agents',
    },
    agentDescriptions: {
      passed: agentsWithDesc.length === agents.length && agents.length > 0,
      warning: agentsWithDesc.length < agents.length && agents.length > 0,
      message: agents.length === 0
        ? 'Sem agentes para verificar'
        : agentsWithDesc.length === agents.length
        ? 'Todos os agentes têm descrição'
        : `${agents.length - agentsWithDesc.length} agente(s) sem descrição`,
      detail: agentsWithDesc.length < agents.length
        ? 'Agentes sem descrição podem não ser selecionados pelo roteamento IA.'
        : undefined,
      actionLabel: agentsWithDesc.length < agents.length ? 'Completar descrições' : undefined,
      actionHref: '/agents',
      guideHref: '/help/routing/improve',
    },
    systemPrompt: {
      passed: agentsWithPrompt.length === agents.length && agents.length > 0,
      warning: agentsWithPrompt.length < agents.length && agents.length > 0,
      message: agents.length === 0
        ? 'Sem agentes para verificar'
        : agentsWithPrompt.length === agents.length
        ? 'Todos os agentes têm System Prompt'
        : `${agents.length - agentsWithPrompt.length} agente(s) sem System Prompt`,
      detail: agentsWithPrompt.length < agents.length
        ? 'Agentes sem System Prompt podem dar respostas imprevisíveis.'
        : undefined,
      actionLabel: agentsWithPrompt.length < agents.length ? 'Configurar personalidade' : undefined,
      actionHref: '/agents',
      guideHref: '/help/agents/personality',
    },
    knowledge: {
      passed: kbCount > 0,
      warning: kbCount === 0,
      message: kbCount > 0 ? `${kbCount} artigo(s) na base de conhecimento` : 'Base de conhecimento vazia',
      detail: kbCount === 0 ? 'Sem artigos, a IA responderá baseada apenas no System Prompt.' : undefined,
      actionLabel: kbCount === 0 ? 'Adicionar artigos' : undefined,
      actionHref: '/knowledge',
      guideHref: '/help/knowledge',
    },
  }
}

const checksMeta: Array<{
  id: string
  title: string
  description: string
}> = [
  { id: 'whatsapp', title: 'WhatsApp Conectado', description: 'Pelo menos uma instância WhatsApp deve estar conectada para receber mensagens.' },
  { id: 'agents', title: 'Agente IA Criado', description: 'É necessário ter pelo menos um Agente IA ativo.' },
  { id: 'agentDescriptions', title: 'Descrições dos Agentes', description: 'Cada agente deve ter uma descrição para o roteamento IA funcionar corretamente.' },
  { id: 'systemPrompt', title: 'System Prompt Configurado', description: 'Cada agente precisa de instruções de personalidade (System Prompt).' },
  { id: 'knowledge', title: 'Base de Conhecimento', description: 'Adicionar artigos melhora significativamente a qualidade das respostas da IA.' },
]

export function SetupChecklist() {
  const { data: checks, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['setup-checklist'],
    queryFn: runChecks,
  })

  const passedCount = checks ? Object.values(checks).filter((c) => c.passed).length : 0
  const totalCount = checksMeta.length
  const progress = checks ? Math.round((passedCount / totalCount) * 100) : 0

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Checklist de Configuração Inicial</h1>
          <p className="text-muted-foreground">Verifique o estado atual do seu sistema e complete as etapas pendentes.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Progress */}
      {checks && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">Progresso geral</p>
            <span className="text-sm font-bold text-primary">{passedCount}/{totalCount} etapas</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {progress === 100 && (
            <p className="text-sm text-green-600 font-medium mt-2">
              ✅ Configuração básica completa! O sistema está pronto para uso.
            </p>
          )}
        </div>
      )}

      {/* Checks list */}
      <div className="space-y-3">
        {checksMeta.map((meta) => {
          const result = checks?.[meta.id]
          const isLoaded = !!result

          const status = isLoading || !isLoaded
            ? 'loading'
            : result.passed
            ? 'passed'
            : result.warning
            ? 'warning'
            : 'failed'

          return (
            <div
              key={meta.id}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                status === 'passed' && 'border-green-200 bg-green-50/50',
                status === 'failed' && 'border-red-200 bg-red-50/50',
                status === 'warning' && 'border-amber-200 bg-amber-50/50',
                status === 'loading' && 'border-border bg-card',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {status === 'passed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {status === 'failed' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  {status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  {status === 'loading' && <Circle className="w-5 h-5 text-muted-foreground/40 animate-pulse" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{meta.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isLoaded ? result.message : meta.description}
                      </p>
                      {isLoaded && result.detail && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <strong>Impacto:</strong> {result.detail}
                        </p>
                      )}
                    </div>
                    {isLoaded && status !== 'passed' && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                        status === 'failed' && 'bg-red-100 text-red-700',
                        status === 'warning' && 'bg-amber-100 text-amber-700',
                      )}>
                        {status === 'failed' ? 'PENDENTE' : 'ATENÇÃO'}
                      </span>
                    )}
                  </div>
                  {isLoaded && status !== 'passed' && (result.actionLabel || result.guideHref) && (
                    <div className="flex gap-2 mt-3">
                      {result.actionLabel && result.actionHref && (
                        <Link to={result.actionHref}>
                          <Button size="sm" className="h-7 text-xs gap-1">
                            {result.actionLabel} <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      )}
                      {result.guideHref && (
                        <Link to={result.guideHref}>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                            <BookOpen className="w-3 h-3" /> Ver guia
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
