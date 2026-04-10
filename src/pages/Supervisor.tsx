import { ShieldCheck } from 'lucide-react'
import { SupervisorKPIs } from '@/components/supervisor/SupervisorKPIs'
import { ReviewQueue } from '@/components/supervisor/ReviewQueue'
import { TrainingOpportunities } from '@/components/supervisor/TrainingOpportunities'

export default function Supervisor() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Central de Supervisão IA</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Supervisione a IA, aprove respostas e identifique oportunidades de treino
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* KPIs */}
        <section>
          <SupervisorKPIs />
        </section>

        {/* Review Queue */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            <h2 className="font-semibold">Aguardando Revisão</h2>
            <span className="text-xs text-muted-foreground">
              — conversas com baixa confiança da IA (&lt; 70%)
            </span>
          </div>
          <ReviewQueue />
        </section>

        {/* Training Opportunities */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h2 className="font-semibold">Oportunidades de Treino</h2>
            <span className="text-xs text-muted-foreground">
              — perguntas frequentes sem resposta confiante na base de conhecimento
            </span>
          </div>
          <TrainingOpportunities />
        </section>
      </div>
    </div>
  )
}
