import { WarningBox } from '../shared/WarningBox'
import { StepByStep } from '../shared/StepByStep'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

interface TrainingGuideProps {
  subsection?: string
}

export function TrainingGuide({ subsection }: TrainingGuideProps) {
  if (subsection === 'improve') return <TrainingImprove />
  if (subsection === 'metrics') return <TrainingMetrics />
  return <TrainingCycle />
}

function TrainingCycle() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Ciclo de Treinamento da IA</h1>
        <p className="text-muted-foreground">
          Como a IA aprende e melhora ao longo do tempo com o uso.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground mb-4">O ciclo de melhoria contínua</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { step: '1', label: 'IA responde', color: 'bg-blue-100 text-blue-700' },
            { step: '2', label: 'Sistema calcula confiança', color: 'bg-purple-100 text-purple-700' },
            { step: '3', label: 'Humano corrige (se necessário)', color: 'bg-amber-100 text-amber-700' },
            { step: '4', label: 'IA aprende com a correção', color: 'bg-green-100 text-green-700' },
          ].map((item, i) => (
            <div key={i}>
              <div className={`rounded-lg p-3 text-sm font-medium ${item.color}`}>
                <div className="text-2xl font-bold mb-1">{item.step}</div>
                {item.label}
              </div>
              {i < 3 && <div className="hidden sm:flex items-center justify-center mt-4 text-muted-foreground">→</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-semibold text-foreground">O que é a "confiança" da IA?</h2>
        <p className="text-sm text-muted-foreground">
          Após gerar cada resposta, o sistema calcula uma pontuação de <strong>confiança</strong>
          (0% a 100%). Isso indica o quanto a IA "está certa" da resposta que deu.
        </p>
        <div className="space-y-2">
          {[
            { range: '80-100%', color: 'bg-green-500', desc: 'Alta confiança — resposta enviada automaticamente', bg: 'bg-green-50 border-green-200' },
            { range: '70-79%', color: 'bg-amber-500', desc: 'Confiança média — enviado, mas pode precisar de revisão', bg: 'bg-amber-50 border-amber-200' },
            { range: '0-69%', color: 'bg-red-500', desc: 'Confiança baixa — conversa escalada para humano', bg: 'bg-red-50 border-red-200' },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${item.bg}`}>
              <span className={`text-xs font-mono font-bold w-16 text-right ${item.color.replace('bg-', 'text-')}`}>{item.range}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-200">
                <div className={`h-2 rounded-full ${item.color}`} style={{ width: i === 0 ? '90%' : i === 1 ? '75%' : '40%' }} />
              </div>
              <span className="text-xs text-muted-foreground">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <WarningBox type="info" title="O limite de confiança é configurável">
        O padrão é 70% (abaixo disso, escala para humano), mas você pode ajustar este valor
        em cada agente. Agentes críticos (ex: cobranças) podem ter limite maior (80%) para
        garantir mais revisão humana.
      </WarningBox>

      <Link to="/help/training/improve">
        <Button className="gap-2">
          Como melhorar as respostas <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  )
}

function TrainingImprove() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Melhorando as Respostas da IA</h1>
        <p className="text-muted-foreground">Três formas principais de melhorar a qualidade das respostas.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        {[
          { num: '1', title: 'Melhorar o System Prompt', impact: 'Alto', color: 'border-blue-200 bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
          { num: '2', title: 'Adicionar artigos na Base KB', impact: 'Alto', color: 'border-green-200 bg-green-50', badge: 'bg-green-100 text-green-700' },
          { num: '3', title: 'Ajustar o Limite de Confiança', impact: 'Médio', color: 'border-amber-200 bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
        ].map((item, i) => (
          <div key={i} className={`rounded-xl border p-4 ${item.color}`}>
            <div className={`text-2xl font-bold mb-2 ${item.badge.replace('bg-', 'text-').replace(/text-\w+-\d+/, (m) => m)}`}>{item.num}</div>
            <p className="font-semibold text-sm">{item.title}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-2 inline-block ${item.badge}`}>
              Impacto: {item.impact}
            </span>
          </div>
        ))}
      </div>

      <StepByStep
        steps={[
          {
            title: 'Identifique onde a IA está errando',
            description: (
              <span>
                Acesse <strong>Supervisão IA</strong> no menu lateral para ver conversas recentes
                onde a IA errou ou foi corrigida por humanos.
              </span>
            ),
            action: { label: 'Abrir Supervisão IA', href: '/supervisor' },
          },
          {
            title: 'Se o problema é comportamento: melhore o System Prompt',
            description: (
              <span>
                Problemas de tom, formatação, ou assuntos não permitidos → edite o System Prompt
                do agente com instruções mais específicas.
              </span>
            ),
            action: { label: 'Editar Agentes', href: '/agents' },
          },
          {
            title: 'Se o problema é informação incorreta: adicione artigos',
            description: (
              <span>
                Se a IA está dando informações erradas sobre seu produto → adicione artigos
                na Base de Conhecimento corrigindo as informações.
              </span>
            ),
            action: { label: 'Base de Conhecimento', href: '/knowledge' },
          },
          {
            title: 'Se a IA escala demais: ajuste o Limite de Confiança',
            description: (
              <span>
                Se muitas conversas são escaladas para humanos desnecessariamente, considere
                reduzir o Limite de Confiança do agente (ex: de 70% para 60%).
              </span>
            ),
            warning: 'Cuidado ao reduzir demais o Limite de Confiança — a IA pode passar a enviar respostas incorretas com muita frequência.',
          },
        ]}
      />
    </div>
  )
}

function TrainingMetrics() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Métricas de Confiança e Performance</h1>
        <p className="text-muted-foreground">Como interpretar os números do sistema.</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">MÉTRICA</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">O QUE SIGNIFICA</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">REFERÊNCIA BOA</th>
            </tr>
          </thead>
          <tbody>
            {[
              { metric: 'Confiança Média', desc: 'Média de confiança de todas as respostas do agente', ref: '> 75%' },
              { metric: 'Taxa de Escalação', desc: 'Porcentagem de conversas transferidas para humano pela IA', ref: '< 20%' },
              { metric: 'Taxa de Sucesso', desc: 'Conversas resolvidas sem necessidade de intervenção humana', ref: '> 80%' },
              { metric: 'CSAT Médio', desc: 'Satisfação do cliente com as respostas da IA (1-5)', ref: '> 4.0' },
              { metric: 'Total de Conversas', desc: 'Histórico de volume atendido pelo agente', ref: 'Referência histórica' },
            ].map((row, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-medium">{row.metric}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{row.desc}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded">{row.ref}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link to="/ai-consumption">
        <Button variant="outline" className="gap-2">
          Ver Consumo de IA <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  )
}
