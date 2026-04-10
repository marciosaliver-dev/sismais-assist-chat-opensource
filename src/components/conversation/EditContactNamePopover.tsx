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

interface EditContactNamePopoverProps {
  conversationId: string
  currentName: string
  uazapiChatId?: string | null
}

const MOTIVO_OPTIONS = [
  { value: 'correcao', label: 'Correção manual' },
  { value: 'apelido', label: 'Apelido' },
  { value: 'nome_completo', label: 'Nome completo' },
]

export function EditContactNamePopover({
  conversationId,
  currentName,
  uazapiChatId,
}: EditContactNamePopoverProps) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState(currentName)
  const [motivo, setMotivo] = useState('correcao')
  const [saveToContact, setSaveToContact] = useState(false)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error('Nome não pode ser vazio')

      // 1. Update ai_conversations.customer_name
      const { error: convErr } = await (supabase as any)
        .from('ai_conversations')
        .update({ customer_name: newName.trim() })
        .eq('id', conversationId)

      if (convErr) throw convErr

      // 2. Optionally update uazapi_chats.contact_name
      if (saveToContact && uazapiChatId) {
        await (supabase as any)
          .from('uazapi_chats')
          .update({ contact_name: newName.trim() })
          .eq('chat_id', uazapiChatId)
          .then(() => {})
          .catch(() => {})
      }

      // 3. Log to contact_name_changes
      await (supabase as any)
        .from('contact_name_changes')
        .insert({
          ticket_id: conversationId,
          old_name: currentName,
          new_name: newName.trim(),
          reason: motivo,
          saved_to_contact: saveToContact,
        })
        .then(() => {})
        .catch(() => {})
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] })
      toast.success('Nome atualizado')
      setOpen(false)
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Erro ao salvar nome'
      toast.error(message)
    },
  })

  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (o) {
      setNewName(currentName)
      setMotivo('correcao')
      setSaveToContact(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-5 h-5 shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          title="Editar nome do contato"
        >
          <Pencil className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start" side="bottom">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-0.5">Editar nome do contato</h4>
            <p className="text-xs text-muted-foreground">A alteração será registrada no histórico.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-contact-name" className="text-xs">Novo nome</Label>
            <Input
              id="edit-contact-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do contato"
              className="h-8 text-sm"
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
                id="save-to-contact"
                checked={saveToContact}
                onCheckedChange={(v) => setSaveToContact(!!v)}
              />
              <Label htmlFor="save-to-contact" className="text-xs cursor-pointer">
                Salvar no cadastro de contatos (WhatsApp)
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
              disabled={mutation.isPending || !newName.trim() || newName.trim() === currentName}
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
