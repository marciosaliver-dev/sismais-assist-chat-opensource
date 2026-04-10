import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Search, Plus, UserPlus, FileText, ArrowRight, ArrowLeft, Zap, CheckCircle } from 'lucide-react'

function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}
function maskCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PRODUCT_OPTIONS, SISTEMA_OPTIONS } from './constants'
import { useContactSearch } from '@/hooks/useContactSearch'

interface ClientRegistrationWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (clientId: string) => void
}

export function ClientRegistrationWizard({ open, onOpenChange, onCreated }: ClientRegistrationWizardProps) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)

  // Step 1: Client data
  const [clientForm, setClientForm] = useState({
    name: '', company_name: '', cnpj: '', cpf: '', email: '', phone: '',
    subscribed_product: 'outro', sistema: '',
  })
  const [glLooking, setGlLooking] = useState(false)

  // Step 2: Contacts & Contracts
  const [contacts, setContacts] = useState<{ name: string; phone: string; email: string; role: string; is_primary: boolean; isNew: boolean; contactId?: string }[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const { data: contactResults = [] } = useContactSearch(contactSearch)
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '' })
  const [contracts, setContracts] = useState<{ plan_name: string; status: string; value: string; start_date: string }[]>([])
  const [newContract, setNewContract] = useState({ plan_name: '', status: 'active', value: '', start_date: '' })

  // GL Lookup
  async function lookupGL() {
    if (!clientForm.cnpj && !clientForm.phone && !clientForm.email) {
      toast.error('Informe CNPJ, telefone ou email para buscar no GL')
      return
    }
    setGlLooking(true)
    try {
      const { data, error } = await supabase.functions.invoke('sismais-client-lookup', {
        body: {
          action: 'lookup',
          phone: clientForm.phone || undefined,
          documento: clientForm.cnpj || undefined,
          email: clientForm.email || undefined,
        },
      })
      if (error) throw error
      if (data?.profile) {
        const p = data.profile
        setClientForm(f => ({
          ...f,
          name: p.nome || f.name,
          company_name: p.fantasia || p.razao_social || f.company_name,
          cnpj: p.documento || f.cnpj,
          email: p.email || f.email,
          phone: p.celular || p.telefone1 || f.phone,
        }))
        toast.success('Dados preenchidos do Sismais GL!')
      } else {
        toast.info('Nenhum registro encontrado no GL')
      }
    } catch (err: any) {
      toast.error('Erro ao buscar no GL')
    } finally {
      setGlLooking(false)
    }
  }

  function addContactToList(contact: { name: string; phone: string; email: string; role: string; isNew: boolean; contactId?: string }) {
    setContacts(prev => [...prev, { ...contact, is_primary: prev.length === 0 }])
    setNewContact({ name: '', phone: '', email: '', role: '' })
    setContactSearch('')
  }

  function addContractToList() {
    if (!newContract.plan_name) return
    setContracts(prev => [...prev, { ...newContract }])
    setNewContract({ plan_name: '', status: 'active', value: '', start_date: '' })
  }

  // Save mutation
  const createClient = useMutation({
    mutationFn: async () => {
      // 1. Create client
      const { data: client, error: cErr } = await supabase.from('helpdesk_clients' as any).insert({
        name: clientForm.name,
        company_name: clientForm.company_name || null,
        cnpj: clientForm.cnpj || null,
        cpf: clientForm.cpf || null,
        email: clientForm.email || null,
        phone: clientForm.phone || null,
        subscribed_product: clientForm.subscribed_product,
        sistema: clientForm.sistema || null,
      }).select('id').single()
      if (cErr) throw cErr
      const clientId = client.id

      // 2. Create/link contacts
      for (const c of contacts) {
        let contactId = c.contactId
        if (c.isNew) {
          const { data: nc, error: ncErr } = await supabase.from('contacts' as any)
            .insert({ name: c.name, phone: c.phone || null, email: c.email || null })
            .select('id').single()
          if (ncErr) throw ncErr
          contactId = nc.id
        }
        if (contactId) {
          await supabase.from('client_contact_links' as any).insert({
            client_id: clientId, contact_id: contactId,
            is_primary: c.is_primary, role: c.role || null,
          })
        }
      }

      // 3. Create contracts
      for (const ct of contracts) {
        await supabase.from('helpdesk_client_contracts').insert({
          client_id: clientId,
          plan_name: ct.plan_name || null,
          status: ct.status,
          value: ct.value ? parseFloat(ct.value) : null,
          start_date: ct.start_date || null,
        })
      }

      return clientId
    },
    onSuccess: (clientId) => {
      toast.success('Cliente criado com sucesso!')
      qc.invalidateQueries({ queryKey: ['recent-clients'] })
      qc.invalidateQueries({ queryKey: ['client-unified-search'] })
      onOpenChange(false)
      resetAll()
      onCreated?.(clientId)
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  })

  function resetAll() {
    setStep(1)
    setClientForm({ name: '', company_name: '', cnpj: '', cpf: '', email: '', phone: '', subscribed_product: 'outro', sistema: '' })
    setContacts([])
    setContracts([])
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAll(); onOpenChange(v) }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Novo Cliente</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-[#45E5E5] text-[#10293F]' : 'bg-gray-200 text-gray-500'}`}>
                {step > 1 ? <CheckCircle className="w-4 h-4" /> : '1'}
              </div>
              <span className={`text-xs font-medium ${step === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>Dados do Cliente</span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-[#45E5E5] text-[#10293F]' : 'bg-gray-200 text-gray-500'}`}>
                2
              </div>
              <span className={`text-xs font-medium ${step === 2 ? 'text-foreground' : 'text-muted-foreground'}`}>Contatos e Contratos</span>
            </div>
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1"><Label>Nome completo *</Label><Input value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Empresa</Label><Input value={clientForm.company_name} onChange={e => setClientForm(f => ({ ...f, company_name: e.target.value }))} /></div>
              <div><Label>CNPJ</Label><Input value={clientForm.cnpj} placeholder="00.000.000/0000-00" onChange={e => setClientForm(f => ({ ...f, cnpj: maskCNPJ(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CPF</Label><Input value={clientForm.cpf} placeholder="000.000.000-00" onChange={e => setClientForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))} /></div>
              <div><Label>Telefone</Label><Input value={clientForm.phone} placeholder="(00) 00000-0000" onChange={e => setClientForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} /></div>
            </div>
            <div><Label>E-mail</Label><Input value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Produto</Label>
                <Select value={clientForm.subscribed_product} onValueChange={v => setClientForm(f => ({ ...f, subscribed_product: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCT_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sistema</Label>
                <Select value={clientForm.sistema || '_nenhum'} onValueChange={v => setClientForm(f => ({ ...f, sistema: v === '_nenhum' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_nenhum">Nao informado</SelectItem>
                    {SISTEMA_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* GL Lookup button */}
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={lookupGL} disabled={glLooking}>
              {glLooking ? <Spinner size="sm" /> : <Zap className="w-4 h-4" />}
              Buscar no Sismais GL
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {/* Contacts section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Contatos</Label>
              </div>

              {/* Search existing */}
              <div className="space-y-2 mb-3">
                <Input placeholder="Buscar contato existente..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
                {contactResults.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {contactResults.map((c: any) => (
                      <div key={c.id} className="border rounded p-2 flex items-center justify-between text-sm">
                        <span>{c.name} {c.phone && `· ${c.phone}`}</span>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => addContactToList({ name: c.name, phone: c.phone, email: c.email, role: '', isNew: false, contactId: c.id })}>
                          Vincular
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new contact inline */}
              <div className="border rounded-lg p-3 space-y-2 bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground">Ou criar novo contato:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Nome" value={newContact.name} onChange={e => setNewContact(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
                  <Input placeholder="Telefone" value={newContact.phone} onChange={e => setNewContact(f => ({ ...f, phone: e.target.value }))} className="h-8 text-sm" />
                  <Input placeholder="Email" value={newContact.email} onChange={e => setNewContact(f => ({ ...f, email: e.target.value }))} className="h-8 text-sm" />
                  <Input placeholder="Cargo" value={newContact.role} onChange={e => setNewContact(f => ({ ...f, role: e.target.value }))} className="h-8 text-sm" />
                </div>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" disabled={!newContact.name.trim()} onClick={() => addContactToList({ ...newContact, isNew: true })}>
                  <UserPlus className="w-3 h-3" /> Adicionar
                </Button>
              </div>

              {/* Added contacts */}
              {contacts.length > 0 && (
                <div className="space-y-1 mt-2">
                  {contacts.map((c, i) => (
                    <div key={i} className="flex items-center justify-between border rounded p-2 text-sm">
                      <div>
                        <span className="font-medium">{c.name}</span>
                        {c.is_primary && <Badge variant="secondary" className="text-[10px] ml-1">Principal</Badge>}
                        {!c.isNew && <Badge variant="outline" className="text-[10px] ml-1">Existente</Badge>}
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500" onClick={() => setContacts(prev => prev.filter((_, j) => j !== i))}>
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contracts section */}
            <div>
              <Label className="text-sm font-semibold">Contratos</Label>
              <div className="border rounded-lg p-3 space-y-2 bg-muted/50 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Nome do plano" value={newContract.plan_name} onChange={e => setNewContract(f => ({ ...f, plan_name: e.target.value }))} className="h-8 text-sm" />
                  <Input placeholder="Valor mensal" type="number" step="0.01" value={newContract.value} onChange={e => setNewContract(f => ({ ...f, value: e.target.value }))} className="h-8 text-sm" />
                </div>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" disabled={!newContract.plan_name.trim()} onClick={addContractToList}>
                  <FileText className="w-3 h-3" /> Adicionar Contrato
                </Button>
              </div>

              {contracts.length > 0 && (
                <div className="space-y-1 mt-2">
                  {contracts.map((c, i) => (
                    <div key={i} className="flex items-center justify-between border rounded p-2 text-sm">
                      <span>{c.plan_name} {c.value && `· R$ ${c.value}`}</span>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500" onClick={() => setContracts(prev => prev.filter((_, j) => j !== i))}>
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)} className="gap-1 mr-auto">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
          )}
          {step === 1 && (
            <Button onClick={() => { if (!clientForm.name.trim()) { toast.error('Nome obrigatorio'); return } setStep(2) }} className="gap-1 ml-auto">
              Proximo <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => createClient.mutate()} disabled={createClient.isPending} className="gap-1">
              {createClient.isPending ? 'Criando...' : 'Criar Cliente'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
