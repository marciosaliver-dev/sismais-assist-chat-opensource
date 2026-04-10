import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Pencil, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const db = supabase as any

interface RuleCondition {
  field: string
  operator: string
  value: string
}

interface PriorityRule {
  id: string
  name: string
  priority: string
  conditions: RuleCondition[]
  logic: 'AND' | 'OR'
  active: boolean
  sort_order: number
  created_at: string
}

const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  critical: { label: 'Crítica', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
  high:     { label: 'Alta',    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' },
  medium:   { label: 'Média',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200' },
  low:      { label: 'Baixa',   className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200' },
}

const FIELD_OPTIONS = [
  { value: 'keyword', label: 'Palavra-chave na mensagem' },
  { value: 'customer_tier', label: 'Plano do cliente' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'time_without_response', label: 'Minutos sem resposta' },
]

const OPERATOR_OPTIONS = [
  { value: 'contains', label: 'Contém' },
  { value: 'equals', label: 'Igual a' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
]

const EMPTY_RULE: Omit<PriorityRule, 'id' | 'created_at'> = {
  name: '',
  priority: 'high',
  conditions: [{ field: 'keyword', operator: 'contains', value: '' }],
  logic: 'OR',
  active: true,
  sort_order: 100,
}

export default function PriorityRulesTab() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PriorityRule | null>(null)
  const [form, setForm] = useState<Omit<PriorityRule, 'id' | 'created_at'>>(EMPTY_RULE)

  const { data: rules, isLoading } = useQuery({
    queryKey: ['priority-rules'],
    queryFn: async () => {
      const { data, error } = await db
        .from('priority_rules')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data || []) as PriorityRule[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (rule: typeof form) => {
      if (editingRule) {
        const { error } = await db.from('priority_rules').update(rule).eq('id', editingRule.id)
        if (error) throw error
      } else {
        const { error } = await db.from('priority_rules').insert(rule)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priority-rules'] })
      toast.success(editingRule ? 'Regra atualizada' : 'Regra criada')
      setDialogOpen(false)
    },
    onError: () => toast.error('Erro ao salvar regra'),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.from('priority_rules').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['priority-rules'] }),
    onError: () => toast.error('Erro ao atualizar regra'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('priority_rules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priority-rules'] })
      toast.success('Regra removida')
    },
    onError: () => toast.error('Erro ao remover regra'),
  })

  const openCreate = () => {
    setEditingRule(null)
    setForm({ ...EMPTY_RULE })
    setDialogOpen(true)
  }

  const openEdit = (rule: PriorityRule) => {
    setEditingRule(rule)
    setForm({
      name: rule.name,
      priority: rule.priority,
      conditions: rule.conditions.length > 0 ? rule.conditions : [{ field: 'keyword', operator: 'contains', value: '' }],
      logic: rule.logic,
      active: rule.active,
      sort_order: rule.sort_order,
    })
    setDialogOpen(true)
  }

  const updateCondition = (idx: number, field: keyof RuleCondition, value: string) => {
    setForm(prev => {
      const conditions = [...prev.conditions]
      conditions[idx] = { ...conditions[idx], [field]: value }
      return { ...prev, conditions }
    })
  }

  const addCondition = () => {
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: 'keyword', operator: 'contains', value: '' }],
    }))
  }

  const removeCondition = (idx: number) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== idx),
    }))
  }

  return (
    <div className="priority-settings">
      <div className="settings-card">
        <div className="sc-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Zap className="w-5 h-5" />
              Regras de Prioridade
            </h3>
            <p className="sc-desc">Defina regras para classificação automática de prioridade.</p>
          </div>
          <Button size="sm" onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nova Regra
          </Button>
        </div>
        <div className="sc-content">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !rules || rules.length === 0 ? (
            <div className="empty-state">
              <Zap className="w-10 h-10" />
              <p>Nenhuma regra cadastrada</p>
              <p className="text-sm">Crie a primeira regra de prioridade</p>
            </div>
          ) : (
            <table className="priority-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Prioridade</th>
                  <th>Condições</th>
                  <th>Lógica</th>
                  <th className="text-center">Ativa</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const cfg = PRIORITY_LABELS[rule.priority]
                  return (
                    <tr key={rule.id} className={cn(!rule.active && 'opacity-50')}>
                      <td className="font-medium">{rule.name}</td>
                      <td>
                        <Badge variant="outline" className={cfg?.className}>
                          {cfg?.label || rule.priority}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {rule.conditions.slice(0, 2).map((c, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{c.field} {c.operator} {c.value}</Badge>
                          ))}
                          {rule.conditions.length > 2 && <Badge variant="secondary" className="text-xs">+{rule.conditions.length - 2}</Badge>}
                        </div>
                      </td>
                      <td className="text-sm">{rule.logic}</td>
                      <td className="text-center">
                        <Switch checked={rule.active} onCheckedChange={() => toggleMutation.mutate(rule)} />
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button className="sc-btn-icon" onClick={() => openEdit(rule)} aria-label="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button className="sc-btn-icon sc-btn-del" onClick={() => { if (confirm(`Remover regra "${rule.name}"?`)) deleteMutation.mutate(rule.id) }} aria-label="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra de Prioridade'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="field">
              <Label className="field-label">Nome da Regra</Label>
              <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Sistema fora do ar" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <Label className="field-label">Prioridade Resultante</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="field">
                <Label className="field-label">Lógica entre condições</Label>
                <Select value={form.logic} onValueChange={(v) => setForm(p => ({ ...p, logic: v as 'AND' | 'OR' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OR">OR — qualquer condição</SelectItem>
                    <SelectItem value="AND">AND — todas as condições</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="field">
              <div className="flex items-center justify-between">
                <Label className="field-label">Condições</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={addCondition}>
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </div>
              {form.conditions.map((cond, idx) => (
                <div key={idx} className="flex items-center gap-2 mt-2">
                  <Select value={cond.field} onValueChange={(v) => updateCondition(idx, 'field', v)}>
                    <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, 'operator', v)}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Input value={cond.value} onChange={(e) => updateCondition(idx, 'value', e.target.value)} className="h-8 flex-1" placeholder="valor" />
                  {form.conditions.length > 1 && (
                    <button className="sc-btn-icon sc-btn-del" onClick={() => removeCondition(idx)} aria-label="Remover">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="field">
              <Label className="field-label">Ordem de avaliação</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))} className="w-24" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saveMutation.isPending}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name.trim()}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .priority-settings { display: flex; flex-direction: column; gap: 16px; }
        .settings-card { background: #fff; border: 1px solid #E5E5E5; border-radius: 12px; overflow: hidden; }
        .sc-header { padding: 20px; border-bottom: 1px solid #E5E5E5; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .sc-info { flex: 1; }
        .sc-title { font-size: 16px; font-weight: 600; color: #10293F; margin: 0; display: flex; align-items: center; gap: 8px; }
        .sc-title .w-5.h-5 { color: #FFB800; }
        .sc-desc { font-size: 13px; color: #666; margin: 4px 0 0; }
        .sc-content { padding: 0; }
        .empty-state { padding: 40px; text-align: center; color: #888; }
        .empty-state .w-10.h-10 { margin: 0 auto 12px; opacity: 0.4; }
        .priority-table { width: 100%; border-collapse: collapse; }
        .priority-table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #666; border-bottom: 1px solid #E5E5E5; background: #F8FAFC; }
        .priority-table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #F0F0F0; }
        .priority-table tr:hover { background: #F8FAFC; }
        .sc-btn-icon { width: 28px; height: 28px; border: none; background: transparent; color: #888; cursor: pointer; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: all 150ms; }
        .sc-btn-icon:hover { background: #E8F9F9; color: #10293F; }
        .sc-btn-del:hover { background: #FEF2F2; color: #DC2626; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 12px; font-weight: 500; color: #333; }
      `}</style>
    </div>
  )
}
