import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Copy } from 'lucide-react'
import { DYNAMIC_VARIABLES } from '@/data/automationConfig'
import { toast } from 'sonner'

interface VariableReferenceProps {
  onClose: () => void
}

export function VariableReference({ onClose }: VariableReferenceProps) {
  const copyVar = (v: string) => {
    navigator.clipboard.writeText(v)
    toast.success(`Copiado: ${v}`)
  }

  return (
    <div className="w-64 bg-card border-l border-border flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold">Variáveis Dinâmicas</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-3">
        <p className="text-xs text-muted-foreground mb-3">Clique para copiar. Use nos campos de texto das ações.</p>
        {DYNAMIC_VARIABLES.map(group => (
          <div key={group.group} className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{group.group}</p>
            <div className="space-y-0.5">
              {group.vars.map(v => (
                <button
                  key={v}
                  className="flex items-center gap-1 w-full p-1.5 rounded-md hover:bg-muted/50 text-left text-xs font-mono text-foreground/80 group transition-colors"
                  onClick={() => copyVar(v)}
                >
                  <span className="flex-1 truncate">{v}</span>
                  <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  )
}
