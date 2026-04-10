import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Brain, Sparkles, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAgents } from '@/hooks/useAgents'

interface Props {
  agentId?: string
}

export function AgentRoutingRules({ agentId }: Props) {
  const { agents } = useAgents()

  const currentAgent = agents.find(a => a.id === agentId)
  const otherAgents = agents.filter(a => a.id !== agentId && a.is_active)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary" />
        <div>
          <p className="font-medium text-foreground">Roteamento Inteligente</p>
          <p className="text-xs text-muted-foreground">
            A IA analisa cada mensagem e decide automaticamente qual agente acionar
          </p>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Como funciona</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          O orquestrador de IA lê a <strong>descrição</strong> e <strong>especialidade</strong> de todos os agentes 
          ativos e decide qual acionar para cada mensagem recebida. Não é necessário configurar regras manuais.
        </p>
        <p className="text-xs text-primary/80 mt-2">
          💡 Para melhorar o roteamento, escreva uma descrição detalhada na aba <strong>Básico</strong>.
        </p>
      </div>

      {/* How AI sees this agent */}
      {currentAgent && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Como a IA vê este agente
          </p>
          <div className="space-y-1">
            <p className="text-sm text-foreground font-medium">{currentAgent.name}</p>
            <Badge variant="outline" className="text-xs">{currentAgent.specialty || 'geral'}</Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {currentAgent.description || 'Sem descrição — adicione uma na aba Básico para melhorar o roteamento.'}
            </p>
          </div>
        </div>
      )}

      {!agentId && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground text-center">
            Salve o agente primeiro para ver como a IA o identifica.
          </p>
        </div>
      )}

      {/* Other agents */}
      {otherAgents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Outros agentes ativos ({otherAgents.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {otherAgents.map(a => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded border border-border/50 bg-muted/30">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: a.color || '#888' }}
                />
                <span className="text-xs text-foreground font-medium">{a.name}</span>
                <Badge variant="outline" className="text-xs ml-auto">{a.specialty || 'geral'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
