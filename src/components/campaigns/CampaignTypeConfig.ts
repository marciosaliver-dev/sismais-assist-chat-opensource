import { MessageSquare, DollarSign, UserPlus, RefreshCw, HeartPulse } from 'lucide-react'

export const CAMPAIGN_TYPES = {
  follow_up: {
    label: 'Follow-up',
    description: 'Contato pós-atendimento para verificar satisfação',
    icon: MessageSquare,
    color: 'bg-blue-500',
    colorLight: 'bg-blue-500/10 text-blue-600',
    defaultApproval: 'auto' as const,
    defaultCron: '0 10 * * 1-5', // Weekdays at 10am
    defaultPrompt: 'Faça um follow-up cordial verificando se o problema do cliente foi resolvido. Seja breve e empático.',
    targetHint: 'Clientes com atendimentos resolvidos recentemente',
    defaultRules: [{ field: 'hours_after_close', op: 'gte', value: 24 }],
  },
  billing: {
    label: 'Cobrança',
    description: 'Lembretes de pagamento e notificações financeiras',
    icon: DollarSign,
    color: 'bg-amber-500',
    colorLight: 'bg-amber-500/10 text-amber-600',
    defaultApproval: 'approval_required' as const,
    defaultCron: '0 9 * * 1-5',
    defaultPrompt: 'Entre em contato sobre pendência financeira de forma profissional e empática, oferecendo ajuda para regularizar.',
    targetHint: 'Clientes com faturas vencidas no Sismais Admin',
    defaultRules: [{ field: 'min_debt_amount', op: 'gte', value: 50 }],
  },
  onboarding: {
    label: 'Onboarding',
    description: 'Boas-vindas e orientação para novos clientes',
    icon: UserPlus,
    color: 'bg-emerald-500',
    colorLight: 'bg-emerald-500/10 text-emerald-600',
    defaultApproval: 'auto' as const,
    defaultCron: '0 10 * * *',
    defaultPrompt: 'Dê boas-vindas ao novo cliente, apresente os recursos do sistema e ofereça ajuda para configurar.',
    targetHint: 'Novos clientes cadastrados nos últimos 7 dias',
    defaultRules: [{ field: 'days_since_created', op: 'lte', value: 7 }],
  },
  reactivation: {
    label: 'Reativação',
    description: 'Reconectar com clientes inativos',
    icon: RefreshCw,
    color: 'bg-purple-500',
    colorLight: 'bg-purple-500/10 text-purple-600',
    defaultApproval: 'approval_required' as const,
    defaultCron: '0 14 * * 2,4', // Tue/Thu at 2pm
    defaultPrompt: 'Entre em contato amigavelmente com o cliente inativo, perguntando se precisa de ajuda com o sistema.',
    targetHint: 'Clientes sem interação há mais de 30 dias',
    defaultRules: [{ field: 'days_inactive', op: 'gte', value: 30 }],
  },
  health_check: {
    label: 'Health Check',
    description: 'Check-in periódico de satisfação',
    icon: HeartPulse,
    color: 'bg-rose-500',
    colorLight: 'bg-rose-500/10 text-rose-600',
    defaultApproval: 'auto' as const,
    defaultCron: '0 11 1,15 * *', // 1st and 15th of month
    defaultPrompt: 'Faça um check-in periódico com o cliente verificando a satisfação com o produto e se há algo que possamos melhorar.',
    targetHint: 'Todos os clientes ativos (respeitando intervalo mínimo)',
    defaultRules: [],
  },
} as const

export type CampaignTypeKey = keyof typeof CAMPAIGN_TYPES

export const SCHEDULE_PRESETS = [
  { label: 'Dias úteis às 9h', value: '0 9 * * 1-5' },
  { label: 'Dias úteis às 10h', value: '0 10 * * 1-5' },
  { label: 'Dias úteis às 14h', value: '0 14 * * 1-5' },
  { label: 'Diário às 10h', value: '0 10 * * *' },
  { label: 'Seg/Qua/Sex às 10h', value: '0 10 * * 1,3,5' },
  { label: 'Ter/Qui às 14h', value: '0 14 * * 2,4' },
  { label: '1x por semana (Segunda)', value: '0 10 * * 1' },
  { label: '2x por mês (dia 1 e 15)', value: '0 11 1,15 * *' },
]

export const APPROVAL_LABELS = {
  auto: { label: 'Automático', description: 'Executa automaticamente no horário agendado', color: 'bg-emerald-500/10 text-emerald-600' },
  approval_required: { label: 'Requer Aprovação', description: 'Um supervisor deve aprovar antes de executar', color: 'bg-amber-500/10 text-amber-600' },
}
