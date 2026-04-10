import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Zap, MessageSquare, Bot, User, GitBranch, Clock, Globe, Tag,
  Variable, PenSquare, ArrowRight, StopCircle, Search, List,
  LayoutGrid, StickyNote, FolderOpen, Package, PlusCircle,
  ChevronDown, Timer, UserCheck, RotateCcw,
} from 'lucide-react'
import { normalizeText } from '@/lib/utils'

const nodeCategories = [
  {
    name: 'Gatilhos',
    nodes: [
      { type: 'trigger', label: 'Mensagem Recebida', icon: Zap, color: 'bg-yellow-500' },
    ]
  },
  {
    name: 'Mensagens',
    nodes: [
      { type: 'send_message', label: 'Enviar Mensagem', icon: MessageSquare, color: 'bg-cyan-500' },
      { type: 'ai_response', label: 'Resposta IA', icon: Bot, color: 'bg-purple-500' },
      { type: 'search_knowledge', label: 'Busca RAG', icon: Search, color: 'bg-emerald-500' },
    ]
  },
  {
    name: 'Atribuição',
    nodes: [
      { type: 'assign_human', label: 'Atribuir Humano', icon: User, color: 'bg-orange-500' },
      { type: 'assign_ai', label: 'Atribuir IA', icon: Bot, color: 'bg-cyan-600' },
    ]
  },
  {
    name: 'Lógica',
    nodes: [
      { type: 'condition', label: 'Condição IF/ELSE', icon: GitBranch, color: 'bg-purple-500' },
      { type: 'switch', label: 'Switch', icon: List, color: 'bg-indigo-500' },
      { type: 'delay', label: 'Aguardar', icon: Clock, color: 'bg-slate-500' },
      { type: 'check_schedule', label: 'Verificar Horário', icon: Clock, color: 'bg-purple-400' },
      { type: 'wait_response', label: 'Aguardar Resposta', icon: Timer, color: 'bg-orange-500' },
      { type: 'check_customer', label: 'Verificar Cliente', icon: UserCheck, color: 'bg-blue-800' },
      { type: 'loop_wait', label: 'Loop/Aguardar', icon: RotateCcw, color: 'bg-yellow-600' },
    ]
  },
  {
    name: 'Ações',
    nodes: [
      { type: 'http_request', label: 'Webhook HTTP', icon: Globe, color: 'bg-green-500' },
      { type: 'add_tag', label: 'Adicionar Tag', icon: Tag, color: 'bg-yellow-600' },
      { type: 'remove_tag', label: 'Remover Tag', icon: Tag, color: 'bg-red-500' },
      { type: 'set_variable', label: 'Definir Variável', icon: Variable, color: 'bg-indigo-500' },
      { type: 'update_field', label: 'Atualizar Campo', icon: PenSquare, color: 'bg-blue-500' },
      { type: 'move_to_stage', label: 'Mover Etapa', icon: ArrowRight, color: 'bg-violet-500' },
      { type: 'move_to_board', label: 'Mover Board', icon: LayoutGrid, color: 'bg-cyan-600' },
      { type: 'change_category', label: 'Alterar Categoria', icon: FolderOpen, color: 'bg-orange-500' },
      { type: 'change_module', label: 'Alterar Módulo', icon: Package, color: 'bg-teal-500' },
      { type: 'create_conversation', label: 'Criar Atendimento', icon: PlusCircle, color: 'bg-purple-600' },
      { type: 'send_internal_message', label: 'Nota Interna', icon: StickyNote, color: 'bg-indigo-600' },
    ]
  },
  {
    name: 'Controle',
    nodes: [
      { type: 'jump_to_flow', label: 'Ir para Fluxo', icon: ArrowRight, color: 'bg-slate-600' },
      { type: 'end', label: 'Finalizar', icon: StopCircle, color: 'bg-red-500' },
    ]
  }
]

export function NodePalette() {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>([])

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const toggleCollapse = (name: string) => {
    setCollapsed(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  const filteredCategories = nodeCategories.map(cat => ({
    ...cat,
    nodes: search ? cat.nodes.filter(n => normalizeText(n.label).includes(normalizeText(search))) : cat.nodes,
  })).filter(cat => cat.nodes.length > 0)

  return (
    <div className="w-56 bg-card border-r border-border flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <h3 className="font-semibold text-sm text-foreground">Nodes</h3>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar node..."
          className="h-7 text-xs"
        />
      </div>
      <ScrollArea className="flex-1 p-2">
        {filteredCategories.map((category) => {
          const isCollapsed = collapsed.includes(category.name)
          return (
            <Collapsible key={category.name} open={!isCollapsed} onOpenChange={() => toggleCollapse(category.name)} className="mb-3">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-1 mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {category.name}
                </p>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1">
                  {category.nodes.map((node) => {
                    const Icon = node.icon
                    return (
                      <div
                        key={node.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, node.type)}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-grab active:cursor-grabbing transition-colors border border-transparent hover:border-border text-xs"
                      >
                        <div className={`w-6 h-6 rounded-md ${node.color} flex items-center justify-center shrink-0`}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-foreground/80">{node.label}</span>
                      </div>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </ScrollArea>
    </div>
  )
}
