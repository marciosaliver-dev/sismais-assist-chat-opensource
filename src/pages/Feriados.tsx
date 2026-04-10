import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Calendar, Download, CalendarDays, MapPin, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Tipos ──

type Holiday = {
  id: string
  name: string
  date: string
  scope: 'national' | 'state' | 'municipal'
  state_code: string | null
  city_name: string | null
  recurring: boolean
  is_active: boolean
  created_at: string | null
}

type HolidayForm = {
  name: string
  date: string
  scope: 'national' | 'state' | 'municipal'
  state_code: string
  city_name: string
  recurring: boolean
  is_active: boolean
}

const EMPTY_FORM: HolidayForm = {
  name: '',
  date: '',
  scope: 'national',
  state_code: '',
  city_name: '',
  recurring: false,
  is_active: true,
}

// ── Estados brasileiros ──

const BRAZILIAN_STATES = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
]

// ── Feriados nacionais fixos ──

const FIXED_NATIONAL_HOLIDAYS = [
  { name: 'Confraternização Universal', month: 1, day: 1 },
  { name: 'Tiradentes', month: 4, day: 21 },
  { name: 'Dia do Trabalho', month: 5, day: 1 },
  { name: 'Independência do Brasil', month: 9, day: 7 },
  { name: 'Nossa Sra. Aparecida', month: 10, day: 12 },
  { name: 'Finados', month: 11, day: 2 },
  { name: 'Proclamação da República', month: 11, day: 15 },
  { name: 'Natal', month: 12, day: 25 },
]

// ── Cálculo de Páscoa (Algoritmo de Meeus/Anonymous Gregorian) ──

function calculateEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMovableHolidays(year: number) {
  const easter = calculateEaster(year)
  return [
    { name: 'Carnaval', date: formatDateISO(addDays(easter, -47)) },
    { name: 'Carnaval', date: formatDateISO(addDays(easter, -46)) },
    { name: 'Sexta-feira Santa', date: formatDateISO(addDays(easter, -2)) },
    { name: 'Corpus Christi', date: formatDateISO(addDays(easter, 60)) },
  ]
}

function getAllNationalHolidays(year: number) {
  const fixed = FIXED_NATIONAL_HOLIDAYS.map(h => ({
    name: h.name,
    date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
    recurring: true,
  }))
  const movable = getMovableHolidays(year).map(h => ({ ...h, recurring: false }))
  return [...fixed, ...movable]
}

// ── Helpers de UI ──

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const SCOPE_LABELS: Record<string, string> = {
  national: 'Nacional',
  state: 'Estadual',
  municipal: 'Municipal',
}

const SCOPE_COLORS: Record<string, string> = {
  national: 'bg-[#E8F9F9] text-[#10293F] border-[rgba(69,229,229,0.4)]',
  state: 'bg-[#EFF6FF] text-[#2563EB] border-[rgba(37,99,235,0.3)]',
  municipal: 'bg-[#F5F3FF] text-[#7C3AED] border-[rgba(124,58,237,0.3)]',
}

const SCOPE_ICONS: Record<string, typeof Flag> = {
  national: Flag,
  state: MapPin,
  municipal: MapPin,
}

// ── Componente principal ──

export default function Feriados() {
  const qc = useQueryClient()
  const currentYear = new Date().getFullYear()

  // Estado
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<HolidayForm>(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importYear, setImportYear] = useState<number>(currentYear)

  // ── Query ──

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['business-holidays'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('business_holidays')
        .select('*')
        .order('date', { ascending: true })

      if (error) throw error
      return (data || []) as Holiday[]
    },
  })

  // ── Filtragem ──

  const filtered = useMemo(() => {
    return holidays.filter(h => {
      if (search) {
        const s = search.toLowerCase()
        if (
          !h.name.toLowerCase().includes(s) &&
          !formatDateBR(h.date).includes(s) &&
          !(h.state_code || '').toLowerCase().includes(s) &&
          !(h.city_name || '').toLowerCase().includes(s)
        ) {
          return false
        }
      }
      if (scopeFilter !== 'all' && h.scope !== scopeFilter) return false
      if (yearFilter !== 'all') {
        const year = h.date.substring(0, 4)
        if (year !== yearFilter) return false
      }
      return true
    })
  }, [holidays, search, scopeFilter, yearFilter])

  // Anos disponíveis para filtro
  const availableYears = useMemo(() => {
    const years = new Set(holidays.map(h => h.date.substring(0, 4)))
    return Array.from(years).sort()
  }, [holidays])

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async (f: HolidayForm) => {
      const { error } = await (supabase as any).from('business_holidays').insert({
        name: f.name.trim(),
        date: f.date,
        scope: f.scope,
        state_code: f.scope !== 'national' ? f.state_code || null : null,
        city_name: f.scope === 'municipal' ? f.city_name.trim() || null : null,
        recurring: f.recurring,
        is_active: f.is_active,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Feriado criado!')
      qc.invalidateQueries({ queryKey: ['business-holidays'] })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
    },
    onError: (e: any) => {
      if (e?.message?.includes('idx_business_holidays_unique')) {
        toast.error('Este feriado já existe nesta data.')
      } else {
        toast.error('Erro ao criar feriado')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, form: f }: { id: string; form: HolidayForm }) => {
      const { error } = await (supabase as any).from('business_holidays').update({
        name: f.name.trim(),
        date: f.date,
        scope: f.scope,
        state_code: f.scope !== 'national' ? f.state_code || null : null,
        city_name: f.scope === 'municipal' ? f.city_name.trim() || null : null,
        recurring: f.recurring,
        is_active: f.is_active,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Feriado atualizado!')
      qc.invalidateQueries({ queryKey: ['business-holidays'] })
      setDialogOpen(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Erro ao atualizar feriado'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('business_holidays').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Feriado excluído!')
      qc.invalidateQueries({ queryKey: ['business-holidays'] })
      setDeleteId(null)
    },
    onError: () => toast.error('Erro ao excluir feriado'),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from('business_holidays').update({ is_active: active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-holidays'] }),
    onError: () => toast.error('Erro ao alterar status'),
  })

  const importMutation = useMutation({
    mutationFn: async (year: number) => {
      const allHolidays = getAllNationalHolidays(year)
      let imported = 0

      for (const h of allHolidays) {
        const { error } = await (supabase as any).from('business_holidays').upsert(
          {
            name: h.name,
            date: h.date,
            scope: 'national' as const,
            state_code: null,
            city_name: null,
            recurring: h.recurring,
            is_active: true,
          },
          { onConflict: 'date,name,scope,COALESCE(state_code, \'\'),COALESCE(city_name, \'\')' as any }
        )
        if (!error) imported++
      }

      return imported
    },
    onSuccess: (count) => {
      toast.success(`${count} feriados importados/atualizados para ${importYear}!`)
      qc.invalidateQueries({ queryKey: ['business-holidays'] })
      setImportDialogOpen(false)
    },
    onError: () => toast.error('Erro ao importar feriados'),
  })

  // ── Handlers ──

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(h: Holiday) {
    setEditingId(h.id)
    setForm({
      name: h.name,
      date: h.date,
      scope: h.scope,
      state_code: h.state_code || '',
      city_name: h.city_name || '',
      recurring: h.recurring,
      is_active: h.is_active,
    })
    setDialogOpen(true)
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    if (!form.date) { toast.error('Data é obrigatória'); return }
    if (form.scope !== 'national' && !form.state_code) { toast.error('Selecione o estado'); return }
    if (form.scope === 'municipal' && !form.city_name.trim()) { toast.error('Informe a cidade'); return }

    if (editingId) {
      updateMutation.mutate({ id: editingId, form })
    } else {
      createMutation.mutate(form)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  // ── Render ──

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Feriados</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie feriados nacionais, estaduais e municipais. A IA considera esses feriados para definir horário de atendimento.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
              <Download className="w-4 h-4" /> Importar Nacionais
            </Button>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Feriado
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar feriados..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="national">Nacional</SelectItem>
              <SelectItem value="state">Estadual</SelectItem>
              <SelectItem value="municipal">Municipal</SelectItem>
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {availableYears.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search || scopeFilter !== 'all' || yearFilter !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setScopeFilter('all'); setYearFilter('all') }}>
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Conteúdo */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">
              {search || scopeFilter !== 'all' || yearFilter !== 'all'
                ? 'Nenhum feriado encontrado com esses filtros.'
                : 'Nenhum feriado cadastrado ainda.'}
            </p>
            {!search && scopeFilter === 'all' && yearFilter === 'all' && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
                  <Download className="w-4 h-4" /> Importar Nacionais
                </Button>
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Criar primeiro feriado
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(h => {
              const ScopeIcon = SCOPE_ICONS[h.scope] || Flag
              return (
                <div
                  key={h.id}
                  className={cn(
                    'group border rounded-xl p-4 space-y-3 transition-all hover:shadow-md bg-card',
                    !h.is_active && 'opacity-60'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#E8F9F9]">
                      <CalendarDays className="w-4 h-4 text-[#10293F]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{h.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateBR(h.date)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn('text-[10px]', SCOPE_COLORS[h.scope])}>
                      <ScopeIcon className="w-3 h-3 mr-1" />
                      {SCOPE_LABELS[h.scope]}
                    </Badge>
                    {h.state_code && (
                      <Badge variant="outline" className="text-[10px]">
                        {h.state_code}
                      </Badge>
                    )}
                    {h.city_name && (
                      <Badge variant="outline" className="text-[10px]">
                        {h.city_name}
                      </Badge>
                    )}
                    {h.recurring && (
                      <Badge variant="outline" className="text-[10px] bg-[#FFFBEB] text-[#92400E] border-[rgba(255,184,0,0.5)]">
                        Recorrente
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <Switch
                      checked={h.is_active}
                      onCheckedChange={active => toggleMutation.mutate({ id: h.id, active })}
                      className="scale-90"
                    />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(h)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(h.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Dialog Criar/Editar */}
        <Dialog open={dialogOpen} onOpenChange={open => {
          if (!open) { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM) }
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Feriado' : 'Novo Feriado'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Natal, Aniversário da Cidade..."
                />
              </div>

              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div>
                <Label>Tipo *</Label>
                <Select value={form.scope} onValueChange={(v: 'national' | 'state' | 'municipal') => setForm(f => ({ ...f, scope: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national">Nacional</SelectItem>
                    <SelectItem value="state">Estadual</SelectItem>
                    <SelectItem value="municipal">Municipal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.scope !== 'national' && (
                <div>
                  <Label>Estado *</Label>
                  <Select value={form.state_code} onValueChange={v => setForm(f => ({ ...f, state_code: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map(s => (
                        <SelectItem key={s.code} value={s.code}>{s.code} - {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.scope === 'municipal' && (
                <div>
                  <Label>Cidade *</Label>
                  <Input
                    value={form.city_name}
                    onChange={e => setForm(f => ({ ...f, city_name: e.target.value }))}
                    placeholder="Ex: São Paulo"
                  />
                </div>
              )}

              <div className="flex items-center justify-between py-1">
                <div>
                  <Label>Recorrente</Label>
                  <p className="text-xs text-muted-foreground">Repete todo ano no mesmo dia/mês</p>
                </div>
                <Switch
                  checked={form.recurring}
                  onCheckedChange={v => setForm(f => ({ ...f, recurring: v }))}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <Label>Ativo</Label>
                  <p className="text-xs text-muted-foreground">Feriados inativos são ignorados pela IA</p>
                </div>
                <Switch
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

        {/* Dialog Excluir */}
        <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir feriado?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O feriado será removido permanentemente.
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

        {/* Dialog Importar */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Importar Feriados Nacionais</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Importa automaticamente os 8 feriados fixos e 4 feriados móveis (Carnaval, Sexta-feira Santa e Corpus Christi) do ano selecionado.
              </p>

              <div>
                <Label>Ano</Label>
                <Select value={String(importYear)} onValueChange={v => setImportYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 8 }, (_, i) => currentYear + i - 1).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview dos feriados */}
              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {getAllNationalHolidays(importYear).map((h, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{h.name}</span>
                    <span className="text-muted-foreground text-xs">{formatDateBR(h.date)}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Feriados já existentes serão ignorados (sem duplicatas).
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => importMutation.mutate(importYear)} disabled={importMutation.isPending} className="gap-2">
                <Download className="w-4 h-4" />
                {importMutation.isPending ? 'Importando...' : `Importar ${importYear}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
