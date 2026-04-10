import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, Phone, RefreshCw, Loader2, User } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useUazapiChats, type UazapiChat } from '@/hooks/useUazapiChats'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { normalizeText } from '@/lib/utils'
import { WhatsAppInstanceSelect } from '@/components/shared/WhatsAppInstanceSelect'

interface NewConversationDialogProps {
  instanceId?: string
  onConversationCreated: (conversationId: string) => void
}

export function NewConversationDialog({ instanceId, onConversationCreated }: NewConversationDialogProps) {
  const [open, setOpen] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState(instanceId || '')

  const { data: activeInstances = [] } = useQuery({
    queryKey: ['whatsapp-instances-active-for-dialog'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('uazapi_instances_public')
        .select('id, instance_name, phone_number, status, is_active')
        .eq('is_active', true)
      return (data || []) as Array<{ id: string; name: string; phone_number: string | null; status: string | null }>
    },
  })

  const effectiveInstanceId = instanceId || selectedInstance || (activeInstances.length === 1 ? activeInstances[0].id : '')
  const showInstanceSelect = !instanceId && activeInstances.length > 1

  const { chats } = useUazapiChats(effectiveInstanceId || undefined)

  const contacts = useMemo(() => chats.filter(c => {
    if (!contactSearch) return true
    const search = normalizeText(contactSearch)
    return (
      normalizeText(c.contact_name || '').includes(search) ||
      c.contact_phone?.includes(contactSearch)
    )
  }), [chats, contactSearch])

  const handleSyncContacts = async () => {
    if (!effectiveInstanceId) return
    setSyncing(true)
    try {
      const { error } = await supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'fetchContacts', instanceId: effectiveInstanceId },
      })
      if (error) throw error
      toast.success('Contatos sincronizados!')
    } catch (err) {
      toast.error('Erro ao sincronizar contatos')
      console.error(err)
    } finally {
      setSyncing(false)
    }
  }

  const handleStartConversation = async (phone: string) => {
    if (!effectiveInstanceId || !phone) return
    setStarting(true)
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'startConversation', instanceId: effectiveInstanceId, chatJid: phone },
      })
      if (error) throw error
      const convId = data?.data?.conversationId
      if (convId) {
        onConversationCreated(convId)
        setOpen(false)
        setPhoneInput('')
        toast.success('Conversa criada!')
      }
    } catch (err) {
      toast.error('Erro ao iniciar conversa')
      console.error(err)
    } finally {
      setStarting(false)
    }
  }

  const handleContactSelect = (chat: UazapiChat) => {
    const phone = chat.contact_phone || chat.chat_id.replace('@s.whatsapp.net', '').replace('@lid', '')
    handleStartConversation(phone)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8">
          <Plus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="phone" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone">
              <Phone className="w-3.5 h-3.5 mr-1.5" />
              Digitar Número
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <User className="w-3.5 h-3.5 mr-1.5" />
              Contatos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="space-y-4 mt-4">
            {showInstanceSelect && (
              <WhatsAppInstanceSelect
                value={selectedInstance}
                onChange={setSelectedInstance}
                label="Instância WhatsApp"
                required
              />
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Número do WhatsApp
              </label>
              <Input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="5511999999999"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Inclua o código do país (55 para Brasil)
              </p>
            </div>
            <Button
              onClick={() => handleStartConversation(phoneInput)}
              disabled={!phoneInput || phoneInput.length < 8 || starting || !effectiveInstanceId}
              className="w-full"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                'Iniciar Conversa'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-3 mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Buscar contato..."
                  className="pl-9"
                />
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={handleSyncContacts}
                disabled={syncing}
                title="Sincronizar contatos do WhatsApp"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>Nenhum contato encontrado</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleSyncContacts}
                    disabled={syncing}
                    className="mt-2"
                  >
                    Sincronizar contatos
                  </Button>
                </div>
              ) : (
                contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleContactSelect(contact)}
                    disabled={starting}
                    className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 rounded-lg transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm shrink-0">
                      {contact.contact_name?.[0]?.toUpperCase() || contact.contact_phone?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {contact.contact_name || contact.contact_phone || contact.chat_id}
                      </p>
                      {contact.contact_phone && (
                        <p className="text-xs text-muted-foreground">{contact.contact_phone}</p>
                      )}
                    </div>
                    {contact.last_message_time && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        Ativo
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
