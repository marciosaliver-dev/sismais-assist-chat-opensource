import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Bot, CheckCircle2, XCircle, Loader2, SkipForward, AlertTriangle, FileText, UserCheck } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface AICloseValidationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  customerName: string | null
  aiValidationsNeeded: string[]
  onComplete: (result: { correctedName?: string; closeReviewNote?: string }) => void
  runAINameValidation: (name: string) => Promise<{ valid: boolean; reason?: string }>
  runAICloseReview: (conversationId: string) => Promise<{ note: string; tokens_used: number }>
}

type ValidationStatus = 'pending' | 'loading' | 'passed' | 'failed' | 'skipped'

export function AICloseValidationDialog({
  open,
  onOpenChange,
  conversationId,
  customerName,
  aiValidationsNeeded,
  onComplete,
  runAINameValidation,
  runAICloseReview,
}: AICloseValidationDialogProps) {
  const needsNameValidation = aiValidationsNeeded.includes('ai_name_validation')
  const needsCloseReview = aiValidationsNeeded.includes('ai_close_review')

  // Name validation state
  const [nameStatus, setNameStatus] = useState<ValidationStatus>('pending')
  const [nameReason, setNameReason] = useState('')
  const [editedName, setEditedName] = useState(customerName || '')
  const [nameEditing, setNameEditing] = useState(false)

  // Close review state
  const [reviewStatus, setReviewStatus] = useState<ValidationStatus>('pending')
  const [reviewNote, setReviewNote] = useState('')

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setNameStatus('pending')
      setNameReason('')
      setEditedName(customerName || '')
      setNameEditing(false)
      setReviewStatus('pending')
      setReviewNote('')
    }
  }, [open, customerName])

  // Auto-start validations when dialog opens
  useEffect(() => {
    if (!open) return
    // Use a small delay to ensure state reset from the other effect has completed
    const timer = setTimeout(() => {
      if (needsNameValidation) {
        handleNameValidation()
      } else if (needsCloseReview) {
        handleCloseReview()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [open])

  const handleNameValidation = useCallback(async () => {
    const nameToValidate = (editedName || customerName || '').trim()
    if (!nameToValidate) {
      setNameStatus('failed')
      setNameReason('Nome do contato está vazio')
      return
    }

    setNameStatus('loading')
    const result = await runAINameValidation(nameToValidate)

    if (result.valid) {
      setNameStatus('passed')
      setNameReason('')
      // Auto-start close review if needed
      if (needsCloseReview && reviewStatus === 'pending') {
        handleCloseReview()
      }
    } else {
      setNameStatus('failed')
      setNameReason(result.reason || 'Nome inválido')
      setNameEditing(true)
    }
  }, [editedName, customerName, runAINameValidation, needsCloseReview, reviewStatus])

  const handleCloseReview = useCallback(async () => {
    setReviewStatus('loading')
    const result = await runAICloseReview(conversationId)

    if (result.note) {
      setReviewStatus('passed')
      setReviewNote(result.note)
    } else {
      setReviewStatus('failed')
      setReviewNote('')
    }
  }, [conversationId, runAICloseReview])

  const handleSkipName = () => {
    setNameStatus('skipped')
    setNameEditing(false)
    if (needsCloseReview && reviewStatus === 'pending') {
      handleCloseReview()
    }
  }

  const handleSkipReview = () => {
    setReviewStatus('skipped')
  }

  const handleRetryName = () => {
    handleNameValidation()
  }

  const canProceed = () => {
    const nameOk = !needsNameValidation || nameStatus === 'passed' || nameStatus === 'skipped'
    const reviewOk = !needsCloseReview || reviewStatus === 'passed' || reviewStatus === 'skipped'
    return nameOk && reviewOk
  }

  const handleProceed = () => {
    const result: { correctedName?: string; closeReviewNote?: string } = {}

    if (needsNameValidation && nameStatus === 'passed' && editedName !== customerName) {
      result.correctedName = editedName.trim()
    }

    if (needsCloseReview && reviewStatus === 'passed' && reviewNote) {
      result.closeReviewNote = reviewNote
    }

    onComplete(result)
    onOpenChange(false)
  }

  const renderStatusIcon = (status: ValidationStatus) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />
      case 'passed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-destructive" />
      case 'skipped':
        return <SkipForward className="w-5 h-5 text-muted-foreground" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Validações IA antes de encerrar
          </DialogTitle>
          <DialogDescription>
            A IA está analisando o atendimento. Você pode pular qualquer validação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name Validation */}
          {needsNameValidation && (
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                {renderStatusIcon(nameStatus)}
                <UserCheck className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold flex-1">Validação do nome do contato</span>
                {(nameStatus === 'failed' || nameStatus === 'pending') && (
                  <Button variant="ghost" size="sm" onClick={handleSkipName} className="text-xs h-7">
                    <SkipForward className="w-3 h-3 mr-1" />
                    Pular
                  </Button>
                )}
              </div>

              {nameStatus === 'loading' && (
                <p className="text-xs text-muted-foreground">Analisando nome: "{editedName}"...</p>
              )}

              {nameStatus === 'passed' && (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Nome "{editedName}" validado com sucesso
                  </p>
                </div>
              )}

              {nameStatus === 'failed' && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {nameReason}
                    </p>
                  </div>
                  {nameEditing && (
                    <div className="flex gap-2">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Digite o nome correto do contato"
                        className="text-sm"
                      />
                      <Button size="sm" onClick={handleRetryName} disabled={!editedName.trim()}>
                        Validar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {nameStatus === 'skipped' && (
                <p className="text-xs text-muted-foreground italic">Validação do nome ignorada</p>
              )}
            </div>
          )}

          {/* Close Review */}
          {needsCloseReview && (
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                {renderStatusIcon(reviewStatus)}
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold flex-1">Nota de encerramento pela IA</span>
                {(reviewStatus === 'failed' || reviewStatus === 'pending') && (
                  <Button variant="ghost" size="sm" onClick={handleSkipReview} className="text-xs h-7">
                    <SkipForward className="w-3 h-3 mr-1" />
                    Pular
                  </Button>
                )}
              </div>

              {reviewStatus === 'loading' && (
                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Analisando conversa e gerando nota...</p>
                </div>
              )}

              {reviewStatus === 'passed' && (
                <div className="space-y-2">
                  <div className="flex items-start gap-1.5 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                    <Bot className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Nota gerada pela IA. Edite se necessário — será salva como anotação do cliente.
                    </p>
                  </div>
                  <Textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="min-h-[150px] text-sm resize-none rounded-xl"
                  />
                </div>
              )}

              {reviewStatus === 'failed' && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">
                      Não foi possível gerar a nota de encerramento.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCloseReview}>
                      Tentar novamente
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSkipReview}>
                      Pular
                    </Button>
                  </div>
                </div>
              )}

              {reviewStatus === 'skipped' && (
                <p className="text-xs text-muted-foreground italic">Nota de encerramento ignorada</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={handleProceed} disabled={!canProceed()} className="rounded-xl">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Prosseguir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
