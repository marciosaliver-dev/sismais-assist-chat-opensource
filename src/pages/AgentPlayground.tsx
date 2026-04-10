import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, RotateCcw, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Spinner } from '@/components/ui/spinner'
import { useAgents } from '@/hooks/useAgents'
import { usePlaygroundSession } from '@/hooks/usePlaygroundSession'
import PlaygroundChat from '@/components/playground/PlaygroundChat'
import PlaygroundMetrics from '@/components/playground/PlaygroundMetrics'
import PlaygroundControlPanel from '@/components/playground/PlaygroundControlPanel'

export default function AgentPlayground() {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const { agents, isLoading } = useAgents()
  const agent = agents.find(a => a.id === agentId) || null

  const {
    messages,
    sending,
    metrics,
    activePersona,
    setActivePersona,
    sendMessage,
    resetSession,
    exportLog,
  } = usePlaygroundSession(agent)

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 gap-4">
        <p className="text-slate-400">Agente não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/agents')}>Voltar</Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agents')} className="text-slate-400 hover:text-slate-200" aria-label="Voltar para agentes">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Bot className="w-5 h-5 text-[#45E5E5]" />
          <div>
            <Breadcrumb>
              <BreadcrumbList className="text-slate-400">
                <BreadcrumbItem>
                  <BreadcrumbLink href="/agents" className="text-slate-400 hover:text-slate-200">Agentes</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-slate-200">{agent.name}</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-slate-200">Playground</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <p className="text-xs text-slate-500">{agent.model} • {agent.specialty || 'Geral'}</p>
          </div>
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs uppercase tracking-wider">
            Simulacao
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportLog} className="text-xs border-slate-700 text-slate-300 hover:text-slate-100">
            <Download className="w-3.5 h-3.5 mr-1" />Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={resetSession} className="text-xs border-slate-700 text-slate-300 hover:text-slate-100">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Reiniciar
          </Button>
        </div>
      </div>

      {/* Metrics Bar */}
      <PlaygroundMetrics metrics={metrics} />

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Chat */}
        <div className="flex-1 min-w-0">
          <PlaygroundChat messages={messages} sending={sending} onSend={sendMessage} />
        </div>
        {/* Control Panel */}
        <PlaygroundControlPanel
          agent={agent}
          activePersona={activePersona}
          onPersonaChange={setActivePersona}
          messages={messages}
        />
      </div>
    </div>
  )
}
