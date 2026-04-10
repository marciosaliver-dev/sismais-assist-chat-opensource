import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import type { AgentConfig } from '@/hooks/useAgentBuilder'

const MODELS = [
  { value: 'google/gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
  { value: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'anthropic/claude-sonnet-4-6-20250414', label: 'Claude Sonnet 4.6' },
]

interface PreviewConfigProps {
  config: AgentConfig
  onChange: (updates: Partial<AgentConfig>) => void
}

export default function PreviewConfig({ config, onChange }: PreviewConfigProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modelo LLM</Label>
        <Select value={config.model} onValueChange={v => onChange({ model: v })}>
          <SelectTrigger className="text-sm h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Temperatura</Label>
          <span className="text-xs font-semibold text-foreground">{config.temperature.toFixed(1)}</span>
        </div>
        <Slider
          value={[config.temperature]}
          onValueChange={([v]) => onChange({ temperature: v })}
          min={0}
          max={1}
          step={0.1}
          className="[&_[role=slider]]:border-[#45E5E5] [&_[role=slider]]:bg-[#45E5E5]"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Preciso</span>
          <span>Criativo</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confiança mínima</Label>
          <span className="text-xs font-semibold text-foreground">{(config.confidence_threshold * 100).toFixed(0)}%</span>
        </div>
        <Slider
          value={[config.confidence_threshold]}
          onValueChange={([v]) => onChange({ confidence_threshold: v })}
          min={0}
          max={1}
          step={0.05}
          className="[&_[role=slider]]:border-[#45E5E5] [&_[role=slider]]:bg-[#45E5E5]"
        />
        <p className="text-xs text-muted-foreground">Abaixo deste valor, escala para humano.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Max Tokens</Label>
          <Input
            type="number"
            value={config.max_tokens}
            onChange={e => onChange({ max_tokens: Number(e.target.value) })}
            min={100}
            max={8000}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prioridade</Label>
          <Input
            type="number"
            value={config.priority}
            onChange={e => onChange({ priority: Number(e.target.value) })}
            min={0}
            max={100}
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  )
}
