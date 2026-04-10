/**
 * Consolidated agent specialties map.
 *
 * 13 core specialties:
 * - triage: Routing/triage
 * - support: Technical support (merged: support, qa)
 * - financial: Billing/payments
 * - sales: Sales pipeline (merged: sales, sdr, upsell, revenue)
 * - customer_success: Customer lifecycle (merged: customer_success, feedback)
 * - onboarding: Client onboarding and first access guidance
 * - retention: Client retention and cancellation handling
 * - analytics: Data/metrics (merged: analysis, analyst, analytics)
 * - copilot: Agent assist (merged: copilot, knowledge_manager)
 * - group_support: WhatsApp group support
 * - scheduler: Agendamentos, callbacks e lembretes
 * - nps_collector: Pesquisas de satisfação pós-atendimento
 * - knowledge_curator: Manutenção automática da base de conhecimento
 *
 * Legacy specialty (proactive) is mapped to sales.
 */
export const specialtyMap: Record<string, { emoji: string; label: string }> = {
  // Core 11 specialties
  triage: { emoji: '👤', label: 'Triagem' },
  support: { emoji: '🛠️', label: 'Suporte Técnico' },
  financial: { emoji: '💰', label: 'Financeiro' },
  sales: { emoji: '💼', label: 'Vendas' },
  customer_success: { emoji: '🏆', label: 'Customer Success' },
  onboarding: { emoji: '🚀', label: 'Onboarding' },
  retention: { emoji: '🛡️', label: 'Retenção' },
  analytics: { emoji: '📈', label: 'Analítico' },
  copilot: { emoji: '🤝', label: 'Copiloto' },
  group_support: { emoji: '👥', label: 'Suporte em Grupo' },
  scheduler: { emoji: '📅', label: 'Agendamento' },
  nps_collector: { emoji: '⭐', label: 'Pesquisa de Satisfação' },
  knowledge_curator: { emoji: '📚', label: 'Curador de Conhecimento' },

  // Legacy mappings (backwards-compatible display — these map to core specialties)
  sdr: { emoji: '💼', label: 'Vendas (SDR)' },
  upsell: { emoji: '💼', label: 'Vendas (Upsell)' },
  revenue: { emoji: '💼', label: 'Vendas (Receita)' },
  analysis: { emoji: '📈', label: 'Analítico' },
  analyst: { emoji: '📈', label: 'Analítico' },
  cancel: { emoji: '🛡️', label: 'Retenção (Cancelamento)' },
  cancellation: { emoji: '🛡️', label: 'Retenção (Cancelamento)' },
  feedback: { emoji: '🏆', label: 'Customer Success (Feedback)' },
  qa: { emoji: '🛠️', label: 'Suporte (QA)' },
  knowledge_manager: { emoji: '🤝', label: 'Copiloto (Conhecimento)' },
  proactive: { emoji: '📢', label: 'Proativo' },
}

/**
 * Core specialties for the agent creation form.
 * These are available for new agents.
 */
export const coreSpecialties = [
  { value: 'triage', emoji: '👤', label: 'Triagem', description: 'Identifica a necessidade e direciona para o agente correto' },
  { value: 'support', emoji: '🛠️', label: 'Suporte Técnico', description: 'Resolve problemas técnicos, bugs e dúvidas operacionais' },
  { value: 'financial', emoji: '💰', label: 'Financeiro', description: 'Cobranças, pagamentos, faturas e questões financeiras' },
  { value: 'sales', emoji: '💼', label: 'Vendas', description: 'Qualificação de leads, propostas, upsell e cross-sell' },
  { value: 'customer_success', emoji: '🏆', label: 'Customer Success', description: 'Onboarding, retenção, NPS e acompanhamento de clientes' },
  { value: 'onboarding', emoji: '🚀', label: 'Onboarding', description: 'Onboarding de novos clientes, guiando o primeiro acesso e configuração inicial' },
  { value: 'retention', emoji: '🛡️', label: 'Retenção', description: 'Retenção de clientes, tratamento de cancelamentos e recuperação de churn' },
  { value: 'analytics', emoji: '📈', label: 'Analítico', description: 'Gera métricas, relatórios e indicadores de desempenho' },
  { value: 'copilot', emoji: '🤝', label: 'Copiloto', description: 'Auxilia agentes humanos com sugestões e informações' },
  { value: 'group_support', emoji: '👥', label: 'Suporte em Grupo', description: 'Atende em grupos de WhatsApp com modo silencioso ou ativo' },
  { value: 'scheduler', emoji: '📅', label: 'Agendamento', description: 'Agenda visitas, reuniões, callbacks e envia lembretes automáticos' },
  { value: 'nps_collector', emoji: '⭐', label: 'Pesquisa de Satisfação', description: 'Coleta NPS/CSAT pós-atendimento via conversa natural' },
  { value: 'knowledge_curator', emoji: '📚', label: 'Curador de Conhecimento', description: 'Revisa, atualiza e sugere novos artigos para a base de conhecimento' },
] as const

/**
 * Maps legacy specialty values to their canonical core specialty.
 * Used for routing and grouping purposes.
 */
export const specialtyCanonicalMap: Record<string, string> = {
  triage: 'triage',
  support: 'support',
  qa: 'support',
  financial: 'financial',
  sales: 'sales',
  sdr: 'sales',
  upsell: 'sales',
  revenue: 'sales',
  customer_success: 'customer_success',
  onboarding: 'onboarding',
  retention: 'retention',
  cancel: 'retention',
  cancellation: 'retention',
  feedback: 'customer_success',
  analytics: 'analytics',
  analysis: 'analytics',
  analyst: 'analytics',
  copilot: 'copilot',
  knowledge_manager: 'copilot',
  group_support: 'group_support',
  scheduler: 'scheduler',
  nps_collector: 'nps_collector',
  knowledge_curator: 'knowledge_curator',
  proactive: 'sales',
}
