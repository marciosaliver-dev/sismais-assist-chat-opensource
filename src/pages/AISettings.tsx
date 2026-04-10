import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown,
  DollarSign, Wallet, TrendingUp, Calendar, ChevronLeft, ChevronRight,
  Cpu, Eye, Zap, Info, CreditCard, Bot, Users
} from 'lucide-react'
import {
  useModelCatalog, useToggleModelActive, useSyncOpenRouterModels,
  useOpenRouterCredits, TIER_CONFIG, SPECIALTY_LABELS, formatModelCost, formatContextWindow,
  type ModelCatalogEntry, type ModelTier
} from '@/hooks/useModelCatalog'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { InternalAITab } from '@/components/ai-settings/InternalAITab'
import { SquadsTab } from '@/components/ai-settings/SquadsTab'
import { BehaviorTab } from '@/components/ai-settings/BehaviorTab'
import TrainingModelTab from '@/components/settings/TrainingModelTab'
import { AIConfigWizard } from '@/components/ai-settings/AIConfigWizard'
import { Link } from 'react-router-dom'
import { BookOpen, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'



// ─── Sort helper ──────────────────────────────────────────────────────
type SortKey = 'display_name' | 'provider' | 'tier' | 'input_cost_per_1m' | 'output_cost_per_1m' | 'max_context_window' | 'max_output_tokens' | 'recommended_for'
type SortDir = 'asc' | 'desc'

function SortableHead({ label, sortKey, currentKey, currentDir, onSort, className }: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir
  onSort: (k: SortKey) => void; className?: string
}) {
  const active = currentKey === sortKey
  const Icon = active ? (currentDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead className={cn('cursor-pointer select-none hover:bg-muted/50 transition-colors', className)} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label} <Icon className={cn('w-3.5 h-3.5', active ? 'text-foreground' : 'text-muted-foreground/50')} />
      </span>
    </TableHead>
  )
}

// ─── Model Detail Dialog ──────────────────────────────────────────────
function ModelDetailDialog({ model, open, onClose }: { model: ModelCatalogEntry | null; open: boolean; onClose: () => void }) {
  if (!model) return null
  const tierCfg = TIER_CONFIG[model.tier as ModelTier]
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" /> {model.display_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={tierCfg.badgeClass}>{tierCfg.label}</Badge>
            <Badge variant="outline">{model.provider}</Badge>
            <Badge variant={model.is_active ? 'default' : 'secondary'}>{model.is_active ? 'Ativo' : 'Inativo'}</Badge>
          </div>
          <p className="text-muted-foreground text-xs font-mono">{model.model_id}</p>
          {model.description && <p className="text-muted-foreground">{model.description}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Custo Input</p><p className="font-semibold">{formatModelCost(model.input_cost_per_1m)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Custo Output</p><p className="font-semibold">{formatModelCost(model.output_cost_per_1m)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Contexto</p><p className="font-semibold">{formatContextWindow(model.max_context_window)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Max Output</p><p className="font-semibold">{formatContextWindow(model.max_output_tokens)}</p></CardContent></Card>
          </div>

          {model.input_modalities?.length > 0 && (
            <div><p className="font-medium mb-1">Modalidades de Entrada</p><div className="flex gap-1 flex-wrap">{model.input_modalities.map(m => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}</div></div>
          )}
          {model.output_modalities?.length > 0 && (
            <div><p className="font-medium mb-1">Modalidades de Saída</p><div className="flex gap-1 flex-wrap">{model.output_modalities.map(m => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}</div></div>
          )}
          {model.capabilities?.length > 0 && (
            <div><p className="font-medium mb-1">Capacidades</p><div className="flex gap-1 flex-wrap">{model.capabilities.map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}</div></div>
          )}
          {model.recommended_for?.length > 0 && (
            <div><p className="font-medium mb-1">Recomendado para</p><div className="flex gap-1 flex-wrap">{model.recommended_for.map(r => {
              const spec = SPECIALTY_LABELS[r]
              return <Badge key={r} className={cn('text-xs', spec?.color)}>{spec?.label || r}</Badge>
            })}</div></div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Credits Tab ──────────────────────────────────────────────────────
function CreditsTab() {
  const { data: credits, isLoading } = useOpenRouterCredits()
  const { rate } = useExchangeRate()

  const formatUSD = (v: number) => `$${v.toFixed(4)}`
  const formatBRL = (v: number) => `R$ ${(v * rate).toFixed(2)}`

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>

  if (!credits) return <Card><CardContent className="p-6 text-center text-muted-foreground">Não foi possível carregar créditos OpenRouter.</CardContent></Card>

  // Prioritize account-level credits over key-level limits
  const balance = credits.balance ?? credits.limit_remaining ?? null
  const totalCredits = credits.total_credits ?? null
  const totalUsage = credits.total_usage ?? credits.usage ?? 0
  const totalPurchased = totalCredits ?? credits.limit ?? null
  const isFree = credits.is_free_tier ?? true
  const usagePercent = totalPurchased ? Math.min((totalUsage / totalPurchased) * 100, 100) : 0

  const periodCards = [
    { label: 'Consumo Diário', value: credits.usage_daily ?? 0, icon: Calendar, color: 'text-blue-500' },
    { label: 'Consumo Semanal', value: credits.usage_weekly ?? 0, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Consumo Mensal', value: credits.usage_monthly ?? 0, icon: DollarSign, color: 'text-amber-500' },
  ]

  return (
    <div className="space-y-4">
      {/* Main balance card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><Wallet className="w-5 h-5" /> Saldo de Créditos Pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            {balance != null ? (
              <>
                <p className="text-3xl font-bold">{formatUSD(balance)}</p>
                <p className="text-sm text-muted-foreground">{formatBRL(balance)}</p>
              </>
            ) : (
              <p className="text-xl font-medium text-muted-foreground">Sem limite definido</p>
            )}
          </div>
          {totalPurchased != null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Consumido: {formatUSD(totalUsage)}</span>
                <span>Total comprado: {formatUSD(totalPurchased)}</span>
              </div>
              <Progress value={usagePercent} className="h-2" />
            </div>
          )}
          <div className="flex gap-2">
            <Badge variant={isFree ? 'secondary' : 'default'}>{isFree ? 'Free Tier' : 'Créditos Pagos'}</Badge>
            {totalUsage > 0 && <Badge variant="outline">Uso all-time: {formatUSD(totalUsage)}</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Period cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {periodCards.map(card => {
          const Icon = card.icon
          return (
            <Card key={card.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn('w-4 h-4', card.color)} />
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                </div>
                <p className="text-2xl font-semibold">{formatUSD(card.value)}</p>
                <p className="text-xs text-muted-foreground">{formatBRL(card.value)}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Model Catalog Tab ────────────────────────────────────────────────
function ModelCatalogTab() {
  const { data: models = [], isLoading } = useModelCatalog({ activeOnly: false })
  const toggleActive = useToggleModelActive()
  const syncModels = useSyncOpenRouterModels()

  const [search, setSearch] = useState('')
  const [filterTier, setFilterTier] = useState<string>('all')
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [filterRecommended, setFilterRecommended] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('display_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)
  const [detailModel, setDetailModel] = useState<ModelCatalogEntry | null>(null)
  const pageSize = 20

  const providers = useMemo(() => [...new Set(models.map(m => m.provider))].sort(), [models])
  const tiers = useMemo(() => [...new Set(models.map(m => m.tier))], [models])

  const tierCounts = useMemo(() => {
    const c: Record<string, number> = {}
    models.forEach(m => { c[m.tier] = (c[m.tier] || 0) + 1 })
    return c
  }, [models])

  const providerCounts = useMemo(() => {
    const c: Record<string, number> = {}
    models.forEach(m => { c[m.provider] = (c[m.provider] || 0) + 1 })
    return c
  }, [models])

  const recommendedOptions = useMemo(() => {
    const c: Record<string, number> = {}
    models.forEach(m => { (m.recommended_for || []).forEach(r => { c[r] = (c[r] || 0) + 1 }) })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [models])

  const filtered = useMemo(() => {
    return models.filter(m => {
      if (filterTier !== 'all' && m.tier !== filterTier) return false
      if (filterProvider !== 'all' && m.provider !== filterProvider) return false
      if (filterRecommended !== 'all' && !m.recommended_for?.includes(filterRecommended)) return false
      if (search) {
        const q = search.toLowerCase()
        return m.display_name.toLowerCase().includes(q) || m.model_id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q)
      }
      return true
    })
  }, [models, search, filterTier, filterProvider, filterRecommended])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'recommended_for') {
        const av = a.recommended_for?.[0] || ''
        const bv = b.recommended_for?.[0] || ''
        cmp = av.localeCompare(bv)
      } else {
        const av = a[sortKey], bv = b[sortKey]
        if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
        else cmp = String(av).localeCompare(String(bv))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar modelo..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} className="pl-9" />
        </div>

        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterTier} onChange={e => { setFilterTier(e.target.value); setPage(0) }}>
          <option value="all">Todos Tiers ({models.length})</option>
          {tiers.map(t => <option key={t} value={t}>{TIER_CONFIG[t as ModelTier]?.label || t} ({tierCounts[t] || 0})</option>)}
        </select>

        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterProvider} onChange={e => { setFilterProvider(e.target.value); setPage(0) }}>
          <option value="all">Todos Providers</option>
          {providers.map(p => <option key={p} value={p}>{p} ({providerCounts[p] || 0})</option>)}
        </select>

        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterRecommended} onChange={e => { setFilterRecommended(e.target.value); setPage(0) }}>
          <option value="all">Recomendado para...</option>
          {recommendedOptions.map(([key, count]) => <option key={key} value={key}>{SPECIALTY_LABELS[key]?.label || key} ({count})</option>)}
        </select>

        {(filterTier !== 'all' || filterProvider !== 'all' || filterRecommended !== 'all' || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterTier('all'); setFilterProvider('all'); setFilterRecommended('all'); setSearch(''); setPage(0) }}>
            Limpar filtros
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={() => syncModels.mutate({})} disabled={syncModels.isPending}>
          <RefreshCw className={cn('w-4 h-4 mr-1', syncModels.isPending && 'animate-spin')} />
          Sincronizar
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto max-h-[calc(100vh-300px)]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <SortableHead label="Modelo" sortKey="display_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="min-w-[200px]" />
              <SortableHead label="Provider" sortKey="provider" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label="Tier" sortKey="tier" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label="Input $/1M" sortKey="input_cost_per_1m" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label="Output $/1M" sortKey="output_cost_per_1m" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label="Contexto" sortKey="max_context_window" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label="Max Output" sortKey="max_output_tokens" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <TableHead className="hidden lg:table-cell">Modalidades</TableHead>
              <SortableHead label="Recomendado" sortKey="recommended_for" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
              <TableHead className="w-16">Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-8" /></TableCell></TableRow>)
            ) : paginated.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhum modelo encontrado</TableCell></TableRow>
            ) : (
              paginated.map(m => {
                const tierCfg = TIER_CONFIG[m.tier as ModelTier]
                return (
                  <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailModel(m)}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{m.display_name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{m.model_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{m.provider}</TableCell>
                    <TableCell><Badge className={cn('text-xs', tierCfg?.badgeClass)}>{tierCfg?.label || m.tier}</Badge></TableCell>
                    <TableCell className="text-sm font-mono">{formatModelCost(m.input_cost_per_1m)}</TableCell>
                    <TableCell className="text-sm font-mono">{formatModelCost(m.output_cost_per_1m)}</TableCell>
                    <TableCell className="text-sm">{formatContextWindow(m.max_context_window)}</TableCell>
                    <TableCell className="text-sm">{formatContextWindow(m.max_output_tokens)}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex gap-1 flex-wrap">{m.input_modalities?.slice(0, 2).map(mod => <Badge key={mod} variant="outline" className="text-xs">{mod}</Badge>)}</div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div className="flex gap-1 flex-wrap">{m.recommended_for?.slice(0, 2).map(r => {
                        const spec = SPECIALTY_LABELS[r]
                        return <Badge key={r} className={cn('text-xs', spec?.color)}>{spec?.label || r}</Badge>
                      })}</div>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Switch checked={m.is_active} onCheckedChange={v => toggleActive.mutate({ id: m.id, is_active: v })} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{sorted.length} modelos • Página {page + 1} de {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ModelDetailDialog model={detailModel} open={!!detailModel} onClose={() => setDetailModel(null)} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────
export default function AISettings() {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div className="page-container">
      <div className="page-content">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configurações IA</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Catálogo de modelos e créditos OpenRouter</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link to="/ai-config-guide">
              <BookOpen className="w-4 h-4 mr-1" />
              Manual
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => setWizardOpen(true)}
            className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]"
          >
            <Zap className="w-4 h-4 mr-1" />
            Wizard de Configuração
          </Button>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList className="flex-wrap">
          <TabsTrigger value="catalog" className="gap-1.5"><Cpu className="w-4 h-4" /> Catálogo de Modelos</TabsTrigger>
          <TabsTrigger value="credits" className="gap-1.5"><CreditCard className="w-4 h-4" /> Créditos</TabsTrigger>
          <TabsTrigger value="internal" className="gap-1.5"><Bot className="w-4 h-4" /> IAs Internas</TabsTrigger>
          <TabsTrigger value="squads" className="gap-1.5"><Users className="w-4 h-4" /> Squads</TabsTrigger>
          <TabsTrigger value="behavior" className="gap-1.5"><Clock className="w-4 h-4" /> Comportamento</TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5"><Zap className="w-4 h-4" /> Treinamento IA</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog"><ModelCatalogTab /></TabsContent>
        <TabsContent value="credits"><CreditsTab /></TabsContent>
        <TabsContent value="internal"><InternalAITab /></TabsContent>
        <TabsContent value="squads"><SquadsTab /></TabsContent>
        <TabsContent value="behavior"><BehaviorTab /></TabsContent>
        <TabsContent value="training"><TrainingModelTab /></TabsContent>
      </Tabs>

      <AIConfigWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
    </div>
  )
}
