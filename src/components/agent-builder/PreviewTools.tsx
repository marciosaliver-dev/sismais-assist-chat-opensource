import { HelpCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { AgentConfig } from '@/hooks/useAgentBuilder'

interface Tool {
  id: string
  name: string
  display_name: string
  description?: string
}

interface PreviewToolsProps {
  config: AgentConfig
  availableTools: Tool[]
  onToggle: (toolId: string) => void
  onAskExplanation: (question: string) => void
}

export default function PreviewTools({ config, availableTools, onToggle, onAskExplanation }: PreviewToolsProps) {
  const activeCount = config.tools.filter(t => availableTools.some(a => a.id === t)).length

  if (availableTools.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground text-center italic">Nenhuma ferramenta disponível.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {activeCount}/{availableTools.length} ativas
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {availableTools.map(tool => {
          const isActive = config.tools.includes(tool.id)
          return (
            <div
              key={tool.id}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all',
                isActive
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border bg-background hover:border-border/70'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{tool.display_name}</span>
                <button
                  onClick={() => onAskExplanation(`O que faz a ferramenta "${tool.display_name}"?`)}
                  className="text-muted-foreground/50 hover:text-[#45E5E5] transition-colors flex-shrink-0"
                  aria-label={`Explicar ferramenta ${tool.display_name}`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={() => onToggle(tool.id)}
                aria-label={`Ativar ${tool.display_name}`}
                className="data-[state=checked]:bg-[#45E5E5]"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
