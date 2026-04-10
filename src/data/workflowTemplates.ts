/**
 * Templates de Workflows prontos para uso.
 * Cada template gera nodes/edges para o Flow Builder.
 *
 * Categorias:
 *   - atendimento: fluxos de suporte ao cliente
 *   - operacional: automacoes internas
 *   - vendas: qualificacao e follow-up
 *   - sistema: monitoramento e SLA
 */

import type { FlowNode, FlowEdge } from '@/types/flow'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'atendimento' | 'operacional' | 'vendas' | 'sistema'
  triggerType: string
  triggerConfig: Record<string, any>
  nodes: FlowNode[]
  edges: FlowEdge[]
  variables: Record<string, any>
}

// ─── Helpers ──────────────────────────────────────────────

let _id = 0
function nid(type: string) { return `${type}-tpl-${++_id}` }

function resetIds() { _id = 0 }

// ─── Template 1: Auto-resposta fora do horario ───────────

function outOfHoursTemplate(): WorkflowTemplate {
  resetIds()
  const trigger = nid('trigger')
  const checkSchedule = nid('check_schedule')
  const sendOff = nid('send_message')
  const endOff = nid('end')
  // ramo business hours -> nao faz nada (passa pro agente)
  const endOn = nid('end')

  return {
    id: 'tpl-out-of-hours',
    name: 'Auto-resposta Fora do Horario',
    description: 'Envia mensagem automatica quando cliente entra em contato fora do expediente. Se dentro do horario, segue o fluxo normal.',
    category: 'atendimento',
    triggerType: 'message_received',
    triggerConfig: {},
    variables: {},
    nodes: [
      { id: trigger, type: 'trigger', data: { label: 'Mensagem Recebida', config: {} }, position: { x: 250, y: 0 } },
      { id: checkSchedule, type: 'check_schedule', data: { label: 'Horario Comercial?', config: { start_hour: 8, end_hour: 18, work_days: [1, 2, 3, 4, 5] } }, position: { x: 250, y: 120 } },
      { id: sendOff, type: 'send_message', data: { label: 'Mensagem Fora do Horario', config: { message: 'Ola! Nosso horario de atendimento e de segunda a sexta, das 8h as 18h. Sua mensagem foi registrada e responderemos assim que possivel!' } }, position: { x: 50, y: 260 } },
      { id: endOff, type: 'end', data: { label: 'Fim', config: {} }, position: { x: 50, y: 400 } },
      { id: endOn, type: 'end', data: { label: 'Seguir Atendimento', config: {} }, position: { x: 450, y: 260 } },
    ],
    edges: [
      { id: `e-${trigger}-${checkSchedule}`, source: trigger, target: checkSchedule },
      { id: `e-${checkSchedule}-${sendOff}`, source: checkSchedule, target: sendOff, sourceHandle: 'false', label: 'Fora do horario' },
      { id: `e-${checkSchedule}-${endOn}`, source: checkSchedule, target: endOn, sourceHandle: 'true', label: 'Dentro do horario' },
      { id: `e-${sendOff}-${endOff}`, source: sendOff, target: endOff },
    ],
  }
}

// ─── Template 2: Escalacao por SLA ───────────────────────

function slaEscalationTemplate(): WorkflowTemplate {
  resetIds()
  const trigger = nid('trigger')
  const addTag = nid('add_tag')
  const assignHuman = nid('assign_human')
  const sendMsg = nid('send_message')
  const end = nid('end')

  return {
    id: 'tpl-sla-escalation',
    name: 'Escalacao por SLA',
    description: 'Quando o SLA e violado, adiciona tag "sla-violado", atribui a um agente humano e notifica o cliente.',
    category: 'sistema',
    triggerType: 'sla_breached',
    triggerConfig: {},
    variables: {},
    nodes: [
      { id: trigger, type: 'trigger', data: { label: 'SLA Violado', config: {} }, position: { x: 250, y: 0 } },
      { id: addTag, type: 'add_tag', data: { label: 'Marcar SLA', config: { tag: 'sla-violado' } }, position: { x: 250, y: 120 } },
      { id: assignHuman, type: 'assign_human', data: { label: 'Atribuir Agente', config: { assignment_type: 'auto', strategy: 'least_busy' } }, position: { x: 250, y: 250 } },
      { id: sendMsg, type: 'send_message', data: { label: 'Notificar Cliente', config: { message: 'Pedimos desculpas pela demora. Um especialista esta sendo acionado para atende-lo agora.' } }, position: { x: 250, y: 380 } },
      { id: end, type: 'end', data: { label: 'Fim', config: {} }, position: { x: 250, y: 500 } },
    ],
    edges: [
      { id: `e-${trigger}-${addTag}`, source: trigger, target: addTag },
      { id: `e-${addTag}-${assignHuman}`, source: addTag, target: assignHuman },
      { id: `e-${assignHuman}-${sendMsg}`, source: assignHuman, target: sendMsg },
      { id: `e-${sendMsg}-${end}`, source: sendMsg, target: end },
    ],
  }
}

// ─── Template 3: Follow-up pos-atendimento ───────────────

function postServiceFollowUpTemplate(): WorkflowTemplate {
  resetIds()
  const trigger = nid('trigger')
  const delay = nid('delay')
  const sendCsat = nid('send_message')
  const end = nid('end')

  return {
    id: 'tpl-follow-up',
    name: 'Follow-up Pos-Atendimento',
    description: 'Apos resolucao do ticket, aguarda 30 minutos e envia pesquisa de satisfacao (CSAT).',
    category: 'atendimento',
    triggerType: 'conversation_closed',
    triggerConfig: {},
    variables: {},
    nodes: [
      { id: trigger, type: 'trigger', data: { label: 'Ticket Resolvido', config: {} }, position: { x: 250, y: 0 } },
      { id: delay, type: 'delay', data: { label: 'Aguardar 30min', config: { duration: 30, unit: 'minutes' } }, position: { x: 250, y: 120 } },
      { id: sendCsat, type: 'send_message', data: { label: 'Enviar CSAT', config: { message: 'Ola {customer_name}! Seu atendimento foi encerrado. Como voce avalia nosso suporte? Responda de 1 (ruim) a 5 (excelente).' } }, position: { x: 250, y: 260 } },
      { id: end, type: 'end', data: { label: 'Fim', config: {} }, position: { x: 250, y: 380 } },
    ],
    edges: [
      { id: `e-${trigger}-${delay}`, source: trigger, target: delay },
      { id: `e-${delay}-${sendCsat}`, source: delay, target: sendCsat },
      { id: `e-${sendCsat}-${end}`, source: sendCsat, target: end },
    ],
  }
}

// ─── Template 4: Triagem inteligente com IA ──────────────

function aiTriageTemplate(): WorkflowTemplate {
  resetIds()
  const trigger = nid('trigger')
  const checkCustomer = nid('check_customer')
  const aiResponse = nid('ai_response')
  const condition = nid('condition')
  const assignHuman = nid('assign_human')
  const end = nid('end')

  return {
    id: 'tpl-ai-triage',
    name: 'Triagem Inteligente com IA',
    description: 'Nova mensagem e processada pela IA. Se confianca for baixa, escala automaticamente para humano.',
    category: 'atendimento',
    triggerType: 'message_received',
    triggerConfig: {},
    variables: {},
    nodes: [
      { id: trigger, type: 'trigger', data: { label: 'Mensagem Recebida', config: {} }, position: { x: 250, y: 0 } },
      { id: aiResponse, type: 'ai_response', data: { label: 'Resposta IA', config: { use_rag: true } }, position: { x: 250, y: 120 } },
      { id: condition, type: 'condition', data: { label: 'Confianca OK?', config: { field: 'ai_confidence', operator: 'greater_than', value: '0.5' } }, position: { x: 250, y: 260 } },
      { id: end, type: 'end', data: { label: 'Resolvido pela IA', config: {} }, position: { x: 450, y: 400 } },
      { id: assignHuman, type: 'assign_human', data: { label: 'Escalar para Humano', config: { assignment_type: 'auto' } }, position: { x: 50, y: 400 } },
    ],
    edges: [
      { id: `e-${trigger}-${aiResponse}`, source: trigger, target: aiResponse },
      { id: `e-${aiResponse}-${condition}`, source: aiResponse, target: condition },
      { id: `e-${condition}-${end}`, source: condition, target: end, sourceHandle: 'true', label: 'Confianca alta' },
      { id: `e-${condition}-${assignHuman}`, source: condition, target: assignHuman, sourceHandle: 'false', label: 'Confianca baixa' },
    ],
  }
}

// ─── Template 5: Roteamento VIP ──────────────────────────

function vipRoutingTemplate(): WorkflowTemplate {
  resetIds()
  const trigger = nid('trigger')
  const condition = nid('condition')
  const setHighPriority = nid('update_field')
  const addTag = nid('add_tag')
  const assignHuman = nid('assign_human')
  const sendVip = nid('send_message')
  const endVip = nid('end')
  const endNormal = nid('end')

  return {
    id: 'tpl-vip-routing',
    name: 'Roteamento VIP',
    description: 'Detecta clientes VIP (tag "vip") e os redireciona com prioridade alta para agente dedicado.',
    category: 'vendas',
    triggerType: 'message_received',
    triggerConfig: {},
    variables: {},
    nodes: [
      { id: trigger, type: 'trigger', data: { label: 'Mensagem Recebida', config: {} }, position: { x: 250, y: 0 } },
      { id: condition, type: 'condition', data: { label: 'Cliente VIP?', config: { field: 'customer_tags', operator: 'contains', value: 'vip' } }, position: { x: 250, y: 120 } },
      { id: setHighPriority, type: 'update_field', data: { label: 'Prioridade Alta', config: { entity: 'conversation', field: 'priority', value: 'high' } }, position: { x: 50, y: 260 } },
      { id: addTag, type: 'add_tag', data: { label: 'Tag VIP', config: { tag: 'vip-atendimento' } }, position: { x: 50, y: 380 } },
      { id: assignHuman, type: 'assign_human', data: { label: 'Agente VIP', config: { assignment_type: 'auto' } }, position: { x: 50, y: 500 } },
      { id: sendVip, type: 'send_message', data: { label: 'Saudacao VIP', config: { message: 'Ola {customer_name}! Como cliente VIP, voce tem atendimento prioritario. Um especialista ja esta cuidando do seu caso.' } }, position: { x: 50, y: 620 } },
      { id: endVip, type: 'end', data: { label: 'Fim VIP', config: {} }, position: { x: 50, y: 740 } },
      { id: endNormal, type: 'end', data: { label: 'Atendimento Normal', config: {} }, position: { x: 450, y: 260 } },
    ],
    edges: [
      { id: `e-${trigger}-${condition}`, source: trigger, target: condition },
      { id: `e-${condition}-${setHighPriority}`, source: condition, target: setHighPriority, sourceHandle: 'true', label: 'Sim' },
      { id: `e-${condition}-${endNormal}`, source: condition, target: endNormal, sourceHandle: 'false', label: 'Nao' },
      { id: `e-${setHighPriority}-${addTag}`, source: setHighPriority, target: addTag },
      { id: `e-${addTag}-${assignHuman}`, source: addTag, target: assignHuman },
      { id: `e-${assignHuman}-${sendVip}`, source: assignHuman, target: sendVip },
      { id: `e-${sendVip}-${endVip}`, source: sendVip, target: endVip },
    ],
  }
}

// ─── Template 6: Webhook externo + RAG ───────────────────

function webhookRagTemplate(): WorkflowTemplate {
  resetIds()
  const trigger = nid('trigger')
  const search = nid('search_knowledge')
  const httpReq = nid('http_request')
  const end = nid('end')

  return {
    id: 'tpl-webhook-rag',
    name: 'Webhook Externo com RAG',
    description: 'Recebe webhook externo, busca resposta na base de conhecimento e envia resultado para API de callback.',
    category: 'operacional',
    triggerType: 'webhook',
    triggerConfig: {},
    variables: {},
    nodes: [
      { id: trigger, type: 'trigger', data: { label: 'Webhook Recebido', config: {} }, position: { x: 250, y: 0 } },
      { id: search, type: 'search_knowledge', data: { label: 'Buscar RAG', config: { query: '{question}', top_k: 5 } }, position: { x: 250, y: 120 } },
      { id: httpReq, type: 'http_request', data: { label: 'Callback API', config: { url: '{callback_url}', method: 'POST', body: '{"answer": "{rag_results}"}' } }, position: { x: 250, y: 260 } },
      { id: end, type: 'end', data: { label: 'Fim', config: {} }, position: { x: 250, y: 380 } },
    ],
    edges: [
      { id: `e-${trigger}-${search}`, source: trigger, target: search },
      { id: `e-${search}-${httpReq}`, source: search, target: httpReq },
      { id: `e-${httpReq}-${end}`, source: httpReq, target: end },
    ],
  }
}

// ─── Template 7: Sentimento negativo → escalacao ─────────

function negativeSentimentTemplate(): WorkflowTemplate {
  resetIds()
  const trigger = nid('trigger')
  const condition = nid('condition')
  const addTag = nid('add_tag')
  const assignHuman = nid('assign_human')
  const sendMsg = nid('send_message')
  const end = nid('end')
  const endNormal = nid('end')

  return {
    id: 'tpl-negative-sentiment',
    name: 'Escalacao por Sentimento Negativo',
    description: 'Detecta sentimento negativo na mensagem e escala imediatamente para agente humano com tag de urgencia.',
    category: 'atendimento',
    triggerType: 'message_received',
    triggerConfig: {},
    variables: {},
    nodes: [
      { id: trigger, type: 'trigger', data: { label: 'Mensagem Recebida', config: {} }, position: { x: 250, y: 0 } },
      { id: condition, type: 'condition', data: { label: 'Sentimento Negativo?', config: { field: 'sentiment', operator: 'equals', value: 'negative' } }, position: { x: 250, y: 120 } },
      { id: addTag, type: 'add_tag', data: { label: 'Tag Urgente', config: { tag: 'urgente' } }, position: { x: 50, y: 260 } },
      { id: assignHuman, type: 'assign_human', data: { label: 'Escalar Humano', config: { assignment_type: 'auto' } }, position: { x: 50, y: 380 } },
      { id: sendMsg, type: 'send_message', data: { label: 'Mensagem Acolhimento', config: { message: 'Entendo sua frustacao, {customer_name}. Um especialista ja esta sendo acionado para resolver isso.' } }, position: { x: 50, y: 500 } },
      { id: end, type: 'end', data: { label: 'Fim', config: {} }, position: { x: 50, y: 620 } },
      { id: endNormal, type: 'end', data: { label: 'Fluxo Normal', config: {} }, position: { x: 450, y: 260 } },
    ],
    edges: [
      { id: `e-${trigger}-${condition}`, source: trigger, target: condition },
      { id: `e-${condition}-${addTag}`, source: condition, target: addTag, sourceHandle: 'true', label: 'Negativo' },
      { id: `e-${condition}-${endNormal}`, source: condition, target: endNormal, sourceHandle: 'false', label: 'OK' },
      { id: `e-${addTag}-${assignHuman}`, source: addTag, target: assignHuman },
      { id: `e-${assignHuman}-${sendMsg}`, source: assignHuman, target: sendMsg },
      { id: `e-${sendMsg}-${end}`, source: sendMsg, target: end },
    ],
  }
}

// ─── Export ──────────────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  outOfHoursTemplate(),
  slaEscalationTemplate(),
  postServiceFollowUpTemplate(),
  aiTriageTemplate(),
  vipRoutingTemplate(),
  webhookRagTemplate(),
  negativeSentimentTemplate(),
]

export const WORKFLOW_TEMPLATE_CATEGORIES = [
  { key: 'atendimento', label: 'Atendimento', description: 'Fluxos de suporte ao cliente' },
  { key: 'operacional', label: 'Operacional', description: 'Automacoes internas' },
  { key: 'vendas', label: 'Vendas', description: 'Qualificacao e follow-up' },
  { key: 'sistema', label: 'Sistema', description: 'Monitoramento e SLA' },
]
