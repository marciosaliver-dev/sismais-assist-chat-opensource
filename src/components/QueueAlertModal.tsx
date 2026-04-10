import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Clock, ArrowRight, Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { OverdueTicket } from '@/hooks/useQueueAlerts'

interface QueueAlertModalProps {
  open: boolean
  overdueTickets: OverdueTicket[]
  onDismiss: (minutes: number) => void
}

function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function UrgencyBadge({ waitMinutes, threshold }: { waitMinutes: number; threshold: number }) {
  const isCritical = waitMinutes >= threshold + 5

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        background: isCritical ? '#FEF2F2' : '#FFFBEB',
        color: isCritical ? '#DC2626' : '#92400E',
        border: `1px solid ${isCritical ? 'rgba(220,38,38,0.3)' : 'rgba(255,184,0,0.5)'}`,
      }}
    >
      <Clock className="h-3 w-3" />
      {formatWaitTime(waitMinutes)}
    </span>
  )
}

export function QueueAlertModal({ open, overdueTickets, onDismiss }: QueueAlertModalProps) {
  const navigate = useNavigate()

  const criticalCount = overdueTickets.filter(
    t => t.wait_minutes >= t.threshold_minutes + 5
  ).length

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl overflow-hidden shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
        {/* Header navy */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: '#10293F' }}
        >
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg"
            style={{ background: 'rgba(255,184,0,0.15)' }}
          >
            <AlertTriangle className="h-5 w-5" style={{ color: '#FFB800' }} />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-white text-base font-semibold m-0">
              Clientes aguardando na fila
            </DialogTitle>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {overdueTickets.length} cliente{overdueTickets.length !== 1 ? 's' : ''} além do tempo limite
              {criticalCount > 0 && (
                <span style={{ color: '#DC2626' }}> · {criticalCount} crítico{criticalCount !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
        </div>

        {/* Lista de tickets */}
        <div className="max-h-[50vh] overflow-y-auto px-5 py-3 space-y-2" style={{ background: '#F8FAFC' }}>
          {overdueTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-sm"
              style={{
                background: '#fff',
                borderColor: ticket.wait_minutes >= ticket.threshold_minutes + 5 ? 'rgba(220,38,38,0.3)' : '#E5E5E5',
                borderLeftWidth: '3px',
                borderLeftColor: ticket.wait_minutes >= ticket.threshold_minutes + 5 ? '#DC2626' : '#FFB800',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: '#10293F' }}>
                    {ticket.customer_name || ticket.customer_phone}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: '#F5F5F5', color: '#666' }}>
                    #{ticket.ticket_number}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs" style={{ color: '#666' }}>
                    {ticket.board_name}
                  </span>
                </div>
              </div>
              <UrgencyBadge waitMinutes={ticket.wait_minutes} threshold={ticket.threshold_minutes} />
            </div>
          ))}
        </div>

        {/* Footer com ações */}
        <div
          className="flex items-center gap-2 px-5 py-3 border-t"
          style={{ borderColor: '#E5E5E5', background: '#fff' }}
        >
          <Button
            className="flex-1 gap-1.5 font-semibold"
            style={{ background: '#45E5E5', color: '#10293F', border: 'none' }}
            onClick={() => {
              onDismiss(5)
              navigate('/queue')
            }}
          >
            <ArrowRight className="h-4 w-4" />
            Ir para Fila
          </Button>
          <Button
            className="gap-1.5 font-semibold"
            style={{ background: '#FFB800', color: '#10293F', border: 'none' }}
            onClick={() => onDismiss(5)}
          >
            <Timer className="h-4 w-4" />
            Adiar 5 min
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 font-semibold"
            style={{ borderColor: '#E5E5E5', color: '#444' }}
            onClick={() => onDismiss(15)}
          >
            Adiar 15 min
          </Button>
        </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
