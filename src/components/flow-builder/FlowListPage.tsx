import { useState } from 'react'
import { useFlowAutomations } from '@/hooks/useFlowAutomations'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Plus, GitBranch, Trash2, Loader2, Zap, MoreVertical, FlaskConical, Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const triggerLabels: Record<string, string> = {
  message_received: '📩 Mensagem Recebida',
  ticket_created: '🎫 Ticket Criado',
  scheduled: '📅 Agendado',
  webhook: '🔗 Webhook',
  status_changed: '🔄 Mudança de Status',
  stage_changed: '📋 Mudança de Etapa',
  conversation_closed: '✅ Finalizado',
  conversation_reopened: '🔁 Reaberto',
  agent_assigned: '👤 Agente Atribuído',
  tag_added: '🏷️ Tag Adicionada',
  priority_changed: '🔺 Prioridade',
  sla_breached: '⏰ SLA Violado',
  csat_received: '⭐ CSAT Recebido',
  no_response_timeout: '⏳ Timeout',
}
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface FlowListPageProps {
  onCreateFlow?: () => void
}

interface ConflictWarning {
  code: string
  message: string
  severity: 'warning' | 'error'
}

export function FlowListPage({ onCreateFlow }: FlowListPageProps) {
  const { flows, isLoading, deleteFlow, toggleFlow } = useFlowAutomations()
  const navigate = useNavigate()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictWarnings, setConflictWarnings] = useState<ConflictWarning[]>([])
  const [pendingToggle, setPendingToggle] = useState<{ id: string; active: boolean } | null>(null)
  const [validating, setValidating] = useState<string | null>(null)

  const { supabase: _sb } = { supabase: (window as any).__supabase }

  // Ao ativar um flow, validar conflitos primeiro
  const handleToggle = async (flowId: string, checked: boolean) => {
    if (!checked) {
      // Desativar não precisa de validação
      toggleFlow.mutate({ id: flowId, active: false })
      return
    }

    // Validar conflitos antes de ativar
    setValidating(flowId)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = (window as any).__SUPABASE_CLIENT__

      // Chamar edge function de validação
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-flow-conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ flow_id: flowId }),
      })
      const result = await resp.json()

      const warnings: ConflictWarning[] = result.warnings || []
      if (warnings.length > 0) {
        setConflictWarnings(warnings)
        setPendingToggle({ id: flowId, active: true })
        setConflictDialogOpen(true)
      } else {
        toggleFlow.mutate({ id: flowId, active: true })
      }
    } catch {
      // Se validação falhar, ativar mesmo assim (não bloquear o usuário)
      toggleFlow.mutate({ id: flowId, active: true })
    } finally {
      setValidating(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!flows || flows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <GitBranch className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum fluxo criado</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro fluxo de automação visual</p>
          {onCreateFlow && (
            <Button onClick={onCreateFlow}>
              <Plus className="w-4 h-4 mr-2" /> Criar Fluxo
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {flows.map((flow) => (
          <Card
            key={flow.id}
            className={cn(
              "cursor-pointer hover:shadow-md transition-all border-l-4",
              flow.is_active ? "border-l-green-500" : "border-l-gray-300 dark:border-l-gray-600"
            )}
            onClick={() => navigate(`/flow-builder/${flow.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    flow.is_active ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
                  )}>
                    <GitBranch className={cn("w-4 h-4", flow.is_active ? "text-green-600" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{flow.name}</h3>
                    <p className="text-xs text-muted-foreground">v{flow.version}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge
                    variant={flow.is_active ? 'default' : 'secondary'}
                    className={cn(
                      "text-xs",
                      flow.is_active ? "bg-green-600 hover:bg-green-700" : ""
                    )}
                  >
                    {flow.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/flow-builder/playground/${flow.id}`) }}>
                        <FlaskConical className="w-3.5 h-3.5 mr-2" /> Testar Fluxo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteId(flow.id) }}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {flow.description || 'Sem descrição'}
              </p>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {triggerLabels[flow.trigger_type] || flow.trigger_type}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {(flow.nodes as any[])?.length || 0} nodes
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>{flow.execution_count || 0} execuções</span>
                  {flow.updated_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(flow.updated_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  )}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={flow.is_active}
                    disabled={validating === flow.id}
                    onCheckedChange={(checked) => handleToggle(flow.id, checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteFlow.mutate(deleteId); setDeleteId(null) } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conflict validation dialog */}
      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Possíveis conflitos detectados</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-2">
                <p className="text-sm">Foram encontradas situações que podem causar comportamento inesperado:</p>
                {conflictWarnings.map((w, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 text-xs ${
                      w.severity === 'error'
                        ? 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400'
                        : 'border-orange-500/30 bg-orange-500/5 text-orange-700 dark:text-orange-400'
                    }`}
                  >
                    <span className="font-medium">{w.severity === 'error' ? '🔴' : '🟡'} {w.code}:</span>{' '}
                    {w.message}
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">
                  Deseja ativar mesmo assim?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingToggle(null); setConflictWarnings([]) }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingToggle) {
                  toggleFlow.mutate(pendingToggle)
                  setPendingToggle(null)
                  setConflictWarnings([])
                }
                setConflictDialogOpen(false)
              }}
            >
              Ativar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
