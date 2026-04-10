import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, ChevronDown, ChevronUp, Settings, CheckCircle2, Loader2 } from 'lucide-react'
import { MethodSelector } from './MethodSelector'
import { cn } from '@/lib/utils'

const SPECIALTY_LABELS: Record<string, string> = {
  triage: 'Triagem', support: 'Suporte', financial: 'Financeiro',
  sales: 'Vendas', sdr: 'SDR', copilot: 'Copiloto',
  analytics: 'Analítico', customer_success: 'Sucesso do Cliente',
}
const TONE_LABELS: Record<string, string> = {
  professional: 'Profissional', casual: 'Casual', friendly: 'Amigável', formal: 'Formal',
}

interface Props {
  config: Record<string, any>
  methods: string[]
  onMethodsChange: (m: string[]) => void
  onCreateAgent: () => void
  onOpenEditor: () => void
  isCreating: boolean
  isPreview: boolean
  isRetrain?: boolean
}

export function AgentPreviewCard({ config, methods, onMethodsChange, onCreateAgent, onOpenEditor, isCreating, isPreview, isRetrain }: Props) {
  const [promptExpanded, setPromptExpanded] = useState(false)
  const hasName = !!config.name

  if (!hasName) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">O preview do agente aparecerá aqui conforme você responde as perguntas.</p>
      </div>
    )
  }

  const sc = config.support_config || {}
  const promptWords = (config.system_prompt || '').split(/\s+/).filter(Boolean).length

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_4px_6px_-1px_rgba(16,41,63,0.1)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${config.color || '#45E5E5'}20`, color: config.color || '#45E5E5' }}>
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{config.name}</h3>
              {config.specialty && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {SPECIALTY_LABELS[config.specialty] || config.specialty}
                </Badge>
              )}
            </div>
            {config.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{config.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Config grid */}
        <div className="grid grid-cols-2 gap-3">
          {config.tone && <ConfigItem label="Tom" value={TONE_LABELS[config.tone] || config.tone} />}
          {config.language && <ConfigItem label="Idioma" value={config.language === 'pt-BR' ? 'Português' : config.language} />}
          {config.temperature != null && <ConfigItem label="Temperature" value={String(config.temperature)} />}
          {config.max_tokens && <ConfigItem label="Max Tokens" value={String(config.max_tokens)} />}
          {config.rag_enabled != null && <ConfigItem label="RAG" value={config.rag_enabled ? 'Habilitado' : 'Desabilitado'} />}
          {config.confidence_threshold != null && <ConfigItem label="Confiança" value={`${(config.confidence_threshold * 100).toFixed(0)}%`} />}
        </div>

        {/* Greeting */}
        {sc.greeting && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Saudação</p>
            <p className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2 italic">"{sc.greeting}"</p>
          </div>
        )}

        {/* Method selector */}
        <MethodSelector selectedMethods={methods} onMethodsChange={onMethodsChange} specialty={config.specialty} />

        {/* System prompt */}
        {config.system_prompt && (
          <div className="space-y-1">
            <button onClick={() => setPromptExpanded(p => !p)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
              System Prompt ({promptWords} palavras)
              {promptExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {promptExpanded && (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                {config.system_prompt}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isPreview && (
        <div className="px-5 py-4 border-t border-border bg-muted/20 flex gap-3">
          <Button className="flex-1 gap-2" onClick={onCreateAgent} disabled={isCreating}>
            {isCreating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {isRetrain ? 'Atualizando...' : 'Criando...'}</>
              : <><CheckCircle2 className="w-4 h-4" /> {isRetrain ? 'Atualizar Agente' : 'Criar Agente'}</>}
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={onOpenEditor} disabled={isCreating}>
            <Settings className="w-4 h-4" /> Personalizar no Editor
          </Button>
        </div>
      )}
    </div>
  )
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  )
}
