import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { WhatsAppInstanceSelect } from '@/components/shared/WhatsAppInstanceSelect'

interface SendMessagePropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
  onBatchUpdate: (updates: Record<string, any>) => void
}

export function SendMessageProperties({ config, onUpdate, onBatchUpdate }: SendMessagePropertiesProps) {
  const buttons: Array<{ id: string; text: string }> = config.buttons || []

  const addButton = () => {
    onUpdate('buttons', [...buttons, { id: `btn_${Date.now()}`, text: 'Novo Botão' }])
  }

  const removeButton = (index: number) => {
    onUpdate('buttons', buttons.filter((_, i) => i !== index))
  }

  const updateButton = (index: number, text: string) => {
    const newButtons = [...buttons]
    newButtons[index] = { ...newButtons[index], text }
    onUpdate('buttons', newButtons)
  }

  const activeTab = config.media_type === 'image' ? 'image' : config.media_type === 'document' ? 'document' : 'text'

  return (
    <div className="space-y-3">
      <Tabs
        value={activeTab}
        onValueChange={(v) => onUpdate('media_type', v === 'text' ? 'none' : v)}
      >
        <TabsList className="w-full grid grid-cols-3 h-8">
          <TabsTrigger value="text" className="text-xs">Texto</TabsTrigger>
          <TabsTrigger value="image" className="text-xs">Imagem</TabsTrigger>
          <TabsTrigger value="document" className="text-xs">Arquivo</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-3 mt-3">
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={config.message || ''}
              onChange={(e) => onUpdate('message', e.target.value)}
              placeholder="Olá {customer_name}! Como posso ajudar?"
              rows={4}
              className="text-xs mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Variáveis: {'{customer_name}'}, {'{customer_phone}'}, {'{message_content}'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Botões (Opcional)</Label>
              <Button onClick={addButton} size="sm" variant="outline" className="h-6 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-1.5">
              {buttons.map((button, index) => (
                <div key={button.id} className="flex items-center gap-1.5">
                  <Input
                    value={button.text}
                    onChange={(e) => updateButton(index, e.target.value)}
                    placeholder="Texto do botão"
                    className="text-xs flex-1"
                  />
                  <Button
                    onClick={() => removeButton(index)}
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            {buttons.length >= 3 && (
              <p className="text-xs text-muted-foreground mt-1">Máximo de 3 botões no WhatsApp</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="image" className="space-y-3 mt-3">
          <div>
            <Label className="text-xs">URL da Imagem</Label>
            <Input
              value={config.media_url || ''}
              onChange={(e) => onUpdate('media_url', e.target.value)}
              placeholder="https://..."
              className="text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Legenda (Opcional)</Label>
            <Textarea
              value={config.message || ''}
              onChange={(e) => onUpdate('message', e.target.value)}
              placeholder="Legenda da imagem..."
              rows={2}
              className="text-xs mt-1"
            />
          </div>
        </TabsContent>

        <TabsContent value="document" className="space-y-3 mt-3">
          <div>
            <Label className="text-xs">URL do Arquivo</Label>
            <Input
              value={config.media_url || ''}
              onChange={(e) => onUpdate('media_url', e.target.value)}
              placeholder="https://..."
              className="text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Nome do Arquivo</Label>
            <Input
              value={config.message || ''}
              onChange={(e) => onUpdate('message', e.target.value)}
              placeholder="documento.pdf"
              className="text-xs mt-1"
            />
          </div>
        </TabsContent>
      </Tabs>

      <WhatsAppInstanceSelect
        value={config.instance_id || '__same_channel__'}
        onChange={(v) => onUpdate('instance_id', v)}
        showSameChannel
        label="Canal de Envio"
      />

      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          💡 A mensagem será enviada via WhatsApp para o cliente
        </p>
      </div>
    </div>
  )
}
