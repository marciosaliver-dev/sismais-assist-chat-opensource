import { useState, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Forward, Loader2, Search, Mic, FileText, Image as ImageIcon, Video, CornerDownRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface ForwardableMessage {
  content: string
  media_url?: string | null
  media_type?: string | null
  media_filename?: string | null
  uazapi_message_id?: string | null
}

interface ForwardMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: ForwardableMessage | null
  instanceId?: string
}

type FilterTab = 'all' | 'recent' | 'groups'

export function ForwardMessageDialog({ open, onOpenChange, message, instanceId }: ForwardMessageDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('all')

  const debouncedSearch = useDebounce(searchQuery, 300)

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ['forward-msg-chats', instanceId, debouncedSearch, filter],
    queryFn: async () => {
      let query = supabase
        .from('uazapi_chats')
        .select('id, chat_id, contact_name, contact_phone, contact_picture_url, is_group, last_message_preview, last_message_time')
        .eq('instance_id', instanceId!)
        .eq('is_archived', false)
        .order('last_message_time', { ascending: false })
        .limit(50)

      if (filter === 'groups') {
        query = query.eq('is_group', true)
      }

      if (debouncedSearch.length >= 2) {
        const term = `%${debouncedSearch}%`
        query = query.or(`contact_name.ilike.${term},contact_phone.ilike.${term}`)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!instanceId && open,
  })

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 5) {
        next.add(id)
      } else {
        toast.error('Máximo de 5 destinos por vez')
      }
      return next
    })
  }

  const handleForward = async () => {
    if (!message || selectedIds.size === 0 || !instanceId) return
    setSending(true)

    const selectedChats = chats.filter(c => selectedIds.has(c.id))
    let successCount = 0

    for (const chat of selectedChats) {
      try {
        const mediaType = message.media_type
        let type = 'text'
        if (mediaType === 'image' || mediaType === 'imageMessage') type = 'image'
        else if (mediaType === 'video' || mediaType === 'videoMessage') type = 'video'
        else if (mediaType === 'audio' || mediaType === 'audioMessage' || mediaType === 'ptt') type = 'audio'
        else if (mediaType === 'document' || mediaType === 'documentMessage') type = 'document'
        else if (mediaType === 'sticker' || mediaType === 'stickerMessage') type = 'image'

        const body: Record<string, unknown> = {
          action: 'sendMessage',
          instanceId,
          chatJid: chat.chat_id,
          type,
          isForwarded: true,
        }

        if (type === 'text') {
          body.text = message.content
        } else {
          body.mediaUrl = message.media_url
          body.text = message.content || ''
          if (type === 'document') {
            body.filename = message.media_filename || 'document'
          }
        }

        const { error } = await supabase.functions.invoke('uazapi-proxy', { body })
        if (error) throw error
        successCount++
      } catch (err: any) {
        toast.error(`Falha ao encaminhar para ${chat.contact_name || chat.contact_phone || 'contato'}`)
      }
    }

    if (successCount > 0) {
      toast.success(`Mensagem encaminhada para ${successCount} contato(s)`)
    }

    setSending(false)
    setSelectedIds(new Set())
    setSearchQuery('')
    setFilter('all')
    onOpenChange(false)
  }

  // Message preview
  const preview = useMemo(() => {
    if (!message) return null
    const mt = message.media_type
    if (mt === 'audio' || mt === 'audioMessage' || mt === 'ptt') {
      return { icon: <Mic className="w-4 h-4 text-muted-foreground" />, text: 'Áudio' }
    }
    if (mt === 'image' || mt === 'imageMessage') {
      return { icon: <ImageIcon className="w-4 h-4 text-muted-foreground" />, text: message.content?.slice(0, 100) || 'Imagem', thumb: message.media_url }
    }
    if (mt === 'video' || mt === 'videoMessage') {
      return { icon: <Video className="w-4 h-4 text-muted-foreground" />, text: message.content?.slice(0, 100) || 'Vídeo', thumb: message.media_url }
    }
    if (mt === 'document' || mt === 'documentMessage') {
      return { icon: <FileText className="w-4 h-4 text-muted-foreground" />, text: message.media_filename || 'Documento' }
    }
    return { text: (message.content || '').slice(0, 100) + ((message.content?.length || 0) > 100 ? '...' : '') }
  }, [message])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="w-5 h-5 text-primary" />
            Encaminhar para...
          </DialogTitle>
          <DialogDescription>Selecione até 5 contatos ou grupos.</DialogDescription>
        </DialogHeader>

        {/* Message preview */}
        {preview && (
          <div className="bg-secondary rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground italic">
              <CornerDownRight className="w-3 h-3" /> Encaminhada
            </div>
            <div className="flex items-center gap-2">
              {preview.thumb && (
                <img src={preview.thumb} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              )}
              {preview.icon}
              <span className="text-sm text-foreground truncate">{preview.text}</span>
            </div>
          </div>
        )}

        {/* Search + filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar contato ou grupo..."
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'recent', 'groups'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  'text-xs px-3 py-1 rounded-full border transition-colors',
                  filter === tab
                    ? 'bg-primary/10 border-primary text-primary font-semibold'
                    : 'bg-secondary border-border text-muted-foreground hover:bg-accent'
                )}
              >
                {tab === 'all' ? 'Todos' : tab === 'recent' ? 'Recentes' : 'Grupos'}
              </button>
            ))}
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {selectedIds.size}/5 selecionados
              </Badge>
            )}
          </div>
        </div>

        {/* Contact list */}
        <ScrollArea className="flex-1 max-h-[300px] -mx-2">
          <div className="space-y-0.5 px-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : chats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum contato encontrado</p>
            ) : (
              chats.map(chat => {
                const selected = selectedIds.has(chat.id)
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => toggleSelect(chat.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                      selected
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-accent border border-transparent'
                    )}
                  >
                    <Checkbox checked={selected} className="shrink-0" tabIndex={-1} />
                    <Avatar className="h-9 w-9 shrink-0">
                      {chat.contact_picture_url && <AvatarImage src={chat.contact_picture_url} />}
                      <AvatarFallback className="text-xs">
                        {(chat.contact_name || chat.contact_phone || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {chat.contact_name || chat.contact_phone}
                        {chat.is_group && <Badge variant="outline" className="ml-1.5 text-[9px] h-4 px-1">Grupo</Badge>}
                      </p>
                      {chat.last_message_preview && (
                        <p className="text-xs text-muted-foreground truncate">{chat.last_message_preview}</p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleForward}
            disabled={sending || selectedIds.size === 0}
            className="rounded-xl"
          >
            {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Forward className="w-4 h-4 mr-1.5" />}
            Encaminhar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
