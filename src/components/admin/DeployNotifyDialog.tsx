import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Loader2, Send, MessageSquare } from 'lucide-react'

interface DeployNotifyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeployNotifyDialog({ open, onOpenChange }: DeployNotifyDialogProps) {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [title, setTitle] = useState('Deploy — Correções e Melhorias')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!webhookUrl.trim()) {
      toast.error('Informe a URL do webhook Discord')
      return
    }
    if (!description.trim()) {
      toast.error('Descreva as correções/ajustes realizados')
      return
    }

    setSending(true)
    try {
      const fields = description.split('\n').filter(l => l.trim()).map((line, i) => ({
        name: `Item ${i + 1}`,
        value: line.trim(),
        inline: false,
      }))

      const { error } = await supabase.functions.invoke('discord-notify', {
        body: {
          webhook_url: webhookUrl,
          title,
          description: `Resumo das implementações realizadas:`,
          fields,
          footer: `Sismais GMS — ${new Date().toLocaleDateString('pt-BR')}`,
        },
      })

      if (error) throw error
      toast.success('Notificação enviada ao Discord!')
      onOpenChange(false)
      setDescription('')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar notificação')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Notificar Deploy no Discord
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="webhook-url">Webhook URL do Discord</Label>
            <Input
              id="webhook-url"
              placeholder="https://discord.com/api/webhooks/..."
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="deploy-title">Título</Label>
            <Input
              id="deploy-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="deploy-desc">Correções e ajustes (uma por linha)</Label>
            <Textarea
              id="deploy-desc"
              placeholder={"Corrigido bug de mensagens na conversa errada\nMelhorado tempo de envio de mensagens\nAdicionado busca no diálogo de transferência"}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={8}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
