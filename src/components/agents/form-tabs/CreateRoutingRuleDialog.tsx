import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useRoutingRules } from '@/hooks/useRoutingRules'
import { toast } from '@/components/ui/sonner'
import { Loader2, X } from 'lucide-react'
import type { Tables } from '@/integrations/supabase/types'

type RoutingRule = Tables<'ai_routing_rules'>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  editRule?: RoutingRule | null
}

const INTENT_OPTIONS = ['greeting', 'complaint', 'question', 'purchase', 'support', 'cancellation']
const SENTIMENT_OPTIONS = ['positive', 'negative', 'neutral']

export function CreateRoutingRuleDialog({ open, onOpenChange, agentId, editRule }: Props) {
  const { createRule, updateRule } = useRoutingRules(agentId)
  const [form, setForm] = useState({
    priority: 50,
    min_confidence: 0.7,
    keywords: [] as string[],
    keywords_operator: 'OR' as string,
    intent_patterns: [] as string[],
    sentiment_filter: [] as string[],
    business_hours_only: false,
    is_active: true,
  })
  const [kwInput, setKwInput] = useState('')

  useEffect(() => {
    if (editRule) {
      setForm({
        priority: editRule.priority ?? 50,
        min_confidence: Number(editRule.min_confidence) || 0.7,
        keywords: editRule.keywords ?? [],
        keywords_operator: editRule.keywords_operator ?? 'OR',
        intent_patterns: editRule.intent_patterns ?? [],
        sentiment_filter: editRule.sentiment_filter ?? [],
        business_hours_only: editRule.business_hours_only ?? false,
        is_active: editRule.is_active ?? true,
      })
    } else {
      setForm({ priority: 50, min_confidence: 0.7, keywords: [], keywords_operator: 'OR', intent_patterns: [], sentiment_filter: [], business_hours_only: false, is_active: true })
    }
  }, [editRule, open])

  const addKeyword = () => {
    const kw = kwInput.trim()
    if (kw && !form.keywords.includes(kw)) {
      setForm(f => ({ ...f, keywords: [...f.keywords, kw] }))
    }
    setKwInput('')
  }

  const toggleList = (field: 'intent_patterns' | 'sentiment_filter', value: string) => {
    setForm(f => {
      const list = f[field]
      return { ...f, [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] }
    })
  }

  const handleSave = async () => {
    try {
      const payload = {
        agent_id: agentId,
        priority: form.priority,
        min_confidence: form.min_confidence,
        keywords: form.keywords,
        keywords_operator: form.keywords_operator,
        intent_patterns: form.intent_patterns,
        sentiment_filter: form.sentiment_filter,
        business_hours_only: form.business_hours_only,
        is_active: form.is_active,
      }
      if (editRule) {
        await updateRule.mutateAsync({ id: editRule.id, updates: payload })
        toast.success('Regra atualizada!')
      } else {
        await createRule.mutateAsync(payload)
        toast.success('Regra criada!')
      }
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar regra')
    }
  }

  const isPending = createRule.isPending || updateRule.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editRule ? 'Editar Regra' : 'Nova Regra de Roteamento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade ({form.priority})</Label>
              <Slider min={0} max={100} step={1} value={[form.priority]} onValueChange={([v]) => setForm(f => ({ ...f, priority: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Confiança Mínima ({Math.round(form.min_confidence * 100)}%)</Label>
              <Slider min={0.5} max={0.95} step={0.05} value={[form.min_confidence]} onValueChange={([v]) => setForm(f => ({ ...f, min_confidence: v }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Keywords</Label>
            <div className="flex gap-2">
              <Input placeholder="Adicionar keyword..." value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())} />
              <Select value={form.keywords_operator} onValueChange={v => setForm(f => ({ ...f, keywords_operator: v }))}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND</SelectItem>
                  <SelectItem value="OR">OR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {form.keywords.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setForm(f => ({ ...f, keywords: f.keywords.filter((_, j) => j !== i) }))}>
                    {kw} <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Padrões de Intenção</Label>
            <div className="flex flex-wrap gap-1.5">
              {INTENT_OPTIONS.map(intent => (
                <Badge key={intent} variant={form.intent_patterns.includes(intent) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleList('intent_patterns', intent)}>
                  {intent}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Filtro de Sentimento</Label>
            <div className="flex flex-wrap gap-1.5">
              {SENTIMENT_OPTIONS.map(s => (
                <Badge key={s} variant={form.sentiment_filter.includes(s) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleList('sentiment_filter', s)}>
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Somente Horário Comercial</Label>
            <Switch checked={form.business_hours_only} onCheckedChange={v => setForm(f => ({ ...f, business_hours_only: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {editRule ? 'Atualizar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
