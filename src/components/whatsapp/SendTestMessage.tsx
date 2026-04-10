import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useWhatsAppBusinessMessages } from '@/hooks/useWhatsAppBusinessMessages'
import { Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function SendTestMessage() {
  const { sendMessage } = useWhatsAppBusinessMessages()
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')

  const handleSend = async () => {
    if (!to.trim() || !message.trim()) {
      toast.error('Preencha número e mensagem')
      return
    }
    try {
      await sendMessage.mutateAsync({ to: to.trim(), message: message.trim(), type: 'text' })
      setMessage('')
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">📤 Enviar Mensagem de Teste</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Número (com código do país)</Label>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="+5511999999999"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Mensagem</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem de teste..."
            rows={4}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={sendMessage.isPending || !to.trim() || !message.trim()}
          className="w-full"
        >
          {sendMessage.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
          ) : (
            <><Send className="w-4 h-4 mr-2" />Enviar Mensagem</>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
