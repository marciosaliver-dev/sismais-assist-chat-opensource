import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Sparkles } from 'lucide-react'
import { useAIFeedback } from '@/hooks/useAIFeedback'

interface AIFeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: {
    id: string
    content: string
    agent_id: string
    conversation_id: string
  } | null
}

export function AIFeedbackDialog({ open, onOpenChange, message }: AIFeedbackDialogProps) {
  const [correctedResponse, setCorrectedResponse] = useState('')
  const { submitCorrection } = useAIFeedback()

  const handleSubmit = () => {
    if (!message || !correctedResponse.trim()) return
    submitCorrection.mutate(
      {
        messageId: message.id,
        agentId: message.agent_id,
        conversationId: message.conversation_id,
        originalResponse: message.content,
        correctedResponse: correctedResponse.trim(),
      },
      {
        onSuccess: () => {
          setCorrectedResponse('')
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-500" />
            Melhorar Resposta da IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Resposta original da IA</Label>
            <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
              {message?.content}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              Resposta corrigida (será usada para treinar o agente)
            </Label>
            <Textarea
              value={correctedResponse}
              onChange={(e) => setCorrectedResponse(e.target.value)}
              placeholder="Escreva como o agente deveria ter respondido..."
              rows={5}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitCorrection.isPending || !correctedResponse.trim()}
              className="gap-1.5"
            >
              {submitCorrection.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Salvar e Treinar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
