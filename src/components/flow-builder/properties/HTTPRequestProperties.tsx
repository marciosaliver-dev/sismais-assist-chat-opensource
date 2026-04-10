import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

interface HTTPRequestPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function HTTPRequestProperties({ config, onUpdate }: HTTPRequestPropertiesProps) {
  const method = config.method || 'POST'
  const headers: Array<{ key: string; value: string }> = config.headers || []

  const addHeader = () => {
    onUpdate('headers', [...headers, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    onUpdate('headers', headers.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const newHeaders = [...headers]
    newHeaders[index] = { ...newHeaders[index], [field]: val }
    onUpdate('headers', newHeaders)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Método HTTP</Label>
        <Select value={method} onValueChange={(v) => onUpdate('method', v)}>
          <SelectTrigger className="text-xs mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">URL</Label>
        <Input
          value={config.url || ''}
          onChange={(e) => onUpdate('url', e.target.value)}
          placeholder="https://api.example.com/webhook"
          className="text-xs mt-1"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs">Headers</Label>
          <Button onClick={addHeader} size="sm" variant="outline" className="h-6 text-xs px-2">
            <Plus className="w-3 h-3 mr-1" />
            Adicionar
          </Button>
        </div>
        <div className="space-y-1.5">
          {headers.map((header, index) => (
            <div key={index} className="flex items-center gap-1">
              <Input
                value={header.key}
                onChange={(e) => updateHeader(index, 'key', e.target.value)}
                placeholder="Header"
                className="text-xs flex-1"
              />
              <Input
                value={header.value}
                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                placeholder="Valor"
                className="text-xs flex-1"
              />
              <Button onClick={() => removeHeader(index)} size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {method !== 'GET' && (
        <div>
          <Label className="text-xs">Body (JSON)</Label>
          <Textarea
            value={config.body || ''}
            onChange={(e) => onUpdate('body', e.target.value)}
            placeholder={'{"key": "value"}'}
            className="text-xs font-mono mt-1"
            rows={5}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use variáveis: {'{customer_name}'}, {'{message_content}'}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        🌐 Enviar dados para sistema externo via HTTP. Resposta ficará em {'{http_response}'}
      </p>
    </div>
  )
}
