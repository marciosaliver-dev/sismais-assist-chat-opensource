import { Link } from 'react-router-dom'
import { WarningBox } from '../shared/WarningBox'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckSquare, BookOpen, Smartphone, Bot, GitBranch, Zap } from 'lucide-react'

interface GettingStartedProps {
  subsection?: string
}

export function GettingStarted({ subsection }: GettingStartedProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Como a IA funciona neste sistema</h1>
        <p className="text-muted-foreground">
          Entenda de forma simples como as mensagens dos seus clientes são processadas pela IA antes de qualquer configuração.
        </p>
      </div>

      {/* Pipeline visual */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground mb-4">O caminho de uma mensagem</h2>
        <div className="space-y-3">
          {[
            {
              icon: Smartphone,
              step: '1',
              title: 'Cliente envia mensagem',
              desc: 'Mensagem chega pelo WhatsApp via UAZAPI',
              color: 'bg-blue-100 text-blue-600',
            },
            {
              icon: GitBranch,
              step: '2',
              title: 'Sistema de Roteamento IA decide',
              desc: 'A IA analisa a mensagem e escolhe o melhor Agente IA para responder, baseado no nome e descrição de cada agente',
              color: 'bg-purple-100 text-purple-600',
            },
            {
              icon: Bot,
              step: '3',
              title: 'Agente IA responde',
              desc: 'O agente consulta sua base de conhecimento, segue suas instruções de personalidade, e gera uma resposta',
              color: 'bg-cyan-100 text-cyan-600',
            },
            {
              icon: CheckSquare,
              step: '4',
              title: 'Verificação de confiança',
              desc: 'Se a IA não estiver confiante o suficiente, a conversa é transferida automaticamente para um agente humano',
              color: 'bg-green-100 text-green-600',
            },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.color}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-muted-foreground">PASSO {item.step}</span>
                </div>
                <p className="font-semibold text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              {i < 3 && (
                <div className="w-px h-8 bg-border mx-auto hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Key insight */}
      <WarningBox type="info" title="A chave para um bom funcionamento">
        O sistema de roteamento usa IA para decidir qual agente responde. Isso significa que
        quanto melhor escrita for a <strong>descrição</strong> de cada Agente IA, melhor o
        sistema saberá quando usar cada um. Invista tempo neste campo!
      </WarningBox>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/help/setup-checklist">
          <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors cursor-pointer group">
            <CheckSquare className="w-6 h-6 text-primary mb-3" />
            <p className="font-semibold text-sm text-foreground mb-1">Checklist Inicial</p>
            <p className="text-xs text-muted-foreground">Veja o que já está configurado e o que falta</p>
            <div className="flex items-center gap-1 text-primary text-xs mt-3 font-medium group-hover:gap-2 transition-all">
              Abrir <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
        <Link to="/help/glossary">
          <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors cursor-pointer group">
            <BookOpen className="w-6 h-6 text-primary mb-3" />
            <p className="font-semibold text-sm text-foreground mb-1">Glossário</p>
            <p className="text-xs text-muted-foreground">Entenda os termos usados no sistema</p>
            <div className="flex items-center gap-1 text-primary text-xs mt-3 font-medium group-hover:gap-2 transition-all">
              Ver glossário <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
        <Link to="/help/diagnostic">
          <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors cursor-pointer group">
            <Zap className="w-6 h-6 text-amber-500 mb-3" />
            <p className="font-semibold text-sm text-foreground mb-1">Diagnóstico</p>
            <p className="text-xs text-muted-foreground">Verifique se há problemas no sistema agora</p>
            <div className="flex items-center gap-1 text-amber-500 text-xs mt-3 font-medium group-hover:gap-2 transition-all">
              Verificar <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* Next step */}
      <div className="flex justify-end">
        <Link to="/help/agents/what-is">
          <Button className="gap-2">
            Próximo: Agentes IA <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
