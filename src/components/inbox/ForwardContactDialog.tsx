import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Forward, Loader2, User, Phone, Search, X, Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import { useWhatsAppValidation } from '@/hooks/useWhatsAppValidation'

interface ForwardContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactName: string
  contactPhone: string
  instanceId?: string
}

interface SelectedContact {
  name: string
  phone: string
  pictureUrl: string | null
}

export function ForwardContactDialog({ open, onOpenChange, contactName, contactPhone, instanceId }: ForwardContactDialogProps) {
  const [destinationNumber, setDestinationNumber] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContact, setSelectedContact] = useState<SelectedContact | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const { validateNumber, validating } = useWhatsAppValidation()

  const debouncedSearch = useDebounce(searchQuery, 300)

  const { data: searchResults = [], isLoading: searching } = useQuery({
    queryKey: ['forward-contact-search', instanceId, debouncedSearch],
    queryFn: async () => {
      const term = `%${debouncedSearch}%`
      const { data, error } = await supabase
        .from('uazapi_chats')
        .select('contact_name, contact_phone, contact_picture_url')
        .eq('instance_id', instanceId!)
        .eq('is_group', false)
        .or(`contact_name.ilike.${term},contact_phone.ilike.${term}`)
        .limit(10)

      if (error) throw error
      return data || []
    },
    enabled: !!instanceId && debouncedSearch.length >= 2 && !selectedContact && !manualMode,
  })

  const handleSelectContact = (contact: typeof searchResults[0]) => {
    setSelectedContact({
      name: contact.contact_name || contact.contact_phone || '',
      phone: contact.contact_phone || '',
      pictureUrl: contact.contact_picture_url,
    })
    setDestinationNumber(contact.contact_phone || '')
    setSearchQuery('')
  }

  const handleClearSelection = () => {
    setSelectedContact(null)
    setDestinationNumber('')
    setSearchQuery('')
  }

  const handleSend = async () => {
    const number = selectedContact?.phone || destinationNumber
    const cleanNumber = number.replace(/\D/g, '')
    if (!cleanNumber || cleanNumber.length < 8) {
      toast.error('Digite um número de telefone válido')
      return
    }
    if (!instanceId) {
      toast.error('Instância WhatsApp não encontrada')
      return
    }

    setSending(true)
    try {
      // Validate if destination number is on WhatsApp
      const validation = await validateNumber(cleanNumber, instanceId)
      if (!validation.valid) {
        toast.error('Este número não possui WhatsApp. Verifique e tente novamente.')
        setSending(false)
        return
      }
      if (validation.unknown) {
        toast.warning('Não foi possível validar o número no WhatsApp. Tentando enviar...')
      }

      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'sendContact',
          instanceId,
          chatJid: `${cleanNumber}@s.whatsapp.net`,
          contactName: contactName || contactPhone,
          contactPhone: contactPhone.replace(/\D/g, ''),
        },
      })

      if (error) throw error
      if (data?.success) {
        toast.success('Contato encaminhado com sucesso!')
        handleClearSelection()
        setManualMode(false)
        onOpenChange(false)
      } else {
        throw new Error(data?.error || 'Erro ao encaminhar contato')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao encaminhar contato')
    } finally {
      setSending(false)
    }
  }

  const hasDestination = !!(selectedContact?.phone || destinationNumber.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="w-5 h-5 text-primary" />
            Encaminhar Contato
          </DialogTitle>
          <DialogDescription>
            Envie os dados deste contato como vCard para outro número no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Contact being forwarded */}
          <div className="bg-secondary rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contato a encaminhar</p>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold text-foreground">{contactName || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono text-foreground">{contactPhone || '—'}</span>
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Destinatário</Label>

            {selectedContact ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <Avatar className="h-9 w-9 shrink-0">
                  {selectedContact.pictureUrl && <AvatarImage src={selectedContact.pictureUrl} />}
                  <AvatarFallback className="text-xs">{(selectedContact.name || '?')[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{selectedContact.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedContact.phone}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleClearSelection}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : manualMode ? (
              <div className="space-y-2">
                <Input
                  value={destinationNumber}
                  onChange={(e) => setDestinationNumber(e.target.value)}
                  placeholder="5511999999999"
                  className="h-10 rounded-xl"
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <p className="text-xs text-muted-foreground">Digite o número com código do país (ex: 5511999999999)</p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => { setManualMode(false); setDestinationNumber('') }}
                >
                  <Search className="w-3 h-3" /> Buscar contato
                </button>
              </div>
            ) : (
              <div className="space-y-2 relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nome ou telefone..."
                    className="h-10 rounded-xl pl-9"
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>

                {/* Search results dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
                        onClick={() => handleSelectContact(c)}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          {c.contact_picture_url && <AvatarImage src={c.contact_picture_url} />}
                          <AvatarFallback className="text-xs">{(c.contact_name || c.contact_phone || '?')[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.contact_name || c.contact_phone}</p>
                          {c.contact_name && <p className="text-xs text-muted-foreground font-mono">{c.contact_phone}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {debouncedSearch.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">Nenhum contato encontrado</p>
                )}

                <button
                  type="button"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => setManualMode(true)}
                >
                  <Keyboard className="w-3 h-3" /> Digitar número manualmente
                </button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending || validating || !hasDestination} className="rounded-xl">
            {(sending || validating) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Forward className="w-4 h-4 mr-1.5" />}
            {validating ? 'Validando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
