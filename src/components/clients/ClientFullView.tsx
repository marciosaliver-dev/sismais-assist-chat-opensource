import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ArrowLeft, Pencil, Activity, FileText, DollarSign, StickyNote, Database, Plus } from 'lucide-react'
import { useCustomer360 } from '@/hooks/useCustomer360'
import { useCrmTimeline } from '@/hooks/useCrmTimeline'
import { useClientContacts } from '@/hooks/useClientContacts'
import { useClientContracts } from '@/hooks/useClientContracts'
import { useClientAnnotations } from '@/hooks/useClientAnnotations'
import { useClientMutations } from '@/hooks/useClientMutations'
import { ClientSidebar } from './ClientSidebar'
import { ClientEditDialog } from './ClientEditDialog'
import { ClientContactDialog } from './ClientContactDialog'
import { ClientContractDialog } from './ClientContractDialog'
import { ClientTimelineTab } from './tabs/ClientTimelineTab'
import { ClientConversationsTab } from './tabs/ClientConversationsTab'
import { ClientContractsTab } from './tabs/ClientContractsTab'
import { ClientAnnotationsTab } from './tabs/ClientAnnotationsTab'
import { ClientGlDataTab } from './tabs/ClientGlDataTab'
import type { ExtendedClient } from './types'

interface ClientFullViewProps {
  clientId: string
  mode: 'page' | 'modal'
}

export function ClientFullView({ clientId, mode }: ClientFullViewProps) {
  const navigate = useNavigate()

  // Dialog states
  const [editOpen, setEditOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contractOpen, setContractOpen] = useState(false)

  // Queries
  const { data: client, isLoading } = useQuery({
    queryKey: ['client-detail', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('helpdesk_clients').select('*').eq('id', clientId).single()
      if (error) throw error
      return data as unknown as ExtendedClient
    },
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
  })

  const { data: c360, isLoading: c360Loading } = useCustomer360(clientId)
  const { data: contacts = [] } = useClientContacts(clientId)
  const { data: contracts = [] } = useClientContracts(clientId)
  const { data: annotations = [] } = useClientAnnotations(clientId)

  const { data: conversations = [] } = useQuery({
    queryKey: ['client-conversations', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('ai_conversations')
        .select('id, ticket_number, status, handler_type, customer_name, started_at, resolved_at, csat_rating, tags, current_agent_id')
        .eq('helpdesk_client_id', clientId)
        .order('started_at', { ascending: false })
        .limit(100)
      return data || []
    },
    enabled: !!clientId,
  })

  const { data: timelineEvents = [], isLoading: timelineLoading } = useCrmTimeline(clientId, { limit: 50 })

  const { data: glData } = useQuery({
    queryKey: ['client-gl-data', client?.gl_license_id],
    queryFn: async () => {
      if (!client?.gl_license_id) return null
      const { data } = await supabase
        .from('gl_client_licenses')
        .select('engajamento, tag, dias_status_atual, dias_assinatura, ltv_dias, dt_inicio_assinatura, dias_instalacao, dias_ult_ver, dias_de_uso, qtd_login, ultimo_login, sistema_utilizado, id_plano, nome_segmento, cidade, uf, ultima_verificacao, crm_data_ultima_sicronizacao, dt_atualizacao')
        .eq('id', client.gl_license_id)
        .single()
      return data
    },
    enabled: !!client?.gl_license_id,
    staleTime: 5 * 60 * 1000,
  })

  // Mutations
  const { updateClient, addContact, addContract, addAnnotation } = useClientMutations(clientId)

  // Loading / Not found
  if (isLoading) return <div className="h-full flex items-center justify-center"><Spinner size="lg" /></div>
  if (!client) return <div className="p-6 text-center text-muted-foreground">Cliente nao encontrado.</div>

  return (
    <div className="h-full flex flex-col">
      {/* Top bar — only in page mode */}
      {mode === 'page' && (
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/clients')} aria-label="Voltar para clientes">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Breadcrumb className="flex-1">
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="/clients">Clientes</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>{client.name}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4" /> Editar Cliente
          </Button>
          <Button size="sm" className="gap-2" style={{ background: '#45E5E5', color: '#10293F' }}>
            <Plus className="w-4 h-4" /> Novo Ticket
          </Button>
        </div>
      )}

      {/* Modal header */}
      {mode === 'modal' && (
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{client.name}</h2>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4" /> Editar
          </Button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <ClientSidebar
          client={client}
          c360={c360}
          c360Loading={c360Loading}
          contacts={contacts}
          contracts={contracts}
          conversations={conversations}
          onAddContact={() => setContactOpen(true)}
        />

        {/* Right Panel — 4 Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="timeline" className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-4 w-fit">
              <TabsTrigger value="timeline" className="gap-1"><Activity className="w-4 h-4" /> Timeline</TabsTrigger>
              <TabsTrigger value="history" className="gap-1"><FileText className="w-4 h-4" /> Atendimentos</TabsTrigger>
              <TabsTrigger value="contracts" className="gap-1"><DollarSign className="w-4 h-4" /> Contratos</TabsTrigger>
              <TabsTrigger value="gldata" className="gap-1"><Database className="w-4 h-4" /> GL Dados</TabsTrigger>
              <TabsTrigger value="notes" className="gap-1"><StickyNote className="w-4 h-4" /> Anotacoes</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="flex-1 overflow-hidden flex flex-col mt-0">
              <ClientTimelineTab timelineEvents={timelineEvents} timelineLoading={timelineLoading} />
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-y-auto p-4 space-y-2 mt-0">
              <ClientConversationsTab conversations={conversations} />
            </TabsContent>

            <TabsContent value="contracts" className="flex-1 overflow-y-auto p-4 mt-0">
              <ClientContractsTab contracts={contracts} onAddContract={() => setContractOpen(true)} />
            </TabsContent>

            <TabsContent value="gldata" className="flex-1 overflow-hidden mt-0">
              <ClientGlDataTab client={client} glData={glData} />
            </TabsContent>

            <TabsContent value="notes" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
              <ClientAnnotationsTab
                annotations={annotations}
                onAddAnnotation={(content) => addAnnotation.mutate(content)}
                isPending={addAnnotation.isPending}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <ClientEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSave={(form) => { updateClient.mutate(form); setEditOpen(false) }}
        isPending={updateClient.isPending}
      />

      <ClientContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        onSave={(form) => { addContact.mutate(form); setContactOpen(false) }}
        isPending={addContact.isPending}
      />

      <ClientContractDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        onSave={(form) => { addContract.mutate(form); setContractOpen(false) }}
        isPending={addContract.isPending}
      />
    </div>
  )
}
