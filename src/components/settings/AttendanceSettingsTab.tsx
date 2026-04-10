import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Bot, LayoutDashboard, MessageSquare, Receipt, Bell, RotateCcw, Settings, Users, Clock, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

function useConfigValue(feature: string, type: 'boolean' | 'string' = 'boolean') {
  return useQuery({
    queryKey: ['platform_ai_config', feature],
    queryFn: async () => {
      const { data } = await db.from('platform_ai_config').select('enabled, extra_config').eq('feature', feature).maybeSingle()
      if (!data) return null
      if (type === 'string') return data.extra_config?.value ?? null
      return data.enabled ?? null
    },
  })
}

function useConfigMutation(feature: string, type: 'boolean' | 'string' = 'boolean') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (value: unknown) => {
      const row: Record<string, unknown> = {
        feature,
        model: 'config',
        updated_at: new Date().toISOString(),
      }
      if (type === 'string') {
        row.extra_config = { value }
      } else {
        row.enabled = value
      }
      const { error } = await db.from('platform_ai_config').upsert(row, { onConflict: 'feature' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform_ai_config', feature] })
      toast.success('Configuração salva')
    },
    onError: () => toast.error('Erro ao salvar'),
  })
}

function useQueueNotificationsConfig() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['platform_ai_config', 'queue_notifications'],
    queryFn: async () => {
      const { data } = await db.from('platform_ai_config').select('enabled, extra_config').eq('feature', 'queue_notifications').maybeSingle()
      return data ?? { enabled: false, extra_config: { interval_minutes: 10, max_notifications: 5, avg_service_minutes: 15 } }
    },
  })
  const mutation = useMutation({
    mutationFn: async (values: { enabled?: boolean; extra_config?: Record<string, unknown> }) => {
      const row: Record<string, unknown> = {
        feature: 'queue_notifications',
        model: 'config',
        updated_at: new Date().toISOString(),
        ...values,
      }
      const { error } = await db.from('platform_ai_config').upsert(row, { onConflict: 'feature' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform_ai_config', 'queue_notifications'] })
      toast.success('Configuração salva')
    },
    onError: () => toast.error('Erro ao salvar'),
  })
  return { data, isLoading, mutation }
}

const DEFAULT_BILLING_TEMPLATE = `Olá, {nome}! Tudo bem? 😊

Identificamos uma pendência referente ao plano *{plano}* no valor de *{valor}*, com vencimento em *{vencimento}*.

Gostaríamos de verificar se houve algum problema com o pagamento. Podemos ajudá-lo(a) a regularizar essa situação?

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Ficamos à disposição! 🙏`

function BillingTemplateEditor() {
  const queryClient = useQueryClient()
  const [localValue, setLocalValue] = useState('')
  const [loaded, setLoaded] = useState(false)

  const { data: savedTemplate, isLoading } = useQuery({
    queryKey: ['platform_ai_config', 'billing_message_template'],
    queryFn: async () => {
      const { data } = await db.from('platform_ai_config').select('extra_config').eq('feature', 'billing_message_template').maybeSingle()
      return (data?.extra_config?.value as string) || ''
    },
  })

  useEffect(() => {
    if (!loaded && savedTemplate !== undefined) {
      setLocalValue(savedTemplate || DEFAULT_BILLING_TEMPLATE)
      setLoaded(true)
    }
  }, [savedTemplate, loaded])

  const saveMutation = useMutation({
    mutationFn: async (value: string) => {
      const row = {
        feature: 'billing_message_template',
        model: 'config',
        extra_config: { value: value === DEFAULT_BILLING_TEMPLATE ? '' : value },
        updated_at: new Date().toISOString(),
      }
      const { error } = await db.from('platform_ai_config').upsert(row, { onConflict: 'feature' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform_ai_config', 'billing_message_template'] })
      toast.success('Template salvo')
    },
    onError: () => toast.error('Erro ao salvar template'),
  })

  const handleRestore = () => {
    setLocalValue(DEFAULT_BILLING_TEMPLATE)
    saveMutation.mutate(DEFAULT_BILLING_TEMPLATE)
  }

  const isDirty = loaded && localValue !== (savedTemplate || DEFAULT_BILLING_TEMPLATE)

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Template da mensagem de cobrança</Label>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1 text-muted-foreground"
          onClick={handleRestore}
          disabled={saveMutation.isPending}
        >
          <RotateCcw className="w-3 h-3" />
          Restaurar padrão
        </Button>
      </div>
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        disabled={isLoading || saveMutation.isPending}
        rows={10}
        className="font-mono text-xs"
        placeholder="Carregando..."
      />
      <p className="text-xs text-muted-foreground">
        Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{nome}'}</code>, <code className="bg-muted px-1 rounded">{'{plano}'}</code>, <code className="bg-muted px-1 rounded">{'{valor}'}</code>, <code className="bg-muted px-1 rounded">{'{vencimento}'}</code>
      </p>
      {isDirty && (
        <Button
          size="sm"
          onClick={() => saveMutation.mutate(localValue)}
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending ? 'Salvando...' : 'Salvar template'}
        </Button>
      )}
    </div>
  )
}

export default function AttendanceSettingsTab() {
  // Config values
  const { data: showAgentName, isLoading: loadingShowAgent } = useConfigValue('show_agent_name')
  const { data: autoReplyEnabled, isLoading: loadingAutoReply } = useConfigValue('auto_reply_enabled')
  const { data: defaultAgentId, isLoading: loadingDefaultAgent } = useConfigValue('default_ai_agent_id', 'string')
  const { data: defaultBoardId, isLoading: loadingBoard } = useConfigValue('default_board_id', 'string')
  const { data: defaultStageId, isLoading: loadingStage } = useConfigValue('default_stage_id', 'string')
  const { data: aiReplyMode, isLoading: loadingMode } = useConfigValue('ai_reply_mode', 'string')
  const { data: billingAgentId, isLoading: loadingBillingAgent } = useConfigValue('billing_default_agent', 'string')

  // Queue notifications
  const { data: queueConfig, isLoading: loadingQueue, mutation: queueMutation } = useQueueNotificationsConfig()
  const queueEnabled = queueConfig?.enabled ?? false
  const queueExtra = queueConfig?.extra_config as Record<string, number> ?? {}
  const intervalMinutes = queueExtra.interval_minutes ?? 10
  const maxNotifications = queueExtra.max_notifications ?? 5
  const avgServiceMinutes = queueExtra.avg_service_minutes ?? 15

  const handleQueueToggle = (checked: boolean) => {
    queueMutation.mutate({ enabled: checked, extra_config: { interval_minutes: intervalMinutes, max_notifications: maxNotifications, avg_service_minutes: avgServiceMinutes } })
  }
  const handleQueueParam = (key: string, value: number) => {
    const newExtra = { interval_minutes: intervalMinutes, max_notifications: maxNotifications, avg_service_minutes: avgServiceMinutes, [key]: value }
    queueMutation.mutate({ enabled: queueEnabled, extra_config: newExtra })
  }

  // Mutations
  const toggleShowAgent = useConfigMutation('show_agent_name')
  const toggleAutoReply = useConfigMutation('auto_reply_enabled')
  const setDefaultAgent = useConfigMutation('default_ai_agent_id', 'string')
  const setDefaultBoard = useConfigMutation('default_board_id', 'string')
  const setDefaultStage = useConfigMutation('default_stage_id', 'string')
  const setAiReplyMode = useConfigMutation('ai_reply_mode', 'string')
  const setBillingAgent = useConfigMutation('billing_default_agent', 'string')

  // Data lists
  const { data: agents = [] } = useQuery({
    queryKey: ['ai-agents-active'],
    queryFn: async () => {
      const { data } = await db.from('ai_agents').select('id, name, specialty').eq('is_active', true).order('priority', { ascending: false })
      return data || []
    },
  })

  const { data: humanAgents = [] } = useQuery({
    queryKey: ['human-agents-active'],
    queryFn: async () => {
      const { data } = await db.from('human_agents').select('id, name, email').neq('is_active', false).order('name')
      return data || []
    },
  })

  const { data: boards = [] } = useQuery({
    queryKey: ['kanban-boards-active'],
    queryFn: async () => {
      const { data } = await db.from('kanban_boards').select('id, name, is_default').eq('active', true).order('sort_order')
      return data || []
    },
  })

  const { data: stages = [] } = useQuery({
    queryKey: ['kanban-stages-for-board', defaultBoardId],
    queryFn: async () => {
      if (!defaultBoardId) return []
      const { data } = await db.from('kanban_stages').select('id, name, is_entry, status_type').eq('board_id', defaultBoardId).eq('active', true).order('sort_order')
      return data || []
    },
    enabled: !!defaultBoardId,
  })

  const handleBoardChange = (boardId: string) => {
    setDefaultBoard.mutate(boardId)
    setDefaultStage.mutate(null)
  }

  return (
    <div className="attendance-settings">
      {/* Mensagens */}
      <div className="attendance-card">
        <div className="attendance-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <MessageSquare className="w-5 h-5" />
              Mensagens
            </h3>
            <p className="sc-desc">Configure como as mensagens são exibidas na inbox.</p>
          </div>
        </div>
        <div className="attendance-card-content">
          <div className="toggle-row">
            <div className="toggle-info">
              <Label htmlFor="show-agent-name" className="text-sm font-medium">
                Exibir nome do agente humano nas mensagens
              </Label>
              <p className="text-xs text-muted-foreground">
                Quando ativado, o nome do atendente aparece na bolha da mensagem.
              </p>
            </div>
            <Switch
              id="show-agent-name"
              checked={!!showAgentName}
              disabled={loadingShowAgent || toggleShowAgent.isPending}
              onCheckedChange={(checked) => toggleShowAgent.mutate(checked)}
            />
          </div>
        </div>
      </div>

      {/* IA Automática */}
      <div className="attendance-card">
        <div className="attendance-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Sparkles className="w-5 h-5" />
              Resposta Automática da IA
            </h3>
            <p className="sc-desc">Configure como a IA responde automaticamente.</p>
          </div>
        </div>
        <div className="attendance-card-content">
          <div className="toggle-row">
            <div className="toggle-info">
              <Label htmlFor="auto-reply" className="text-sm font-medium">
                Ativar resposta automática
              </Label>
              <p className="text-xs text-muted-foreground">
                A IA responde usando a base de conhecimento.
              </p>
            </div>
            <Switch
              id="auto-reply"
              checked={autoReplyEnabled !== false}
              disabled={loadingAutoReply || toggleAutoReply.isPending}
              onCheckedChange={(checked) => toggleAutoReply.mutate(checked)}
            />
          </div>
          <div className="field-row">
            <Label className="text-sm font-medium">Modo de resposta</Label>
            <Select
              value={(aiReplyMode as string) || 'always'}
              onValueChange={(val) => setAiReplyMode.mutate(val)}
              disabled={loadingMode || setAiReplyMode.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Responder sempre</SelectItem>
                <SelectItem value="no_human">Apenas sem humano</SelectItem>
                <SelectItem value="outside_hours">Fora do horário</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Fila e Notificações */}
      <div className="attendance-card">
        <div className="attendance-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Bell className="w-5 h-5" />
              Fila e Notificações
            </h3>
            <p className="sc-desc">Configure notificações da fila de atendimento.</p>
          </div>
        </div>
        <div className="attendance-card-content">
          <div className="toggle-row">
            <div className="toggle-info">
              <Label htmlFor="queue-notify" className="text-sm font-medium">
                Notificações de nova mensagem na fila
              </Label>
              <p className="text-xs text-muted-foreground">
                Enviar notificação aos supervisores quando houver novas mensagens.
              </p>
            </div>
            <Switch
              id="queue-notify"
              checked={queueEnabled === true}
              disabled={loadingQueue || queueMutation.isPending}
              onCheckedChange={(checked) => handleQueueToggle(checked)}
            />
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="attendance-card">
        <div className="attendance-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <LayoutDashboard className="w-5 h-5" />
              Kanban
            </h3>
            <p className="sc-desc">Configure o comportamento do quadro Kanban.</p>
          </div>
        </div>
        <div className="attendance-card-content">
          <div className="toggle-row">
            <div className="toggle-info">
              <Label htmlFor="auto-advance" className="text-sm font-medium">
                Avançar ticket automaticamente após resposta do agente
              </Label>
              <p className="text-xs text-muted-foreground">
                Ao responder um ticket, ele avança para a próxima etapa automaticamente.
              </p>
            </div>
            <Switch
              id="auto-advance"
              checked={false}
              disabled={true}
            />
          </div>
          <div className="field-row">
            <Label className="text-sm font-medium">Etapa padrão para novos tickets</Label>
            <Select
              value={(defaultStageId as string) || 'auto'}
              onValueChange={(val) => setDefaultStage.mutate(val === 'auto' ? null : val)}
              disabled={loadingStage || setDefaultStage.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={defaultBoardId ? "Automática" : "Selecione um board"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automática (etapa de entrada)</SelectItem>
                {stages.map((s: { id: string; name: string }) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Cobranças */}
      <div className="attendance-card">
        <div className="attendance-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Receipt className="w-5 h-5" />
              Cobranças
            </h3>
            <p className="sc-desc">Configure agente padrão para tickets de cobrança.</p>
          </div>
        </div>
        <div className="attendance-card-content">
          <div className="field-row">
            <Label className="text-sm font-medium">Agente humano padrão para cobranças</Label>
            <Select
              value={(billingAgentId as string) || ''}
              onValueChange={(val) => setBillingAgent.mutate(val === 'none' ? null : val)}
              disabled={loadingBillingAgent || setBillingAgent.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {humanAgents.map((a: { id: string; name: string }) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <BillingTemplateEditor />
        </div>
      </div>

      <style>{`
        .attendance-settings { display: flex; flex-direction: column; gap: 16px; }
        .attendance-card { background: #fff; border: 1px solid #E5E5E5; border-radius: 8px; overflow: hidden; }
        .attendance-card-header { padding: 16px; border-bottom: 1px solid #E5E5E5; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #fff; }
        .attendance-card-header .sc-info { flex: 1; }
        .attendance-card-header .sc-title { font-size: 16px; font-weight: 600; color: #10293F; margin: 0; display: flex; align-items: center; gap: 8px; }
        .attendance-card-header .sc-title .w-5.h-5 { color: #45E5E5; }
        .attendance-card-header .sc-desc { font-size: 13px; color: #666; margin: 4px 0 0; }
        .attendance-card-content { padding: 16px; background: #F8FAFC; border-radius: 0 0 8px 8px; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid #F0F0F0; }
        .toggle-row:last-child { border-bottom: none; }
        .toggle-info { flex: 1; }
        .field-row { padding: 12px 0; border-bottom: 1px solid #F0F0F0; display: flex; flex-direction: column; gap: 8px; }
        .field-row:last-child { border-bottom: none; }
      `}</style>
    </div>
  )
}
