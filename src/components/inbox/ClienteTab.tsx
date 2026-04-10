import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Search, Loader2, Building2, Mail, Phone, X,
  Users, FileText, Package, Wifi,
  Database, RefreshCw, ShieldCheck, AlertTriangle,
  Clock, DollarSign, CheckCircle, XCircle, Plus
} from 'lucide-react'
import { cn, stripBrazilDDI, stripDocument } from '@/lib/utils'
import { ClienteContextCard } from '@/components/inbox/ClienteContextCard'
import { ClientFullModal } from '@/components/clients/ClientFullModal'
import { ClientGLStatusBanner } from '@/components/inbox/ClientGLStatusBanner'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

const productLabels: Record<string, string> = {
  mais_simples: 'Mais Simples',
  sismais_erp: 'Sismais ERP',
  sismais_pdv: 'Sismais PDV',
  sismais_os: 'Sismais OS',
  outro: 'Outro',
}

interface HelpdeskClient {
  id: string
  name: string
  company_name: string | null
  email: string | null
  phone: string | null
  cnpj: string | null
  cpf: string | null
  external_id?: string | null
  subscribed_product: string | null
  subscribed_product_custom: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
  // Financial fields (populated via Sismais Admin sync, stored as `as any` updates)
  license_status?: string | null
  debt_total?: number | null
  pending_invoices_count?: number | null
  mrr_total?: number | null
  active_contracts_count?: number | null
  churn_risk?: boolean | null
  last_synced_at?: string | null
  // GL license fields
  support_eligible?: boolean | null
  support_block_reason?: string | null
  gl_status_mais_simples?: string | null
  gl_status_maxpro?: string | null
  gl_license_id?: number | null
  gl_source_system?: string | null
}

interface HelpdeskContact {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  is_primary: boolean | null
}

interface HelpdeskContract {
  id: string
  contract_number: string | null
  plan_name: string | null
  status: string | null
  value: number | null
}

interface SismaisAdminClient {
  documento: string
  nome: string
  email: string
  telefone: string
  mrr_total: number
  contratos_count: number
  contratos_ativos: number
  plataformas: string[]
  status_geral: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-[6px] rounded-full bg-primary" />
        <span className="text-xs font-bold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  )
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </div>
  )
}

export function ClienteTab({ conversationId, conversationName, conversationPhone }: { conversationId: string; conversationName?: string; conversationPhone?: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState(conversationPhone ? stripBrazilDDI(conversationPhone) : '')
  const [contracts, setContracts] = useState<HelpdeskContract[]>([])
  const [contractsLoaded, setContractsLoaded] = useState(false)
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [quickFormData, setQuickFormData] = useState({ name: '', phone: '', email: '', cnpj: '' })
  const [savingQuickForm, setSavingQuickForm] = useState(false)
  const [contactInstances, setContactInstances] = useState<{ instanceId: string; instanceName: string; contactName: string | null }[]>([])
  const [loadingInstances, setLoadingInstances] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)

  // Sismais Admin states
  const [sismaisResults, setSismaisResults] = useState<SismaisAdminClient[]>([])
  const [searchingSismais, setSearchingSismais] = useState(false)
  const [linkingSismais, setLinkingSismais] = useState(false)
  const [syncingSismais, setSyncingSismais] = useState(false)
  const [companies, setCompanies] = useState<Array<{id: string, cnpj: string, company_name: string | null, is_primary: boolean}>>([])
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [savingCompany, setSavingCompany] = useState(false)

  const debouncedSearch = useDebounce(searchQuery, 400)
  const sismaisSearchedRef = useRef<string>('')


  // Fetch conversation to get helpdesk_client_id
  const { data: conversation } = useQuery({
    queryKey: ['conv-helpdesk', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, helpdesk_client_id, customer_name, customer_phone')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const clientId = (conversation as any)?.helpdesk_client_id as string | null

  // Auto-link: when a conversation opens, check if phone matches a helpdesk_client
  const autoLinkAttemptedRef = useRef(false)
  useEffect(() => {
    if (!conversationId || clientId || autoLinkAttemptedRef.current) return
    if (!conversationPhone) return
    autoLinkAttemptedRef.current = true

    const phoneDigits = conversationPhone.replace(/\D/g, '')
    const phoneSuffix = phoneDigits.slice(-8)
    if (phoneSuffix.length < 8) return

    supabase
      .from('helpdesk_clients')
      .select('id')
      .ilike('phone', `%${phoneSuffix}%`)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          supabase
            .from('ai_conversations')
            .update({ helpdesk_client_id: data.id } as any)
            .eq('id', conversationId)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['conv-helpdesk', conversationId] })
            })
        }
      })
  }, [conversationId, clientId, conversationPhone, queryClient])

  // Reset auto-link ref when conversation changes
  useEffect(() => {
    autoLinkAttemptedRef.current = false
  }, [conversationId])

  // Auto-search Sismais Admin when debounced search changes (with fallback to local)
  useEffect(() => {
    if (debouncedSearch.length >= 2 && !clientId && sismaisSearchedRef.current !== debouncedSearch) {
      sismaisSearchedRef.current = debouncedSearch
      setSearchingSismais(true)
      supabase.functions.invoke('sismais-admin-proxy', {
        body: { action: 'clients', search: debouncedSearch }
      }).then(({ data, error }) => {
        if (!error) setSismaisResults((data?.data || []) as SismaisAdminClient[])
      }).catch(() => {
        // Proxy failed — results will come from the local helpdesk_clients query (searchResults)
      }).finally(() => setSearchingSismais(false))
    }
  }, [debouncedSearch, clientId])

  // Fetch linked client
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['helpdesk-client', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('helpdesk_clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle()
      return data as unknown as HelpdeskClient | null
    },
    enabled: !!clientId,
  })

  // Fetch companies (CNPJs) for linked client
  useEffect(() => {
    if (!client?.id) { setCompanies([]); return }
    supabase
      .from('helpdesk_client_companies')
      .select('id, cnpj, company_name, is_primary')
      .eq('client_id', client.id)
      .order('is_primary', { ascending: false })
      .then(({ data }) => setCompanies(data || []))
  }, [client?.id])

  // Sync on-demand: atualizar dados GL quando cliente é vinculado
  const glSyncAttemptedRef = useRef<string | null>(null)
  useEffect(() => {
    const doc = client?.cnpj || client?.cpf
    if (!doc || glSyncAttemptedRef.current === doc) return
    glSyncAttemptedRef.current = doc

    supabase.functions.invoke('gl-sync-single', {
      body: { cpf_cnpj: doc }
    }).then(({ data }) => {
      if (data?.found) {
        queryClient.invalidateQueries({ queryKey: ['gl-licenses'] })
        queryClient.invalidateQueries({ queryKey: ['client-gl-data'] })
      }
    }).catch(() => {
      // Silencioso — dados em cache continuam disponíveis
    })
  }, [client?.cnpj, client?.cpf, queryClient])

  // Fetch contacts for linked client (modelo novo: contacts + client_contact_links via view)
  const { data: contacts = [] } = useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data } = await supabase
        .from('v_client_contacts' as any)
        .select('*')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false })
      return (data || []) as HelpdeskContact[]
    },
    enabled: !!clientId,
  })

  // Search helpdesk_clients
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['helpdesk-search', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return []
      const normalizedSearch = stripDocument(debouncedSearch)
      const term = `%${normalizedSearch}%`
      const { data } = await supabase
        .from('helpdesk_clients')
        .select('id, name, company_name, email, phone, cnpj, subscribed_product')
        .or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term},cnpj.ilike.${term},company_name.ilike.${term}`)
        .limit(8)
      return (data || []) as (HelpdeskClient & { subscribed_product: string })[]
    },
    enabled: debouncedSearch.length >= 2 && !clientId,
  })

  // Reset contracts when conversation changes
  useEffect(() => {
    setContracts([])
    setContractsLoaded(false)
  }, [conversationId])

  // Reset sismais results when search changes
  useEffect(() => {
    setSismaisResults([])
  }, [debouncedSearch])

  const handleLink = async (selectedClientId: string) => {
    setLinking(true)
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ helpdesk_client_id: selectedClientId } as any)
        .eq('id', conversationId)
      if (error) throw error
      toast.success('Cliente vinculado!')
      setSearchQuery('')
      queryClient.invalidateQueries({ queryKey: ['conv-helpdesk', conversationId] })
    } catch {
      toast.error('Erro ao vincular cliente')
    } finally {
      setLinking(false)
    }
  }

  const handleUnlink = async () => {
    setUnlinking(true)
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ helpdesk_client_id: null } as any)
        .eq('id', conversationId)
      if (error) throw error
      toast.success('Cliente desvinculado')
      setContracts([])
      setContractsLoaded(false)
      queryClient.invalidateQueries({ queryKey: ['conv-helpdesk', conversationId] })
    } catch {
      toast.error('Erro ao desvincular')
    } finally {
      setUnlinking(false)
    }
  }

  const handleLoadContracts = async () => {
    if (!clientId) return
    setLoadingContracts(true)
    try {
      const { data, error } = await supabase
        .from('helpdesk_client_contracts')
        .select('id, contract_number, plan_name, status, value')
        .eq('client_id', clientId)
      if (error) throw error
      setContracts((data || []) as HelpdeskContract[])
      setContractsLoaded(true)
      if (!data || data.length === 0) toast.info('Nenhum contrato encontrado')
    } catch {
      toast.error('Erro ao buscar contratos')
    } finally {
      setLoadingContracts(false)
    }
  }

  const fetchContactInstances = useCallback(async () => {
    if (!conversationPhone) return
    setLoadingInstances(true)
    try {
      const phoneDigits = conversationPhone.replace(/\D/g, '')
      const phoneLike = `%${phoneDigits.slice(-8)}%`
      const { data: chats } = await supabase
        .from('uazapi_chats')
        .select('instance_id, contact_name, contact_phone')
        .ilike('contact_phone', phoneLike)
      if (chats && chats.length > 0) {
        const instanceIds = [...new Set(chats.map(c => c.instance_id))]
        const { data: instances } = await (supabase as any)
          .from('uazapi_instances_public')
          .select('id, instance_name')
          .in('id', instanceIds)
        const instanceMap = new Map((instances || []).map(i => [i.id, i.instance_name]))
        const result = chats.map(c => ({
          instanceId: c.instance_id,
          instanceName: (instanceMap.get(c.instance_id) || 'Instância') as string,
          contactName: c.contact_name,
        }))
        const unique = result.filter((v, i, a) => a.findIndex(t => t.instanceId === v.instanceId) === i)
        setContactInstances(unique)
        const whatsappName = chats.find(c => c.contact_name)?.contact_name
        if (whatsappName) {
          setQuickFormData(prev => ({ ...prev, name: prev.name || whatsappName }))
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingInstances(false)
    }
  }, [conversationPhone])

  const handleQuickRegister = async () => {
    if (!quickFormData.name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSavingQuickForm(true)
    try {
      const { data: newClient, error } = await supabase
        .from('helpdesk_clients')
        .insert({
          name: quickFormData.name.trim(),
          phone: quickFormData.phone.trim() || null,
          email: quickFormData.email.trim() || null,
          cnpj: quickFormData.cnpj.trim() || null,
        })
        .select('id')
        .single()
      if (error) throw error
      // Criar contato no modelo novo (contacts + client_contact_links)
      const { data: newContact } = await supabase.from('contacts' as any)
        .insert({
          name: quickFormData.name.trim(),
          phone: quickFormData.phone.trim() || null,
          email: quickFormData.email.trim() || null,
        })
        .select('id')
        .single()
      if (newContact) {
        await supabase.from('client_contact_links' as any).insert({
          client_id: newClient.id,
          contact_id: newContact.id,
          is_primary: true,
          role: null,
        })
      }
      const { error: linkError } = await supabase
        .from('ai_conversations')
        .update({ helpdesk_client_id: newClient.id } as any)
        .eq('id', conversationId)
      if (linkError) throw linkError
      toast.success('Cliente cadastrado e vinculado!')
      setShowQuickForm(false)
      setSearchQuery('')
      setQuickFormData({ name: '', phone: '', email: '', cnpj: '' })
      setContactInstances([])
      queryClient.invalidateQueries({ queryKey: ['conv-helpdesk', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
    } catch {
      toast.error('Erro ao cadastrar cliente')
    } finally {
      setSavingQuickForm(false)
    }
  }

  // ── Sismais Admin: search ──
  const handleSearchSismais = async () => {
    if (debouncedSearch.length < 2) return
    setSearchingSismais(true)
    try {
      const { data, error } = await supabase.functions.invoke('sismais-admin-proxy', {
        body: { action: 'clients', search: debouncedSearch }
      })
      if (error) throw error
      setSismaisResults((data?.data || []) as SismaisAdminClient[])
      if (!data?.data?.length) toast.info('Nenhum cliente encontrado no Sismais Admin')
    } catch {
      toast.error('Erro ao buscar no Sismais Admin')
    } finally {
      setSearchingSismais(false)
    }
  }

  // ── Sismais Admin: link client ──
  const handleLinkSismaisClient = async (sClient: SismaisAdminClient) => {
    setLinkingSismais(true)
    try {
      // 1. Check if exists locally by document
      const { data: existing } = await supabase
        .from('helpdesk_clients')
        .select('id')
        .eq('cnpj', sClient.documento)
        .maybeSingle()

      let localClientId: string

      if (existing) {
        await supabase.from('helpdesk_clients').update({
          name: sClient.nome || existing.id,
          email: sClient.email || null,
          phone: sClient.telefone || null,
        }).eq('id', existing.id)
        localClientId = existing.id
      } else {
        const { data: created, error } = await supabase.from('helpdesk_clients').insert({
          name: sClient.nome || 'Cliente Sismais Admin',
          cnpj: sClient.documento || null,
          email: sClient.email || null,
          phone: sClient.telefone || null,
          subscribed_product: 'outro',
          subscribed_product_custom: sClient.plataformas.join(', '),
        }).select('id').single()
        if (error) throw error
        localClientId = created.id
      }

      // 2. Import contracts (only if documento is available)
      let remoteContracts: any[] = []
      if (sClient.documento) {
        const { data: contractsData } = await supabase.functions.invoke('sismais-admin-proxy', {
          body: { action: 'contracts', documento: sClient.documento }
        })
        remoteContracts = contractsData?.data || []
      }

      for (const c of remoteContracts) {
        const contractNum = c.id?.toString() || c.contrato_id?.toString() || ''
        const { data: existingContract } = await supabase
          .from('helpdesk_client_contracts')
          .select('id')
          .eq('client_id', localClientId)
          .eq('contract_number', contractNum)
          .maybeSingle()

        const contractData = {
          client_id: localClientId,
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

      // 3. Link to conversation
      const { error: linkErr } = await supabase
        .from('ai_conversations')
        .update({ helpdesk_client_id: localClientId } as any)
        .eq('id', conversationId)
      if (linkErr) throw linkErr

      toast.success('Cliente do Sismais Admin vinculado!')
      setSearchQuery('')
      setSismaisResults([])
      queryClient.invalidateQueries({ queryKey: ['conv-helpdesk', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
    } catch (err: any) {
      toast.error(`Erro ao vincular: ${err.message}`)
    } finally {
      setLinkingSismais(false)
    }
  }

  // ── Sismais Admin: sync contracts + financial data for linked client ──
  const handleSyncSismais = async () => {
    if (!clientId || !client?.cnpj) {
      toast.error('Cliente não possui documento/CNPJ para sincronizar')
      return
    }
    setSyncingSismais(true)
    try {
      // 1. Sync contracts
      const { data: contractsData } = await supabase.functions.invoke('sismais-admin-proxy', {
        body: { action: 'contracts', documento: client.cnpj }
      })
      const remoteContracts = contractsData?.data || []

      let mrrTotal = 0
      let activeCount = 0

      for (const c of remoteContracts) {
        const contractNum = c.id?.toString() || c.contrato_id?.toString() || ''
        const isActive = c.status?.toLowerCase() === 'ativo' || c.status?.toLowerCase() === 'active'
        if (isActive) {
          mrrTotal += parseFloat(c.mrr || c.valor_assinatura || '0') || 0
          activeCount++
        }

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
          status: isActive ? 'active' : 'cancelled',
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

      // 2. Fetch invoice/debt data
      const { data: invoicesData } = await supabase.functions.invoke('sismais-admin-proxy', {
        body: { action: 'invoices', documento: client.cnpj }
      })

      const invoices = invoicesData?.data || []
      const today = new Date().toISOString().split('T')[0]
      let debtTotal = 0
      let pendingCount = 0

      for (const inv of invoices) {
        const isPaid = inv.status?.toLowerCase() === 'pago' || inv.status?.toLowerCase() === 'paid'
        if (!isPaid && inv.data_vencimento && inv.data_vencimento <= today) {
          debtTotal += parseFloat(inv.valor || inv.valor_liquido || '0') || 0
          pendingCount++
        }
      }

      // 3. Update client with financial data
      await supabase.from('helpdesk_clients').update({
        license_status: activeCount > 0 ? 'active' : 'cancelled',
        mrr_total: Math.round(mrrTotal * 100) / 100,
        active_contracts_count: activeCount,
        debt_total: Math.round(debtTotal * 100) / 100,
        pending_invoices_count: pendingCount,
        churn_risk: debtTotal > 0,
        last_synced_at: new Date().toISOString(),
      } as any).eq('id', clientId)

      toast.success(`${remoteContracts.length} contratos sincronizados!`)
      // Reload contracts and client data
      setContractsLoaded(false)
      handleLoadContracts()
      queryClient.invalidateQueries({ queryKey: ['helpdesk-client', clientId] })
    } catch {
      toast.error('Erro ao sincronizar contratos')
    } finally {
      setSyncingSismais(false)
    }
  }

  const addCompany = async () => {
    if (!client?.id || !newCompanyCnpj.trim()) return
    setSavingCompany(true)
    const { data, error } = await supabase
      .from('helpdesk_client_companies')
      .insert({
        client_id: client.id,
        cnpj: newCompanyCnpj.trim(),
        company_name: newCompanyName.trim() || null,
        is_primary: companies.length === 0,
      })
      .select()
      .single()
    if (error || !data) { toast.error('Erro ao adicionar empresa'); setSavingCompany(false); return }
    setSavingCompany(false)
    setCompanies(prev => [...prev, data])
    setNewCompanyCnpj('')
    setNewCompanyName('')
    setShowAddCompany(false)
    toast.success('Empresa adicionada')
  }

  const removeCompany = async (companyId: string) => {
    const { error } = await supabase
      .from('helpdesk_client_companies')
      .delete()
      .eq('id', companyId)
    if (error) { toast.error('Erro ao remover'); return }
    setCompanies(prev => prev.filter(c => c.id !== companyId))
    toast.success('Empresa removida')
  }

  if (!conversationId) {
    return <div className="p-6 text-center text-muted-foreground text-sm">Selecione uma conversa</div>
  }

  // ── CLIENT LINKED ──
  if (clientId && client) {
    const productLabel = client.subscribed_product
      ? productLabels[client.subscribed_product] || client.subscribed_product_custom || client.subscribed_product
      : null

    return (
      <div className="p-4 space-y-4" key="cliente-linked">
        {/* Client Card */}
        <Section title="Cliente Vinculado">
          <div className="bg-secondary rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {client.name?.[0]?.toUpperCase() || 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
                {client.company_name && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />{client.company_name}
                  </p>
                )}
              </div>
            </div>

            {productLabel && (
              <Badge className="text-[11px] font-bold bg-[#10293F] text-white border-[#10293F] px-2.5 py-0.5">
                <Package className="w-3.5 h-3.5 mr-1" />
                {productLabel}
              </Badge>
            )}

            <div className="space-y-1.5">
              {client.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono">{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
              {client.cnpj && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono">{client.cnpj}</span>
                </div>
              )}
            </div>

            {/* Empresas / CNPJs */}
            {client && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Empresas</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => setShowAddCompany(true)}
                  >
                    <Plus className="w-3 h-3 mr-0.5" /> Adicionar
                  </Button>
                </div>
                {companies.length === 0 && !showAddCompany && (
                  <p className="text-xs text-muted-foreground italic">Nenhuma empresa vinculada</p>
                )}
                {companies.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-2 py-1.5">
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-[11px]">{c.cnpj}</span>
                      {c.company_name && <p className="text-[10px] text-muted-foreground truncate">{c.company_name}</p>}
                    </div>
                    {c.is_primary && <Badge variant="outline" className="text-[9px] h-4 px-1">Principal</Badge>}
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeCompany(c.id)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {showAddCompany && (
                  <div className="space-y-1.5 p-2 border rounded-lg">
                    <Input
                      placeholder="CNPJ"
                      value={newCompanyCnpj}
                      onChange={e => setNewCompanyCnpj(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <Input
                      placeholder="Nome da empresa (opcional)"
                      value={newCompanyName}
                      onChange={e => setNewCompanyName(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-6 text-[10px] flex-1" onClick={addCompany} disabled={savingCompany || !newCompanyCnpj.trim()}>
                        {savingCompany ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setShowAddCompany(false); setNewCompanyCnpj(''); setNewCompanyName('') }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs rounded-xl"
                onClick={() => setClientModalOpen(true)}
              >
                <Users className="w-3.5 h-3.5 mr-1" />
                Ver Perfil Completo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs rounded-xl text-destructive hover:text-destructive"
                onClick={handleUnlink}
                disabled={unlinking}
              >
                {unlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Desvincular
              </Button>
            </div>
          </div>
        </Section>

        {/* GL License Status */}
        <ClientGLStatusBanner phone={client.phone || conversationPhone || null} cnpj={client.cnpj} />

        {/* CRM 360 Context Card */}
        <ClienteContextCard clientId={client.id} />

        {/* Support Eligibility Banner */}
        {client.support_eligible === false && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Sem direito a suporte</p>
              {client.support_block_reason && (
                <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">{client.support_block_reason}</p>
              )}
            </div>
          </div>
        )}

        {/* License & Financial Status */}
        <Section title="Status da Licença">
          <div className="bg-secondary rounded-2xl p-3 space-y-2.5">
            {/* GL per-product status badges */}
            {(client.gl_status_mais_simples || client.gl_status_maxpro) ? (
              <div className="flex flex-col gap-2">
                {client.gl_status_mais_simples && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mais Simples</span>
                    <Badge className={cn(
                      'text-[11px] font-bold border gap-1.5 px-2.5 py-0.5',
                      client.gl_status_mais_simples === 'Ativo'
                        ? 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]'
                        : client.gl_status_mais_simples === 'Trial 7 Dias'
                          ? 'bg-[#EFF6FF] text-[#2563EB] border-[rgba(37,99,235,0.3)]'
                          : client.gl_status_mais_simples === 'Bloqueado'
                            ? 'bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]'
                            : 'bg-[#FFFBEB] text-[#10293F] border-[rgba(255,184,0,0.5)]'
                    )}>
                      {client.gl_status_mais_simples === 'Ativo' || client.gl_status_mais_simples === 'Trial 7 Dias'
                        ? <CheckCircle className="w-3 h-3" />
                        : <XCircle className="w-3 h-3" />}
                      {client.gl_status_mais_simples}
                    </Badge>
                  </div>
                )}
                {client.gl_status_maxpro && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Maxpro</span>
                    <Badge className={cn(
                      'text-[11px] font-bold border gap-1.5 px-2.5 py-0.5',
                      client.gl_status_maxpro === 'Ativo'
                        ? 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]'
                        : client.gl_status_maxpro === 'Bloqueado'
                          ? 'bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]'
                          : 'bg-[#FFFBEB] text-[#10293F] border-[rgba(255,184,0,0.5)]'
                    )}>
                      {client.gl_status_maxpro === 'Ativo'
                        ? <CheckCircle className="w-3 h-3" />
                        : <XCircle className="w-3 h-3" />}
                      {client.gl_status_maxpro}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback: legacy license_status */
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Licença</span>
                <Badge className={cn(
                  'text-[11px] font-bold border gap-1.5 px-2.5 py-0.5',
                  client.license_status === 'active'
                    ? 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]'
                    : client.license_status === 'cancelled'
                      ? 'bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]'
                      : 'text-muted-foreground bg-muted border-border'
                )}>
                  {client.license_status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {client.license_status === 'active' ? 'Ativo' : client.license_status === 'cancelled' ? 'Cancelado' : client.license_status === 'suspended' ? 'Suspenso' : 'Desconhecido'}
                </Badge>
              </div>
            )}

            {/* Financial metrics grid */}
            {(client.mrr_total || client.active_contracts_count || client.debt_total) ? (
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <div className="bg-background rounded-lg p-2 text-center border border-border/50">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">MRR</span>
                  <span className="text-xs font-bold text-foreground">
                    {client.mrr_total ? `R$ ${Number(client.mrr_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                  </span>
                </div>
                <div className={cn(
                  'rounded-lg p-2 text-center border',
                  (client.debt_total && client.debt_total > 0) ? 'bg-[#FEF2F2] border-[rgba(220,38,38,0.2)]' : 'bg-background border-border/50'
                )}>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Dívida</span>
                  <span className={cn('text-xs font-bold', (client.debt_total && client.debt_total > 0) ? 'text-[#DC2626]' : 'text-foreground')}>
                    {client.debt_total ? `R$ ${Number(client.debt_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                  </span>
                  {(client.pending_invoices_count != null && client.pending_invoices_count > 0) && (
                    <span className="text-[8px] text-[#DC2626] block">{client.pending_invoices_count} fatura{client.pending_invoices_count !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border/50">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Contratos</span>
                  <span className="text-xs font-bold text-foreground">{client.active_contracts_count ?? 0}</span>
                </div>
              </div>
            ) : null}

            {/* Sync indicator */}
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {client.last_synced_at
                  ? `Sync: ${new Date(client.last_synced_at).toLocaleDateString('pt-BR')} ${new Date(client.last_synced_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Nunca sincronizado'}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={handleSyncSismais}
                disabled={syncingSismais}
                title="Sincronizar com Sismais Admin"
              >
                {syncingSismais
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <RefreshCw className="w-3 h-3" />
                }
              </Button>
            </div>
          </div>
        </Section>

        {/* Contacts */}
        {contacts.length > 0 && (
          <Section title="Contatos">
            <div className="space-y-2">
              {contacts.map(c => (
                <div key={c.id} className="bg-secondary rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground truncate">{c.name}</span>
                    {c.is_primary && (
                      <Badge variant="outline" className="text-[9px] font-bold">Principal</Badge>
                    )}
                  </div>
                  {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{c.phone}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{c.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Contracts - on demand */}
        <Section title="Contratos e Planos">
          {!contractsLoaded ? (
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs rounded-xl"
                onClick={handleLoadContracts}
                disabled={loadingContracts}
              >
                {loadingContracts
                  ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  : <Search className="w-3.5 h-3.5 mr-1" />
                }
                Buscar Contratos deste Cliente
              </Button>
              {client.cnpj && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs rounded-xl gap-1.5"
                  onClick={handleSyncSismais}
                  disabled={syncingSismais}
                >
                  {syncingSismais
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />
                  }
                  Sincronizar com Sismais Admin
                </Button>
              )}
            </div>
          ) : contracts.length > 0 ? (
            <div className="space-y-2">
              {contracts.map(c => {
                const isActive = c.status === 'active' || c.status === 'ativo'
                return (
                  <div key={c.id} className="bg-secondary rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {c.plan_name || `Contrato ${c.contract_number || ''}`}
                      </span>
                      <Badge className={cn(
                        'text-[9px] font-bold border',
                        isActive
                          ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-muted-foreground bg-muted border-border'
                      )}>
                        {c.status || 'N/A'}
                      </Badge>
                    </div>
                    {c.value != null && (
                      <StatusRow label="Valor">
                        <span className="text-xs font-semibold text-foreground">
                          R$ {Number(c.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </StatusRow>
                    )}
                  </div>
                )
              })}
              {client.cnpj && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 text-xs rounded-xl gap-1"
                  onClick={handleSyncSismais}
                  disabled={syncingSismais}
                >
                  {syncingSismais
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />
                  }
                  Atualizar do Sismais Admin
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum contrato encontrado</p>
              {client.cnpj && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 text-xs rounded-xl gap-1"
                  onClick={handleSyncSismais}
                  disabled={syncingSismais}
                >
                  {syncingSismais
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />
                  }
                  Importar do Sismais Admin
                </Button>
              )}
            </div>
          )}
        </Section>
      </div>
    )
  }

  // ── NO CLIENT LINKED - show search ──
  return (
    <div className="p-4 space-y-4" key="cliente-search">
      {/* GL License Status (visible even before linking) */}
      <ClientGLStatusBanner phone={conversationPhone || null} />

      <Section title="Vincular Cliente">
        <div className="space-y-3">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, telefone, e-mail, CNPJ..."
            className="text-xs h-9 rounded-xl"
          />

          {searching && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleLink(r.id)}
                  disabled={linking}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors text-left bg-secondary border border-border disabled:opacity-50"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {r.name?.[0]?.toUpperCase() || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{r.name}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {r.company_name && <span className="flex items-center gap-1"><Building2 className="w-2.5 h-2.5" />{r.company_name}</span>}
                      {r.phone && <span className="font-mono">{r.phone}</span>}
                      {r.email && <span className="truncate">{r.email}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Sismais Admin search section */}
          {debouncedSearch.length >= 2 && !showQuickForm && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Database className="w-3 h-3" /> Sismais Admin
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {sismaisResults.length === 0 && !searchingSismais && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs rounded-xl gap-1.5"
                  onClick={handleSearchSismais}
                  disabled={searchingSismais}
                >
                  <Database className="w-3.5 h-3.5" />
                  Buscar no Sismais Admin
                </Button>
              )}

              {searchingSismais && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {sismaisResults.length > 0 && (
                <div className="space-y-2">
                  {sismaisResults.map((sc, i) => (
                    <button
                      key={sc.documento || i}
                      onClick={() => handleLinkSismaisClient(sc)}
                      disabled={linkingSismais}
                      className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors text-left bg-secondary border border-border disabled:opacity-50"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-amber-100 text-amber-700 font-bold text-xs">
                          {sc.nome?.[0]?.toUpperCase() || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-foreground truncate">{sc.nome || 'Sem nome'}</p>
                          <Badge variant={sc.status_geral === 'ativo' ? 'default' : 'secondary'}
                            className={cn('text-[8px] font-bold shrink-0',
                              sc.status_geral === 'ativo'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                            )}
                          >
                            {sc.status_geral === 'ativo' ? 'Ativo' : 'Cancelado'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {sc.documento && <span className="font-mono">{sc.documento}</span>}
                          {sc.email && <span className="truncate">{sc.email}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-foreground">
                            MRR: R$ {sc.mrr_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-muted-foreground">
                            {sc.contratos_ativos}/{sc.contratos_count} contratos
                          </span>
                        </div>
                        {sc.plataformas.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {sc.plataformas.map(p => (
                              <Badge key={p} variant="outline" className="text-[8px] font-bold">{p}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {debouncedSearch.length >= 2 && searchResults.length === 0 && !searching && !showQuickForm && sismaisResults.length === 0 && !searchingSismais && (
            <div className="text-center py-1">
              <Button
                size="sm"
                variant="link"
                className="text-xs text-primary h-auto p-0"
                onClick={() => {
                  setShowQuickForm(true)
                  setQuickFormData({
                    name: conversationName || '',
                    phone: conversationPhone || '',
                    email: '',
                    cnpj: '',
                  })
                  fetchContactInstances()
                }}
              >
                + Cadastro rápido
              </Button>
            </div>
          )}

          {/* Quick registration form */}
          {showQuickForm && (
            <div className="bg-secondary rounded-xl p-3 space-y-2.5 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Cadastro Rápido</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowQuickForm(false); setContactInstances([]); }}>
                  <X className="w-3 h-3" />
                </Button>
              </div>

              {loadingInstances && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Buscando instâncias...
                </div>
              )}
              {contactInstances.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instâncias WhatsApp</span>
                  <div className="flex flex-wrap gap-1.5">
                    {contactInstances.map(ci => (
                      <Badge key={ci.instanceId} variant="outline" className="text-[9px] font-bold gap-1">
                        <Wifi className="w-2.5 h-2.5" />
                        {ci.instanceName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Input
                value={quickFormData.name}
                onChange={e => setQuickFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome *"
                className="text-xs h-8 rounded-lg"
              />
              <Input
                value={quickFormData.phone}
                onChange={e => setQuickFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Telefone"
                className="text-xs h-8 rounded-lg"
              />
              <Input
                value={quickFormData.email}
                onChange={e => setQuickFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="E-mail"
                className="text-xs h-8 rounded-lg"
              />
              <Input
                value={quickFormData.cnpj}
                onChange={e => setQuickFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                placeholder="CNPJ (opcional)"
                className="text-xs h-8 rounded-lg"
              />
              <Button
                size="sm"
                className="w-full h-8 text-xs rounded-lg"
                onClick={handleQuickRegister}
                disabled={savingQuickForm || !quickFormData.name.trim()}
              >
                {savingQuickForm ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                Cadastrar e Vincular
              </Button>
            </div>
          )}

          {debouncedSearch.length < 2 && !showQuickForm && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center py-2">
                Digite pelo menos 2 caracteres para buscar
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs rounded-xl"
                onClick={() => {
                  setShowQuickForm(true)
                  setQuickFormData({
                    name: conversationName || '',
                    phone: conversationPhone || '',
                    email: '',
                    cnpj: '',
                  })
                  fetchContactInstances()
                }}
              >
                + Cadastro rápido de cliente
              </Button>
            </div>
          )}
        </div>
      </Section>

      {/* Full Client Modal */}
      {clientId && (
        <ClientFullModal
          open={clientModalOpen}
          onOpenChange={setClientModalOpen}
          clientId={clientId}
        />
      )}
    </div>
  )
}
