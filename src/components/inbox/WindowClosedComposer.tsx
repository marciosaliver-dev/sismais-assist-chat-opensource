import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, FileText, MessageSquare } from 'lucide-react'
import { TemplatePickerDialog } from './TemplatePickerDialog'

interface WindowClosedComposerProps {
  onSwitchToUazapi: () => void
  instanceId?: string
  recipient?: string
  onTemplateSent?: () => void
}

export function WindowClosedComposer({ onSwitchToUazapi, instanceId, recipient, onTemplateSent }: WindowClosedComposerProps) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  const canSendTemplate = !!instanceId && !!recipient

  return (
    <div className="border-t border-border bg-yellow-50/50 p-4">
      <div className="flex items-center gap-2 mb-3 text-yellow-800">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">
          Janela de 24h encerrada. Escolha uma opção:
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canSendTemplate}
          className="gap-2"
          onClick={() => setShowTemplatePicker(true)}
        >
          <FileText className="h-4 w-4" />
          Enviar Template HSM
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onSwitchToUazapi}
          className="gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          Continuar via UAZAPI
        </Button>
      </div>

      {canSendTemplate && (
        <TemplatePickerDialog
          open={showTemplatePicker}
          onOpenChange={setShowTemplatePicker}
          instanceId={instanceId}
          recipient={recipient}
          onSent={onTemplateSent}
        />
      )}
    </div>
  )
}
