import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { HelpCircle, Sparkles, Tag } from 'lucide-react'
import { useState } from 'react'

interface SkillDetailPanelProps {
  open: boolean
  onClose: () => void
  skill: { id: string; name: string; description: string; category: string; trigger_keywords?: string[]; trigger_intents?: string[] } | null
  isActive: boolean
  onToggle: (skillId: string) => void
  onAskExplanation: (question: string) => void
}

export function SkillDetailPanel({ open, onClose, skill, isActive, onToggle, onAskExplanation }: SkillDetailPanelProps) {
  const [override, setOverride] = useState('')

  if (!skill) return null

  const categoryColors: Record<string, string> = {
    atendimento: 'bg-cyan-100 text-cyan-800',
    tecnico: 'bg-blue-100 text-blue-800',
    financeiro: 'bg-yellow-100 text-yellow-800',
    vendas: 'bg-green-100 text-green-800',
    interno: 'bg-purple-100 text-purple-800',
    general: 'bg-gray-100 text-gray-800',
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[380px] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {skill.name}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Ativa neste agente</span>
            <Switch checked={isActive} onCheckedChange={() => onToggle(skill.id)} />
          </div>

          {/* Category */}
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Categoria</span>
            <div className="mt-1">
              <Badge className={categoryColors[skill.category] || categoryColors.general}>
                {skill.category}
              </Badge>
            </div>
          </div>

          {/* Description */}
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Descrição</span>
            <p className="mt-1 text-sm text-foreground">{skill.description}</p>
          </div>

          {/* Trigger keywords */}
          {skill.trigger_keywords && skill.trigger_keywords.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Tag className="w-3 h-3" /> Palavras-chave de ativação
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {skill.trigger_keywords.map((kw, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Custom override */}
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Override de instrução (opcional)</span>
            <Textarea
              className="mt-1 text-sm"
              placeholder="Instruções personalizadas para esta skill neste agente..."
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              rows={3}
            />
          </div>

          {/* Ask AI button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              onAskExplanation(`Explique a skill "${skill.name}" de forma simples. O que ela faz e quando é útil?`)
              onClose()
            }}
          >
            <HelpCircle className="w-4 h-4" />
            Perguntar à IA sobre esta skill
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
