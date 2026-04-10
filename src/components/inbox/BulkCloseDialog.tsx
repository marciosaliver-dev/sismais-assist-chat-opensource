import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle2, Bot, Info } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface BulkCloseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (sendCsat: boolean) => void
  count: number
  isClosing?: boolean
}

export function BulkCloseDialog({ open, onOpenChange, onConfirm, count, isClosing }: BulkCloseDialogProps) {
  const [sendCsat, setSendCsat] = useState(true)

  // Check if AI validations are enabled globally
  const { data: hasAIValidations = false } = useQuery({
    queryKey: ['has-ai-close-validations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ticket_close_requirements')
        .select('field_name')
        .eq('is_required', true)
        .in('field_name', ['ai_name_validation', 'ai_close_review'])
      return (data || []).length > 0
    },
  })

  const handleConfirm = () => {
    onConfirm(sendCsat)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Finalizar {count} atendimento{count > 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {count} conversa{count > 1 ? 's' : ''} será{count > 1 ? 'ão' : ''} encerrada{count > 1 ? 's' : ''} e movida{count > 1 ? 's' : ''} para finalizados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasAIValidations && (
            <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <Bot className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Validações com IA serão ignoradas no encerramento em lote.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 p-3 bg-secondary rounded-xl">
            <Label htmlFor="bulk-csat-toggle" className="text-sm font-medium cursor-pointer flex-1">
              Enviar pesquisa CSAT
            </Label>
            <Switch
              id="bulk-csat-toggle"
              checked={sendCsat}
              onCheckedChange={setSendCsat}
            />
          </div>

          {!sendCsat && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Os atendimentos serão encerrados sem coletar feedback dos clientes.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" disabled={isClosing}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isClosing}
            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isClosing ? 'Finalizando...' : sendCsat ? `Finalizar + CSAT (${count})` : `Finalizar (${count})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
