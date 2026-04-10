import { useNavigate } from 'react-router-dom'
import { useFlowAutomations } from '@/hooks/useFlowAutomations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, MessageSquare, Star, Clock, AlertTriangle, UserPlus, Search, Webhook, Loader2 } from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string
  icon: any
  category: string
  trigger_type: string
  trigger_conditions: any[]
  actions: any[]
  schedule_cron?: string
}

const TEMPLATES: Template[] = [
  {
    id: 'welcome',
    name: 'Boas-vindas Automáticas',
    description: 'Envia mensagem de boas-vindas quando novo ticket é criado',
    icon: MessageSquare,
    category: 'Engajamento',
    trigger_type: 'ticket_created',
    trigger_conditions: [],
    actions: [
      { type: 'send_message', params: { message: 'Olá {customer_name}! 👋 Bem-vindo ao nosso suporte. Como posso ajudar?' } },
      { type: 'assign_agent', params: { agent_id: '' } },
    ],
  },
  {
    id: 'negative_sentiment',
    name: 'Escalonar Sentimento Negativo',
    description: 'Passa para atendente humano quando detecta cliente insatisfeito',
    icon: AlertTriangle,
    category: 'Qualidade',
    trigger_type: 'message_received',
    trigger_conditions: [
      { field: 'sentiment', operator: 'equals', value: 'negative' }
    ],
    actions: [
      { type: 'escalate_to_human', params: { reason: 'Sentimento negativo detectado' } },
      { type: 'send_message', params: { message: 'Vejo que você está passando por uma dificuldade. Vou transferir para um especialista! ⏳' } },
      { type: 'add_tag', params: { tag: 'urgente' } },
    ],
  },
  {
    id: 'csat_followup',
    name: 'Follow-up CSAT Baixo',
    description: 'Envia mensagem de acompanhamento quando CSAT é baixo',
    icon: Star,
    category: 'CSAT',
    trigger_type: 'csat_received',
    trigger_conditions: [
      { field: 'rating', operator: 'less_than', value: '3' }
    ],
    actions: [
      { type: 'send_message', params: { message: 'Lamentamos que sua experiência não tenha sido ideal. Um especialista entrará em contato em breve.' } },
      { type: 'escalate_to_human', params: { reason: 'CSAT baixo - acompanhamento necessário' } },
    ],
  },
  {
    id: 'after_hours',
    name: 'Fora do Horário Comercial',
    description: 'Mensagem automática fora do horário comercial',
    icon: Clock,
    category: 'Disponibilidade',
    trigger_type: 'message_received',
    trigger_conditions: [
      { field: 'time_of_day', operator: 'greater_than', value: '18:00' }
    ],
    actions: [
      { type: 'send_message', params: { message: '🌙 Nosso horário de atendimento é de 8h às 18h. Sua mensagem foi recebida e responderemos assim que possível! 😊' } },
    ],
  },
  {
    id: 'vip_routing',
    name: 'Roteamento VIP',
    description: 'Prioriza e roteia clientes VIP automaticamente',
    icon: UserPlus,
    category: 'Retenção',
    trigger_type: 'ticket_created',
    trigger_conditions: [],
    actions: [
      { type: 'update_conversation', params: { field: 'priority', value: 'high' } },
      { type: 'add_tag', params: { tag: 'vip' } },
      { type: 'send_message', params: { message: '🌟 Olá {customer_name}! Você tem atendimento prioritário. Um especialista já está sendo acionado.' } },
    ],
  },
  {
    id: 'urgent_priority',
    name: 'Priorizar Urgências',
    description: 'Atribui agente especializado para casos urgentes',
    icon: AlertTriangle,
    category: 'Eficiência',
    trigger_type: 'message_received',
    trigger_conditions: [
      { field: 'urgency', operator: 'equals', value: 'critical' }
    ],
    actions: [
      { type: 'add_tag', params: { tag: 'urgente' } },
      { type: 'send_message', params: { message: '🚨 Entendemos a urgência! Já estou priorizando seu atendimento.' } },
    ],
  },
  {
    id: 'knowledge_search',
    name: 'Sugerir Artigos da Base',
    description: 'Busca e envia artigos da base de conhecimento automaticamente',
    icon: Search,
    category: 'Autoatendimento',
    trigger_type: 'message_received',
    trigger_conditions: [],
    actions: [
      { type: 'search_knowledge', params: { query: '{message_content}', top_k: 3 } },
    ],
  },
  {
    id: 'daily_webhook',
    name: 'Resumo Diário via Webhook',
    description: 'Envia relatório automático todos os dias às 18h via webhook',
    icon: Webhook,
    category: 'Gestão',
    trigger_type: 'scheduled',
    trigger_conditions: [],
    schedule_cron: '0 18 * * *',
    actions: [
      { type: 'http_request', params: { url: 'https://hooks.example.com/webhook', method: 'POST', body: { text: 'Resumo do dia' } } },
    ],
  },
]

export function AutomationTemplates() {
  const { createFlow } = useFlowAutomations()
  const navigate = useNavigate()
  const categories = [...new Set(TEMPLATES.map(t => t.category))]

  const handleUseTemplate = (template: Template) => {
    createFlow.mutate(
      {
        name: template.name,
        description: template.description,
        trigger_type: template.trigger_type,
      },
      { onSuccess: (data: any) => navigate(`/flow-builder/${data.id}`) }
    )
  }

  return (
    <div className="space-y-8">
      {categories.map(category => (
        <div key={category} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full bg-primary" />
            <h3 className="text-sm font-semibold text-foreground">{category}</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.filter(t => t.category === category).map((template) => {
              const Icon = template.icon
              return (
                <Card key={template.id} className="hover:shadow-md hover:border-primary/50 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" /> Template
                      </Badge>
                    </div>
                    <CardTitle className="text-sm mt-2">{template.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{template.actions.length} ações</Badge>
                      {template.trigger_conditions.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{template.trigger_conditions.length} condições</Badge>
                      )}
                      {template.schedule_cron && (
                        <Badge variant="secondary" className="text-xs">⏰ Cron</Badge>
                      )}
                    </div>
                    <Button
                      onClick={() => handleUseTemplate(template)}
                      size="sm"
                      className="w-full"
                      disabled={createFlow.isPending}
                    >
                      {createFlow.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                      Usar Template
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
