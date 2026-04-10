import { useState } from 'react'
import { Pencil, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/integrations/supabase/client'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

interface EditContactPhonePopoverProps {
  conversationId: string
  currentPhone: string
  uazapiChatId?: string | null
}

const MOTIVO_OPTIONS = [
  { value: 'correcao', label: 'Correção manual' },
  { value: 'numero_errado', label: 'Número errado (automação)' },
  { value: 'troca_numero', label: 'Cliente trocou de número' },
]

export function EditContactPhonePopover({
  conversationId,
  currentPhone,
  uazapiChatId,
}: EditContactPhonePopoverProps) {
  const [open, setOpen] = useState(false)
  const [newPhone, setNewPhone] = useState(currentPhone)
  const [motivo, setMotivo] = useState('correcao')
  const [saveToContact, setSaveToContact] = useState(false)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const cleaned = newPhone.replace(/\D/g, '')
      if (!cleaned) throw new Error('Telefone não pode ser vazio')

      // 1. Update ai_conversations.customer_phone
      const { error: convErr } = await (supabase as any)
        .from('ai_conversations')
        .update({ customer_phone: cleaned })
        .eq('id', conversationId)

      if (convErr) throw convErr

      // 2. Optionally update uazapi_chats.contact_phone
      if (saveToContact && uazapiChatId) {
        await (supabase as any)
          .from('uazapi_chats')
          .update({ contact_phone: cleaned })
          .eq('chat_id', uazapiChatId)
          .then(() => {})
          .catch(() => {})
      }

      // 3. Log the change
      await (supabase as any)
        .from('contact_name_changes')
        .insert({
          ticket_id: conversationId,
          old_name: currentPhone,
          new_name: cleaned,
          reason: `phone_${motivo}`,
          saved_to_contact: saveToContact,
        })
        .then(() => {})
        .catch(() => {})
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] })
      toast.success('Telefone atualizado')
      setOpen(false)
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Erro ao salvar telefone'
      toast.error(message)
    },
  })

  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (o) {
      setNewPhone(currentPhone)
      setMotivo('correcao')
      setSaveToContact(false)
    }
  }

  const cleanedNew = newPhone.replace(/\D/g, '')
  const cleanedCurrent = currentPhone.replace(/\D/g, '')

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-4 h-4 shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          title="Editar telefone do contato"
        >
          <Pencil className="w-2.5 h-2.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start" side="bottom">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-0.5">Editar telefone do contato</h4>
            <p className="text-xs text-muted-foreground">A alteração será registrada no histórico.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-contact-phone" className="text-xs">Novo telefone</Label>
            <Input
              id="edit-contact-phone"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="5511999999999"
              className="h-8 text-sm font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') mutation.mutate()
                if (e.key === 'Escape') setOpen(false)
              }}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {uazapiChatId && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-phone-to-contact"
                checked={saveToContact}
                onCheckedChange={(v) => setSaveToContact(!!v)}
              />
              <Label htmlFor="save-phone-to-contact" className="text-xs cursor-pointer">
                Atualizar no cadastro de contatos (WhatsApp)
              </Label>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !cleanedNew || cleanedNew === cleanedCurrent}
            >
              {mutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
