import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { ClientForm } from '@/components/clients/types'

export function useClientMutations(clientId: string | undefined) {
  const qc = useQueryClient()

  const updateClient = useMutation({
    mutationFn: async (form: ClientForm) => {
      const { error } = await supabase.from('helpdesk_clients' as any).update({
        name: form.name, company_name: form.company_name || null,
        cnpj: form.cnpj || null, cpf: form.cpf || null,
        email: form.email || null, phone: form.phone || null,
        subscribed_product: form.subscribed_product,
        subscribed_product_custom: form.subscribed_product === 'outro' ? form.subscribed_product_custom || null : null,
        notes: form.notes || null,
        sistema: form.sistema || null,
      }).eq('id', clientId!)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Cliente atualizado!')
      qc.invalidateQueries({ queryKey: ['client-detail', clientId] })
      qc.invalidateQueries({ queryKey: ['helpdesk-client', clientId] })
      qc.invalidateQueries({ queryKey: ['customer-360', clientId] })
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message || 'Tente novamente'}`),
  })

  const addContact = useMutation({
    mutationFn: async (f: { name: string; role: string; phone: string; email: string; is_primary: boolean }) => {
      // First, check if contact already exists by phone or email
      let contactId: string | null = null
      if (f.phone || f.email) {
        let query = supabase.from('contacts' as any).select('id')
        if (f.phone) query = query.eq('phone', f.phone)
        else if (f.email) query = query.eq('email', f.email)
        const { data: existing } = await query.limit(1)
        if (existing && existing.length > 0) {
          contactId = existing[0].id
        }
      }

      // Create contact if not found
      if (!contactId) {
        const { data: newContact, error: cErr } = await supabase.from('contacts' as any)
          .insert({ name: f.name, phone: f.phone || null, email: f.email || null })
          .select('id')
          .single()
        if (cErr) throw cErr
        contactId = newContact.id
      }

      // If marking as primary, unset existing primary
      if (f.is_primary) {
        await supabase.from('client_contact_links' as any)
          .update({ is_primary: false })
          .eq('client_id', clientId!)
      }

      // Create the link
      const { error } = await supabase.from('client_contact_links' as any).insert({
        client_id: clientId!, contact_id: contactId,
        is_primary: f.is_primary, role: f.role || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Contato adicionado!')
      qc.invalidateQueries({ queryKey: ['client-contacts', clientId] })
    },
    onError: () => toast.error('Erro ao adicionar contato'),
  })

  const addContract = useMutation({
    mutationFn: async (f: { contract_number: string; plan_name: string; status: string; start_date: string; end_date: string; value: string; notes: string }) => {
      const { error } = await supabase.from('helpdesk_client_contracts').insert({
        client_id: clientId!, contract_number: f.contract_number || null,
        plan_name: f.plan_name || null, status: f.status,
        start_date: f.start_date || null, end_date: f.end_date || null,
        value: f.value ? parseFloat(f.value) : null, notes: f.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Contrato adicionado!')
      qc.invalidateQueries({ queryKey: ['client-contracts', clientId] })
    },
    onError: () => toast.error('Erro ao adicionar contrato'),
  })

  const addAnnotation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('helpdesk_client_annotations').insert({
        client_id: clientId!, content, author: 'Usuario',
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Anotacao salva!')
      qc.invalidateQueries({ queryKey: ['client-annotations', clientId] })
      qc.invalidateQueries({ queryKey: ['crm-timeline', clientId] })
    },
    onError: () => toast.error('Erro ao salvar anotacao'),
  })

  return { updateClient, addContact, addContract, addAnnotation }
}
