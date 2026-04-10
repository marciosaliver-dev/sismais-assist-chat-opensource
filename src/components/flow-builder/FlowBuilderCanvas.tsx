import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  ReactFlowProvider,
  Panel,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, FlaskConical, ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { NodePalette } from './NodePalette'
import { NodePropertiesPanel } from './NodePropertiesPanel'
import { customNodeTypes } from './nodes'
import { edgeTypes } from './edges/CustomEdge'
import { useFlowAutomations } from '@/hooks/useFlowAutomations'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FlowAIChatPanel } from './FlowAIChatPanel'

interface FlowBuilderCanvasProps {
  flowId?: string
}

function FlowBuilderCanvasInner({ flowId }: FlowBuilderCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [flowName, setFlowName] = useState('Novo Fluxo')
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const { flows, updateFlow, createFlow } = useFlowAutomations()
  const navigate = useNavigate()
  const [currentFlowId, setCurrentFlowId] = useState(flowId)

  // Load existing flow
  useEffect(() => {
    if (flowId && flows) {
      const flow = flows.find((f) => f.id === flowId)
      if (flow) {
        setFlowName(flow.name)
        setNodes(flow.nodes as any[] || [])
        setEdges(flow.edges as any[] || [])
      }
    }
  }, [flowId, flows])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')
      if (!type || !reactFlowInstance) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const labels: Record<string, string> = {
        trigger: 'Gatilho', send_message: 'Mensagem', ai_response: 'Resposta IA',
        assign_human: 'Atribuir Humano', assign_ai: 'Atribuir IA', condition: 'Condição',
        switch: 'Switch', delay: 'Delay', http_request: 'HTTP Request', add_tag: 'Tag',
        set_variable: 'Variável', update_field: 'Atualizar', jump_to_flow: 'Ir para Fluxo',
        end: 'Fim', search_knowledge: 'RAG Search',
        check_schedule: 'Verificar Horário', wait_response: 'Aguardar Resposta',
        check_customer: 'Verificar Cliente', loop_wait: 'Loop/Aguardar',
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: labels[type] || type, config: {} },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance, setNodes]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const updateNodeData = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      )
      setSelectedNode((prev) => prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev)
    },
    [setNodes]
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setSelectedNode(null)
    },
    [setNodes, setEdges]
  )

  const handleSave = async () => {
    if (!flowName.trim()) {
      toast.error('Digite um nome para o fluxo')
      return
    }

    const flowData = { name: flowName, nodes: nodes as any, edges: edges as any }

    if (currentFlowId) {
      updateFlow.mutate({ id: currentFlowId, updates: flowData })
    } else {
      createFlow.mutate(
        { ...flowData, trigger_type: 'message_received' },
        {
          onSuccess: (data: any) => {
            setCurrentFlowId(data.id)
            navigate(`/flow-builder/${data.id}`, { replace: true })
          },
        }
      )
    }
  }

  const isSaving = updateFlow.isPending || createFlow.isPending

  const nodeTypes = useMemo(() => customNodeTypes, [])
  const memoEdgeTypes = useMemo(() => edgeTypes, [])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/flow-builder')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="max-w-xs h-8 text-sm"
            placeholder="Nome do fluxo"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showAIPanel ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAIPanel(v => !v)}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> IA
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (currentFlowId) navigate(`/flow-builder/playground/${currentFlowId}`)
            else toast.info('Salve o fluxo antes de testar')
          }}>
            <FlaskConical className="w-3.5 h-3.5 mr-1.5" /> Testar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />

        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            edgeTypes={memoEdgeTypes}
            defaultEdgeOptions={{ type: 'custom', animated: true }}
            fitView
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
            <Controls className="!bg-card !border-border !rounded-lg !shadow-lg" />
            <MiniMap
              className="!bg-card !border-border !rounded-lg"
              nodeColor={(node) => {
                const colors: Record<string, string> = {
                  trigger: '#eab308', send_message: '#06b6d4', ai_response: '#a855f7',
                  assign_human: '#f97316', assign_ai: '#0891b2', condition: '#a855f7',
                  switch: '#6366f1', delay: '#64748b', http_request: '#22c55e',
                  add_tag: '#ca8a04', set_variable: '#6366f1', update_field: '#3b82f6',
                  jump_to_flow: '#475569', end: '#ef4444', search_knowledge: '#10b981',
                  check_schedule: '#c084fc', wait_response: '#f97316',
                  check_customer: '#1e3a8a', loop_wait: '#ca8a04',
                }
                return colors[node.type || ''] || '#64748b'
              }}
            />
            <Panel position="bottom-center">
              <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
                {nodes.length} nodes • {edges.length} conexões
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodePropertiesPanel
            node={selectedNode}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
            onClose={() => setSelectedNode(null)}
            onDelete={() => deleteNode(selectedNode.id)}
          />
        )}

        {showAIPanel && (
          <FlowAIChatPanel
            onClose={() => setShowAIPanel(false)}
            currentNodes={nodes}
            currentEdges={edges}
            onApplyFlow={(newNodes, newEdges) => {
              setNodes(newNodes)
              setEdges(newEdges)
              setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 100)
            }}
          />
        )}
      </div>
    </div>
  )
}

export function FlowBuilderCanvas({ flowId }: FlowBuilderCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderCanvasInner flowId={flowId} />
    </ReactFlowProvider>
  )
}
