import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Zap, FileText, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

type Macro = {
  id: string
  name: string
  message: string | null
  description: string | null
  color: string | null
  icon: string | null
  is_active: boolean | null
  sort_order: number | null
  created_at: string | null
}

type MacroForm = {
  name: string
  message: string
  description: string
  color: string
  is_active: boolean
}

const COLORS = [
  { value: '#6366f1', label: 'Índigo' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#eab308', label: 'Amarelo' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#64748b', label: 'Cinza' },
]

const EMPTY_FORM: MacroForm = { name: '', message: '', description: '', color: '#6366f1', is_active: true }

export default function Macros() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MacroForm>(EMPTY_FORM)

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ['macros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('macros')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name')
      if (error) throw error
      return data as Macro[]
    },
  })

  const filtered = macros.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.message?.toLowerCase().includes(search.toLowerCase()) ||
    m.description?.toLowerCase().includes(search.toLowerCase())
  )

  const createMutation = useMutation({
    mutationFn: async (f: MacroForm) => {
      const { error } = await supabase.from('macros').insert({
        name: f.name,
        message: f.message || null,
        description: f.description || null,
        color: f.color || null,
        is_active: f.is_active,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Macro criada!')
      qc.invalidateQueries({ queryKey: ['macros'] })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Erro ao criar macro'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: MacroForm }) => {
      const { error } = await supabase.from('macros').update({
        name: f.name,
        message: f.message || null,
        description: f.description || null,
        color: f.color || null,
        is_active: f.is_active,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Macro atualizada!')
      qc.invalidateQueries({ queryKey: ['macros'] })
      setDialogOpen(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Erro ao atualizar macro'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('macros').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Macro excluída!')
      qc.invalidateQueries({ queryKey: ['macros'] })
      setDeleteId(null)
    },
    onError: () => toast.error('Erro ao excluir macro'),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('macros').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['macros'] }),
    onError: () => toast.error('Erro ao atualizar status'),
  })

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(macro: Macro) {
    setEditingId(macro.id)
    setForm({
      name: macro.name,
      message: macro.message || '',
      description: macro.description || '',
      color: macro.color || '#6366f1',
      is_active: macro.is_active ?? true,
    })
    setDialogOpen(true)
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return }
    if (!form.message.trim()) { toast.error('Mensagem obrigatória'); return }
    if (editingId) {
      updateMutation.mutate({ id: editingId, f: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="page-container">
      <div className="page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Macros</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Respostas rápidas e modelos de mensagem</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Macro
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar macros..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-3 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {search ? 'Nenhuma macro encontrada.' : 'Nenhuma macro cadastrada ainda.'}
          </p>
          {!search && (
            <Button variant="outline" onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Criar primeira macro
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(macro => (
            <MacroCard
              key={macro.id}
              macro={macro}
              onEdit={() => openEdit(macro)}
              onDelete={() => setDeleteId(macro.id)}
              onToggle={(v) => toggleActive.mutate({ id: macro.id, is_active: v })}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Macro' : 'Nova Macro'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Boas-vindas, Aguardando retorno..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Mensagem *</Label>
              <Textarea
                placeholder="Texto da mensagem a ser enviada..."
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para inserir o nome do cliente
              </p>
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Breve descrição de quando usar esta macro..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap mt-1.5">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    className={cn(
                      'w-7 h-7 rounded-full transition-all border-2',
                      form.color === c.value ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-active">Ativa</Label>
              <Switch
                id="is-active"
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM) }}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir macro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A macro será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  )
}

function MacroCard({
  macro,
  onEdit,
  onDelete,
  onToggle,
}: {
  macro: Macro
  onEdit: () => void
  onDelete: () => void
  onToggle: (v: boolean) => void
}) {
  const accentColor = macro.color || '#6366f1'

  return (
    <div className={cn(
      'group border rounded-xl p-4 space-y-3 transition-all hover:shadow-md bg-card',
      !macro.is_active && 'opacity-60'
    )}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <Zap className="w-4 h-4" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-foreground truncate">{macro.name}</p>
            {!macro.is_active && (
              <Badge variant="secondary" className="text-xs h-4 shrink-0">Inativa</Badge>
            )}
          </div>
          {macro.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{macro.description}</p>
          )}
        </div>
      </div>

      {/* Message preview */}
      {macro.message && (
        <p className="text-sm text-muted-foreground line-clamp-3 bg-muted/50 rounded-lg p-2.5 text-xs leading-relaxed">
          {macro.message}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <Switch
          checked={macro.is_active ?? true}
          onCheckedChange={onToggle}
          className="scale-90"
        />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
