import { Headphones, DollarSign, Filter, TrendingUp, Users, Heart, UserPlus, Star, Shield } from 'lucide-react'

interface Props {
  onSelectTemplate: (description: string) => void
}

const TEMPLATES = [
  {
    label: 'Triagem',
    icon: Filter,
    color: '#8B5CF6',
    description: 'Preciso de um agente de triagem que receba o primeiro contato do cliente, entenda rapidamente o que ele precisa e direcione para o agente especializado correto (suporte, financeiro, vendas). Deve ser rápido — máximo 2 perguntas antes de direcionar.',
  },
  {
    label: 'Suporte Técnico',
    icon: Headphones,
    color: '#45E5E5',
    description: 'Preciso de um agente de suporte técnico que resolva problemas de acesso, erros do sistema, lentidão e dúvidas sobre funcionalidades. Deve consultar a base de conhecimento, fornecer soluções passo a passo e escalar para humano quando não resolver em 2 tentativas.',
  },
  {
    label: 'Cobrança Financeira',
    icon: DollarSign,
    color: '#F59E0B',
    description: 'Preciso de um agente financeiro para cobrar clientes inadimplentes, consultar débitos, gerar segunda via de boletos e negociar condições de pagamento. Deve identificar o cliente pelo CNPJ, ser empático e escalar negociações acima do limite autorizado.',
  },
  {
    label: 'Qualificação de Leads',
    icon: TrendingUp,
    color: '#10B981',
    description: 'Preciso de um agente de vendas/SDR que qualifique potenciais clientes, entenda o negócio deles, apresente benefícios do produto e agende demonstrações. Deve ser consultivo e nunca forçar a venda.',
  },
  {
    label: 'Copiloto',
    icon: Users,
    color: '#06B6D4',
    description: 'Preciso de um agente copiloto que auxilie os atendentes humanos em tempo real. Ele deve sugerir respostas, resumir o histórico da conversa, buscar informações na base de conhecimento e alertar sobre SLA. Nunca deve responder diretamente ao cliente.',
  },
  {
    label: 'Pós-venda',
    icon: Heart,
    color: '#EC4899',
    description: 'Preciso de um agente de atendimento pós-venda que acompanhe a satisfação do cliente, colete feedback, resolva reclamações simples e identifique riscos de churn. Deve ser atencioso e proativo.',
  },
  {
    label: 'Onboarding',
    icon: UserPlus,
    color: '#3B82F6',
    description: 'Preciso de um agente de onboarding que guie novos clientes nos primeiros passos com o produto. Deve apresentar funcionalidades principais, enviar tutoriais, agendar treinamentos e acompanhar a ativação.',
  },
  {
    label: 'Feedback / NPS',
    icon: Star,
    color: '#F97316',
    description: 'Preciso de um agente que colete feedback e NPS dos clientes de forma natural e não intrusiva. Deve perguntar sobre a experiência, registrar notas e comentários, e escalar detratores para o time de sucesso.',
  },
  {
    label: 'Retenção',
    icon: Shield,
    color: '#EF4444',
    description: 'Preciso de um agente de retenção que atue quando o cliente sinaliza cancelamento. Deve entender os motivos, oferecer soluções personalizadas, descontos ou planos alternativos, e escalar para gestor quando necessário.',
  },
]

export function TemplatesGrid({ onSelectTemplate }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Templates de Agentes</h3>
        <p className="text-sm text-muted-foreground">Escolha um template para iniciar a criação com IA</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.label}
              onClick={() => onSelectTemplate(t.description)}
              className="flex items-start gap-3 px-4 py-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all text-left group"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${t.color}20`, color: t.color }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {t.label}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {t.description.substring(0, 100)}...
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
