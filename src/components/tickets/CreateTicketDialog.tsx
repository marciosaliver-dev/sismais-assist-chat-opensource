import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Plus, Search, Building2, User, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { WhatsAppInstanceSelect } from '@/components/shared/WhatsAppInstanceSelect'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

interface Stage {
  id: string
  is_entry?: boolean
}

interface CreateTicketDialogProps {
  boardId: string
  stages: Stage[]
}

interface HelpdeskClient {
  id: string
  name: string
  company_name: string | null
  cnpj: string | null
  cpf: string | null
  subscribed_product: string | null
}

export function CreateTicketDialog({ boardId, stages }: CreateTicketDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const queryClient = useQueryClient()

  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<HelpdeskClient | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [categoryId, setCategoryId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [instanceId, setInstanceId] = useState('')
  const [humanAgentId, setHumanAgentId] = useState('')

  const debouncedSearch = useDebounce(clientSearch, 350)

  const { data: clientResults = [], isFetching: searchingClients } = useQuery({
    queryKey: ['helpdesk-clients-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return []
      const q = `%${debouncedSearch}%`
      const { data } = await supabase
        .from('helpdesk_clients')
        .select('id, name, company_name, cnpj, cpf, subscribed_product')
        .or(`name.ilike.${q},company_name.ilike.${q},cnpj.ilike.${q}`)
        .limit(8)
      return (data || []) as HelpdeskClient[]
    },
    enabled: debouncedSearch.length >= 2,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['ticket-categories-dialog'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_categories').select('id, name').eq('active', true).order('sort_order')
      return data || []
    },
  })

  const { data: modules = [] } = useQuery({
    queryKey: ['ticket-modules-dialog'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_modules').select('id, name').eq('active', true).order('name')
      return data || []
    },
  })

  const { data: humanAgents = [] } = useQuery({
    queryKey: ['human-agents-create-ticket'],
    queryFn: async () => {
      const { data } = await supabase.from('human_agents').select('id, name').neq('is_active', false).order('name')
      return data || []
    },
    enabled: open,
  })

  const resetForm = () => {
    setClientSearch('')
    setSelectedClient(null)
    setCustomerName('')
    setCustomerPhone('')
    setDescription('')
    setPriority('medium')
    setCategoryId('')
    setModuleId('')
    setInstanceId('')
    setHumanAgentId('')
    setMoreOpen(false)
  }

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Informe a descrição / assunto do ticket')
      return
    }

    setSubmitting(true)
    try {
      const entryStage = stages.find(s => s.is_entry) || stages[0]

      const { data: conv, error } = await (supabase as any)
        .from('ai_conversations')
        .insert({
          customer_name: selectedClient?.name || customerName || 'Ticket Interno',
          customer_phone: customerPhone || 'interno',
          priority,
          status: 'aguardando',
          handler_type: 'human',
          communication_channel: 'internal',
          kanban_board_id: boardId,
          stage_id: entryStage?.id || null,
          ticket_category_id: categoryId || null,
          ticket_module_id: moduleId || null,
          helpdesk_client_id: selectedClient?.id || null,
          human_agent_id: humanAgentId || null,
          context: instanceId ? { uazapi_instance_id: instanceId } : null,
        })
        .select('id')
        .single()

      if (error) throw error

      if (conv?.id && description.trim()) {
        await (supabase as any).from('ai_messages').insert({
          conversation_id: conv.id,
          role: 'system',
          content: description.trim(),
        })
      }

      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Ticket criado com sucesso')
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
      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5 mr-1" />
        Novo Ticket
      </Button>

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Ticket</DialogTitle>
          <DialogDescription>Preencha os dados e clique em Criar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client search */}
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
                  onClick={() => { setClientSearch(''); setSelectedClient(null) }}
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
                    onClick={() => { setSelectedClient(c); setClientSearch('') }}
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
                <button onClick={() => setSelectedClient(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!selectedClient && (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nome (opcional)" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-7 text-xs" />
                <Input placeholder="Telefone (opcional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-7 text-xs" />
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="ct-desc" className="text-xs">Descrição / Assunto *</Label>
            <Textarea
              id="ct-desc"
              placeholder="Descreva o motivo do ticket..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Priority / Category / Module */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Módulo</Label>
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* More options (collapsible) */}
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', moreOpen && 'rotate-180')} />
              Mais opções
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <WhatsAppInstanceSelect
                value={instanceId}
                onChange={setInstanceId}
                label="Canal WhatsApp (opcional)"
              />
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <User className="w-3 h-3" />
                  Agente responsável
                </Label>
                <Select value={humanAgentId} onValueChange={setHumanAgentId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sem agente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem agente atribuído</SelectItem>
                    {humanAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
