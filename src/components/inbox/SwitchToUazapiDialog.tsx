import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { MessageSquare, Loader2 } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface SwitchToUazapiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metaConversationId: string
  customerPhone: string
  customerName: string
  onSwitched: (conversationId: string) => void
}

export function SwitchToUazapiDialog({
  open,
  onOpenChange,
  metaConversationId,
  customerPhone,
  customerName,
  onSwitched,
}: SwitchToUazapiDialogProps) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('')

  const { data: uazapiInstances = [] } = useQuery({
    queryKey: ['uazapi-instances-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uazapi_instances')
        .select('id, instance_name, status')
        .eq('status', 'connected')
      if (error) throw error
      return data
    },
    enabled: open,
  })

  const switchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInstanceId) throw new Error('Selecione uma instância')

      const cleanPhone = customerPhone.replace(/\D/g, '')
      const chatJid = `${cleanPhone}@s.whatsapp.net`

      const { data: existingConv } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('communication_channel', 'uazapi')
        .eq('uazapi_chat_id', chatJid)
        .eq('whatsapp_instance_id', selectedInstanceId)
        .in('status', ['aguardando', 'em_atendimento', 'nova'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingConv) {
        await supabase
          .from('ai_conversations')
          .update({ related_conversation_id: metaConversationId } as any)
          .eq('id', existingConv.id)
        await supabase
          .from('ai_conversations')
          .update({ related_conversation_id: existingConv.id } as any)
          .eq('id', metaConversationId)
        return existingConv.id
      }

      const { data: newConv, error } = await supabase
        .from('ai_conversations')
        .insert({
          customer_name: customerName || 'Cliente',
          customer_phone: cleanPhone,
          communication_channel: 'uazapi',
          uazapi_chat_id: chatJid,
          whatsapp_instance_id: selectedInstanceId,
          channel_instance_id: null,
          channel_chat_id: chatJid,
          status: 'em_atendimento',
          handler_type: 'human',
          related_conversation_id: metaConversationId,
        } as any)
        .select('id')
        .single()

      if (error) throw error

      await supabase
        .from('ai_conversations')
        .update({ related_conversation_id: newConv.id } as any)
        .eq('id', metaConversationId)

      return newConv.id
    },
    onSuccess: (conversationId) => {
      toast.success('Conversa UAZAPI criada. Redirecionando...')
      onOpenChange(false)
      onSwitched(conversationId)
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Continuar via UAZAPI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            A janela de 24h da Meta expirou. Selecione uma instância UAZAPI para
            continuar a conversa com <strong>{customerName || customerPhone}</strong>.
          </p>

          <div className="space-y-2">
            <Label>Instância UAZAPI</Label>
            <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância..." />
              </SelectTrigger>
              <SelectContent>
                {uazapiInstances.map((inst: any) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uazapiInstances.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma instância UAZAPI conectada disponível.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => switchMutation.mutate()}
              disabled={!selectedInstanceId || switchMutation.isPending}
            >
              {switchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Iniciar conversa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
