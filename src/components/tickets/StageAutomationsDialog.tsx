import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useStageAutomations, getActionSummary, type StageAutomation } from '@/hooks/useStageAutomations'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LogIn, LogOut, Plus, Trash2, Pencil, GripVertical,
  RefreshCw, UserPlus, MessageSquare, Tag, Workflow, Bell, AlertTriangle,
  ArrowRight, LayoutGrid, Bot, StickyNote, TagIcon, FolderOpen, Package,
  PlusCircle, Globe, Settings2,
} from 'lucide-react'
import { WhatsAppInstanceSelect } from '@/components/shared/WhatsAppInstanceSelect'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Constants ──
const ACTION_TYPES = [
  { value: 'change_ticket_status', label: 'Mudar Status', icon: RefreshCw },
  { value: 'assign_agent', label: 'Atribuir Agente Humano', icon: UserPlus },
  { value: 'assign_ai', label: 'Atribuir Agente de IA', icon: Bot },
  { value: 'move_to_stage', label: 'Mover para Etapa', icon: ArrowRight },
  { value: 'move_to_board', label: 'Mover para Board', icon: LayoutGrid },
  { value: 'send_message', label: 'Enviar Mensagem ao Cliente', icon: MessageSquare },
  { value: 'send_internal_message', label: 'Mensagem Interna', icon: StickyNote },
  { value: 'add_tag', label: 'Adicionar Tag', icon: Tag },
  { value: 'remove_tag', label: 'Remover Tag', icon: TagIcon },
  { value: 'change_priority', label: 'Alterar Prioridade', icon: AlertTriangle },
  { value: 'change_category', label: 'Alterar Categoria', icon: FolderOpen },
  { value: 'change_module', label: 'Alterar Módulo', icon: Package },
  { value: 'create_conversation', label: 'Criar Novo Atendimento', icon: PlusCircle },
  { value: 'send_webhook', label: 'Enviar Webhook', icon: Globe },
  { value: 'run_flow', label: 'Executar Fluxo', icon: Workflow },
  { value: 'run_automation', label: 'Executar Automação', icon: Workflow },
  { value: 'notify', label: 'Notificar Equipe', icon: Bell },
]

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = Object.fromEntries(
  ACTION_TYPES.map(t => [t.value, t.icon])
)

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Crítica' },
]

const NOTIFY_TARGETS = [
  { value: 'assigned_agent', label: 'Agente Responsável' },
  { value: 'all_agents', label: 'Todos os Agentes' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'specific_group', label: 'Grupo Específico' },
]

const STATUS_OPTIONS = [
  { value: 'aguardando', label: 'Aguardando', slug: 'aguardando' },
  { value: 'em_atendimento', label: 'Em Atendimento', slug: 'em_atendimento' },
  { value: 'finalizado', label: 'Finalizado', slug: 'finalizado' },
]

const MESSAGE_VARIABLES = [
  '{nome_cliente}', '{nome_agente}', '{empresa_cliente}', '{produto_cliente}',
  '{etapa_atual}', '{board_atual}', '{data_hoje}', '{hora_atual}',
]

const CONDITION_FIELDS = [
  { value: 'priority', label: 'Prioridade' },
  { value: 'handler_type', label: 'Tipo de Handler' },
  { value: 'tags', label: 'Tags' },
  { value: 'status', label: 'Status' },
  { value: 'human_agent_id', label: 'Agente Humano' },
  { value: 'current_agent_id', label: 'Agente IA' },
]

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'exists', label: 'Existe' },
]

// ── Props ──
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  stageId: string
  stageLabel: string
}

// ── Sortable Action Item ──
function SortableActionItem({
  item, onToggle, onEdit, onDelete,
}: {
  item: StageAutomation
  onToggle: (id: string, active: boolean) => void
  onEdit: (item: StageAutomation) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const Icon = ICON_MAP[item.action_type] || Workflow

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="text-xs flex-1 truncate">{getActionSummary(item.action_type, item.action_config)}</span>
      <Switch checked={item.active} onCheckedChange={v => onToggle(item.id, v)} className="scale-75" />
      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onEdit(item)}>
        <Pencil className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" onClick={() => onDelete(item.id)}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  )
}

// ── Action Section ──
function ActionSection({
  title, icon: SectionIcon, items, triggerType, onAdd, onToggle, onEdit, onDelete, onReorder,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: StageAutomation[]
  triggerType: 'on_enter' | 'on_exit'
  onAdd: (triggerType: 'on_enter' | 'on_exit') => void
  onToggle: (id: string, active: boolean) => void
  onEdit: (item: StageAutomation) => void
  onDelete: (id: string) => void
  onReorder: (items: StageAutomation[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    onReorder(arrayMove(items, oldIdx, newIdx))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SectionIcon className="w-4 h-4 text-primary" />
          {title}
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAdd(triggerType)}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar Ação
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground pl-6">Nenhuma ação configurada</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableActionItem key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}

// ── Advanced Meta Fields ──
function AdvancedMetaFields({ config, setConfig }: { config: Record<string, any>; setConfig: React.Dispatch<React.SetStateAction<Record<string, any>>> }) {
  const hasDelay = !!config._use_delay
  const hasCondition = !!config._use_condition

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
        <Settings2 className="w-3 h-3" /> Configurações Avançadas
      </p>

      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={hasDelay} onCheckedChange={v => {
          if (!v) setConfig(prev => { const { _use_delay, delay_minutes, ...rest } = prev; return rest })
          else setConfig(prev => ({ ...prev, _use_delay: true, delay_minutes: 5 }))
        }} />
        Executar após delay
      </label>
      {hasDelay && (
        <div className="flex items-center gap-2 pl-6">
          <Input type="number" min={1} className="w-20 h-7 text-xs" value={config.delay_minutes || 5}
            onChange={e => setConfig(prev => ({ ...prev, delay_minutes: parseInt(e.target.value) || 0 }))} />
          <span className="text-xs text-muted-foreground">minutos</span>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={hasCondition} onCheckedChange={v => {
          if (!v) setConfig(prev => { const { _use_condition, condition, ...rest } = prev; return rest })
          else setConfig(prev => ({ ...prev, _use_condition: true, condition: { field: 'priority', operator: 'equals', value: '' } }))
        }} />
        Executar somente se
      </label>
      {hasCondition && config.condition && (
        <div className="space-y-2 pl-6">
          <Select value={config.condition.field || ''} onValueChange={v => setConfig(prev => ({ ...prev, condition: { ...prev.condition, field: v } }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Campo..." /></SelectTrigger>
            <SelectContent>{CONDITION_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={config.condition.operator || ''} onValueChange={v => setConfig(prev => ({ ...prev, condition: { ...prev.condition, operator: v } }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Operador..." /></SelectTrigger>
            <SelectContent>{CONDITION_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          {config.condition.operator !== 'exists' && (
            <Input className="h-7 text-xs" placeholder="Valor..." value={config.condition.value || ''}
              onChange={e => setConfig(prev => ({ ...prev, condition: { ...prev.condition, value: e.target.value } }))} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Create/Edit Action Dialog ──
function ActionFormDialog({
  open, onOpenChange, triggerType, editingAction, stageId, onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerType: 'on_enter' | 'on_exit'
  editingAction: StageAutomation | null
  stageId: string
  onSave: (params: { actionType: string; actionConfig: Record<string, any>; flowAutomationId?: string | null }) => void
}) {
  const [step, setStep] = useState<'type' | 'config'>(editingAction ? 'config' : 'type')
  const [actionType, setActionType] = useState(editingAction?.action_type || '')
  const [config, setConfig] = useState<Record<string, any>>(editingAction?.action_config || {})

  const resetAndClose = () => { setStep('type'); setActionType(''); setConfig({}); onOpenChange(false) }
  const navigate = useNavigate()

  // Queries
  const { data: agents = [] } = useQuery({
    queryKey: ['human-agents-active'],
    queryFn: async () => { const { data } = await supabase.from('human_agents').select('id, name').neq('is_active', false).order('name'); return data || [] },
  })

  const { data: flows = [] } = useQuery({
    queryKey: ['flow-automations-list'],
    queryFn: async () => { const { data } = await supabase.from('flow_automations').select('id, name').order('name'); return data || [] },
  })

  const { data: boards = [] } = useQuery({
    queryKey: ['kanban-boards-active'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('kanban_boards').select('id, name, slug, color').eq('active', true).order('sort_order')
      return (data || []) as Array<{ id: string; name: string; slug: string | null; color: string }>
    },
  })

  const selectedBoardId = config.board_id || ''
  const { data: stages = [] } = useQuery({
    queryKey: ['kanban-stages-for-board', selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const { data } = await (supabase as any).from('kanban_stages').select('id, name, is_entry, sort_order')
        .eq('board_id', selectedBoardId).eq('active', true).order('sort_order')
      return (data || []) as Array<{ id: string; name: string; is_entry: boolean; sort_order: number }>
    },
  })

  const { data: aiAgents = [] } = useQuery({
    queryKey: ['ai-agents-active'],
    queryFn: async () => { const { data } = await supabase.from('ai_agents').select('id, name').eq('is_active', true).order('name'); return data || [] },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('ticket_categories').select('id, name').eq('active', true).order('name')
      return (data || []) as Array<{ id: string; name: string }>
    },
  })

  const { data: modules = [] } = useQuery({
    queryKey: ['ticket-modules'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('ticket_modules').select('id, name').eq('active', true).order('name')
      return (data || []) as Array<{ id: string; name: string }>
    },
  })

  const { data: instances = [] } = useQuery({
    queryKey: ['uazapi-instances-active'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('uazapi_instances_public').select('id, instance_name, phone_number').eq('is_active', true)
      return (data || []) as Array<{ id: string; name: string; phone_number: string | null }>
    },
  })

  const { data: systemAutomations = [] } = useQuery({
    queryKey: ['ai-automations-active'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_automations').select('id, name, description, trigger_type').eq('is_active', true).order('name')
      return data || []
    },
  })

  const selectType = (t: string) => { setActionType(t); setConfig({}); setStep('config') }

  const handleSave = () => {
    // Clean up internal flags
    const { _use_delay, _use_condition, ...cleanConfig } = config
    if (!_use_delay) { delete cleanConfig.delay_minutes }
    if (!_use_condition) { delete cleanConfig.condition }

    let flowAutomationId: string | null = null
    if (actionType === 'run_flow' && cleanConfig.flow_id) flowAutomationId = cleanConfig.flow_id
    onSave({ actionType, actionConfig: cleanConfig, flowAutomationId })
    resetAndClose()
  }

  const isValid = () => {
    switch (actionType) {
      case 'change_ticket_status': return !!config.slug
      case 'assign_agent': return !!config.agent_id
      case 'send_message': return !!(config.message || '').trim()
      case 'add_tag': return !!(config.tag || '').trim()
      case 'remove_tag': return !!(config.tag || '').trim()
      case 'run_flow': return !!config.flow_id
      case 'notify': return !!config.target && !!(config.message || '').trim()
      case 'change_priority': return !!config.priority
      case 'move_to_stage': return !!config.stage_id
      case 'move_to_board': return !!config.board_id
      case 'assign_ai': return !!config.agent_id
      case 'send_internal_message': return !!(config.message || '').trim()
      case 'change_category': return !!config.category_id
      case 'change_module': return !!config.module_id
      case 'create_conversation': return !!config.board_id
      case 'send_webhook': return !!(config.url || '').trim()
      case 'run_automation': return !!config.automation_id
      default: return false
    }
  }

  const renderConfigForm = () => {
    switch (actionType) {
      case 'change_ticket_status':
        return (
          <Select value={config.slug || ''} onValueChange={v => {
            const s = STATUS_OPTIONS.find(o => o.value === v)
            setConfig({ ...config, slug: v, status_name: s?.label || '' })
          }}>
            <SelectTrigger><SelectValue placeholder="Selecionar status..." /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )

      case 'assign_agent':
        return (
          <div className="space-y-3">
            <Select value={config.agent_id || ''} onValueChange={v => {
              const a = agents.find(a => a.id === v)
              setConfig(prev => ({ ...prev, agent_id: v, agent_name: v === 'round_robin' ? 'Próximo disponível' : a?.name || '' }))
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar agente..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">🔄 Próximo disponível (round-robin)</SelectItem>
                {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={!!config.only_if_unassigned} onCheckedChange={v => setConfig(prev => ({ ...prev, only_if_unassigned: !!v }))} />
              Apenas se não tiver agente atribuído
            </label>
          </div>
        )

      case 'assign_ai':
        return (
          <div className="space-y-3">
            <Select value={config.agent_id || ''} onValueChange={v => {
              const a = aiAgents.find(a => a.id === v)
              setConfig(prev => ({ ...prev, agent_id: v, agent_name: a?.name || '' }))
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar agente IA..." /></SelectTrigger>
              <SelectContent>
                {aiAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={!!config.activate_ai} onCheckedChange={v => setConfig(prev => ({ ...prev, activate_ai: !!v }))} />
              Ativar IA para esta conversa (handler_type = ai)
            </label>
          </div>
        )

      case 'move_to_stage':
        return (
          <div className="space-y-3">
            <Select value={config.board_id || ''} onValueChange={v => {
              const b = boards.find(b => b.id === v)
              setConfig(prev => ({ ...prev, board_id: v, board_name: b?.name || '', stage_id: '', stage_name: '' }))
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar board..." /></SelectTrigger>
              <SelectContent>{boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            {config.board_id && (
              <Select value={config.stage_id || ''} onValueChange={v => {
                const s = stages.find(s => s.id === v)
                setConfig(prev => ({ ...prev, stage_id: v, stage_name: s?.name || '' }))
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar etapa..." /></SelectTrigger>
                <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={!!config.run_enter_automations} onCheckedChange={v => setConfig(prev => ({ ...prev, run_enter_automations: !!v }))} />
              Executar automações on_enter da etapa destino
            </label>
          </div>
        )

      case 'move_to_board':
        return (
          <div className="space-y-3">
            <Select value={config.board_id || ''} onValueChange={v => {
              const b = boards.find(b => b.id === v)
              setConfig(prev => ({ ...prev, board_id: v, board_name: b?.name || '', stage_id: '', stage_name: '' }))
            }}>
              <SelectTrigger><SelectValue placeholder="Board destino..." /></SelectTrigger>
              <SelectContent>{boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            {config.board_id && (
              <Select value={config.stage_id || ''} onValueChange={v => {
                const s = stages.find(s => s.id === v)
                setConfig(prev => ({ ...prev, stage_id: v, stage_name: s?.name || '' }))
              }}>
                <SelectTrigger><SelectValue placeholder="Etapa de entrada..." /></SelectTrigger>
                <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.is_entry ? ' (entrada)' : ''}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        )

      case 'send_message':
        return (
          <div className="space-y-3">
            <Textarea placeholder="Mensagem..." value={config.message || ''}
              onChange={e => setConfig(prev => ({ ...prev, message: e.target.value }))} rows={3} />
            <p className="text-xs text-muted-foreground">
              Variáveis: {MESSAGE_VARIABLES.join(', ')}
            </p>
            <WhatsAppInstanceSelect
              value={config.instance_id || '__same_channel__'}
              onChange={v => setConfig(prev => ({ ...prev, instance_id: v }))}
              showSameChannel
              label="Canal de Envio"
            />
          </div>
        )

      case 'send_internal_message':
        return (
          <div className="space-y-3">
            <Textarea placeholder="Nota interna (visível apenas para agentes)..." value={config.message || ''}
              onChange={e => setConfig(prev => ({ ...prev, message: e.target.value }))} rows={3} />
            <p className="text-xs text-muted-foreground">
              Variáveis: {MESSAGE_VARIABLES.join(', ')}
            </p>
          </div>
        )

      case 'add_tag':
        return <Input placeholder="Nome da tag..." value={config.tag || ''} onChange={e => setConfig(prev => ({ ...prev, tag: e.target.value }))} />

      case 'remove_tag':
        return <Input placeholder="Tag a remover..." value={config.tag || ''} onChange={e => setConfig(prev => ({ ...prev, tag: e.target.value }))} />

      case 'change_priority':
        return (
          <Select value={config.priority || ''} onValueChange={v => setConfig(prev => ({ ...prev, priority: v }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar prioridade..." /></SelectTrigger>
            <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        )

      case 'change_category':
        return (
          <Select value={config.category_id || ''} onValueChange={v => {
            const c = categories.find(c => c.id === v)
            setConfig(prev => ({ ...prev, category_id: v, category_name: c?.name || '' }))
          }}>
            <SelectTrigger><SelectValue placeholder="Selecionar categoria..." /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        )

      case 'change_module':
        return (
          <Select value={config.module_id || ''} onValueChange={v => {
            const m = modules.find(m => m.id === v)
            setConfig(prev => ({ ...prev, module_id: v, module_name: m?.name || '' }))
          }}>
            <SelectTrigger><SelectValue placeholder="Selecionar módulo..." /></SelectTrigger>
            <SelectContent>{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        )

      case 'create_conversation':
        return (
          <div className="space-y-3">
            <Select value={config.board_id || ''} onValueChange={v => {
              const b = boards.find(b => b.id === v)
              setConfig(prev => ({ ...prev, board_id: v, board_name: b?.name || '', stage_id: '', stage_name: '' }))
            }}>
              <SelectTrigger><SelectValue placeholder="Board..." /></SelectTrigger>
              <SelectContent>{boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            {config.board_id && (
              <Select value={config.stage_id || ''} onValueChange={v => {
                const s = stages.find(s => s.id === v)
                setConfig(prev => ({ ...prev, stage_id: v, stage_name: s?.name || '' }))
              }}>
                <SelectTrigger><SelectValue placeholder="Etapa de entrada..." /></SelectTrigger>
                <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <WhatsAppInstanceSelect
              value={config.instance_id || ''}
              onChange={v => setConfig(prev => ({ ...prev, instance_id: v }))}
              label="Canal para iniciar o contato"
              required
            />
            <div>
              <Label className="text-xs">Número do cliente</Label>
              <div className="space-y-1.5 mt-1">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={!!config.use_same_client_phone} onCheckedChange={v => setConfig(prev => ({ ...prev, use_same_client_phone: !!v, customer_phone: '' }))} />
                  Usar número do atendimento atual
                </label>
                {!config.use_same_client_phone && (
                  <Input placeholder="5511999999999" value={config.customer_phone || ''} onChange={e => setConfig(prev => ({ ...prev, customer_phone: e.target.value }))} className="text-xs" />
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={!!config.link_same_client} onCheckedChange={v => setConfig(prev => ({ ...prev, link_same_client: !!v }))} />
              Vincular ao mesmo cliente do atendimento atual
            </label>
          </div>
        )

      case 'send_webhook':
        return (
          <div className="space-y-3">
            <Input placeholder="URL destino..." value={config.url || ''} onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))} />
            <Select value={config.method || 'POST'} onValueChange={v => setConfig(prev => ({ ...prev, method: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder='Headers JSON (opcional)... {"Authorization": "Bearer ..."}' value={config.headers || ''}
              onChange={e => setConfig(prev => ({ ...prev, headers: e.target.value }))} rows={2} className="font-mono text-xs" />
            <Textarea placeholder='Body JSON (opcional)... {"conversation_id": "{id}"}' value={config.body || ''}
              onChange={e => setConfig(prev => ({ ...prev, body: e.target.value }))} rows={3} className="font-mono text-xs" />
          </div>
        )

      case 'run_flow':
        return (
          <div className="space-y-2">
            <Select value={config.flow_id || ''} onValueChange={v => {
              const f = flows.find(f => f.id === v)
              setConfig({ ...config, flow_id: v, flow_name: f?.name || '' })
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar fluxo..." /></SelectTrigger>
              <SelectContent>{flows.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => { resetAndClose(); navigate('/flow-builder') }}>
              + Criar novo fluxo no Flow Builder
            </Button>
          </div>
        )

      case 'run_automation': {
        const selectedAuto = systemAutomations.find(a => a.id === config.automation_id)
        return (
          <div className="space-y-3">
            <Select value={config.automation_id || ''} onValueChange={v => {
              const a = systemAutomations.find(a => a.id === v)
              setConfig(prev => ({ ...prev, automation_id: v, automation_name: a?.name || '' }))
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar automação..." /></SelectTrigger>
              <SelectContent>
                {systemAutomations.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedAuto && (
              <div className="rounded-md bg-muted/50 p-2 space-y-1">
                {selectedAuto.description && <p className="text-xs text-muted-foreground">{selectedAuto.description}</p>}
                <p className="text-xs text-muted-foreground">Gatilho: {selectedAuto.trigger_type}</p>
              </div>
            )}
            <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => { resetAndClose(); navigate('/automations/new') }}>
              + Criar nova automação
            </Button>
          </div>
        )
      }

      case 'notify':
        return (
          <div className="space-y-3">
            <Select value={config.target || ''} onValueChange={v => setConfig(prev => ({ ...prev, target: v }))}>
              <SelectTrigger><SelectValue placeholder="Quem notificar..." /></SelectTrigger>
              <SelectContent>{NOTIFY_TARGETS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            {config.target === 'specific_group' && (
              <Input placeholder="Nome do grupo..." value={config.group_name || ''}
                onChange={e => setConfig(prev => ({ ...prev, group_name: e.target.value }))} />
            )}
            <Textarea placeholder="Texto da notificação..." value={config.message || ''}
              onChange={e => setConfig(prev => ({ ...prev, message: e.target.value }))} rows={2} />
          </div>
        )

      default: return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) resetAndClose() }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingAction ? 'Editar Ação' : 'Nova Ação'}</DialogTitle>
        </DialogHeader>

        {step === 'type' && (
          <ScrollArea className="max-h-[60vh]">
            <div className="grid gap-1.5 pr-2">
              {ACTION_TYPES.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.value}
                    className="flex items-center gap-3 p-2.5 rounded-md border hover:bg-muted/50 text-left transition-colors"
                    onClick={() => selectType(t.value)}>
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}

        {step === 'config' && (
          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="space-y-4 pr-2">
              <Badge variant="outline" className="text-xs">
                {ACTION_TYPES.find(t => t.value === actionType)?.label}
              </Badge>

              {renderConfigForm()}

              <AdvancedMetaFields config={config} setConfig={setConfig} />

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => { if (!editingAction) setStep('type'); else resetAndClose() }}>
                  {editingAction ? 'Cancelar' : 'Voltar'}
                </Button>
                <Button size="sm" disabled={!isValid()} onClick={handleSave}>Salvar</Button>
              </DialogFooter>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Main Dialog ──
export function StageAutomationsDialog({ open, onOpenChange, stageId, stageLabel }: Props) {
  const {
    enterAutomations, exitAutomations, isLoading,
    addAction, updateAction, deleteAction, reorderActions, toggleActive,
  } = useStageAutomations(stageId)

  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionTriggerType, setActionTriggerType] = useState<'on_enter' | 'on_exit'>('on_enter')
  const [editingAction, setEditingAction] = useState<StageAutomation | null>(null)

  const openAddDialog = (triggerType: 'on_enter' | 'on_exit') => {
    setActionTriggerType(triggerType); setEditingAction(null); setActionDialogOpen(true)
  }
  const openEditDialog = (item: StageAutomation) => {
    setActionTriggerType(item.trigger_type); setEditingAction(item); setActionDialogOpen(true)
  }

  const handleSave = (params: { actionType: string; actionConfig: Record<string, any>; flowAutomationId?: string | null }) => {
    if (editingAction) {
      updateAction.mutate({ id: editingAction.id, actionConfig: params.actionConfig, flowAutomationId: params.flowAutomationId })
    } else {
      addAction.mutate({ triggerType: actionTriggerType, actionType: params.actionType, actionConfig: params.actionConfig, flowAutomationId: params.flowAutomationId })
    }
  }

  const handleReorder = (items: StageAutomation[]) => {
    reorderActions.mutate(items.map((item, idx) => ({ id: item.id, sort_order: idx })))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="w-5 h-5 text-primary" />
              Automações — {stageLabel}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="space-y-4">
              <ActionSection title="Ao Entrar nesta Etapa" icon={LogIn} items={enterAutomations} triggerType="on_enter"
                onAdd={openAddDialog} onToggle={(id, active) => toggleActive.mutate({ id, active })}
                onEdit={openEditDialog} onDelete={id => deleteAction.mutate(id)} onReorder={handleReorder} />
              <Separator />
              <ActionSection title="Ao Sair desta Etapa" icon={LogOut} items={exitAutomations} triggerType="on_exit"
                onAdd={openAddDialog} onToggle={(id, active) => toggleActive.mutate({ id, active })}
                onEdit={openEditDialog} onDelete={id => deleteAction.mutate(id)} onReorder={handleReorder} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ActionFormDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}
        triggerType={actionTriggerType} editingAction={editingAction} stageId={stageId} onSave={handleSave} />
    </>
  )
}
