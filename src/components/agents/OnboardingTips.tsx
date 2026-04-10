import { Lightbulb, X } from 'lucide-react'

export const ONBOARDING_TIPS: Record<string, { title: string; description: string }> = {
  basic: {
    title: 'Comece pelo essencial',
    description: 'O campo Descrição é o mais importante — é o que a IA usa para decidir quando acionar este agente. Seja específico!',
  },
  llm: {
    title: 'Escolha o modelo certo',
    description: 'Para atendimento, recomendamos temperatura 0.3 e modelos rápidos como Gemini Flash ou GPT-4o Mini.',
  },
  personality: {
    title: 'Defina a personalidade',
    description: 'O System Prompt define como o agente se comporta. Dê um nome humano, defina regras claras e limites.',
  },
  tools: {
    title: 'Ferramentas são opcionais',
    description: 'Conecte APIs externas que o agente pode chamar automaticamente. Pode pular esta etapa no início.',
  },
  rag: {
    title: 'Conecte a base de conhecimento',
    description: 'Habilite o RAG para que o agente busque respostas na sua base de documentos. Threshold de 75% é um bom início.',
  },
  routing: {
    title: 'Roteamento automático',
    description: 'O orquestrador de IA decide automaticamente qual agente acionar com base na descrição. Não precisa configurar nada aqui.',
  },
  channels: {
    title: 'Vincule ao WhatsApp',
    description: 'Selecione em quais instâncias WhatsApp este agente deve atuar. Sem vínculo, as mensagens vão para fila humana.',
  },
  briefing: {
    title: 'Contextualize o agente',
    description: 'Informações da empresa ajudam o agente a dar respostas mais precisas e personalizadas.',
  },
  greeting: {
    title: 'Primeira impressão',
    description: 'A saudação é a primeira mensagem que o cliente recebe. Seja acolhedor e direto.',
  },
  troubleshooting: {
    title: 'Diagnóstico inteligente',
    description: 'Liste perguntas de diagnóstico e problemas comuns para o agente resolver sozinho.',
  },
  escalation: {
    title: 'Quando transferir',
    description: 'Defina situações em que o agente DEVE transferir para um humano, como cancelamentos ou reclamações graves.',
  },
  policies: {
    title: 'Regras do negócio',
    description: 'Horários, SLA e políticas ajudam o agente a dar respostas corretas sobre prazos e garantias.',
  },
  responses: {
    title: 'Respostas padrão',
    description: 'Templates para momentos-chave: fora do horário, problema resolvido, aguardando cliente, etc.',
  },
}

interface OnboardingTipBannerProps {
  tabId: string
  onDismiss: () => void
}

export function OnboardingTipBanner({ tabId, onDismiss }: OnboardingTipBannerProps) {
  const tip = ONBOARDING_TIPS[tabId]
  if (!tip) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 mb-4">
      <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{tip.title}</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{tip.description}</p>
      </div>
      <button onClick={onDismiss} className="shrink-0 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
