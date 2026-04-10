import { useMemo, useCallback, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
  Handle,
  ReactFlowProvider,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { cn } from '@/lib/utils'
import { MessageSquare, Brain, Users, HeadphonesIcon } from 'lucide-react'
import type { Tables } from '@/integrations/supabase/types'

type Agent = Tables<'ai_agents'>

interface AgentMetrics {
  id: string
  conversations: number
  successRate: number
}

interface AgentFlowPipelineProps {
  agents: Agent[]
  agentMetrics?: AgentMetrics[]
  onEdit: (agent: Agent) => void
  onTest: (agent: Agent) => void
}

// ── Custom node components ──────────────────────────

function EntryNode({ data }: { data: { label: string; sublabel: string } }) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 text-center min-w-[130px]">
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-2 !h-2" />
      <div className="flex items-center justify-center gap-2 mb-0.5">
        <MessageSquare className="w-4 h-4 text-emerald-600" />
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{data.label}</span>
      </div>
      <span className="text-xs text-emerald-600/70 dark:text-emerald-400/60">{data.sublabel}</span>
    </div>
  )
}

function OrchestratorNode({ data }: { data: { label: string; sublabel: string } }) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-violet-500/40 bg-violet-500/10 ring-2 ring-violet-500/20 ring-offset-1 ring-offset-background text-center min-w-[150px]">
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-2 !h-2" />
      <div className="flex items-center justify-center gap-2 mb-0.5">
        <Brain className="w-4 h-4 text-violet-600" />
        <span className="text-xs font-bold text-violet-700 dark:text-violet-400">{data.label}</span>
      </div>
      <span className="text-xs text-violet-600/70 dark:text-violet-400/60">{data.sublabel}</span>
    </div>
  )
}

function AgentNode({ data }: { data: { agent: Agent; metrics?: { conversations: number; successRate: number }; onClick: () => void } }) {
  const agent = data.agent
  const metrics = data.metrics
  return (
    <div
      className="px-3 py-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors min-w-[130px]"
      style={{ borderColor: `${agent.color}60`, borderLeftWidth: 3, borderLeftColor: agent.color || '#45E5E5' }}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: agent.color || '#45E5E5' }} />
        <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">{agent.name}</span>
        {!agent.is_active && (
          <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1 rounded">off</span>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground capitalize">{agent.specialty}</span>
      {metrics && (metrics.conversations > 0 || metrics.successRate > 0) && (
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border/50">
          <span className="text-[9px] text-muted-foreground">{metrics.conversations} conv</span>
          <span className={cn('text-[9px] font-medium', metrics.successRate >= 80 ? 'text-emerald-500' : metrics.successRate >= 50 ? 'text-amber-500' : 'text-red-500')}>
            {metrics.successRate}%
          </span>
        </div>
      )}
    </div>
  )
}

function CopilotNode({ data }: { data: { agent: Agent; onClick: () => void } }) {
  const agent = data.agent
  return (
    <div
      className="px-3 py-2 rounded-lg border-2 border-dashed border-emerald-400/40 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer transition-colors min-w-[120px]"
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">{agent.name}</span>
      </div>
      <span className="text-xs text-muted-foreground">Copiloto</span>
    </div>
  )
}

function FallbackNode({ data }: { data: { label: string; sublabel: string } }) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-blue-500/40 bg-blue-500/10 text-center min-w-[130px]">
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-2 !h-2" />
      <div className="flex items-center justify-center gap-2 mb-0.5">
        <HeadphonesIcon className="w-4 h-4 text-blue-600" />
        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{data.label}</span>
      </div>
      <span className="text-xs text-blue-600/70 dark:text-blue-400/60">{data.sublabel}</span>
    </div>
  )
}

const nodeTypes = {
  entry: EntryNode,
  orchestrator: OrchestratorNode,
  agent: AgentNode,
  copilot: CopilotNode,
  fallback: FallbackNode,
}

// ── Main component ──────────────────────────

function AgentFlowPipelineInner({ agents, agentMetrics: metricsData, onEdit, onTest }: AgentFlowPipelineProps) {
  const active = agents.filter(a => a.is_active)
  const agentNodes = active.filter(a => a.specialty !== 'copilot')
  const copilotAgents = active.filter(a => a.specialty === 'copilot')

  const { nodes, edges } = useMemo(() => {
    const n: Node[] = []
    const e: Edge[] = []

    const COL_X_CENTER = 350
    const ROW_SPACING = 110
    let currentY = 0

    // 1. Entry: WhatsApp
    n.push({
      id: 'whatsapp',
      type: 'entry',
      position: { x: COL_X_CENTER - 65, y: currentY },
      data: { label: 'WhatsApp', sublabel: 'Mensagem recebida' },
      draggable: false,
    })
    currentY += ROW_SPACING

    // 2. Orchestrator (roteia direto para qualquer agente)
    n.push({
      id: 'orchestrator',
      type: 'orchestrator',
      position: { x: COL_X_CENTER - 75, y: currentY },
      data: { label: 'Orquestrador IA', sublabel: 'Analisa intenção e roteia' },
      draggable: false,
    })
    e.push({
      id: 'e-whatsapp-orch',
      source: 'whatsapp',
      target: 'orchestrator',
      animated: true,
      style: { stroke: '#a78bfa' },
    })
    currentY += ROW_SPACING

    // 3. Todos os agentes (sem separação triagem/worker)
    if (agentNodes.length > 0) {
      const agentWidth = agentNodes.length * 155
      const agentStartX = COL_X_CENTER - agentWidth / 2

      agentNodes.forEach((agent, i) => {
        const nodeId = `agent-${agent.id}`
        const m = metricsData?.find(x => x.id === agent.id)
        n.push({
          id: nodeId,
          type: 'agent',
          position: { x: agentStartX + i * 155, y: currentY },
          data: { agent, metrics: m ? { conversations: m.conversations, successRate: m.successRate } : undefined, onClick: () => onEdit(agent) },
          draggable: false,
        })
        e.push({
          id: `e-orch-${nodeId}`,
          source: 'orchestrator',
          target: nodeId,
          animated: true,
          style: { stroke: '#a78bfa80' },
        })
      })
      currentY += ROW_SPACING
    }

    // 4. Human fallback
    n.push({
      id: 'human-fallback',
      type: 'fallback',
      position: { x: COL_X_CENTER - 65, y: currentY },
      data: { label: 'Agente Humano', sublabel: 'Escalação automática' },
      draggable: false,
    })

    // Edges to human fallback
    if (agentNodes.length > 0) {
      agentNodes.forEach(agent => {
        e.push({
          id: `e-${agent.id}-human`,
          source: `agent-${agent.id}`,
          target: 'human-fallback',
          style: { stroke: '#ef444480', strokeDasharray: '5,5' },
          label: 'escalação',
          labelStyle: { fontSize: 9, fill: '#ef4444' },
        })
      })
    } else {
      e.push({
        id: 'e-orch-human',
        source: 'orchestrator',
        target: 'human-fallback',
        style: { stroke: '#ef444480', strokeDasharray: '5,5' },
      })
    }

    // 5. Copilot agents (side position, connected to human fallback)
    copilotAgents.forEach((agent, i) => {
      const nodeId = `copilot-${agent.id}`
      const copilotY = ROW_SPACING + i * 80

      n.push({
        id: nodeId,
        type: 'copilot',
        position: { x: COL_X_CENTER + (agentNodes.length > 0 ? agentNodes.length * 78 + 30 : 130), y: copilotY },
        data: { agent, onClick: () => onEdit(agent) },
        draggable: false,
      })

      e.push({
        id: `e-copilot-${agent.id}-human`,
        source: nodeId,
        target: 'human-fallback',
        sourceHandle: null,
        targetHandle: null,
        style: { stroke: '#10b98180', strokeDasharray: '4,4' },
        animated: true,
      })
    })

    return { nodes: n, edges: e }
  }, [agents, onEdit])

  const [expanded, setExpanded] = useState(false)

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.data?.onClick) {
      node.data.onClick()
    }
  }, [])

  return (
    <div
      className={cn(
        "bg-card overflow-hidden transition-all duration-300",
        expanded
          ? "fixed inset-4 z-50 shadow-2xl rounded-xl border border-border"
          : "relative"
      )}
      style={expanded ? {} : { height: 380 }}
    >
      {/* Header com botão expand */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card/90 border border-border hover:bg-accent/50 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground shadow-sm backdrop-blur-sm"
          title={expanded ? 'Minimizar' : 'Expandir'}
        >
          {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {expanded ? 'Minimizar' : 'Expandir'}
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 0.9 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={expanded}
        panOnScroll={false}
        panOnDrag={expanded}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="!bg-card" />
        <Controls showInteractive={false} className="!bg-card !border-border !shadow-sm" />
        <MiniMap
          nodeStrokeColor="#6b7280"
          nodeColor={(n) => {
            if (n.type === 'entry') return '#10b981'
            if (n.type === 'orchestrator') return '#8b5cf6'
            if (n.type === 'fallback') return '#3b82f6'
            if (n.type === 'copilot') return '#10b981'
            return n.data?.agent?.color || '#6b7280'
          }}
          maskColor="rgba(0,0,0,0.15)"
          className="!bg-card !border-border"
          style={{ height: 70, width: 110 }}
        />
      </ReactFlow>
    </div>
  )
}

export function AgentFlowPipeline(props: AgentFlowPipelineProps) {
  return (
    <ReactFlowProvider>
      <AgentFlowPipelineInner {...props} />
    </ReactFlowProvider>
  )
}
