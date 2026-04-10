import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Save } from 'lucide-react'
import { useCSATBoardConfig, type CSATBoardConfig, type CSATQuestion } from '@/hooks/useCSATBoardConfig'
import { CSATMessagePreview } from './CSATMessagePreview'
import { CSATQuestionBuilder } from './CSATQuestionBuilder'

interface CSATBoardConfigFormProps {
  boardId: string
  boardName: string
}

const SCALE_OPTIONS: { value: CSATBoardConfig['scale_type']; label: string }[] = [
  { value: 'stars_1_5', label: 'Estrelas 1-5 ⭐' },
  { value: 'thumbs', label: 'Positivo/Negativo 👍👎' },
  { value: 'nps_0_10', label: 'NPS 0-10' },
  { value: 'emoji', label: 'Emojis 😡😕😐🙂😍' },
]

export function CSATBoardConfigForm({ boardId, boardName }: CSATBoardConfigFormProps) {
  const { config, isLoading, save, isSaving } = useCSATBoardConfig(boardId)

  const [form, setForm] = useState<CSATBoardConfig>(config)

  useEffect(() => {
    if (!isLoading) setForm(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  function set<K extends keyof CSATBoardConfig>(key: K, value: CSATBoardConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 bg-muted rounded-md w-1/3" />
        <div className="h-32 bg-muted rounded-md" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toggle ativo */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Ativar CSAT neste board</p>
          <p className="text-xs text-muted-foreground">
            Pesquisa de satisfação será enviada automaticamente ao encerrar conversas.
          </p>
        </div>
        <Switch
          checked={form.enabled}
          onCheckedChange={(v) => set('enabled', v)}
        />
      </div>

      {form.enabled && (
        <>
          <Separator />

          {/* Tipo de escala */}
          <div className="space-y-2">
            <Label>Tipo de escala</Label>
            <Select
              value={form.scale_type}
              onValueChange={(v) => set('scale_type', v as CSATBoardConfig['scale_type'])}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCALE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Mensagem */}
          <div className="space-y-3">
            <div>
              <Label>Mensagem da pesquisa</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis disponíveis:{' '}
                <code className="bg-muted px-1 rounded text-xs">{'{{nome}}'}</code>,{' '}
                <code className="bg-muted px-1 rounded text-xs">{'{{protocolo}}'}</code>,{' '}
                <code className="bg-muted px-1 rounded text-xs">{'{{board}}'}</code>
              </p>
            </div>
            <Textarea
              value={form.message_template}
              onChange={(e) => set('message_template', e.target.value)}
              rows={8}
              className="font-mono text-sm resize-y"
              placeholder="Digite a mensagem da pesquisa..."
            />
            <CSATMessagePreview template={form.message_template} boardName={boardName} />
          </div>

          <Separator />

          {/* Envio e Timing */}
          <div className="space-y-4">
            <p className="text-sm font-medium">Envio e Timing</p>
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-normal">Enviar ao fechar conversa</Label>
                <Switch
                  checked={form.send_on_close}
                  onCheckedChange={(v) => set('send_on_close', v)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="delay_minutes">Atraso (minutos)</Label>
                  <Input
                    id="delay_minutes"
                    type="number"
                    min={0}
                    value={form.delay_minutes}
                    onChange={(e) => set('delay_minutes', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="response_window_hours">Janela de resposta (horas)</Label>
                  <Input
                    id="response_window_hours"
                    type="number"
                    min={1}
                    value={form.response_window_hours}
                    onChange={(e) => set('response_window_hours', Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="font-normal">Reenviar se sem resposta</Label>
                <Switch
                  checked={form.resend_enabled}
                  onCheckedChange={(v) => set('resend_enabled', v)}
                />
              </div>

              {form.resend_enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="resend_after_hours">Reenviar após (horas)</Label>
                    <Input
                      id="resend_after_hours"
                      type="number"
                      min={1}
                      value={form.resend_after_hours}
                      onChange={(e) => set('resend_after_hours', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="max_resends">Máximo de reenvios</Label>
                    <Input
                      id="max_resends"
                      type="number"
                      min={1}
                      max={5}
                      value={form.max_resends}
                      onChange={(e) => set('max_resends', Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Separator />

          {/* Follow-up para notas baixas */}
          <div className="space-y-4">
            <p className="text-sm font-medium">Follow-up para notas baixas</p>
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-normal">Perguntar o que melhorar em notas baixas</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Envia uma mensagem automática pedindo feedback quando a nota for baixa.
                  </p>
                </div>
                <Switch
                  checked={form.followup_enabled}
                  onCheckedChange={(v) => set('followup_enabled', v)}
                />
              </div>

              {form.followup_enabled && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="followup_threshold">Nota máxima para disparar (1-3)</Label>
                    <Input
                      id="followup_threshold"
                      type="number"
                      min={1}
                      max={3}
                      value={form.followup_threshold}
                      onChange={(e) => set('followup_threshold', Number(e.target.value))}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      Notas iguais ou menores a este valor disparam o follow-up.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="followup_message">Mensagem de follow-up</Label>
                    <Textarea
                      id="followup_message"
                      value={form.followup_message}
                      onChange={(e) => set('followup_message', e.target.value)}
                      rows={3}
                      className="text-sm resize-y"
                      placeholder="Sentimos muito pela experiência. Poderia nos contar o que podemos melhorar?"
                    />
                  </div>
                </>
              )}
            </Card>
          </div>

          <Separator />

          {/* Perguntas adicionais */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Perguntas adicionais</p>
            <CSATQuestionBuilder
              questions={form.questions}
              onChange={(q: CSATQuestion[]) => set('questions', q)}
            />
          </div>

          <Separator />

          {/* Dimensões IA */}
          <div className="space-y-2">
            <Label htmlFor="ai_dimensions">Dimensões de análise IA</Label>
            <p className="text-xs text-muted-foreground">
              Separe por vírgula as dimensões que a IA deve avaliar nas respostas. Ex:{' '}
              <span className="italic">tempo de resposta, clareza, solução</span>
            </p>
            <Input
              id="ai_dimensions"
              value={(form.ai_dimensions ?? []).join(', ')}
              onChange={(e) => set('ai_dimensions', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="tempo de resposta, clareza, solução, empatia"
            />
          </div>
        </>
      )}

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => save(form)}
          disabled={isSaving}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>
    </div>
  )
}
