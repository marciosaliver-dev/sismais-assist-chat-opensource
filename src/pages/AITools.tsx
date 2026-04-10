import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Wrench, Plus, Search, Activity, CheckCircle2, XCircle, Loader2, BarChart3, Zap, Clock, AlertTriangle, Trash2 } from 'lucide-react'
import { useAgentTools, useKnowledgeQuality, useAgentPerformance } from '@/hooks/useAgentTools'
import { useAutomationLogs } from '@/hooks/useAutomationLogs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Tables } from '@/integrations/supabase/types'

type Tool = Tables<'ai_agent_tools'>

const FUNCTION_TYPE_COLORS: Record<string, string> = {
  database: 'bg-blue-100 text-blue-700 border-blue-200',
  api: 'bg-purple-100 text-purple-700 border-purple-200',
  webhook: 'bg-orange-100 text-orange-700 border-orange-200',
  function: 'bg-green-100 text-green-700 border-green-200',
  default: 'bg-gray-100 text-gray-700 border-gray-200',
}

export default function AIToolsPage() {
  const navigate = useNavigate()
  const { tools, isLoading, toggleTool, deleteTool } = useAgentTools()
  const { qualityReport, isLoading: qualityLoading } = useKnowledgeQuality()
  const { performance } = useAgentPerformance()
  const { logs } = useAutomationLogs()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const filteredTools = useMemo(() => {
    let items = tools ?? []
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(t => 
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.display_name || '').toLowerCase().includes(q)
      )
    }
    if (typeFilter !== 'all') {
      items = items.filter(t => t.function_type === typeFilter)
    }
    if (statusFilter === 'active') {
      items = items.filter(t => t.is_active)
    } else if (statusFilter === 'inactive') {
      items = items.filter(t => !t.is_active)
    }
    return items
  }, [tools, search, typeFilter, statusFilter])

  const stats = useMemo(() => ({
    total: tools.length,
    active: tools.filter(t => t.is_active).length,
    totalExecutions: tools.reduce((s, t) => s + ((t as any).execution_count ?? 0), 0),
    avgLatency: tools.length > 0 
      ? Math.round(tools.reduce((s, t) => s + ((t as any).avg_latency_ms ?? 0), 0) / tools.length)
      : 0,
  }), [tools])

  const handleToggle = async (tool: Tool) => {
    try {
      await toggleTool.mutateAsync({ id: tool.id, is_active: !tool.is_active })
      toast.success(`${tool.display_name || tool.name} ${tool.is_active ? 'desativado' : 'ativado'} com sucesso`)
    } catch (error) {
      toast.error('Erro ao atualizar ferramenta')
    }
  }

  const handleDelete = async (tool: Tool) => {
    if (!confirm(`Tem certeza que deseja excluir "${tool.display_name || tool.name}"?`)) return
    try {
      await deleteTool.mutateAsync(tool.id)
      toast.success('Ferramenta excluída')
    } catch (error) {
      toast.error('Erro ao excluir ferramenta')
    }
  }

  const openDetails = (tool: Tool) => {
    setSelectedTool(tool)
    setDetailsOpen(true)
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#E8F9F9] flex items-center justify-center shrink-0 mt-0.5">
              <Wrench className="w-5 h-5 text-[#10293F]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Ferramentas de IA</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gerencie as ferramentas que seus agentes de IA podem utilizar
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/agents')} className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]">
            <Plus className="w-4 h-4 mr-2" />
            Criar Nova Ferramenta
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <Wrench className="w-5 h-5 text-[#10293F]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#10293F]">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total de Ferramentas</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#10293F]">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#10293F]">{stats.totalExecutions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total de Execuções</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#10293F]">{stats.avgLatency}ms</p>
                <p className="text-xs text-muted-foreground">Latência Média</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tools" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tools">Ferramentas</TabsTrigger>
            <TabsTrigger value="quality">Qualidade RAG</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ferramentas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="function">Function</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tools Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ferramenta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Execuções</TableHead>
                    <TableHead>Latência</TableHead>
                    <TableHead>Taxa Sucesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredTools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma ferramenta encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTools.map((tool) => {
                      const t = tool as any
                      const successRate = t.execution_count && t.execution_count > 0
                        ? Math.round(((t.execution_count - (t.error_count ?? 0)) / t.execution_count) * 100)
                        : 0
                      return (
                        <TableRow key={tool.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-[#E8F9F9] flex items-center justify-center">
                                <Wrench className="w-4 h-4 text-[#10293F]" />
                              </div>
                              <div>
                                <p className="font-medium">{tool.display_name || tool.name}</p>
                                <p className="text-xs text-muted-foreground">{tool.description}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-xs', FUNCTION_TYPE_COLORS[tool.function_type] || FUNCTION_TYPE_COLORS.default)}>
                              {tool.function_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm">{(t.execution_count ?? 0).toLocaleString()}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm">{(t.avg_latency_ms ?? 0)}ms</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                                <div 
                                  className={cn('h-full rounded-full', 
                                    successRate >= 90 ? 'bg-green-500' : 
                                    successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                  )}
                                  style={{ width: `${successRate}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono">{successRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={tool.is_active ? 'default' : 'secondary'}>
                              {tool.is_active ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleToggle(tool)}
                                disabled={toggleTool.isPending}
                              >
                                {tool.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openDetails(tool)}
                              >
                                <Activity className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDelete(tool)}
                                disabled={deleteTool.isPending}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Quality Tab */}
          <TabsContent value="quality">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-5 h-5 text-[#10293F]" />
                <h2 className="text-lg font-semibold">Qualidade da Base de Conhecimento</h2>
              </div>
              {qualityLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Uso</TableHead>
                      <TableHead>Rating Médio</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualityReport?.map((doc: any) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{doc.category}</Badge>
                        </TableCell>
                        <TableCell>{(doc.usage_count ?? 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{((doc.ai_knowledge_ratings?.[0]?.avg_rating) ?? 0).toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground">
                              ({doc.ai_knowledge_ratings?.[0]?.rating_count ?? 0} avaliações)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.is_active ? (
                            <Badge className="bg-green-100 text-green-700">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-[#10293F]" />
                <h2 className="text-lg font-semibold">Performance dos Agentes</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Conversas</TableHead>
                    <TableHead>Taxa Sucesso</TableHead>
                    <TableHead>Uso de Ferramentas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance?.map((agent: any) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{agent.specialty}</Badge>
                      </TableCell>
                      <TableCell>{agent.total_conversations ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${agent.total_conversations > 0 ? Math.round((agent.successful / agent.total_conversations) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono">
                            {agent.total_conversations > 0 ? Math.round((agent.successful / agent.total_conversations) * 100) : 0}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{agent.tool_usage ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-[#10293F]" />
                <h2 className="text-lg font-semibold">Logs de Ações</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ferramenta</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.slice(0, 20).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>{log.action_type}</TableCell>
                      <TableCell>{log.tool_name || '-'}</TableCell>
                      <TableCell>
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.execution_time_ms ?? 0}ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedTool?.display_name || selectedTool?.name}</DialogTitle>
              <DialogDescription>{selectedTool?.description}</DialogDescription>
            </DialogHeader>
            {selectedTool && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <Badge className={cn('text-xs mt-1', FUNCTION_TYPE_COLORS[selectedTool.function_type] || FUNCTION_TYPE_COLORS.default)}>
                      {selectedTool.function_type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant={selectedTool.is_active ? 'default' : 'secondary'} className="mt-1">
                      {selectedTool.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Execuções</p>
                    <p className="font-mono">{((selectedTool as any).execution_count ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Latência Média</p>
                    <p className="font-mono">{((selectedTool as any).avg_latency_ms ?? 0)}ms</p>
                  </div>
                </div>

                {selectedTool.parameters_schema && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Parâmetros</p>
                    <pre className="bg-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedTool.parameters_schema, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex gap-2">
                  {selectedTool.requires_auth && (
                    <Badge variant="outline">Requer Autenticação</Badge>
                  )}
                  {(selectedTool as any).is_idempotent && (
                    <Badge variant="outline">Idempotente</Badge>
                  )}
                  {(selectedTool as any).is_retryable && (
                    <Badge variant="outline">Reutilizável</Badge>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
