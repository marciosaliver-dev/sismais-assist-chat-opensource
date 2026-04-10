import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useAgentSkills, type Skill, type SkillInsert } from '@/hooks/useAgentSkills'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  skill?: Skill | null
}

const categories = [
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'vendas', label: 'Vendas' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'interno', label: 'Interno' },
  { value: 'general', label: 'Geral' },
]

const defaultForm: Partial<SkillInsert> = {
  name: '',
  slug: '',
  description: '',
  icon: 'Zap',
  color: '#6366f1',
  category: 'general',
  prompt_instructions: '',
  trigger_keywords: [],
  trigger_intents: [],
  auto_activate: false,
  is_active: true,
  is_system: false,
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function SkillFormDialog({ open, onOpenChange, skill }: Props) {
  const { createSkill, updateSkill } = useAgentSkills()
  const [form, setForm] = useState<Partial<SkillInsert>>(defaultForm)
  const [newKeyword, setNewKeyword] = useState('')
  const [newIntent, setNewIntent] = useState('')
  const [saving, setSaving] = useState(false)

  const isEditing = !!skill

  useEffect(() => {
    if (skill) {
      setForm({
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        icon: skill.icon,
        color: skill.color,
        category: skill.category,
        prompt_instructions: skill.prompt_instructions,
        trigger_keywords: skill.trigger_keywords || [],
        trigger_intents: skill.trigger_intents || [],
        auto_activate: skill.auto_activate,
        is_active: skill.is_active,
        is_system: skill.is_system,
      })
    } else {
      setForm(defaultForm)
    }
  }, [skill, open])

  const update = (field: string, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'name' && !isEditing) {
        next.slug = slugify(value)
      }
      return next
    })
  }

  const addKeyword = () => {
    if (!newKeyword.trim()) return
    const keywords = [...(form.trigger_keywords || []), newKeyword.trim().toLowerCase()]
    update('trigger_keywords', keywords)
    setNewKeyword('')
  }

  const removeKeyword = (idx: number) => {
    const keywords = [...(form.trigger_keywords || [])]
    keywords.splice(idx, 1)
    update('trigger_keywords', keywords)
  }

  const addIntent = () => {
    if (!newIntent.trim()) return
    const intents = [...(form.trigger_intents || []), newIntent.trim().toLowerCase()]
    update('trigger_intents', intents)
    setNewIntent('')
  }

  const removeIntent = (idx: number) => {
    const intents = [...(form.trigger_intents || [])]
    intents.splice(idx, 1)
    update('trigger_intents', intents)
  }

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.description || !form.prompt_instructions) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await updateSkill.mutateAsync({ id: skill!.id, ...form } as any)
        toast.success('Skill atualizada')
      } else {
        await createSkill.mutateAsync(form as SkillInsert)
        toast.success('Skill criada')
      }
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar skill')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Skill' : 'Nova Skill'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name & Slug */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name || ''} onChange={e => update('name', e.target.value)} placeholder="Identificar Cliente" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug || ''} onChange={e => update('slug', e.target.value)} placeholder="identificar-cliente" disabled={isEditing} />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Descrição *</Label>
            <Input value={form.description || ''} onChange={e => update('description', e.target.value)} placeholder="O que esta skill faz..." />
          </div>

          {/* Category & Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category || 'general'} onValueChange={v => update('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color || '#6366f1'}
                  onChange={e => update('color', e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input value={form.color || ''} onChange={e => update('color', e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>

          {/* Icon */}
          <div>
            <Label>Ícone (nome do lucide-react)</Label>
            <Input value={form.icon || ''} onChange={e => update('icon', e.target.value)} placeholder="Zap, Wrench, Target..." />
          </div>

          {/* Prompt Instructions */}
          <div>
            <Label>Instruções do Prompt *</Label>
            <Textarea
              value={form.prompt_instructions || ''}
              onChange={e => update('prompt_instructions', e.target.value)}
              placeholder="Instruções detalhadas que serão injetadas no system prompt do agente..."
              rows={10}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">Suporta Markdown. Estas instruções são injetadas no prompt do agente quando a skill está ativa.</p>
          </div>

          {/* Auto Activate */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium">Auto-ativar</p>
              <p className="text-xs text-muted-foreground">Skill sempre ativa, sem necessidade de gatilho</p>
            </div>
            <Switch checked={form.auto_activate ?? false} onCheckedChange={v => update('auto_activate', v)} />
          </div>

          {/* Trigger Keywords */}
          <div>
            <Label>Keywords de Gatilho</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                placeholder="boleto, fatura, pagar..."
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              />
              <Button variant="outline" size="icon" onClick={addKeyword}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(form.trigger_keywords || []).map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1">
                  {kw}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => removeKeyword(i)} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Trigger Intents */}
          <div>
            <Label>Intents de Gatilho</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newIntent}
                onChange={e => setNewIntent(e.target.value)}
                placeholder="billing, support, sales..."
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addIntent())}
              />
              <Button variant="outline" size="icon" onClick={addIntent}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(form.trigger_intents || []).map((intent, i) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1">
                  {intent}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => removeIntent(i)} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Save */}
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Skill'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
