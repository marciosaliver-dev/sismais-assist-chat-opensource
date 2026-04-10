import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  Filter, UserPlus, ExternalLink, Users
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useClientUnifiedSearch, type UnifiedSearchResult } from '@/hooks/useClientUnifiedSearch'
import { supabase } from '@/integrations/supabase/client'
import { formatCNPJ, formatDateBR, stripDocument } from '@/lib/utils'
import { ClientKpiStrip } from './ClientKpiStrip'
import { ClientColumnToggle, useVisibleColumns, EXTRA_COLUMNS } from './ClientColumnToggle'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

const PAGE_SIZE = 50

const SEGMENTOS = ['Varejo', 'Serviços', 'Indústria', 'Alimentação', 'Tecnologia', 'Saúde', 'Educação']

const DATE_CHIPS = [
  { value: '',   label: 'Qualquer data' },
  { value: '7',  label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
]

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  local: { label: 'Local', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  gl: { label: 'GL', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  contact: { label: 'Contato', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
}

const GL_STATUS_BADGE: Record<string, string> = {
  Ativo: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Bloqueado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'Trial 7 Dias': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Gratuita: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-[#10293F] text-[#45E5E5]',
    'bg-[#45E5E5] text-[#10293F]',
    'bg-emerald-600 text-white',
    'bg-blue-600 text-white',
    'bg-purple-600 text-white',
    'bg-amber-600 text-white',
  ]
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export function ClientUnifiedSearch() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSegmentos, setFilterSegmentos] = useState<string[]>([])
  const [filterDateRange, setFilterDateRange] = useState('')
  const { visible: visibleColumns, toggle: toggleColumn } = useVisibleColumns()
  const [importingId, setImportingId] = useState<string | null>(null)

  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>()

  const filterSegmento = filterSegmentos.join(',')

  const [currentPage, setCurrentPage] = useState(1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const { data: searchData, isLoading: loading } = useClientUnifiedSearch({
    query: debouncedSearch,
    limit: PAGE_SIZE,
    offset,
    sortBy,
    sortDir,
    filterStatus,
    filterSegmento,
    filterDateRange,
  })
  const displayRows = searchData?.results ?? []
  const kpiCounts = searchData?.kpiCounts ?? { total: 0, ativos: 0, bloqueados: 0, trial: 0, inativos: 0 }
  const pagination = searchData?.pagination ?? { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false }
  const totalPages = Math.max(1, Math.ceil(pagination.total / PAGE_SIZE))

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
  }

  function renderGlStatus(result: UnifiedSearchResult) {
    const statuses = [
      result.gl_status_mais_simples && { system: 'MS', status: result.gl_status_mais_simples },
      result.gl_status_maxpro && { system: 'MP', status: result.gl_status_maxpro },
    ].filter(Boolean)

    if (statuses.length === 0) return <span className="text-xs text-muted-foreground">—</span>

    return (
      <div className="flex gap-1">
        {statuses.map((s: any) => (
          <Badge key={s.system} variant="secondary" className={`text-[10px] ${GL_STATUS_BADGE[s.status] || 'bg-yellow-100 text-yellow-700'}`}>
            {s.system}: {s.status}
          </Badge>
        ))}
      </div>
    )
  }

  // Importar cliente GL para helpdesk_clients
  const handleQuickImport = async (row: UnifiedSearchResult, e: React.MouseEvent) => {
    e.stopPropagation()
    if (importingId) return
    setImportingId(row.id)
    try {
      const { data, error } = await supabase.from('helpdesk_clients').insert({
        name: row.name || 'Cliente GL',
        company_name: row.company || null,
        cnpj: row.cnpj || null,
        email: row.email || null,
        phone: row.phone || null,
        gl_status_mais_simples: row.gl_status_mais_simples || null,
        gl_status_maxpro: row.gl_status_maxpro || null,
        license_status: row.license_status === 'Ativo' ? 'active' : row.license_status === 'Bloqueado' ? 'suspended' : null,
        subscribed_product: 'outro',
      }).select('id').single()
      if (error) throw error
      toast.success('Cliente importado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['client-unified-search'] })
      navigate(`/clients/${data.id}`)
    } catch (err: any) {
      toast.error(`Erro ao importar: ${err.message}`)
    } finally {
      setImportingId(null)
    }
  }

  const safePage = Math.min(currentPage, totalPages)

  const handleSearch = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
    if (timer) clearTimeout(timer)
    const normalized = stripDocument(value).length >= 11 ? stripDocument(value) : value
    setTimer(setTimeout(() => setDebouncedSearch(normalized), 300))
  }

  return (
    <div className="flex flex-col h-full">
      {/* KPI Strip */}
      <div className="px-4 pt-4">
        <ClientKpiStrip counts={kpiCounts} activeFilter={filterStatus} onFilterChange={(s) => { setFilterStatus(s); setCurrentPage(1) }} />
      </div>

      {/* Barra de filtros */}
      <div className="px-4 pb-3 pt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar por nome, CNPJ, telefone, email..."
              className="pl-9"
              autoFocus
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
                <Filter className="w-3.5 h-3.5" />
                Segmento
                {filterSegmentos.length > 0 && (
                  <span className="bg-[#45E5E5] text-[#10293F] rounded-full px-1.5 text-[10px] font-bold">
                    {filterSegmentos.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="start">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[#10293F] uppercase tracking-wide">Segmento</p>
                {filterSegmentos.length > 0 && (
                  <button
                    className="text-[10px] text-[#45E5E5] hover:underline font-medium"
                    onClick={() => { setFilterSegmentos([]); setCurrentPage(1) }}
                  >
                    Limpar
                  </button>
                )}
              </div>
              {SEGMENTOS.map(seg => (
                <label key={seg} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1">
                  <input
                    type="checkbox"
                    checked={filterSegmentos.includes(seg)}
                    onChange={() => {
                      setFilterSegmentos(prev =>
                        prev.includes(seg) ? prev.filter(s => s !== seg) : [...prev, seg]
                      )
                      setCurrentPage(1)
                    }}
                    className="accent-[#45E5E5]"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{seg}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>

          <ClientColumnToggle visible={visibleColumns} onToggle={toggleColumn} />
        </div>

        {/* Chips de data */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium mr-1">Cadastro:</span>
          {DATE_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => { setFilterDateRange(chip.value); setCurrentPage(1) }}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                filterDateRange === chip.value
                  ? 'bg-[#10293F] text-white border-[#10293F]'
                  : 'bg-white dark:bg-gray-800 text-[#444] dark:text-gray-300 border-[#E5E5E5] dark:border-gray-600 hover:border-[#45E5E5] hover:text-[#10293F] dark:hover:text-[#45E5E5]',
              ].join(' ')}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 min-h-0 px-4 pb-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-muted-foreground">Carregando clientes...</p>
          </div>
        ) : allRows.length === 0 ? (
          /* Empty state melhorado */
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-[#E8F9F9] flex items-center justify-center">
              <Users className="w-8 h-8 text-[#10293F]" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground text-base">Nenhum cliente encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {debouncedSearch
                  ? `Nenhum resultado para "${debouncedSearch}". Tente buscar por outro nome, CNPJ ou telefone.`
                  : 'Cadastre seu primeiro cliente ou sincronize com o Sismais GL para importar a base existente.'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-auto h-full">
            <table className="border-collapse text-sm" style={{ minWidth: 'max-content', width: '100%' }}>
              <thead>
                <tr style={{ background: '#10293F' }}>
                  <th
                    className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/80 cursor-pointer select-none whitespace-nowrap sticky left-0 z-20"
                    style={{ background: '#10293F', boxShadow: '4px 0 8px -2px rgba(16,41,63,0.18)' }}
                    onClick={() => handleSort('name')}
                  >
                    <span className="flex items-center gap-1">Nome / Empresa <SortIcon col="name" /></span>
                  </th>
                  {[
                    { col: 'cnpj',          label: 'CNPJ/CPF' },
                    { col: 'segmento',      label: 'Segmento' },
                    { col: 'data_cadastro', label: 'Cadastro' },
                    { col: 'dias_de_uso',   label: 'Dias Uso' },
                    { col: 'ultimo_login',  label: 'Último Login' },
                    { col: 'qtd_logins',    label: 'Logins' },
                    { col: 'gl_status',     label: 'GL Status' },
                    { col: 'mrr_total',     label: 'MRR' },
                    { col: 'source',        label: 'Origem' },
                  ].map(({ col, label }) => (
                    <th
                      key={col}
                      className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/80 cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort(col)}
                    >
                      <span className="flex items-center gap-1">{label} <SortIcon col={col} /></span>
                    </th>
                  ))}
                  {/* Coluna de ações para GL não vinculados */}
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/80 whitespace-nowrap">
                    Ação
                  </th>
                  {EXTRA_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(({ key, label }) => (
                    <th
                      key={key}
                      className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/80 whitespace-nowrap cursor-pointer select-none"
                      onClick={() => handleSort(key)}
                    >
                      <span className="flex items-center gap-1">{label} <SortIcon col={key} /></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map(row => (
                  <tr
                    key={row.id}
                    className={[
                      'border-b border-border transition-colors',
                      row.is_linked
                        ? 'hover:bg-muted/50 cursor-pointer'
                        : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-default',
                    ].join(' ')}
                    onClick={() => row.is_linked && navigate(`/clients/${row.id}`)}
                  >
                    {/* Coluna Nome com Avatar */}
                    <td
                      className="px-3 py-2 whitespace-nowrap sticky left-0 z-10 border-r border-border"
                      style={{ background: 'var(--background, #ffffff)', boxShadow: '4px 0 8px -2px rgba(16,41,63,0.10)' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className={`text-[11px] font-bold ${getAvatarColor(row.name || '')}`}>
                            {getInitials(row.name || '?')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate max-w-[200px]">{row.name}</div>
                          {row.company && <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{row.company}</div>}
                        </div>
                        {!row.is_linked && (
                          <Badge variant="outline" className="text-[9px] font-bold border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400 shrink-0">
                            GL
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-primary whitespace-nowrap font-mono">{formatCNPJ(row.cnpj)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{row.segmento ?? '—'}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{row.data_cadastro ? formatDateBR(row.data_cadastro) : '—'}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-center">{(row as any).dias_de_uso ?? '—'}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{row.ultimo_login ? formatDateBR(row.ultimo_login) : '—'}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-center">{row.qtd_logins ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{renderGlStatus(row)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {row.mrr_total ? `R$ ${Number(row.mrr_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant="secondary" className={`text-[10px] ${SOURCE_BADGE[row.source]?.className || ''}`}>
                        {SOURCE_BADGE[row.source]?.label || row.source}
                      </Badge>
                    </td>
                    {/* Coluna de ações */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.is_linked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); navigate(`/clients/${row.id}`) }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 border-[#45E5E5] text-[#10293F] hover:bg-[#E8F9F9]"
                          onClick={(e) => handleQuickImport(row, e)}
                          disabled={importingId === row.id}
                        >
                          {importingId === row.id ? (
                            <Spinner className="w-3 h-3" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          Importar
                        </Button>
                      )}
                    </td>
                    {/* Extra columns */}
                    {visibleColumns.includes('cidade_uf') && (
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {[(row as any).cidade, (row as any).uf].filter(Boolean).join('/') || '—'}
                      </td>
                    )}
                    {visibleColumns.includes('sistema_utilizado') && (
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{(row as any).sistema_utilizado ?? '—'}</td>
                    )}
                    {visibleColumns.includes('dias_instalacao') && (
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-center">{(row as any).dias_instalacao ?? '—'}</td>
                    )}
                    {visibleColumns.includes('dias_assinatura') && (
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-center">{(row as any).dias_assinatura ?? '—'}</td>
                    )}
                    {visibleColumns.includes('ltv_dias') && (
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-center">{(row as any).ltv_dias ?? '—'}</td>
                    )}
                    {visibleColumns.includes('ultima_verificacao') && (
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {(row as any).ultima_verificacao ? formatDateBR((row as any).ultima_verificacao) : '—'}
                      </td>
                    )}
                    {visibleColumns.includes('dt_inicio_assinatura') && (
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {(row as any).dt_inicio_assinatura ? formatDateBR((row as any).dt_inicio_assinatura) : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {!loading && allRows.length > PAGE_SIZE && (
        <div className="px-4 py-3 flex items-center justify-between border-t border-border">
          <span className="text-xs text-muted-foreground">
            {allRows.length} clientes · página {safePage} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              disabled={safePage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const half = 3
              let start = Math.max(1, safePage - half)
              const end = Math.min(totalPages, start + 6)
              start = Math.max(1, end - 6)
              const page = start + i
              return page <= totalPages ? (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={[
                    'h-7 min-w-[28px] px-2 rounded text-xs font-medium transition-all border',
                    page === safePage
                      ? 'bg-[#10293F] text-white border-[#10293F]'
                      : 'bg-white dark:bg-gray-800 text-[#444] dark:text-gray-300 border-[#E5E5E5] dark:border-gray-600 hover:border-[#45E5E5]',
                  ].join(' ')}
                >
                  {page}
                </button>
              ) : null
            })}
            <Button
              variant="outline" size="sm"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
