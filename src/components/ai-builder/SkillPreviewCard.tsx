import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap, ChevronDown, ChevronUp, CheckCircle2, Loader2, Settings } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  atendimento: 'Atendimento', financeiro: 'Financeiro', vendas: 'Vendas',
  tecnico: 'Técnico', interno: 'Interno', general: 'Geral',
}

interface Props {
  config: Record<string, any>
  onCreateSkill: () => void
  onOpenEditor: () => void
  isCreating: boolean
  isPreview: boolean
}

export function SkillPreviewCard({ config, onCreateSkill, onOpenEditor, isCreating, isPreview }: Props) {
  const [instructionsExpanded, setInstructionsExpanded] = useState(false)

  if (!config.name) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">O preview da skill aparecerá aqui conforme você responde as perguntas.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_4px_6px_-1px_rgba(16,41,63,0.1)]">
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${config.color || '#6366f1'}20`, color: config.color || '#6366f1' }}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{config.name}</h3>
            {config.category && (
              <Badge variant="outline" className="text-xs mt-0.5">
                {CATEGORY_LABELS[config.category] || config.category}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {config.description && <p className="text-sm text-muted-foreground">{config.description}</p>}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Ativação</p>
          <div className="flex flex-wrap gap-2">
            {config.auto_activate && <Badge variant="default" className="text-xs">Auto-ativar</Badge>}
            {(config.trigger_keywords || []).map((kw: string) => (
              <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
            ))}
            {(config.trigger_intents || []).map((intent: string) => (
              <Badge key={intent} variant="outline" className="text-xs">{intent}</Badge>
            ))}
          </div>
        </div>

        {config.prompt_instructions && (
          <div className="space-y-1">
            <button onClick={() => setInstructionsExpanded(p => !p)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
              Instruções
              {instructionsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {instructionsExpanded && (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                {config.prompt_instructions}
              </div>
            )}
          </div>
        )}
      </div>

      {isPreview && (
        <div className="px-5 py-4 border-t border-border bg-muted/20 flex gap-3">
          <Button className="flex-1 gap-2" onClick={onCreateSkill} disabled={isCreating}>
            {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><CheckCircle2 className="w-4 h-4" /> Criar Skill</>}
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={onOpenEditor} disabled={isCreating}>
            <Settings className="w-4 h-4" /> Editar Formulário
          </Button>
        </div>
      )}
    </div>
  )
}
