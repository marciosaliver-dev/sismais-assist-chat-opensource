import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface ReopenTicketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  onSuccess?: () => void
}

type DestinationType = 'orchestrator' | 'human' | 'ai'

export function ReopenTicketModal({ open, onOpenChange, conversationId, onSuccess }: ReopenTicketModalProps) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [destination, setDestination] = useState<DestinationType | ''>('')
  const [destinationId, setDestinationId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: humanAgents } = useQuery({
    queryKey: ['human_agents', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_agents')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: destination === 'human',
  })

  const { data: aiAgents } = useQuery({
    queryKey: ['ai_agents', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: destination === 'ai',
  })

  const resetForm = () => {
    setReason('')
    setDestination('')
    setDestinationId('')
  }

  const handleOpenChange = (value: boolean) => {
    if (!value) resetForm()
    onOpenChange(value)
  }

  const isValid =
    reason.length >= 10 &&
    destination !== '' &&
    (destination === 'orchestrator' || destinationId !== '')

  const handleSubmit = async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('reopen-conversation', {
        body: {
          conversation_id: conversationId,
          reason,
          destination_type: destination,
          destination_id: destination !== 'orchestrator' ? destinationId : undefined,
        },
      })
      if (error) throw error
      toast.success('Atendimento reaberto com sucesso')
      await qc.invalidateQueries({ queryKey: ['conversations'] })
      await qc.invalidateQueries({ queryKey: ['conversation-messages'] })
      await qc.invalidateQueries({ queryKey: ['kanban-tickets'] })
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao reabrir atendimento'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Reabrir Atendimento
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Motivo */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reopen-reason">
              Motivo da reabertura <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reopen-reason"
              placeholder="Descreva o motivo da reabertura..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            {reason.length < 10 && reason.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {10 - reason.length} caractere{10 - reason.length !== 1 ? 's' : ''} restante{10 - reason.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Destino */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reopen-destination">
              Destino <span className="text-destructive">*</span>
            </Label>
            <Select
              value={destination}
              onValueChange={(value: DestinationType) => {
                setDestination(value)
                setDestinationId('')
              }}
            >
              <SelectTrigger id="reopen-destination">
                <SelectValue placeholder="Selecione o destino..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orchestrator">Fila do orquestrador (IA redistribui)</SelectItem>
                <SelectItem value="human">Agente humano</SelectItem>
                <SelectItem value="ai">Agente IA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agente humano */}
          {destination === 'human' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reopen-human-agent">
                Agente humano <span className="text-destructive">*</span>
              </Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger id="reopen-human-agent">
                  <SelectValue placeholder="Selecione um agente..." />
                </SelectTrigger>
                <SelectContent>
                  {humanAgents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Agente IA */}
          {destination === 'ai' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reopen-ai-agent">
                Agente IA <span className="text-destructive">*</span>
              </Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger id="reopen-ai-agent">
                  <SelectValue placeholder="Selecione um agente..." />
                </SelectTrigger>
                <SelectContent>
                  {aiAgents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reabrindo...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Reabrir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
