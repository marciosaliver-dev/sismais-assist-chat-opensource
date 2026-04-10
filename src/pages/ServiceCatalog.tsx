import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Package, Clock, DollarSign, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ServiceItem {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  estimated_time: string | null
  notes: string | null
  is_active: boolean
  sort_order: number | null
  created_at: string | null
}

interface ServiceForm {
  name: string
  description: string
  category: string
  price: string
  estimated_time: string
  notes: string
  is_active: boolean
}

const CATEGORIES = [
  'Infraestrutura de TI',
  'Impressoras',
  'Hardware Fiscal',
  'Certificados Digitais',
  'Banco de Dados',
  'Servidores',
]

const CATEGORY_STYLES: Record<string, string> = {
  'Infraestrutura de TI': 'bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-300',
  'Impressoras': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'Hardware Fiscal': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'Certificados Digitais': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Banco de Dados': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'Servidores': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
}

const EMPTY_FORM: ServiceForm = {
  name: '',
  description: '',
  category: 'Infraestrutura de TI',
  price: '',
  estimated_time: '',
  notes: '',
  is_active: true,
}

function formatPrice(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ServiceCatalog() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Todas')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM)

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['service_catalog'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('service_catalog')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name')
      if (error) throw error
      return (data ?? []) as ServiceItem[]
    },
  })

  const filtered = services.filter(s => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'Todas' || s.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const createMutation = useMutation({
    mutationFn: async (f: ServiceForm) => {
      const { error } = await (supabase as any).from('service_catalog').insert({
        name: f.name,
        description: f.description || null,
        category: f.category,
        price: parseFloat(f.price) || 0,
        estimated_time: f.estimated_time || null,
        notes: f.notes || null,
        is_active: f.is_active,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Serviço criado!')
      qc.invalidateQueries({ queryKey: ['service_catalog'] })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Erro ao criar serviço'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: ServiceForm }) => {
      const { error } = await (supabase as any)
        .from('service_catalog')
        .update({
          name: f.name,
          description: f.description || null,
          category: f.category,
          price: parseFloat(f.price) || 0,
          estimated_time: f.estimated_time || null,
          notes: f.notes || null,
          is_active: f.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Serviço atualizado!')
      qc.invalidateQueries({ queryKey: ['service_catalog'] })
      setDialogOpen(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Erro ao atualizar serviço'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('service_catalog').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Serviço excluído!')
      qc.invalidateQueries({ queryKey: ['service_catalog'] })
      setDeleteId(null)
    },
    onError: () => toast.error('Erro ao excluir serviço'),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from('service_catalog')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service_catalog'] }),
    onError: () => toast.error('Erro ao atualizar status'),
  })

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(service: ServiceItem) {
    setEditingId(service.id)
    setForm({
      name: service.name,
      description: service.description || '',
      category: service.category,
      price: service.price > 0 ? String(service.price) : '',
      estimated_time: service.estimated_time || '',
      notes: service.notes || '',
      is_active: service.is_active,
    })
    setDialogOpen(true)
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return }
    if (!form.category) { toast.error('Categoria obrigatória'); return }
    if (editingId) {
      updateMutation.mutate({ id: editingId, f: form })
    } else {
      createMutation.mutate(form)
    }
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const activeCount = services.filter(s => s.is_active).length

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold text-foreground">Catálogo de Serviços</h1>
              {services.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeCount} ativo{activeCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Serviços extras cobrados à parte — fora do escopo do suporte padrão
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Serviço
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative max-w-sm flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar serviços..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas as categorias</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Documentação — escopo do suporte */}
        <Accordion type="single" collapsible className="rounded-xl border border-border bg-card">
          <AccordionItem value="scope" className="border-b border-border">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                O que está incluso na mensalidade?
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span>Licenciamento de uso do sistema (conforme plano e módulos contratados)</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span>Atualizações de novas versões do Maxpró</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span>Atualizações para atender exigências da legislação (para os módulos contratados)</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span>Suporte a erros do sistema</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span>Conferência e validação de informações</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span>Dúvidas específicas sobre funcionalidades do sistema (que não possam ser solucionadas por manual ou videoaula)</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <strong>Atenção:</strong> quando um atendimento caracterizar-se como "Treinamento", a Sismais se reserva o direito de cobrar pelo serviço ou direcionar o usuário para as videoaulas e manuais.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="out-of-scope" className="border-b border-border">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                Por que os serviços abaixo são cobrados à parte?
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
              <p>
                Mesmo que o Maxpró dependa de infraestrutura de TI para oferecer determinados recursos (equipamentos, redes, softwares de terceiros etc.), a <strong>instalação e manutenção destes é de inteira responsabilidade do cliente</strong> — não está incluso no suporte mensal.
              </p>
              <p>
                Recomendamos que você tenha um <strong>técnico de TI de sua confiança</strong> para executar esses serviços. Em casos de exceção, a Sismais pode realizá-los remotamente mediante cobrança da taxa conforme tabela abaixo.
              </p>
              <p>
                Serviços de banco de dados são executados somente em último caso, se não houver nenhuma forma de fazer por dentro do sistema. Nossa equipe avalia a viabilidade de cada solicitação antes de executar.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="never" className="border-0">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
                Serviços que a Sismais NÃO realiza (nem com cobrança)
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">✕</span>
                  <span><strong>Instalação física de computadores:</strong> montagem, formatação, troca de peças, preparação e conexão de cabos de rede. O único serviço que pode ser feito pela Sismais (com cobrança) é a configuração em rede, <em>desde que o cabeamento esteja feito e funcionando</em>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">✕</span>
                  <span><strong>Balanças:</strong> instalação física ou de softwares próprios do fabricante. Antes de configurarmos a integração com o Maxpró, a balança deve estar comunicando com o software do fabricante. Válido para balanças de retaguarda (açougue/hortifrúti) e de checkout (PDV).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">✕</span>
                  <span><strong>Orientações fiscais e tributárias:</strong> orientamos sobre onde preencher campos no sistema, mas o <em>conteúdo</em> (CFOP, CST, CSOSN, NCM, alíquotas, etc.) deve ser consultado com contador ou consultoria tributária especializada.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">✕</span>
                  <span><strong>Impressoras matriciais:</strong> não realizamos mais instalação desse tipo de impressora.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">✕</span>
                  <span><strong>Certificado Digital A3 (Token/Cartão):</strong> serviço descontinuado. Recomendamos o uso do certificado A1 (arquivo), que é mais simples e tem menos problemas.</span>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-12 w-full" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-8 w-16 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">
              {search || categoryFilter !== 'Todas'
                ? 'Nenhum serviço encontrado com esses filtros.'
                : 'Nenhum serviço cadastrado ainda.'}
            </p>
            {!search && categoryFilter === 'Todas' && (
              <Button variant="outline" onClick={openCreate} className="gap-2">
                <Plus className="w-4 h-4" /> Cadastrar primeiro serviço
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={() => openEdit(service)}
                onDelete={() => setDeleteId(service.id)}
                onToggle={v => toggleActive.mutate({ id: service.id, is_active: v })}
              />
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog() }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  placeholder="Ex: Intervenção em Banco de Dados"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria *</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Preço (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Tempo Estimado</Label>
                <Input
                  placeholder="Ex: 2-4 horas, 1 dia útil"
                  value={form.estimated_time}
                  onChange={e => setForm(f => ({ ...f, estimated_time: e.target.value }))}
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva o que está incluso neste serviço..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div>
                <Label>Observações Internas</Label>
                <Textarea
                  placeholder="Notas visíveis apenas para a equipe..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="svc-active">Ativo no catálogo</Label>
                <Switch
                  id="svc-active"
                  checked={form.is_active}
                  onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
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
              <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O serviço será removido permanentemente do catálogo.
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

function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggle,
}: {
  service: ServiceItem
  onEdit: () => void
  onDelete: () => void
  onToggle: (v: boolean) => void
}) {
  const categoryStyle = CATEGORY_STYLES[service.category] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300'

  return (
    <div
      className={cn(
        'group border rounded-xl p-4 space-y-3 transition-all hover:shadow-md bg-card',
        !service.is_active && 'opacity-60'
      )}
    >
      {/* Top row: category badge + inactive badge */}
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', categoryStyle)}>
          {service.category}
        </span>
        {!service.is_active && (
          <Badge variant="secondary" className="text-xs h-4 shrink-0">Inativo</Badge>
        )}
      </div>

      {/* Name */}
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Package className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground leading-snug">{service.name}</p>
        </div>
      </div>

      {/* Price highlight */}
      <div className="flex items-center gap-1.5">
        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
        <span className={cn(
          'text-lg font-bold',
          service.price > 0 ? 'text-primary' : 'text-muted-foreground'
        )}>
          {service.price > 0 ? formatPrice(service.price) : 'A consultar'}
        </span>
      </div>

      {/* Time estimate */}
      {service.estimated_time && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{service.estimated_time}</span>
        </div>
      )}

      {/* Description */}
      {service.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {service.description}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <Switch
          checked={service.is_active}
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
