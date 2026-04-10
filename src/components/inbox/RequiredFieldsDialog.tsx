import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertTriangle, ClipboardEdit, CheckCircle2 } from 'lucide-react'

interface MissingField {
  field_name: string
  field_label: string
}

interface RequiredFieldsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  missingFields: MissingField[]
  onForceClose: () => void
  onGoToTicket?: () => void
  showResolutionNote?: boolean
  onForceCloseWithNote?: (note: string) => void
  isAdmin?: boolean
}

export function RequiredFieldsDialog({
  open,
  onOpenChange,
  missingFields,
  onForceClose,
  onGoToTicket,
  showResolutionNote,
  onForceCloseWithNote,
  isAdmin,
}: RequiredFieldsDialogProps) {
  const [resolutionNote, setResolutionNote] = useState('')

  const hasResolutionNoteMissing = missingFields.some(f => f.field_name === 'resolution_note')
  const otherMissingFields = missingFields.filter(f => f.field_name !== 'resolution_note')
  const showInlineNote = showResolutionNote && hasResolutionNoteMissing

  const canSaveAndClose = showInlineNote && resolutionNote.trim().length >= 10

  const handleSaveAndClose = () => {
    if (canSaveAndClose && onForceCloseWithNote) {
      onForceCloseWithNote(resolutionNote.trim())
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[480px]">
        {/* Header navy — identidade GMS */}
        <div className="-mx-6 -mt-6 px-6 py-4 rounded-t-lg mb-4" style={{ background: '#10293F' }}>
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="flex items-center gap-2 text-white text-base">
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#FFB800' }} />
              Campos obrigatórios não preenchidos
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60 text-[13px]">
              Preencha os campos abaixo antes de encerrar o atendimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        {/* Missing fields list (non-resolution-note ones) */}
        {otherMissingFields.length > 0 && (
          <ul className="space-y-2 mb-4">
            {otherMissingFields.map((field) => (
              <li
                key={field.field_name}
                className="flex items-center gap-2 text-sm p-2.5 rounded-lg border"
                style={{ background: '#FFFBEB', borderColor: 'rgba(255,184,0,0.4)', color: '#333' }}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: '#FFB800' }} />
                <span className="font-medium">{field.field_label}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Inline resolution note */}
        {showInlineNote && (
          <div className="space-y-2 mb-4">
            <div
              className="flex items-center gap-2 p-2.5 rounded-lg border mb-1"
              style={{ background: '#FFFBEB', borderColor: 'rgba(255,184,0,0.4)', color: '#333' }}
            >
              <ClipboardEdit className="w-3.5 h-3.5 shrink-0" style={{ color: '#FFB800' }} />
              <span className="text-sm font-medium">Nota de resolução (obrigatória)</span>
            </div>
            <Label htmlFor="resolution-note" className="text-xs font-medium" style={{ color: '#444' }}>
              Descreva brevemente como o atendimento foi resolvido
            </Label>
            <Textarea
              id="resolution-note"
              placeholder="Ex.: Cliente orientado a atualizar o sistema para a versão 3.2.1. Problema resolvido."
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value)}
              rows={3}
              className="text-sm resize-none"
              style={{
                borderColor: resolutionNote.trim().length >= 10 ? '#45E5E5' : '#CCCCCC',
                outline: 'none',
              }}
            />
            {resolutionNote.trim().length > 0 && resolutionNote.trim().length < 10 && (
              <p className="text-xs" style={{ color: '#DC2626' }}>
                Mínimo de 10 caracteres ({resolutionNote.trim().length}/10)
              </p>
            )}
            {canSaveAndClose && (
              <p className="flex items-center gap-1 text-xs" style={{ color: '#16A34A' }}>
                <CheckCircle2 className="w-3 h-3" />
                Nota pronta para salvar
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter className="gap-2">
          {onGoToTicket ? (
            <AlertDialogAction
              onClick={onGoToTicket}
              className="border text-sm font-semibold h-9 px-4 rounded-md"
              style={{ background: 'transparent', borderColor: '#CCCCCC', color: '#444' }}
            >
              Ir para o ticket
            </AlertDialogAction>
          ) : (
            <AlertDialogCancel
              className="border text-sm font-semibold h-9 px-4 rounded-md"
              style={{ background: 'transparent', borderColor: '#CCCCCC', color: '#444' }}
            >
              Voltar e Preencher
            </AlertDialogCancel>
          )}

          {/* Primary action: save note if available */}
          {canSaveAndClose ? (
            <AlertDialogAction
              onClick={handleSaveAndClose}
              className="text-sm font-semibold h-9 px-4 rounded-md"
              style={{ background: '#45E5E5', color: '#10293F', border: 'none' }}
            >
              Salvar e Encerrar
            </AlertDialogAction>
          ) : isAdmin ? (
            <AlertDialogAction
              onClick={onForceClose}
              className="text-sm font-semibold h-9 px-4 rounded-md"
              style={{ background: '#DC2626', color: '#fff', border: 'none' }}
            >
              Encerrar mesmo assim
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
