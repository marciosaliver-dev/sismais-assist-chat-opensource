import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, BookOpen, Edit, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>

const MODULE_OPTIONS = [
  { value: 'all', label: 'Todos os Módulos' },
  { value: 'vendas_pdv', label: 'Vendas (PDV)' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'fiscal_nfe', label: 'Fiscal (NF-e)' },
  { value: 'geral', label: 'Geral' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Status: Todos' },
  { value: 'published', label: 'Publicado' },
  { value: 'draft', label: 'Rascunho' },
]

function moduleLabel(mod?: string | null) {
  return MODULE_OPTIONS.find((o) => o.value === mod)?.label ?? mod ?? '—'
}

function getStatus(doc: Doc): 'published' | 'draft' {
  return (doc.metadata as Record<string, unknown> | null)?.status === 'published' ? 'published' : 'draft'
}

function getModule(doc: Doc): string {
  return ((doc.metadata as Record<string, unknown> | null)?.module as string) ?? 'geral'
}

const PAGE_SIZE = 8

export function ManuaisTab() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['manuais'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('ai_knowledge_base')
        .select('*')
        .eq('source_type', 'manual')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as Doc[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ai_knowledge_base').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manuais'] })
      toast.success('Manual excluído com sucesso.')
      setDeleteId(null)
    },
    onError: () => toast.error('Erro ao excluir manual.'),
  })

  const filtered = docs.filter((d) => {
    const matchSearch = search === '' || d.title?.toLowerCase().includes(search.toLowerCase())
    const matchModule = module === 'all' || getModule(d) === module
    const matchStatus = status === 'all' || getStatus(d) === status
    return matchSearch && matchModule && matchStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function formatDate(iso?: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gerencie o conteúdo de ajuda para seus usuários.
        </p>
        <Button onClick={() => navigate('/admin/manuais/new')} className="gap-2">
          <Plus className="w-4 h-4" />
          Criar Manual
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por título ou módulo..."
            className="pl-9"
          />
        </div>
        <Select value={module} onValueChange={(v) => { setModule(v); setPage(1) }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODULE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3.5 font-semibold text-foreground">Título do Manual</th>
              <th className="text-left px-4 py-3.5 font-semibold text-foreground w-36">Módulo</th>
              <th className="text-left px-4 py-3.5 font-semibold text-foreground w-48">Última Atualização</th>
              <th className="text-left px-4 py-3.5 font-semibold text-foreground w-28">Status</th>
              <th className="text-right px-5 py-3.5 font-semibold text-foreground w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  Carregando manuais...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">Nenhum manual encontrado.</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">Crie seu primeiro manual clicando no botão acima.</p>
                </td>
              </tr>
            ) : (
              paginated.map((doc) => {
                const st = getStatus(doc)
                return (
                  <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-medium text-foreground truncate max-w-xs">{doc.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{moduleLabel(getModule(doc))}</td>
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(doc.updated_at)}</td>
                    <td className="px-4 py-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-semibold',
                          st === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-muted text-muted-foreground border-border'
                        )}
                      >
                        {st === 'published' ? 'Publicado' : 'Rascunho'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-muted-foreground hover:text-foreground"
                          onClick={() => navigate(`/admin/manuais/${doc.id}`)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(doc.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} manuais
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir Manual"
        description="Esta ação é irreversível. O manual será removido permanentemente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
