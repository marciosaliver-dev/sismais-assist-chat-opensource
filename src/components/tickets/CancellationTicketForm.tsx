import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { ShieldAlert, Search, Building2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

interface CancellationTicketFormProps {
  boardId: string
  stages: Array<{ id: string; name: string; is_entry: boolean }>
}

interface HelpdeskClient {
  id: string
  name: string
  company_name: string | null
  phone: string | null
  customer_since: string | null
  mrr: number | null
}

function calcMonthsActive(customerSince: string | null): number {
  if (!customerSince) return 0
  const since = new Date(customerSince)
  const now = new Date()
  const diff = (now.getFullYear() - since.getFullYear()) * 12 + (now.getMonth() - since.getMonth())
  return Math.max(0, diff)
}

export function CancellationTicketForm({ boardId, stages }: CancellationTicketFormProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const queryClient = useQueryClient()

  // Client search
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<HelpdeskClient | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // Cancellation fields
  const [channel, setChannel] = useState('')
  const [monthsActive, setMonthsActive] = useState<number>(0)
  const [mrrValue, setMrrValue] = useState<number>(69.90)
  const [notes, setNotes] = useState('')

  const debouncedSearch = useDebounce(clientSearch, 350)

  const { data: clientResults = [], isFetching: searchingClients } = useQuery({
    queryKey: ['helpdesk-clients-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return []
      const q = `%${debouncedSearch}%`
      const { data } = await supabase
        .from('helpdesk_clients')
        .select('id, name, company_name, phone, customer_since, mrr')
        .or(`name.ilike.${q},company_name.ilike.${q},cnpj.ilike.${q}`)
        .limit(8)
      return (data || []) as HelpdeskClient[]
    },
    enabled: debouncedSearch.length >= 2,
  })

  const selectClient = (client: HelpdeskClient) => {
    setSelectedClient(client)
    setClientSearch('')
    setCustomerName(client.name)
    setCustomerPhone(client.phone || '')
    setMonthsActive(calcMonthsActive(client.customer_since))
    if (client.mrr != null) setMrrValue(client.mrr)
  }

  const clearClient = () => {
    setSelectedClient(null)
    setCustomerName('')
    setCustomerPhone('')
  }

  const resetForm = () => {
    setClientSearch('')
    setSelectedClient(null)
    setCustomerName('')
    setCustomerPhone('')
    setChannel('')
    setMonthsActive(0)
    setMrrValue(69.90)
    setNotes('')
  }

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('Informe o nome do cliente')
      return
    }
    if (!channel) {
      toast.error('Selecione o canal de entrada')
      return
    }

    setSubmitting(true)
    try {
      const entryStage = stages.find(s => s.is_entry) || stages[0]

      const context = {
        cancellation_channel: channel,
        months_active: monthsActive,
        mrr_value: mrrValue,
        contact_attempts: 0,
        notes: notes,
      }

      const { error } = await (supabase as any)
        .from('ai_conversations')
        .insert({
          customer_name: customerName || 'Ticket Interno',
          customer_phone: customerPhone || 'interno',
          status: 'aguardando',
          handler_type: 'human',
          communication_channel: 'internal',
          kanban_board_id: boardId,
          stage_id: entryStage?.id || null,
          helpdesk_client_id: selectedClient?.id || null,
          context,
          ticket_subject: `Pedido de Cancelamento - ${customerName}`,
        })

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Ticket de cancelamento criado com sucesso')
      resetForm()
      setOpen(false)
    } catch (err: any) {
      toast.error('Erro ao criar ticket: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm()
    setOpen(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="default" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        <ShieldAlert className="w-3.5 h-3.5 mr-1" />
        Novo Cancelamento
      </Button>

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pedido de Cancelamento</DialogTitle>
          <DialogDescription>Registre os dados do cancelamento para acompanhamento.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Section 1: Cliente */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</Label>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Search className="w-3 h-3" />
                Buscar cliente
              </Label>
              <div className="relative">
                <Input
                  placeholder="Nome, empresa ou CNPJ..."
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setSelectedClient(null) }}
                  className="h-8 text-sm pr-8"
                  autoFocus
                />
                {clientSearch && (
                  <button
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    onClick={() => { setClientSearch(''); clearClient() }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {clientSearch.length >= 2 && !selectedClient && (
                <div className="border border-border rounded-md overflow-hidden bg-popover shadow-sm max-h-[160px] overflow-y-auto">
                  {searchingClients && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>
                  )}
                  {!searchingClients && clientResults.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum cliente encontrado.</div>
                  )}
                  {clientResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectClient(c)}
                      className="w-full flex items-start gap-3 px-3 py-2 hover:bg-accent text-left transition-colors border-b border-border last:border-0"
                    >
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {c.company_name && <p className="text-xs text-muted-foreground truncate">{c.company_name}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedClient && (
                <div className="flex items-center gap-2 p-2 rounded-md border border-primary/30 bg-primary/5 text-sm">
                  <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-medium truncate flex-1">{selectedClient.name}</span>
                  {selectedClient.company_name && (
                    <span className="text-xs text-muted-foreground truncate">{selectedClient.company_name}</span>
                  )}
                  <button onClick={clearClient} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="cancel-name" className="text-xs">Nome do cliente *</Label>
                <Input
                  id="cancel-name"
                  placeholder="Nome"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cancel-phone" className="text-xs">Telefone</Label>
                <Input
                  id="cancel-phone"
                  placeholder="Telefone"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dados do Cancelamento */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados do Cancelamento</Label>

            <div className="space-y-1">
              <Label className="text-xs">Canal de entrada *</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="suporte">Suporte</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="ligacao">Ligacao</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="cancel-months" className="text-xs">Tempo de casa (meses)</Label>
                <Input
                  id="cancel-months"
                  type="number"
                  min={0}
                  value={monthsActive}
                  onChange={e => setMonthsActive(Number(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cancel-mrr" className="text-xs">MRR (R$)</Label>
                <Input
                  id="cancel-mrr"
                  type="number"
                  min={0}
                  step={0.01}
                  value={mrrValue}
                  onChange={e => setMrrValue(Number(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="cancel-notes" className="text-xs">Observacoes</Label>
              <Textarea
                id="cancel-notes"
                placeholder="Motivo do cancelamento, detalhes relevantes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="min-h-[80px] text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
