import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, CheckCircle2, FileText, Info } from 'lucide-react'
import { CLOSE_REASONS, type CloseReason } from '@/utils/statusTransitions'
import { useCSATBoardConfig } from '@/hooks/useCSATBoardConfig'

interface CloseConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (sendCsat: boolean, resolutionSummary: string, closeReason: CloseReason) => void
  isWhatsApp: boolean
  conversationSummary?: string | null
  validationError?: string | null
  boardId?: string
}

export function CloseConversationDialog({
  open,
  onOpenChange,
  onConfirm,
  isWhatsApp,
  conversationSummary,
  validationError,
  boardId,
}: CloseConversationDialogProps) {
  const { config: csatConfig } = useCSATBoardConfig(boardId)
  const csatAvailable = isWhatsApp && csatConfig?.enabled && csatConfig?.send_on_close
  const [sendCsat, setSendCsat] = useState(true)
  const [resolutionSummary, setResolutionSummary] = useState(conversationSummary || '')
  const [summaryError, setSummaryError] = useState(false)
  const [closeReason, setCloseReason] = useState<CloseReason>('resolvido')
  const [reasonError, setReasonError] = useState(false)

  // Sync when dialog opens with a fresh summary
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setResolutionSummary(conversationSummary || '')
      setSummaryError(false)
      setReasonError(false)
      setCloseReason('resolvido')
    }
    onOpenChange(open)
  }

  const handleConfirm = () => {
    let hasError = false
    if (!resolutionSummary.trim()) {
      setSummaryError(true)
      hasError = true
    }
    if (!closeReason) {
      setReasonError(true)
      hasError = true
    }
    if (hasError) return
    onConfirm(sendCsat, resolutionSummary.trim(), closeReason)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Finalizar Atendimento
          </DialogTitle>
          <DialogDescription>
            Revise o resumo antes de encerrar. Ele ficará salvo no histórico do ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Validation error from parent */}
          {validationError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive font-medium">{validationError}</p>
            </div>
          )}

          {/* Motivo de Fechamento */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Motivo do encerramento <span className="text-destructive">*</span>
            </Label>
            <Select value={closeReason} onValueChange={(v) => { setCloseReason(v as CloseReason); setReasonError(false) }}>
              <SelectTrigger className={`rounded-xl ${reasonError ? 'border-destructive' : ''}`}>
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {CLOSE_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reasonError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Selecione o motivo do encerramento.
              </p>
            )}
          </div>

          {/* Resumo Final */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Resumo Final</Label>
              <span className="text-xs text-destructive font-medium">*</span>
            </div>

            {conversationSummary ? (
              <div className="flex items-start gap-1.5 p-2 bg-primary/5 border border-primary/20 rounded-lg mb-1">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Preenchido automaticamente a partir do resumo gerado pela IA. Edite se necessário.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Nenhum resumo gerado ainda. Descreva brevemente a resolução do atendimento.
                </p>
              </div>
            )}

            <Textarea
              value={resolutionSummary}
              onChange={(e) => {
                setResolutionSummary(e.target.value)
                if (e.target.value.trim()) setSummaryError(false)
              }}
              placeholder="Descreva o problema relatado, ações tomadas e como foi resolvido..."
              className={`min-h-[100px] text-sm resize-none rounded-xl ${summaryError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {summaryError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                O resumo final é obrigatório para encerrar o atendimento.
              </p>
            )}
          </div>

          {/* CSAT toggle */}
          {csatAvailable && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 p-3 bg-secondary rounded-xl">
                <Label htmlFor="csat-toggle" className="text-sm font-medium cursor-pointer flex-1">
                  Enviar pesquisa CSAT
                </Label>
                <Switch
                  id="csat-toggle"
                  checked={sendCsat}
                  onCheckedChange={setSendCsat}
                />
              </div>

              {!sendCsat && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    O atendimento será encerrado sem coletar feedback do cliente.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {csatAvailable && sendCsat ? 'Finalizar + CSAT' : 'Finalizar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
