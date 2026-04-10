import { useState } from 'react'
import { Sparkles, Wand2, ArrowDownToLine, Languages, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAIFieldGenerator } from '@/hooks/useAIFieldGenerator'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AIFieldGeneratorProps {
  fieldType: string
  value: string
  onChange: (value: string) => void
  context?: Record<string, string | undefined>
  className?: string
}

const ACTIONS = [
  { key: 'generate' as const, label: 'Gerar', icon: Sparkles, description: 'Gerar conteúdo com IA' },
  { key: 'improve' as const, label: 'Melhorar', icon: Wand2, description: 'Tornar mais profissional' },
  { key: 'simplify' as const, label: 'Simplificar', icon: ArrowDownToLine, description: 'Texto mais curto e direto' },
  { key: 'translate' as const, label: 'Traduzir', icon: Languages, description: 'Traduzir para outro idioma' },
]

export function AIFieldGenerator({ fieldType, value, onChange, context = {}, className }: AIFieldGeneratorProps) {
  const { generate, isLoading } = useAIFieldGenerator()
  const [preview, setPreview] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const handleAction = async (action: 'generate' | 'improve' | 'simplify' | 'translate') => {
    if ((action === 'improve' || action === 'simplify' || action === 'translate') && !value?.trim()) {
      toast.warning('Campo vazio', { description: 'Preencha o campo antes de melhorar, simplificar ou traduzir.' })
      return
    }

    const fullContext = {
      ...context,
      existing_value: value || undefined,
      target_language: action === 'translate' ? 'en' : undefined,
    }

    const result = await generate(action, fieldType, fullContext)
    if (result) {
      setPreview(result)
    }
  }

  const handleAccept = () => {
    if (preview) {
      onChange(preview)
      toast.success('Texto aplicado')
    }
    setPreview(null)
    setOpen(false)
  }

  const handleDiscard = () => {
    setPreview(null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors',
            className
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          IA
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {preview ? (
          <div className="p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Preview do texto gerado:</p>
            <div className="max-h-48 overflow-y-auto rounded-md bg-muted/50 p-3 text-sm leading-relaxed whitespace-pre-wrap border">
              {preview}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                className="h-8 gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Descartar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAccept}
                className="h-8 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-3.5 w-3.5" />
                Aceitar
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-1">
            <div className="px-3 py-2 border-b">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Gerar com IA (Claude Sonnet)
              </p>
            </div>
            <div className="p-1">
              {ACTIONS.map(({ key, label, icon: Icon, description }) => {
                const needsValue = key !== 'generate'
                const disabled = isLoading || (needsValue && !value?.trim())

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleAction(key)}
                    disabled={disabled}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors',
                      disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-muted cursor-pointer'
                    )}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground truncate">{description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {isLoading && (
              <div className="px-3 py-2 border-t flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Gerando com Claude Sonnet...
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
