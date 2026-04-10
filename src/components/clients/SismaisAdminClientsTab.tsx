import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, Loader2, Database, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'sonner'
import SismaisAdminClientSheet from './SismaisAdminClientSheet'
import SyncLogPanel from './SyncLogPanel'

type AggregatedClient = {
  documento: string
  nome: string
  email: string
  telefone: string
  mrr_total: number
  contratos_count: number
  contratos_ativos: number
  plataformas: string[]
  status_geral: string
  divida_total: number
}

export default function SismaisAdminClientsTab() {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<AggregatedClient | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25
  const debouncedSearch = useDebounce(search, 500)
  const queryClient = useQueryClient()

  const syncMutation = useMutation({
    mutationFn: async (action: 'full' | 'incremental') => {
      const { data, error } = await supabase.functions.invoke('sync-sismais-admin-clients', {
        body: { action }
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sismais-admin-clients'] })
      const result = data?.data
      if (result) {
        toast.success(`Sincronização concluída: ${result.synced} clientes processados (${result.errors?.length || 0} erros)`)
      } else {
        toast.success('Sincronização concluída')
      }
    },
    onError: (err) => {
      toast.error(`Erro na sincronização: ${(err as Error).message}`)
    },
  })

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['sismais-admin-clients', debouncedSearch, currentPage],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sismais-admin-proxy', {
        body: { action: 'clients', search: debouncedSearch || undefined, page: currentPage, page_size: pageSize }
      })
      if (error) throw error
      return data as { data: AggregatedClient[], total: number, page: number, page_size: number }
    },
    placeholderData: keepPreviousData,
  })

  const clients = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, documento, e-mail ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={syncMutation.isPending}
              className="gap-1.5 shrink-0"
            >
              {syncMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />
              }
              Sincronizar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => syncMutation.mutate('incremental')}>
              Incremental (novos e alterados)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => syncMutation.mutate('full')}>
              Completa (todos os clientes)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SyncLogPanel />

      {isLoading && !clients.length ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando clientes do Sismais Admin...
        </div>
      ) : error ? (
        <div className="text-center py-16 text-destructive">
          Erro ao carregar dados: {(error as Error).message}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <Database className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {debouncedSearch ? 'Nenhum cliente encontrado.' : 'Nenhum contrato encontrado no Sismais Admin.'}
          </p>
        </div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? 'opacity-60' : ''}`}>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Nome</TableHead>
                  <TableHead className="whitespace-nowrap">Documento</TableHead>
                  <TableHead className="whitespace-nowrap">Telefone</TableHead>
                  <TableHead className="whitespace-nowrap">E-mail</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right whitespace-nowrap">MRR</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Dívida</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Contratos</TableHead>
                  <TableHead className="whitespace-nowrap">Plataformas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client, i) => (
                  <TableRow
                    key={client.documento || i}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedClient(client)}
                  >
                    <TableCell className="font-medium max-w-[200px] truncate">{client.nome || '—'}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{client.documento || '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{client.telefone || '—'}</TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">{client.email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={client.status_geral === 'ativo' ? 'default' : 'secondary'}
                        className={client.status_geral === 'ativo'
                          ? 'bg-[#F0FDF4] text-[#16A34A] border border-[rgba(22,163,74,0.3)]'
                          : 'bg-[#FEF2F2] text-[#DC2626] border border-[rgba(220,38,38,0.3)]'
                        }
                      >
                        {client.status_geral === 'ativo' ? 'Ativo' : 'Cancelado'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {client.mrr_total > 0 ? formatCurrency(client.mrr_total) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {client.divida_total > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {formatCurrency(client.divida_total)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{client.contratos_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {client.plataformas.map(p => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Mostrando {startItem}–{endItem} de {total} clientes
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <span className="text-muted-foreground px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="gap-1"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <SismaisAdminClientSheet
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => { if (!open) setSelectedClient(null) }}
      />
    </div>
  )
}
