import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'

interface TemplatePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: string
  recipient: string
  onSent?: () => void
}

interface TemplateComponent {
  type: string
  text?: string
  format?: string
  example?: { body_text?: string[][] }
}

interface MetaTemplate {
  name: string
  status: string
  category: string
  language: string
  components: TemplateComponent[]
  quality_score?: { score: string }
}

function extractParams(components: TemplateComponent[]): string[] {
  const body = components?.find(c => c.type === 'BODY')
  if (!body?.text) return []
  const matches = body.text.match(/\{\{(\d+)\}\}/g)
  return matches || []
}

function previewText(components: TemplateComponent[], params: Record<string, string>): string {
  const body = components?.find(c => c.type === 'BODY')
  if (!body?.text) return ''
  let text = body.text
  Object.entries(params).forEach(([key, value]) => {
    text = text.replace(key, value || key)
  })
  return text
}

export function TemplatePickerDialog({
  open,
  onOpenChange,
  instanceId,
  recipient,
  onSent,
}: TemplatePickerDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null)
  const [params, setParams] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  const { data: templates, isLoading } = useQuery({
    queryKey: ['meta-templates', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-whatsapp-proxy', {
        body: { action: 'getTemplates', instanceId },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return (data?.templates || []) as MetaTemplate[]
    },
    enabled: open && !!instanceId,
    staleTime: 60000,
  })

  const filteredTemplates = templates?.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (template: MetaTemplate) => {
    setSelectedTemplate(template)
    const placeholders = extractParams(template.components)
    const initial: Record<string, string> = {}
    placeholders.forEach(p => { initial[p] = '' })
    setParams(initial)
  }

  const handleSend = async () => {
    if (!selectedTemplate) return
    setSending(true)
    try {
      const paramValues = Object.keys(params).length > 0
        ? Object.keys(params)
            .sort()
            .map(k => params[k])
            .filter(v => v.trim() !== '')
        : undefined

      const { data, error } = await supabase.functions.invoke('meta-whatsapp-proxy', {
        body: {
          action: 'sendMessage',
          instanceId,
          recipient,
          templateName: selectedTemplate.name,
          templateLanguage: selectedTemplate.language,
          templateParams: paramValues,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success('Template enviado com sucesso!')
      onSent?.()
      onOpenChange(false)
      setSelectedTemplate(null)
      setParams({})
    } catch (err: any) {
      toast.error('Erro ao enviar template: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const handleBack = () => {
    setSelectedTemplate(null)
    setParams({})
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedTemplate ? 'Preencher Template' : 'Selecionar Template HSM'}
          </DialogTitle>
        </DialogHeader>

        {!selectedTemplate ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar template..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredTemplates?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum template aprovado encontrado.
              </p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {filteredTemplates.map(template => {
                    const body = template.components?.find(c => c.type === 'BODY')
                    return (
                      <button
                        key={`${template.name}-${template.language}`}
                        className="w-full text-left rounded-lg border border-border p-3 hover:bg-accent transition-colors"
                        onClick={() => handleSelect(template)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{template.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {template.category}
                          </Badge>
                        </div>
                        {body?.text && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {body.text}
                          </p>
                        )}
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {template.language}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              Voltar
            </Button>

            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
              <p className="text-sm font-mono whitespace-pre-wrap">
                {previewText(selectedTemplate.components, params)}
              </p>
            </div>

            {Object.keys(params).length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Preencha os parâmetros:</p>
                {Object.keys(params).sort().map(key => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{key}</Label>
                    <Input
                      value={params[key]}
                      onChange={e => setParams(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Valor para ${key}`}
                    />
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full gap-2"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Template
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
