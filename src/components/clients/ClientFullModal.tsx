import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ClientFullView } from './ClientFullView'

interface ClientFullModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string | null
}

export function ClientFullModal({ open, onOpenChange, clientId }: ClientFullModalProps) {
  if (!clientId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] h-[85vh] p-0 overflow-hidden">
        <ClientFullView clientId={clientId} mode="modal" />
      </DialogContent>
    </Dialog>
  )
}
