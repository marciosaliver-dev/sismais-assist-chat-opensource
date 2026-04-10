import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

/**
 * LGPD Data Request — Endpoint para direito de acesso, exclusão e anonimização
 *
 * Actions:
 * - export: Retorna todos os dados do titular (conversas, mensagens, contatos)
 * - delete: Exclui dados pessoais (anonimiza mensagens, remove contatos)
 * - anonymize: Anonimiza dados mas mantém estrutura para analytics
 * - consent_status: Verifica status de consentimento
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Auth: requer admin ou service_role
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Autorização necessária' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const isServiceRole = token === serviceRoleKey
  if (!isServiceRole) {
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '')
    const { data: { user }, error } = await authClient.auth.getUser(token)
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar se é admin
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (role?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem executar solicitações LGPD' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { action, phone, email, document_id: docId, reason } = await req.json()

    if (!action || (!phone && !email)) {
      return new Response(JSON.stringify({ error: 'action e (phone ou email) são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const identifier = phone || email
    const identifierType = phone ? 'phone' : 'email'
    console.log(`[lgpd] Action: ${action} for ${identifierType}: ${identifier.slice(0, 4)}****`)

    if (action === 'export') {
      // Exportar todos os dados do titular
      const [conversations, messages, clients, contacts, consent] = await Promise.all([
        supabase.from('ai_conversations')
          .select('id, status, started_at, resolved_at, customer_name, customer_phone, customer_email, ticket_number')
          .or(`customer_phone.eq.${phone},customer_email.eq.${email}`)
          .order('started_at', { ascending: false }),
        supabase.from('ai_messages')
          .select('role, content, created_at, confidence')
          .in('conversation_id',
            (await supabase.from('ai_conversations').select('id').or(`customer_phone.eq.${phone},customer_email.eq.${email}`)).data?.map((c: any) => c.id) || []
          )
          .order('created_at', { ascending: true }),
        supabase.from('helpdesk_clients')
          .select('*')
          .or(`phone.eq.${phone},email.eq.${email}`),
        supabase.from('helpdesk_client_contacts')
          .select('*')
          .or(`phone.eq.${phone},email.eq.${email}`),
        supabase.from('lgpd_consent_records')
          .select('*')
          .eq('phone', phone || ''),
      ])

      return new Response(JSON.stringify({
        titular: { phone, email },
        export_date: new Date().toISOString(),
        conversations: conversations.data || [],
        messages: messages.data || [],
        clients: clients.data || [],
        contacts: contacts.data || [],
        consent_records: consent.data || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else if (action === 'delete' || action === 'anonymize') {
      const anonymizedName = 'Titular Removido'
      const anonymizedPhone = '00000000000'
      const anonymizedEmail = 'removido@lgpd.local'

      // 1. Anonimizar conversas
      const { data: convs } = await supabase
        .from('ai_conversations')
        .select('id')
        .or(`customer_phone.eq.${phone},customer_email.eq.${email}`)

      const convIds = (convs || []).map((c: any) => c.id)

      if (convIds.length > 0) {
        await supabase.from('ai_conversations')
          .update({
            customer_name: anonymizedName,
            customer_phone: anonymizedPhone,
            customer_email: anonymizedEmail,
          })
          .in('id', convIds)

        // 2. Anonimizar mensagens do usuário
        if (action === 'delete') {
          await supabase.from('ai_messages')
            .update({ content: '[Conteúdo removido por solicitação LGPD]' })
            .in('conversation_id', convIds)
            .eq('role', 'user')
        }
      }

      // 3. Anonimizar clientes helpdesk
      await supabase.from('helpdesk_clients')
        .update({ name: anonymizedName, phone: anonymizedPhone, email: anonymizedEmail })
        .or(`phone.eq.${phone},email.eq.${email}`)

      // 4. Remover contatos
      if (action === 'delete') {
        await supabase.from('helpdesk_client_contacts')
          .delete()
          .or(`phone.eq.${phone},email.eq.${email}`)
      }

      // 5. Registrar na auditoria
      await supabase.from('lgpd_consent_records').insert({
        phone: phone || '',
        consent_type: action === 'delete' ? 'data_deletion' : 'data_anonymization',
        granted: false,
        revoked_at: new Date().toISOString(),
      })

      return new Response(JSON.stringify({
        success: true,
        action,
        conversations_affected: convIds.length,
        reason: reason || 'Solicitação do titular',
        processed_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else if (action === 'consent_status') {
      const { data } = await supabase
        .from('lgpd_consent_records')
        .select('*')
        .eq('phone', phone || '')
        .order('created_at', { ascending: false })
        .limit(1)

      return new Response(JSON.stringify({
        phone,
        has_consent: data && data.length > 0 && data[0].granted && !data[0].revoked_at,
        records: data || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else {
      return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}. Use: export, delete, anonymize, consent_status` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('[lgpd] Error:', (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
