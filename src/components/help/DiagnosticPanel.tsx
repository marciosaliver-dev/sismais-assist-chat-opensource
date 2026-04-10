import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { XCircle, AlertTriangle, CheckCircle, RefreshCw, ArrowRight, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DiagnosticIssue {
  id: string
  severity: 'critical' | 'warning'
  title: string
  detail: string
  impact: string
  actionLabel?: string
  actionHref?: string
  guideHref?: string
}

async function runDiagnostics(): Promise<{ issues: DiagnosticIssue[]; passedCount: number }> {
  const issues: DiagnosticIssue[] = []

  const [agentsRes, instancesRes, automationsRes, flowsRes, kbRes] = await Promise.all([
    supabase.from('ai_agents').select('id, name, description, system_prompt, rag_enabled, rag_similarity_threshold, confidence_threshold, is_active').eq('is_active', true),
    (supabase as any).from('uazapi_instances_public').select('id, instance_name, status').eq('is_active', true),
    supabase.from('ai_automations').select('id, name, trigger_type').eq('is_active', true),
    supabase.from('flow_automations').select('id, name, trigger_type').eq('is_active', true),
    supabase.from('ai_knowledge_base').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const agents = agentsRes.data ?? []
  const instances = instancesRes.data ?? []
  const automations = automationsRes.data ?? []
  const flows = flowsRes.data ?? []
  const kbCount = kbRes.count ?? 0

  let passedChecks = 0
  const TOTAL_CHECKS = 8

  // 1. Agents without description
  const agentsNoDesc = agents.filter((a) => !a.description || a.description.trim() === '')
  if (agentsNoDesc.length > 0) {
    issues.push({
      id: 'agents_without_description',
      severity: 'critical',
      title: `${agentsNoDesc.length} agente(s) sem Descrição`,
      detail: `Agentes sem descrição: ${agentsNoDesc.map((a) => `"${a.name}"`).join(', ')}`,
      impact: 'O sistema de roteamento IA não consegue decidir quando usar estes agentes — provavelmente eles nunca serão acionados.',
      actionLabel: 'Editar agentes',
      actionHref: '/agents',
      guideHref: '/help/routing/improve',
    })
  } else {
    passedChecks++
  }

  // 2. Agents without system_prompt
  const agentsNoPrompt = agents.filter((a) => !a.system_prompt || a.system_prompt.trim() === '')
  if (agentsNoPrompt.length > 0) {
    issues.push({
      id: 'empty_system_prompt',
      severity: 'critical',
      title: `${agentsNoPrompt.length} agente(s) sem System Prompt`,
      detail: `Agentes sem System Prompt: ${agentsNoPrompt.map((a) => `"${a.name}"`).join(', ')}`,
      impact: 'Sem instruções de personalidade, a IA pode dar respostas genéricas ou fora do contexto do seu negócio.',
      actionLabel: 'Configurar personalidade',
      actionHref: '/agents',
      guideHref: '/help/agents/personality',
    })
  } else {
    passedChecks++
  }

  // 3. RAG enabled with very high threshold
  const agentsHighThreshold = agents.filter(
    (a) => a.rag_enabled && (a.rag_similarity_threshold ?? 0) > 0.9
  )
  if (agentsHighThreshold.length > 0) {
    issues.push({
      id: 'rag_threshold_too_high',
      severity: 'warning',
      title: `RAG com Limite de Similaridade muito alto`,
      detail: `Agentes afetados: ${agentsHighThreshold.map((a) => `"${a.name}" (${Math.round((a.rag_similarity_threshold ?? 0) * 100)}%)`).join(', ')}`,
      impact: 'Com threshold acima de 90%, quase nenhum artigo será encontrado, e a IA responderá sem consultar a base de conhecimento.',
      actionLabel: 'Ajustar configuração',
      actionHref: '/agents',
      guideHref: '/help/knowledge/how-rag-works',
    })
  } else {
    passedChecks++
  }

  // 4. RAG enabled but empty KB
  const agentsWithRAG = agents.filter((a) => a.rag_enabled)
  if (agentsWithRAG.length > 0 && kbCount === 0) {
    issues.push({
      id: 'rag_enabled_empty_kb',
      severity: 'warning',
      title: 'RAG ativo mas Base de Conhecimento vazia',
      detail: `${agentsWithRAG.length} agente(s) têm RAG ativo, mas não há artigos na base de conhecimento.`,
      impact: 'A IA tentará buscar artigos mas não encontrará nada — o RAG não terá efeito.',
      actionLabel: 'Adicionar artigos',
      actionHref: '/knowledge',
      guideHref: '/help/knowledge/best-practices',
    })
  } else {
    passedChecks++
  }

  // 5. Duplicate triggers (flow + automation with same trigger)
  const automationTriggers = new Set(automations.map((a) => a.trigger_type))
  const conflictingFlows = flows.filter((f) => automationTriggers.has(f.trigger_type))
  if (conflictingFlows.length > 0) {
    const conflictTriggers = [...new Set(conflictingFlows.map((f) => f.trigger_type))]
    issues.push({
      id: 'duplicate_trigger_conflict',
      severity: 'critical',
      title: `Conflito de gatilhos: Automação + Flow Builder`,
      detail: `Gatilhos duplicados: ${conflictTriggers.join(', ')}. Fluxos conflitantes: ${conflictingFlows.map((f) => `"${f.name}"`).join(', ')}`,
      impact: 'O cliente pode receber mensagens duplicadas quando estes gatilhos dispararem.',
      actionLabel: 'Resolver conflito',
      actionHref: '/automations',
      guideHref: '/help/automations/duplicates',
    })
  } else {
    passedChecks++
  }

  // 6. Disconnected WhatsApp instances
  const disconnected = instances.filter((i) => i.status !== 'connected' && i.status !== 'open')
  if (disconnected.length > 0) {
    issues.push({
      id: 'whatsapp_disconnected',
      severity: 'critical',
      title: `${disconnected.length} instância(s) WhatsApp desconectada(s)`,
      detail: `Instâncias desconectadas: ${disconnected.map((i) => `"${i.instance_name}"`).join(', ')}`,
      impact: 'Mensagens enviadas para estas instâncias não serão recebidas ou enviadas.',
      actionLabel: 'Reconectar',
      actionHref: '/whatsapp-instances',
    })
  } else {
    passedChecks++
  }

  // 7. Agents with confidence_threshold = 0 (never escalates)
  const agentsZeroConf = agents.filter((a) => a.confidence_threshold === 0)
  if (agentsZeroConf.length > 0) {
    issues.push({
      id: 'zero_confidence_threshold',
      severity: 'warning',
      title: `${agentsZeroConf.length} agente(s) com Limite de Confiança = 0%`,
      detail: `Agentes: ${agentsZeroConf.map((a) => `"${a.name}"`).join(', ')}`,
      impact: 'Estes agentes nunca escalarão para um humano, mesmo quando não souberem responder.',
      actionLabel: 'Ajustar configuração',
      actionHref: '/agents',
      guideHref: '/help/training/cycle',
    })
  } else {
    passedChecks++
  }

  // 8. No active agents at all
  if (agents.length === 0) {
    issues.push({
      id: 'no_active_agents',
      severity: 'critical',
      title: 'Nenhum Agente IA ativo',
      detail: 'Não há agentes ativos no sistema.',
      impact: 'O sistema não pode responder nenhuma mensagem automaticamente.',
      actionLabel: 'Criar Agente',
      actionHref: '/agents',
      guideHref: '/help/agents/create',
    })
  } else {
    passedChecks++
  }

  return { issues, passedCount: passedChecks }
}

export function DiagnosticPanel() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['diagnostic-panel'],
    queryFn: runDiagnostics,
  })

  const critical = data?.issues.filter((i) => i.severity === 'critical') ?? []
  const warnings = data?.issues.filter((i) => i.severity === 'warning') ?? []
  const passedCount = data?.passedCount ?? 0

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Diagnóstico do Sistema</h1>
          <p className="text-muted-foreground">Verificação automática em tempo real dos problemas mais comuns.</p>
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

      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Analisando seu sistema...</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className={cn('rounded-xl border p-4 text-center', critical.length > 0 ? 'border-red-200 bg-red-50' : 'border-border bg-card')}>
              <div className={cn('text-2xl font-bold mb-0.5', critical.length > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                {critical.length}
              </div>
              <p className="text-xs text-muted-foreground">Críticos</p>
            </div>
            <div className={cn('rounded-xl border p-4 text-center', warnings.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-border bg-card')}>
              <div className={cn('text-2xl font-bold mb-0.5', warnings.length > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                {warnings.length}
              </div>
              <p className="text-xs text-muted-foreground">Avisos</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <div className="text-2xl font-bold mb-0.5 text-green-600">{passedCount}</div>
              <p className="text-xs text-muted-foreground">Verificações OK</p>
            </div>
          </div>

          {/* Critical issues */}
          {critical.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4" />
                PROBLEMAS CRÍTICOS ({critical.length})
              </h2>
              <div className="space-y-3">
                {critical.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-600 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                AVISOS ({warnings.length})
              </h2>
              <div className="space-y-3">
                {warnings.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            </div>
          )}

          {/* All OK */}
          {critical.length === 0 && warnings.length === 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-800">Sistema sem problemas detectados</p>
              <p className="text-sm text-green-600 mt-1">
                {passedCount} verificações passaram. Seu sistema está configurado corretamente.
              </p>
            </div>
          )}

          {/* Passed checks detail */}
          {passedCount > 0 && (critical.length > 0 || warnings.length > 0) && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                {passedCount} verificação(ões) OK
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function IssueCard({ issue }: { issue: DiagnosticIssue }) {
  const isCritical = issue.severity === 'critical'

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isCritical ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70'
    )}>
      <div className="flex items-start gap-3">
        {isCritical
          ? <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        }
        <div className="flex-1 min-w-0">
          <p className={cn('font-semibold text-sm mb-1', isCritical ? 'text-red-800' : 'text-amber-800')}>
            {issue.title}
          </p>
          <p className="text-xs text-muted-foreground mb-1">{issue.detail}</p>
          <p className="text-xs text-muted-foreground">
            <strong>Impacto:</strong> {issue.impact}
          </p>
          <div className="flex gap-2 mt-3">
            {issue.actionLabel && issue.actionHref && (
              <Link to={issue.actionHref}>
                <Button
                  size="sm"
                  className={cn('h-7 text-xs gap-1', isCritical ? '' : 'bg-amber-600 hover:bg-amber-700')}
                >
                  {issue.actionLabel} <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            )}
            {issue.guideHref && (
              <Link to={issue.guideHref}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <BookOpen className="w-3 h-3" /> Ver guia
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
