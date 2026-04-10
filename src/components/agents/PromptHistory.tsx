import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { History, RotateCcw, Clock } from 'lucide-react'

interface PromptHistoryProps {
  agentId: string
  currentPrompt: string
  onRestore: (prompt: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PromptVersion {
  id: string
  agent_id: string
  prompt: string
  created_at: string
  version: number
}

function formatDatePtBr(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

export function PromptHistory({
  agentId,
  currentPrompt,
  onRestore,
  open,
  onOpenChange,
}: PromptHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['prompt-history', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_prompt_history' as any)
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Erro ao carregar historico de prompts')
        throw error
      }

      return (data as any[]).map((row: any, index: number, arr: any[]) => ({
        ...row,
        version: arr.length - index,
      })) as PromptVersion[]
    },
    enabled: open && !!agentId,
  })

  const handleRestore = (prompt: string) => {
    onRestore(prompt)
    onOpenChange(false)
    toast.success('Prompt restaurado com sucesso')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historico de Prompts
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Carregando...
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <History className="h-8 w-8 opacity-50" />
              <p>Nenhum historico encontrado</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {versions.map((v) => {
                const isExpanded = expandedId === v.id
                const isCurrent = v.prompt === currentPrompt

                return (
                  <div
                    key={v.id}
                    className="border border-border rounded-lg bg-card transition-colors"
                  >
                    <button
                      type="button"
                      className="w-full text-left p-3 flex items-start gap-3 hover:bg-muted/50 rounded-lg transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    >
                      <Badge variant="secondary" className="shrink-0 mt-0.5">
                        v{v.version}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {v.prompt.slice(0, 100)}
                          {v.prompt.length > 100 ? '...' : ''}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDatePtBr(v.created_at)}
                          {isCurrent && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                              Atual
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-border">
                        <ScrollArea className="max-h-60 mt-3">
                          <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded-md p-3">
                            {v.prompt}
                          </pre>
                        </ScrollArea>
                        {!isCurrent && (
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestore(v.prompt)}
                              className="gap-1.5"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restaurar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
