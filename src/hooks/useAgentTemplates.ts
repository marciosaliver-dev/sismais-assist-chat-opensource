export interface AgentTemplate {
  id: string
  name: string
  specialty: string
  description: string
  icon: string
  color: string
  defaultPrompt: string
}

const TEMPLATES: AgentTemplate[] = [
  {
    id: 'support',
    name: 'Suporte Técnico',
    specialty: 'support',
    description: 'Atende dúvidas técnicas, resolve problemas e orienta clientes com passo-a-passo',
    icon: '🛠️',
    color: '#45E5E5',
    defaultPrompt: 'Quero um agente de suporte técnico empático que resolva problemas dos clientes com instruções passo-a-passo',
  },
  {
    id: 'financial',
    name: 'Financeiro',
    specialty: 'financial',
    description: 'Consulta faturas, gera boletos/PIX, negocia pagamentos e cobra inadimplentes',
    icon: '💰',
    color: '#FFB800',
    defaultPrompt: 'Quero um agente financeiro profissional que consulte faturas, gere boletos e ajude com cobranças',
  },
  {
    id: 'sales',
    name: 'Vendas / SDR',
    specialty: 'sales',
    description: 'Qualifica leads, apresenta produtos, tira dúvidas comerciais e agenda demonstrações',
    icon: '🎯',
    color: '#16A34A',
    defaultPrompt: 'Quero um agente de vendas amigável que qualifique leads e apresente nossos produtos',
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    specialty: 'onboarding',
    description: 'Guia novos clientes na configuração inicial, ensina funcionalidades e acompanha primeiros passos',
    icon: '🚀',
    color: '#7C3AED',
    defaultPrompt: 'Quero um agente de onboarding que guie novos clientes na configuração e primeiros passos do sistema',
  },
  {
    id: 'retention',
    name: 'Retenção',
    specialty: 'retention',
    description: 'Previne cancelamentos, resolve insatisfações, negocia condições e reconquista clientes',
    icon: '🤝',
    color: '#DC2626',
    defaultPrompt: 'Quero um agente de retenção empático que previna cancelamentos e resolva insatisfações dos clientes',
  },
]

export function useAgentTemplates() {
  return { templates: TEMPLATES }
}
