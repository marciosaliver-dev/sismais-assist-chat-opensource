import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Link2, Loader2, FileText, Receipt, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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
  divida_total?: number
}

interface Props {
  client: AggregatedClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SismaisAdminClientSheet({ client, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Check if client is already linked locally
  const { data: linkedClient } = useQuery({
    queryKey: ['helpdesk-client-by-doc', client?.documento],
    queryFn: async () => {
      if (!client?.documento) return null
      const { data } = await supabase
        .from('helpdesk_clients')
        .select('id, name')
        .eq('cnpj', client.documento)
        .maybeSingle()
      return data
    },
    enabled: !!client?.documento && open,
  })

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['sismais-admin-contracts', client?.documento],
    queryFn: async () => {
      if (!client?.documento) return []
      const { data, error } = await supabase.functions.invoke('sismais-admin-proxy', {
        body: { action: 'contracts', documento: client.documento }
      })
      if (error) throw error
      return data?.data || []
    },
    enabled: !!client?.documento && open,
  })

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['sismais-admin-invoices', client?.documento],
    queryFn: async () => {
      if (!client?.documento) return []
      const { data, error } = await supabase.functions.invoke('sismais-admin-proxy', {
        body: { action: 'invoices', documento: client.documento }
      })
      if (error) throw error
      return data?.data || []
    },
    enabled: !!client?.documento && open,
  })

  const today = new Date().toISOString().slice(0, 10)

  const overdueInvoices = invoices.filter((inv: any) => {
    const status = inv.status?.toLowerCase() || ''
    if (status === 'pago' || status === 'paid') return false
    return inv.data_vencimento && inv.data_vencimento <= today
  })

  const futureInvoices = invoices.filter((inv: any) => {
    const status = inv.status?.toLowerCase() || ''
    if (status === 'pago' || status === 'paid') return false
    return !inv.data_vencimento || inv.data_vencimento > today
  })

  const debtTotal = overdueInvoices.reduce((sum: number, inv: any) => {
    return sum + (parseFloat(inv.valor || inv.valor_liquido || '0') || 0)
  }, 0)

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!client) return

      const { data: existing } = await supabase
        .from('helpdesk_clients')
        .select('id')
        .eq('cnpj', client.documento)
        .maybeSingle()

      let clientId: string

      if (existing) {
        await supabase.from('helpdesk_clients').update({
          name: client.nome || existing.id,
          email: client.email || null,
          phone: client.telefone || null,
        }).eq('id', existing.id)
        clientId = existing.id
      } else {
        const { data: created, error } = await supabase.from('helpdesk_clients').insert({
          name: client.nome || 'Cliente Sismais Admin',
          cnpj: client.documento || null,
          email: client.email || null,
          phone: client.telefone || null,
          subscribed_product: 'outro',
          subscribed_product_custom: client.plataformas.join(', '),
        }).select('id').single()
        if (error) throw error
        clientId = created.id
      }

      for (const c of contracts) {
        const contractNum = c.id?.toString() || c.contrato_id?.toString() || ''
        const { data: existingContract } = await supabase
          .from('helpdesk_client_contracts')
          .select('id')
          .eq('client_id', clientId)
          .eq('contract_number', contractNum)
          .maybeSingle()

        const contractData = {
          client_id: clientId,
          contract_number: contractNum,
          plan_name: c.plano_nome || c.nome_produto || 'N/A',
          value: parseFloat(c.mrr || c.valor_assinatura || '0') || null,
          status: c.status?.toLowerCase() === 'ativo' || c.status?.toLowerCase() === 'active' ? 'active' : 'cancelled',
          start_date: c.data_inicio || null,
          end_date: c.data_cancelamento || null,
          notes: [c.plataforma, c.vendedor, c.segmento_cliente].filter(Boolean).join(' | '),
        }

        if (existingContract) {
          await supabase.from('helpdesk_client_contracts').update(contractData).eq('id', existingContract.id)
        } else {
          await supabase.from('helpdesk_client_contracts').insert(contractData)
        }
      }
    },
    onSuccess: () => {
      toast.success('Cliente vinculado ao SisCRM com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['helpdesk-clients'] })
      queryClient.invalidateQueries({ queryKey: ['helpdesk-client-by-doc', client?.documento] })
    },
    onError: (err: Error) => {
      toast.error(`Erro ao vincular: ${err.message}`)
    },
  })

  const formatCurrency = (val: any) => {
    const num = parseFloat(val)
    if (isNaN(num)) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
  }

  const formatDate = (d: any) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('pt-BR') } catch { return d }
  }

  if (!client) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[90vw] !sm:max-w-[600px] !max-w-[600px] overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <span className="truncate">{client.nome || 'Cliente'}</span>
            {linkedClient && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Vinculado
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-6 pr-2">
            {/* Debt Alert */}
            {debtTotal > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-destructive text-sm">Cliente com dívida</p>
                  <p className="text-destructive text-lg font-bold">{formatCurrency(debtTotal)}</p>
                  <p className="text-destructive/80 text-xs">{overdueInvoices.length} fatura(s) vencida(s)</p>
                </div>
              </div>
            )}

            {/* Client Info */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="min-w-0">
                  <span className="text-muted-foreground">Documento:</span>
                  <p className="font-mono truncate">{client.documento || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p>
                    <Badge variant={client.status_geral === 'ativo' ? 'default' : 'secondary'}
                      className={client.status_geral === 'ativo'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }
                    >
                      {client.status_geral === 'ativo' ? 'Ativo' : 'Cancelado'}
                    </Badge>
                  </p>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground">E-mail:</span>
                  <p className="truncate">{client.email || '—'}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground">Telefone:</span>
                  <p className="truncate">{client.telefone || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">MRR Total:</span>
                  <p className="font-semibold">{formatCurrency(client.mrr_total)}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground">Plataformas:</span>
                  <div className="flex gap-1 flex-wrap mt-0.5">
                    {client.plataformas.map(p => (
                      <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {linkedClient ? (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  navigate(`/clients/${linkedClient.id}`)
                }}
                className="w-full gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Ver ficha completa no SisCRM
              </Button>
            ) : (
              <Button
                onClick={() => linkMutation.mutate()}
                disabled={linkMutation.isPending}
                className="w-full gap-2"
              >
                {linkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Vincular ao SisCRM
              </Button>
            )}

            <Separator />

            {/* Contracts */}
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4" />
                Contratos ({contracts.length})
              </h3>
              {loadingContracts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum contrato encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {contracts.map((c: any, i: number) => {
                    const isActive = c.status?.toLowerCase() === 'ativo' || c.status?.toLowerCase() === 'active'
                    return (
                      <div key={i} className="border rounded-lg p-3 text-sm space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{c.plano_nome || c.nome_produto || 'Contrato'}</span>
                          <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {c.status || '—'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-muted-foreground text-xs">
                          <span className="truncate">MRR: {formatCurrency(c.mrr || c.valor_assinatura)}</span>
                          <span className="truncate">Início: {formatDate(c.data_inicio)}</span>
                          <span className="truncate">Plataforma: {c.plataforma || '—'}</span>
                          <span className="truncate">Vendedor: {c.vendedor || '—'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Invoices */}
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4" />
                Faturas ({invoices.length})
              </h3>
              {loadingInvoices ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
              ) : (
                <div className="space-y-2">
                  {overdueInvoices.length > 0 && (
                    <p className="text-xs font-semibold text-destructive mb-1">Vencidas</p>
                  )}
                  {overdueInvoices.map((inv: any, i: number) => (
                    <div key={`overdue-${i}`} className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 text-sm flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <span className="font-medium text-destructive">{formatCurrency(inv.valor || inv.valor_liquido)}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Venc: {formatDate(inv.data_vencimento)}
                        </span>
                      </div>
                      <Badge variant="destructive" className="text-xs shrink-0">
                        {inv.status || 'Vencida'}
                      </Badge>
                    </div>
                  ))}
                  {futureInvoices.length > 0 && (
                    <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-1 mt-3">A Vencer</p>
                  )}
                  {futureInvoices.map((inv: any, i: number) => (
                    <div key={`future-${i}`} className="border border-yellow-300/50 bg-yellow-50/50 dark:border-yellow-700/30 dark:bg-yellow-900/10 rounded-lg p-3 text-sm flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <span className="font-medium">{formatCurrency(inv.valor || inv.valor_liquido)}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Venc: {formatDate(inv.data_vencimento)}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 border-yellow-400 text-yellow-700 dark:text-yellow-300">
                        {inv.status || 'A Vencer'}
                      </Badge>
                    </div>
                  ))}
                  {invoices.filter((inv: any) => {
                    const s = inv.status?.toLowerCase() || ''
                    return s === 'pago' || s === 'paid'
                  }).slice(0, 10).map((inv: any, i: number) => (
                    <div key={`paid-${i}`} className="border rounded-lg p-3 text-sm flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <span className="font-medium">{formatCurrency(inv.valor || inv.valor_liquido)}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Venc: {formatDate(inv.data_vencimento)}
                        </span>
                      </div>
                      <Badge variant="default" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs shrink-0">
                        {inv.status || 'Pago'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
