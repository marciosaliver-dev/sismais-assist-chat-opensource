export type NodeType =
  | 'trigger'
  | 'send_message'
  | 'ai_response'
  | 'assign_human'
  | 'assign_ai'
  | 'condition'
  | 'switch'
  | 'delay'
  | 'http_request'
  | 'update_field'
  | 'add_tag'
  | 'set_variable'
  | 'jump_to_flow'
  | 'end'
  | 'search_knowledge'
  | 'move_to_stage'
  | 'move_to_board'
  | 'remove_tag'
  | 'change_category'
  | 'change_module'
  | 'create_conversation'
  | 'send_internal_message'
  | 'check_schedule'
  | 'wait_response'
  | 'check_customer'
  | 'loop_wait'

export interface FlowNodeData {
  label: string
  config: Record<string, any>
}

export interface FlowNode {
  id: string
  type: NodeType
  data: FlowNodeData
  position: { x: number; y: number }
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  type?: string
}

export interface FlowAutomation {
  id: string
  name: string
  description?: string | null
  nodes: FlowNode[]
  edges: FlowEdge[]
  variables: Record<string, any>
  trigger_type: string
  trigger_config: Record<string, any>
  whatsapp_instances: string[]
  is_active: boolean
  is_published: boolean
  version: number
  execution_count: number
  success_count: number
  error_count: number
  last_executed_at?: string | null
  avg_execution_time_ms?: number | null
  created_by?: string | null
  updated_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface FlowVersion {
  id: string
  flow_id: string
  version: number
  nodes: FlowNode[]
  edges: FlowEdge[]
  variables?: Record<string, any> | null
  created_by?: string | null
  created_at?: string | null
}

export interface FlowExecution {
  id: string
  flow_id: string
  conversation_id?: string | null
  trigger_data?: Record<string, any> | null
  executed_nodes: Array<{
    node_id: string
    status: string
    output?: any
    duration_ms?: number
  }>
  current_node_id?: string | null
  status: 'running' | 'completed' | 'failed' | 'paused'
  error_message?: string | null
  started_at?: string | null
  completed_at?: string | null
  execution_time_ms?: number | null
  variables: Record<string, any>
  user_id?: string | null
}

export interface HumanAgent {
  id: string
  user_id?: string | null
  name: string
  email?: string | null
  avatar_url?: string | null
  is_active: boolean
  is_online: boolean
  status: 'available' | 'busy' | 'away' | 'offline'
  max_concurrent_conversations: number
  current_conversations_count: number
  specialties: string[]
  languages: string[]
  whatsapp_instances: string[]
  total_conversations: number
  avg_response_time_seconds?: number | null
  avg_resolution_time_seconds?: number | null
  csat_rating?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface AgentAssignment {
  id: string
  conversation_id: string
  agent_type: 'ai' | 'human'
  ai_agent_id?: string | null
  human_agent_id?: string | null
  assigned_at?: string | null
  assigned_by?: string | null
  unassigned_at?: string | null
  reason?: string | null
}

// Node-specific config types
export interface SendMessageConfig {
  message: string
  instance_id?: string
  buttons?: Array<{ id: string; text: string }>
}

export interface AIResponseConfig {
  agent_id?: string
  context?: string
  max_tokens?: number
}

export interface AssignHumanConfig {
  strategy: 'specific' | 'round_robin' | 'least_busy'
  agent_id?: string
  specialty_filter?: string
}

export interface AssignAIConfig {
  agent_id?: string
}

export interface ConditionConfig {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists'
  value: string
  true_label?: string
  false_label?: string
}

export interface SwitchConfig {
  field: string
  cases: Array<{ value: string; label: string }>
  default_label?: string
}

export interface DelayConfig {
  duration: number
  unit: 'seconds' | 'minutes' | 'hours'
}

export interface HTTPRequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
}

export interface AddTagConfig {
  tag: string
}

export interface SetVariableConfig {
  variable_name: string
  value: string
}

export interface UpdateFieldConfig {
  entity: 'conversation' | 'contact'
  field: string
  value: string
}

export interface JumpToFlowConfig {
  flow_id?: string
  flow_name?: string
}

export interface SearchKnowledgeConfig {
  query: string
  top_k?: number
  category?: string
}

export interface TriggerConfig {
  trigger_type:
    | 'message_received'
    | 'ticket_created'
    | 'scheduled'
    | 'webhook'
    | 'status_changed'
    | 'stage_changed'
    | 'conversation_closed'
    | 'conversation_reopened'
    | 'agent_assigned'
    | 'tag_added'
    | 'priority_changed'
    | 'sla_breached'
    | 'csat_received'
    | 'no_response_timeout'
  keywords?: string[]
  schedule_cron?: string
  webhook_path?: string
  tag?: string
  agent_type_filter?: 'ai' | 'human' | ''
  agent_id?: string
  from_priority?: string
  to_priority?: string
  csat_min?: number
  csat_max?: number
  timeout_minutes?: number
}
