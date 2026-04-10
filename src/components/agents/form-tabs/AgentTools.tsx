import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Plus, Wrench } from 'lucide-react'
import { useAgentTools } from '@/hooks/useAgentTools'
import { Badge } from '@/components/ui/badge'
import { CreateToolDialog } from './CreateToolDialog'
import type { TablesInsert } from '@/integrations/supabase/types'
import type { Json } from '@/integrations/supabase/types'

type AgentInsert = TablesInsert<'ai_agents'>

interface Props {
  data: Partial<AgentInsert>
  onChange: (updates: Partial<AgentInsert>) => void
}

export function AgentTools({ data, onChange }: Props) {
  const { tools } = useAgentTools()
  const [dialogOpen, setDialogOpen] = useState(false)
  const selectedTools = (Array.isArray(data.tools) ? data.tools : []) as Array<{ name: string; description: string; schema: Json }>

  const toggleTool = (tool: { name: string; description: string; parameters_schema: Json }) => {
    const isSelected = selectedTools.some((t) => t.name === tool.name)
    const updated = isSelected
      ? selectedTools.filter((t) => t.name !== tool.name)
      : [...selectedTools, { name: tool.name, description: tool.description, schema: tool.parameters_schema }]
    onChange({ tools: updated as unknown as Json })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">Ferramentas Disponíveis</p>
          <p className="text-xs text-muted-foreground">Selecione quais funções este agente pode chamar</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Criar Nova
        </Button>
      </div>

      {tools.length > 0 ? (
        <div className="space-y-2">
          {tools.map((tool) => {
            const isSelected = selectedTools.some((t) => t.name === tool.name)
            return (
              <div
                key={tool.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                }`}
                onClick={() => toggleTool(tool)}
              >
                <Checkbox checked={isSelected} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">{tool.display_name || tool.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">{tool.function_type}</Badge>
                    {tool.requires_auth && <Badge variant="outline" className="text-xs">Auth</Badge>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma ferramenta cadastrada ainda</p>
        </div>
      )}

      {selectedTools.length > 0 && (
        <p className="text-sm text-primary">✅ {selectedTools.length} ferramenta(s) selecionada(s)</p>
      )}

      <CreateToolDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
