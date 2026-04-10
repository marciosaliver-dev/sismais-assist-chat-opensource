import {
  MessageSquare, Bot, User, GitBranch, Clock, Globe, Tag, Variable,
  PenSquare, ArrowRight, StopCircle, Search, LayoutGrid, FolderOpen,
  Package, PlusCircle, StickyNote, Zap, Star, AlertTriangle, UserPlus,
  Bell, Shield, CalendarClock, Webhook, Server, RefreshCw, Hash,
  Timer, UserCheck, RotateCcw, CheckCircle2, XCircle, Eye,
} from 'lucide-react'

// ─── Category Colors ─────────────────────────────────────────────
export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  mensagens:  { bg: 'bg-blue-500/10',   border: 'border-l-blue-500',   text: 'text-blue-600',   icon: 'bg-blue-500' },
  ticket:     { bg: 'bg-violet-500/10',  border: 'border-l-violet-500', text: 'text-violet-600', icon: 'bg-violet-500' },
  kanban:     { bg: 'bg-emerald-500/10', border: 'border-l-emerald-500',text: 'text-emerald-600',icon: 'bg-emerald-500' },
  cliente:    { bg: 'bg-amber-500/10',   border: 'border-l-amber-500',  text: 'text-amber-600',  icon: 'bg-amber-500' },
  ia:         { bg: 'bg-cyan-500/10',    border: 'border-l-cyan-500',   text: 'text-cyan-600',   icon: 'bg-cyan-500' },
  webhook:    { bg: 'bg-pink-500/10',    border: 'border-l-pink-500',   text: 'text-pink-600',   icon: 'bg-pink-500' },
  sistema:    { bg: 'bg-slate-500/10',   border: 'border-l-slate-500',  text: 'text-slate-600',  icon: 'bg-slate-500' },
  controle:   { bg: 'bg-yellow-500/10',  border: 'border-l-yellow-500', text: 'text-yellow-600', icon: 'bg-yellow-500' },
  variaveis:  { bg: 'bg-indigo-500/10',  border: 'border-l-indigo-500', text: 'text-indigo-600', icon: 'bg-indigo-500' },
}

// ─── Triggers ────────────────────────────────────────────────────
export interface TriggerDef {
  type: string
  label: string
  description: string
  category: string
  icon: any
  options?: { key: string; label: string; type: 'text' | 'select' | 'number'; options?: string[] }[]
}

export const TRIGGER_CATEGORIES = [
  {
    name: 'Mensagens',
    category: 'mensagens',
    triggers: [
      { type: 'message_received', label: 'Mensagem Recebida do Cliente', description: 'Quando o cliente envia qualquer mensagem', icon: MessageSquare, options: [{ key: 'subtype', label: 'Tipo', type: 'select' as const, options: ['Qualquer', 'Contém palavra-chave', 'Primeira mensagem', 'Com mídia'] }] },
      { type: 'agent_message_sent', label: 'Mensagem Enviada pelo Agente', description: 'Quando um agente envia uma mensagem', icon: User },
      { type: 'ai_message_sent', label: 'Mensagem de IA Enviada', description: 'Quando a IA envia uma resposta', icon: Bot },
    ],
  },
  {
    name: 'Ticket',
    category: 'ticket',
    triggers: [
      { type: 'ticket_created', label: 'Ticket Criado', description: 'Quando um novo ticket é criado', icon: PlusCircle },
      { type: 'ticket_updated', label: 'Ticket Atualizado', description: 'Quando qualquer campo é alterado', icon: RefreshCw },
      { type: 'status_changed', label: 'Status Alterado', description: 'De um status para outro', icon: ArrowRight, options: [{ key: 'from_status', label: 'De', type: 'text' as const }, { key: 'to_status', label: 'Para', type: 'text' as const }] },
      { type: 'priority_changed', label: 'Prioridade Alterada', description: 'Quando a prioridade muda', icon: AlertTriangle, options: [{ key: 'to_priority', label: 'Para', type: 'select' as const, options: ['Baixa', 'Média', 'Alta', 'Urgente'] }] },
      { type: 'agent_assigned', label: 'Ticket Atribuído', description: 'Quando atribuído a um agente', icon: UserCheck },
      { type: 'conversation_closed', label: 'Ticket Resolvido', description: 'Quando o ticket é resolvido', icon: CheckCircle2 },
      { type: 'conversation_reopened', label: 'Ticket Reaberto', description: 'Quando um ticket é reaberto', icon: RotateCcw },
      { type: 'tag_added', label: 'Tag Adicionada', description: 'Quando uma tag é adicionada', icon: Tag },
      { type: 'csat_received', label: 'CSAT Recebido', description: 'Quando avaliação é recebida', icon: Star },
      { type: 'sla_breached', label: 'SLA Violado', description: 'Quando o SLA é violado', icon: Shield },
      { type: 'no_response_timeout', label: 'SLA em Risco', description: 'Sem resposta por X min', icon: Timer, options: [{ key: 'timeout_minutes', label: 'Minutos', type: 'number' as const }] },
    ],
  },
  {
    name: 'Kanban',
    category: 'kanban',
    triggers: [
      { type: 'stage_changed', label: 'Etapa Alterada', description: 'Card movido de etapa', icon: LayoutGrid },
      { type: 'card_created_stage', label: 'Card Criado em Etapa', description: 'Novo card criado', icon: PlusCircle },
    ],
  },
  {
    name: 'Cliente',
    category: 'cliente',
    triggers: [
      { type: 'new_customer', label: 'Novo Cliente Cadastrado', description: 'Quando um novo contato aparece', icon: UserPlus },
      { type: 'customer_updated', label: 'Cliente Atualizado', description: 'Quando dados do cliente mudam', icon: PenSquare },
      { type: 'health_score_low', label: 'Health Score Baixo', description: 'Score abaixo do limite', icon: AlertTriangle },
    ],
  },
  {
    name: 'Webhook',
    category: 'webhook',
    triggers: [
      { type: 'webhook', label: 'Webhook Recebido', description: 'Endpoint externo dispara', icon: Globe },
      { type: 'form_response', label: 'Resposta de Formulário', description: 'Formulário preenchido', icon: Hash },
    ],
  },
  {
    name: 'Sistema',
    category: 'sistema',
    triggers: [
      { type: 'scheduled', label: 'Agendamento CRON', description: 'Executa em horário definido', icon: CalendarClock },
      { type: 'out_of_hours', label: 'Fora do Horário', description: 'Fora do expediente', icon: Clock },
    ],
  },
]

// Flatten for lookup
export const ALL_TRIGGERS = TRIGGER_CATEGORIES.flatMap(c => c.triggers)

export const TRIGGER_LABELS: Record<string, string> = Object.fromEntries(
  ALL_TRIGGERS.map(t => [t.type, t.label])
)

export const TRIGGER_CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  TRIGGER_CATEGORIES.flatMap(c => c.triggers.map(t => [t.type, c.category]))
)

// ─── Filter Fields ───────────────────────────────────────────────
export const FILTER_OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'not_contains', label: 'Não contém' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'exists', label: 'Existe' },
  { value: 'not_exists', label: 'Não existe' },
]

export interface FilterFieldOption {
  value: string
  label: string
}

export interface FilterFieldDef {
  value: string
  label: string
  group: string
  valueType?: 'static' | 'dynamic:kanban_stages' | 'dynamic:agents'
  staticOptions?: FilterFieldOption[]
}

export const FILTER_FIELDS: FilterFieldDef[] = [
  { value: 'conversation_channel', label: 'Canal', group: 'Conversa', valueType: 'static', staticOptions: [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'webchat', label: 'Webchat' },
    { value: 'email', label: 'Email' },
  ] },
  { value: 'ticket_status', label: 'Status do Ticket', group: 'Conversa', valueType: 'static', staticOptions: [
    { value: 'active', label: 'Ativo' },
    { value: 'waiting', label: 'Aguardando' },
    { value: 'resolved', label: 'Resolvido' },
    { value: 'closed', label: 'Fechado' },
  ] },
  { value: 'ticket_priority', label: 'Prioridade', group: 'Conversa', valueType: 'static', staticOptions: [
    { value: 'low', label: 'Baixa' },
    { value: 'medium', label: 'Média' },
    { value: 'high', label: 'Alta' },
    { value: 'urgent', label: 'Urgente' },
  ] },
  { value: 'assigned_agent', label: 'Agente Responsável', group: 'Conversa', valueType: 'dynamic:agents' },
  { value: 'kanban_stage', label: 'Etapa do Kanban', group: 'Conversa', valueType: 'dynamic:kanban_stages' },
  { value: 'ticket_tags', label: 'Tags do Ticket', group: 'Conversa' },
  { value: 'sentiment', label: 'Sentimento', group: 'Conversa', valueType: 'static', staticOptions: [
    { value: 'positive', label: 'Positivo' },
    { value: 'neutral', label: 'Neutro' },
    { value: 'negative', label: 'Negativo' },
  ] },
  { value: 'wait_time_minutes', label: 'Tempo sem resposta (min)', group: 'Conversa' },
  { value: 'message_count', label: 'Nº de mensagens', group: 'Conversa' },
  { value: 'has_ai', label: 'IA ativa', group: 'Conversa', valueType: 'static', staticOptions: [
    { value: 'true', label: 'Sim' },
    { value: 'false', label: 'Não' },
  ] },
  { value: 'customer_name', label: 'Nome do Cliente', group: 'Cliente' },
  { value: 'customer_phone', label: 'Telefone', group: 'Cliente' },
  { value: 'customer_email', label: 'Email', group: 'Cliente' },
  { value: 'customer_tags', label: 'Tags do Cliente', group: 'Cliente' },
  { value: 'health_score', label: 'Health Score', group: 'Cliente' },
  { value: 'first_contact', label: 'Primeiro contato', group: 'Cliente', valueType: 'static', staticOptions: [
    { value: 'true', label: 'Sim' },
    { value: 'false', label: 'Não' },
  ] },
  { value: 'message_content', label: 'Conteúdo da mensagem', group: 'Mensagem' },
  { value: 'message_type', label: 'Tipo da mensagem', group: 'Mensagem', valueType: 'static', staticOptions: [
    { value: 'text', label: 'Texto' },
    { value: 'image', label: 'Imagem' },
    { value: 'audio', label: 'Áudio' },
    { value: 'video', label: 'Vídeo' },
    { value: 'document', label: 'Documento' },
  ] },
  { value: 'message_sender', label: 'Remetente', group: 'Mensagem', valueType: 'static', staticOptions: [
    { value: 'customer', label: 'Cliente' },
    { value: 'agent', label: 'Agente' },
    { value: 'ai', label: 'IA' },
  ] },
  { value: 'current_hour', label: 'Horário atual', group: 'Data/Hora' },
  { value: 'current_weekday', label: 'Dia da semana', group: 'Data/Hora', valueType: 'static', staticOptions: [
    { value: 'Segunda', label: 'Segunda' },
    { value: 'Terça', label: 'Terça' },
    { value: 'Quarta', label: 'Quarta' },
    { value: 'Quinta', label: 'Quinta' },
    { value: 'Sexta', label: 'Sexta' },
    { value: 'Sábado', label: 'Sábado' },
    { value: 'Domingo', label: 'Domingo' },
  ] },
  { value: 'business_hours', label: 'Horário comercial', group: 'Data/Hora', valueType: 'static', staticOptions: [
    { value: 'true', label: 'Sim' },
    { value: 'false', label: 'Não' },
  ] },
]

// ─── Actions ─────────────────────────────────────────────────────
export interface ActionFieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  options?: string[]
  placeholder?: string
}

export interface ActionDef {
  type: string
  label: string
  description: string
  category: string
  icon: any
  fields?: ActionFieldDef[]
}

export const ACTION_CATEGORIES = [
  {
    name: 'Mensagens',
    category: 'mensagens',
    actions: [
      { type: 'send_message', label: 'Enviar Mensagem', description: 'Enviar mensagem ao cliente', icon: MessageSquare, fields: [{ key: 'message', label: 'Mensagem', type: 'textarea' as const, placeholder: 'Olá {{customer_name}}!' }] },
      { type: 'send_internal_message', label: 'Nota Interna', description: 'Nota visível apenas para agentes', icon: StickyNote, fields: [{ key: 'message', label: 'Nota', type: 'textarea' as const }] },
      { type: 'notify_agent', label: 'Notificar Agente', description: 'Enviar notificação ao agente', icon: Bell, fields: [{ key: 'message', label: 'Mensagem', type: 'textarea' as const }] },
    ],
  },
  {
    name: 'Ticket',
    category: 'ticket',
    actions: [
      { type: 'update_status', label: 'Atualizar Status', description: 'Mudar status do ticket', icon: RefreshCw, fields: [{ key: 'status', label: 'Novo Status', type: 'select' as const, options: ['Aberto', 'Em Andamento', 'Aguardando', 'Resolvido', 'Fechado'] }] },
      { type: 'update_priority', label: 'Atualizar Prioridade', description: 'Mudar prioridade', icon: AlertTriangle, fields: [{ key: 'priority', label: 'Prioridade', type: 'select' as const, options: ['low', 'medium', 'high', 'urgent'] }] },
      { type: 'add_tag', label: 'Adicionar Tag', description: 'Adicionar tag ao ticket', icon: Tag, fields: [{ key: 'tag', label: 'Tag', type: 'text' as const }] },
      { type: 'remove_tag', label: 'Remover Tag', description: 'Remover tag do ticket', icon: XCircle, fields: [{ key: 'tag', label: 'Tag', type: 'text' as const }] },
      { type: 'assign_human', label: 'Atribuir Humano', description: 'Atribuir a agente humano', icon: User, fields: [{ key: 'strategy', label: 'Estratégia', type: 'select' as const, options: ['Específico', 'Menos sobrecarregado', 'Round Robin'] }] },
      { type: 'assign_ai', label: 'Atribuir IA', description: 'Atribuir a agente IA', icon: Bot },
      { type: 'resolve_ticket', label: 'Resolver Ticket', description: 'Resolver automaticamente', icon: CheckCircle2 },
      { type: 'add_note', label: 'Nota Interna', description: 'Adicionar nota ao ticket', icon: StickyNote, fields: [{ key: 'note', label: 'Nota', type: 'textarea' as const }] },
    ],
  },
  {
    name: 'Kanban',
    category: 'kanban',
    actions: [
      { type: 'move_to_stage', label: 'Mover Etapa', description: 'Mover card para etapa', icon: ArrowRight },
      { type: 'move_to_board', label: 'Mover Board', description: 'Mover para outro board', icon: LayoutGrid },
    ],
  },
  {
    name: 'Cliente',
    category: 'cliente',
    actions: [
      { type: 'update_customer', label: 'Atualizar Cliente', description: 'Atualizar campo do cliente', icon: PenSquare, fields: [{ key: 'field', label: 'Campo', type: 'text' as const }, { key: 'value', label: 'Valor', type: 'text' as const }] },
      { type: 'add_customer_tag', label: 'Tag do Cliente', description: 'Adicionar tag ao cliente', icon: Tag, fields: [{ key: 'tag', label: 'Tag', type: 'text' as const }] },
    ],
  },
  {
    name: 'IA',
    category: 'ia',
    actions: [
      { type: 'ai_response', label: 'Resposta IA', description: 'Acionar resposta da IA', icon: Bot },
      { type: 'pause_ai', label: 'Pausar IA', description: 'Pausar IA por X minutos', icon: Clock, fields: [{ key: 'minutes', label: 'Minutos', type: 'number' as const }] },
      { type: 'search_knowledge', label: 'Busca RAG', description: 'Buscar na base de conhecimento', icon: Search },
    ],
  },
  {
    name: 'Webhook',
    category: 'webhook',
    actions: [
      { type: 'http_request', label: 'Chamada HTTP', description: 'Webhook externo', icon: Globe, fields: [
        { key: 'url', label: 'URL', type: 'text' as const, placeholder: 'https://...' },
        { key: 'method', label: 'Método', type: 'select' as const, options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        { key: 'body', label: 'Body (JSON)', type: 'textarea' as const },
      ] },
    ],
  },
  {
    name: 'Controle',
    category: 'controle',
    actions: [
      { type: 'delay', label: 'Aguardar', description: 'Esperar X minutos', icon: Clock, fields: [{ key: 'minutes', label: 'Minutos', type: 'number' as const }] },
      { type: 'wait_response', label: 'Aguardar Resposta', description: 'Esperar resposta do cliente', icon: Timer, fields: [{ key: 'timeout_minutes', label: 'Timeout (min)', type: 'number' as const }] },
      { type: 'stop', label: 'Parar Automação', description: 'Encerrar execução', icon: StopCircle },
      { type: 'jump_to_flow', label: 'Executar Fluxo', description: 'Executar fluxo visual', icon: GitBranch },
    ],
  },
]

export const ALL_ACTIONS: ActionDef[] = ACTION_CATEGORIES.flatMap(c => c.actions as ActionDef[])

// ─── Dynamic Variables ───────────────────────────────────────────
export const DYNAMIC_VARIABLES = [
  { group: 'Conversa', vars: [
    '{{conversation_id}}', '{{conversation_status}}', '{{conversation_priority}}',
    '{{conversation_tags}}', '{{conversation_channel}}', '{{conversation_etapa}}',
    '{{first_message}}', '{{last_message}}', '{{message_count}}',
    '{{wait_time_minutes}}', '{{created_at}}', '{{updated_at}}',
  ]},
  { group: 'Cliente', vars: [
    '{{customer_name}}', '{{customer_phone}}', '{{customer_email}}',
    '{{customer_tags}}', '{{customer_health_score}}', '{{customer_segment}}',
  ]},
  { group: 'Agente', vars: [
    '{{agent_name}}', '{{agent_email}}', '{{assigned_agent}}',
  ]},
  { group: 'Mensagem', vars: [
    '{{message_content}}', '{{message_type}}', '{{message_timestamp}}',
  ]},
  { group: 'Sistema', vars: [
    '{{current_date}}', '{{current_time}}', '{{current_weekday}}',
    '{{instance_name}}', '{{company_name}}',
  ]},
  { group: 'Ações Anteriores', vars: [
    '{{webhook_response}}', '{{rag_result}}',
  ]},
]

// ─── Templates ───────────────────────────────────────────────────
export const AUTOMATION_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Boas-vindas Automáticas',
    description: 'Mensagem de boas-vindas para novos contatos',
    icon: MessageSquare,
    category: 'mensagens',
    trigger_type: 'message_received',
    trigger_conditions: { logic: 'AND', conditions: [{ field: 'first_contact', operator: 'equals', value: 'true' }] },
    actions: [{ type: 'send_message', category: 'mensagens', params: { message: 'Olá {{customer_name}}! 👋 Como posso ajudar?' }, delay_minutes: 0 }],
  },
  {
    id: 'escalate_timeout',
    name: 'Escalar após Timeout',
    description: 'Transfere para humano após 10min sem resposta',
    icon: Timer,
    category: 'ticket',
    trigger_type: 'no_response_timeout',
    trigger_conditions: { logic: 'AND', conditions: [] },
    actions: [
      { type: 'assign_human', category: 'ticket', params: { strategy: 'least_busy' }, delay_minutes: 0 },
      { type: 'send_message', category: 'mensagens', params: { message: 'Estou transferindo para um especialista ⏳' }, delay_minutes: 0 },
    ],
  },
  {
    id: 'csat_after_resolve',
    name: 'CSAT após Resolução',
    description: 'Envia pesquisa de satisfação após resolver ticket',
    icon: Star,
    category: 'ticket',
    trigger_type: 'conversation_closed',
    trigger_conditions: { logic: 'AND', conditions: [] },
    actions: [{ type: 'send_message', category: 'mensagens', params: { message: 'Como foi seu atendimento? Avalie de 1 a 5 ⭐' }, delay_minutes: 5 }],
  },
  {
    id: 'notify_agent_new',
    name: 'Notificar Agente',
    description: 'Notifica o agente quando recebe novo ticket',
    icon: Bell,
    category: 'ticket',
    trigger_type: 'ticket_created',
    trigger_conditions: { logic: 'AND', conditions: [] },
    actions: [{ type: 'notify_agent', category: 'mensagens', params: { message: 'Novo ticket #{{conversation_id}} de {{customer_name}}' }, delay_minutes: 0 }],
  },
  {
    id: 'negative_sentiment',
    name: 'Escalonar Sentimento Negativo',
    description: 'Passa para humano quando detecta insatisfação',
    icon: AlertTriangle,
    category: 'ia',
    trigger_type: 'message_received',
    trigger_conditions: { logic: 'AND', conditions: [{ field: 'sentiment', operator: 'equals', value: 'negative' }] },
    actions: [
      { type: 'assign_human', category: 'ticket', params: { strategy: 'least_busy' }, delay_minutes: 0 },
      { type: 'add_tag', category: 'ticket', params: { tag: 'urgente' }, delay_minutes: 0 },
    ],
  },
  {
    id: 'after_hours',
    name: 'Fora do Horário',
    description: 'Mensagem automática fora do expediente',
    icon: Clock,
    category: 'sistema',
    trigger_type: 'out_of_hours',
    trigger_conditions: { logic: 'AND', conditions: [] },
    actions: [{ type: 'send_message', category: 'mensagens', params: { message: '🌙 Nosso horário é de 8h às 18h. Responderemos em breve!' }, delay_minutes: 0 }],
  },
  {
    id: 'vip_routing',
    name: 'Roteamento VIP',
    description: 'Prioriza clientes VIP automaticamente',
    icon: UserPlus,
    category: 'cliente',
    trigger_type: 'ticket_created',
    trigger_conditions: { logic: 'AND', conditions: [{ field: 'customer_tags', operator: 'contains', value: 'vip' }] },
    actions: [
      { type: 'update_priority', category: 'ticket', params: { priority: 'high' }, delay_minutes: 0 },
      { type: 'add_tag', category: 'ticket', params: { tag: 'vip' }, delay_minutes: 0 },
    ],
  },
  {
    id: 'webhook_report',
    name: 'Resumo via Webhook',
    description: 'Envia relatório diário via webhook externo',
    icon: Webhook,
    category: 'webhook',
    trigger_type: 'scheduled',
    trigger_conditions: { logic: 'AND', conditions: [] },
    actions: [{ type: 'http_request', category: 'webhook', params: { url: 'https://hooks.example.com/daily', method: 'POST' }, delay_minutes: 0 }],
  },
]
