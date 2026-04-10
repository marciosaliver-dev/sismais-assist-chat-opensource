import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAgentTemplates } from '@/hooks/useAgentTemplates'
import { cn } from '@/lib/utils'

interface TemplateSelectorProps {
  open: boolean
  onClose: () => void
}

export function TemplateSelector({ open, onClose }: TemplateSelectorProps) {
  const navigate = useNavigate()
  const { templates } = useAgentTemplates()

  const handleSelect = (templateId: string) => {
    onClose()
    navigate(`/ai-builder?template=${templateId}`)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span>🧩</span>
            Escolha um Template de Agente
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Selecione um ponto de partida e personalize conforme sua necessidade
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className={cn(
                'group relative rounded-xl border border-border bg-card p-4 cursor-pointer',
                'transition-all duration-150 hover:-translate-y-0.5',
                'hover:shadow-[0_4px_16px_rgba(16,41,63,0.1)]'
              )}
              style={{ borderLeft: `3px solid ${tpl.color}` }}
              onClick={() => handleSelect(tpl.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelect(tpl.id)}
              aria-label={`Usar template ${tpl.name}`}
            >
              {/* Icon + Name */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: `${tpl.color}20` }}
                >
                  {tpl.icon}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{tpl.name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{tpl.specialty}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                {tpl.description}
              </p>

              {/* CTA */}
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                style={{
                  backgroundColor: tpl.color,
                  color: '#10293F',
                  borderColor: tpl.color,
                }}
                onClick={(e) => { e.stopPropagation(); handleSelect(tpl.id) }}
              >
                Usar Template
              </Button>
            </div>
          ))}
        </div>

        {/* Blank option */}
        <div className="mt-2 pt-3 border-t border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Começar do zero</p>
            <p className="text-xs text-muted-foreground">Crie um agente personalizado sem template</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { onClose(); navigate('/ai-builder') }}
          >
            Agente em branco
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
