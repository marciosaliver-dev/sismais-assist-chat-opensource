import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Wand2, Save } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useTicketDescription, type TicketDescription } from '@/hooks/useTicketDescription'

const EMPTY_FORM: TicketDescription = {
  sistema: '',
  modulo: '',
  resumo: '',
  detalhe: '',
  passos_reproducao: '',
  impacto: '',
  tentativas: '',
}

interface Props {
  conversationId: string
  ticketSubject?: string
  onSubjectChange?: (subject: string) => void
}

export default function TicketDescriptionForm({ conversationId, ticketSubject, onSubjectChange }: Props) {
  const [form, setForm] = useState<TicketDescription>(EMPTY_FORM)
  const [localSubject, setLocalSubject] = useState(ticketSubject || '')
  const [generating, setGenerating] = useState(false)
  const queryClient = useQueryClient()
  const { description, isLoading, save, isSaving } = useTicketDescription(conversationId)

  useEffect(() => {
    if (description) {
      setForm(description)
    }
  }, [description])

  useEffect(() => {
    setLocalSubject(ticketSubject || '')
  }, [ticketSubject])

  const handleChange = (field: keyof TicketDescription, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleGenerateWithAI = async () => {
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-ticket-description', {
        body: { conversation_id: conversationId }
      })
      if (error) throw error
      if (data?.success === false) throw new Error(data.error || 'Erro desconhecido na função')
      if (data?.data?.ticket_description) {
        const desc = data.data.ticket_description as TicketDescription
        setForm(desc)
        // Setar cache diretamente para sobreviver a remounts
        queryClient.setQueryData(['ticket-description', conversationId], desc)
        if (data.data.titulo && onSubjectChange) {
          setLocalSubject(data.data.titulo)
          onSubjectChange(data.data.titulo)
        }
        toast.success('Descrição gerada pela IA')
        // Atualizar cache com categoria e módulo retornados diretamente da função
        if (data.data.category_id || data.data.module_id) {
          const cached = queryClient.getQueryData<any>(['ticket-detail', conversationId])
          if (cached) {
            queryClient.setQueryData(['ticket-detail', conversationId], {
              ...cached,
              ticket_category_id: data.data.category_id || cached.ticket_category_id,
              ticket_module_id: data.data.module_id || cached.ticket_module_id,
            })
          }
          const categoryLabel = data.data.category_name || ''
          const moduleLabel = data.data.module_name ? ` • ${data.data.module_name}` : ''
          if (categoryLabel) toast.success(`Classificado: ${categoryLabel}${moduleLabel}`)
        }
        queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
        queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
        queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      }
    } catch (err) {
      console.error('[TicketDescriptionForm] Erro ao classificar:', err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao gerar descrição com IA: ${msg}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = () => {
    save(form)
    if (onSubjectChange && localSubject !== ticketSubject) {
      onSubjectChange(localSubject)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-muted-foreground text-xs">
        <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Título / Assunto</Label>
        <Input
          value={localSubject}
          onChange={e => setLocalSubject(e.target.value)}
          placeholder="Título curto do problema..."
          className="text-xs h-8"
          maxLength={120}
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Resumo do problema</Label>
        <Textarea
          value={form.resumo}
          onChange={e => handleChange('resumo', e.target.value)}
          placeholder="Descreva o problema em 1-2 frases..."
          rows={2}
          className="text-xs resize-none"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Detalhamento</Label>
        <Textarea
          value={form.detalhe}
          onChange={e => handleChange('detalhe', e.target.value)}
          placeholder="Descrição detalhada do problema..."
          rows={3}
          className="text-xs resize-none"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 flex-1"
          onClick={handleGenerateWithAI}
          disabled={generating || isSaving}
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          Classificar com IA
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 flex-1"
          onClick={handleSave}
          disabled={isSaving || generating}
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar
        </Button>
      </div>
    </div>
  )
}
