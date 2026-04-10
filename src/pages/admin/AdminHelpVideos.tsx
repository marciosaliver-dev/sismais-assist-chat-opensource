import { useState } from 'react'
import { Plus, Search, Edit, Trash2, PlayCircle, Loader2, Clock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const MODULE_OPTIONS = [
  { value: 'vendas_pdv', label: 'Vendas (PDV)' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'fiscal_nfe', label: 'Fiscal (NF-e)' },
  { value: 'geral', label: 'Geral' },
]

const LEVEL_OPTIONS = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
]

const LEVEL_STYLES: Record<string, string> = {
  iniciante: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  intermediario: 'bg-amber-50 text-amber-700 border-amber-200',
  avancado: 'bg-red-50 text-red-700 border-red-200',
}

function moduleLabel(val: string) {
  return MODULE_OPTIONS.find((o) => o.value === val)?.label ?? val
}

function levelLabel(val: string) {
  return LEVEL_OPTIONS.find((o) => o.value === val)?.label ?? val
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface VideoRow {
  id: string
  title: string
  description: string | null
  module: string
  level: string
  duration_seconds: number | null
  thumbnail_url: string | null
  video_url: string
  status: string
  created_at: string
}

const EMPTY_FORM = {
  title: '',
  description: '',
  module: 'geral',
  level: 'iniciante',
  video_url: '',
  thumbnail_url: '',
  duration_seconds: '',
  status: 'draft',
}

const PAGE_SIZE = 8

export default function AdminHelpVideos() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterModule, setFilterModule] = useState('all')
  const [filterLevel, setFilterLevel] = useState('all')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['admin-help-videos'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('help_videos')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as VideoRow[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        module: form.module,
        level: form.level,
        video_url: form.video_url.trim(),
        thumbnail_url: form.thumbnail_url.trim() || null,
        duration_seconds: form.duration_seconds ? parseInt(form.duration_seconds) : null,
        status: form.status,
      }
      if (editingId) {
        const { error } = await (supabase as any).from('help_videos').update(payload).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await (supabase as any).from('help_videos').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-help-videos'] })
      qc.invalidateQueries({ queryKey: ['help-admin-kpi-videos'] })
      toast.success(editingId ? 'Vídeo atualizado.' : 'Vídeo criado.')
      setDialogOpen(false)
      setEditingId(null)
      setForm({ ...EMPTY_FORM })
    },
    onError: () => toast.error('Erro ao salvar vídeo.'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('help_videos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-help-videos'] })
      qc.invalidateQueries({ queryKey: ['help-admin-kpi-videos'] })
      toast.success('Vídeo excluído.')
      setDeleteId(null)
    },
    onError: () => toast.error('Erro ao excluir vídeo.'),
  })

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  function openEdit(v: VideoRow) {
    setEditingId(v.id)
    setForm({
      title: v.title,
      description: v.description ?? '',
      module: v.module,
      level: v.level,
      video_url: v.video_url,
      thumbnail_url: v.thumbnail_url ?? '',
      duration_seconds: v.duration_seconds ? String(v.duration_seconds) : '',
      status: v.status,
    })
    setDialogOpen(true)
  }

  function setField(key: keyof typeof EMPTY_FORM, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  const filtered = videos.filter((v) => {
    const matchSearch = search === '' || v.title.toLowerCase().includes(search.toLowerCase())
    const matchModule = filterModule === 'all' || v.module === filterModule
    const matchLevel = filterLevel === 'all' || v.level === filterLevel
    return matchSearch && matchModule && matchLevel
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const isFormValid = form.title.trim() && form.video_url.trim()

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vídeos Tutoriais</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie os vídeos de ajuda disponíveis no portal do cliente.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Vídeo
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar por título..."
              className="pl-9"
            />
          </div>
          <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setPage(1) }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todos os Módulos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Módulos</SelectItem>
              {MODULE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterLevel} onValueChange={(v) => { setFilterLevel(v); setPage(1) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todos os Níveis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Níveis</SelectItem>
              {LEVEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3.5 font-semibold text-foreground">Título</th>
                <th className="text-left px-4 py-3.5 font-semibold text-foreground w-36 hidden sm:table-cell">Módulo</th>
                <th className="text-left px-4 py-3.5 font-semibold text-foreground w-32 hidden md:table-cell">Nível</th>
                <th className="text-left px-4 py-3.5 font-semibold text-foreground w-24 hidden lg:table-cell">Duração</th>
                <th className="text-left px-4 py-3.5 font-semibold text-foreground w-28">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-foreground w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <PlayCircle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Nenhum vídeo encontrado.</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">
                      Adicione o primeiro vídeo clicando no botão acima.
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((video) => (
                  <tr
                    key={video.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded bg-red-50 flex items-center justify-center shrink-0">
                          <PlayCircle className="w-3.5 h-3.5 text-red-600" />
                        </div>
                        <span className="font-medium text-foreground truncate max-w-xs">{video.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden sm:table-cell">
                      {moduleLabel(video.module)}
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <Badge
                        variant="outline"
                        className={cn('text-xs font-semibold', LEVEL_STYLES[video.level] ?? '')}
                      >
                        {levelLabel(video.level)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden lg:table-cell">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(video.duration_seconds)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-semibold',
                          video.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-muted text-muted-foreground border-border'
                        )}
                      >
                        {video.status === 'published' ? 'Publicado' : 'Rascunho'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(video)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(video.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} vídeos
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Anterior
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditingId(null); setForm({ ...EMPTY_FORM }) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Vídeo' : 'Adicionar Vídeo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="v-title">Título <span className="text-destructive">*</span></Label>
              <Input
                id="v-title"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="Ex: Como fazer o fechamento de caixa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="v-description">Descrição</Label>
              <Textarea
                id="v-description"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Breve descrição do conteúdo..."
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Módulo</Label>
                <Select value={form.module} onValueChange={(v) => setField('module', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nível</Label>
                <Select value={form.level} onValueChange={(v) => setField('level', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="v-url">URL do Vídeo <span className="text-destructive">*</span></Label>
              <Input
                id="v-url"
                value={form.video_url}
                onChange={(e) => setField('video_url', e.target.value)}
                placeholder="https://www.youtube.com/embed/..."
              />
              <p className="text-xs text-muted-foreground">
                Use a URL de embed do YouTube (youtube.com/embed/ID) ou link direto de vídeo.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="v-thumb">URL da Thumbnail</Label>
              <Input
                id="v-thumb"
                value={form.thumbnail_url}
                onChange={(e) => setField('thumbnail_url', e.target.value)}
                placeholder="https://img.youtube.com/vi/ID/maxresdefault.jpg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="v-duration">Duração (segundos)</Label>
                <Input
                  id="v-duration"
                  type="number"
                  min="0"
                  value={form.duration_seconds}
                  onChange={(e) => setField('duration_seconds', e.target.value)}
                  placeholder="Ex: 180"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!isFormValid || saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? 'Salvar Alterações' : 'Criar Vídeo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir Vídeo"
        description="Esta ação é irreversível. O vídeo será removido permanentemente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
