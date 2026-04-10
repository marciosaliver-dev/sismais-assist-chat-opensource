import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { HelpCircle, Wrench, Zap } from 'lucide-react'

interface ToolDetailPanelProps {
  open: boolean
  onClose: () => void
  tool: { id: string; name: string; display_name: string; description: string; function_type?: string; parameters_schema?: any } | null
  isActive: boolean
  onToggle: (toolId: string) => void
  onAskExplanation: (question: string) => void
}

export function ToolDetailPanel({ open, onClose, tool, isActive, onToggle, onAskExplanation }: ToolDetailPanelProps) {
  if (!tool) return null

  const typeLabels: Record<string, string> = {
    builtin: 'Integrada',
    edge_function: 'Edge Function',
    supabase_rpc: 'Database RPC',
    supabase_query: 'Database Query',
    api_call: 'API Externa',
    webhook: 'Webhook',
  }

  const typeColors: Record<string, string> = {
    builtin: 'bg-cyan-100 text-cyan-800',
    edge_function: 'bg-blue-100 text-blue-800',
    api_call: 'bg-yellow-100 text-yellow-800',
    webhook: 'bg-purple-100 text-purple-800',
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[380px] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            {tool.display_name || tool.name}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Ativa neste agente</span>
            <Switch checked={isActive} onCheckedChange={() => onToggle(tool.id)} />
          </div>

          {/* Function type */}
          {tool.function_type && (
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Zap className="w-3 h-3" /> Tipo
              </span>
              <div className="mt-1">
                <Badge className={typeColors[tool.function_type] || 'bg-gray-100 text-gray-800'}>
                  {typeLabels[tool.function_type] || tool.function_type}
                </Badge>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Descrição</span>
            <p className="mt-1 text-sm text-foreground">{tool.description}</p>
          </div>

          {/* Parameters */}
          {tool.parameters_schema && (
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Parâmetros</span>
              <pre className="mt-1 text-xs bg-muted rounded-lg p-3 overflow-auto max-h-48">
                {JSON.stringify(tool.parameters_schema, null, 2)}
              </pre>
            </div>
          )}

          {/* Ask AI button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              onAskExplanation(`Explique a ferramenta "${tool.display_name || tool.name}" de forma simples. O que ela faz, quando o agente deve usá-la e que dados ela precisa?`)
              onClose()
            }}
          >
            <HelpCircle className="w-4 h-4" />
            Perguntar à IA sobre esta ferramenta
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
