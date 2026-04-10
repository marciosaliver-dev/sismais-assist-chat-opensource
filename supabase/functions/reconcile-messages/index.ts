import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

// Reconcilia mensagens órfãs entre uazapi_messages e ai_messages
// Também processa a dead-letter queue
// Pode ser invocada via cron ou manualmente

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const stats = {
    orphans_found: 0,
    orphans_fixed: 0,
    dead_letters_processed: 0,
    dead_letters_resolved: 0,
    errors: [] as string[],
  }

  try {
    // ── PARTE 1: Buscar mensagens em uazapi_messages sem correspondente em ai_messages ──
    // Limitar a mensagens das últimas 24h para performance
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: orphanMessages, error: orphanError } = await supabase
      .rpc('find_orphan_uazapi_messages', { p_since: cutoff })

    if (orphanError) {
      // Se a RPC não existe ainda, usar query direta
      console.warn('[reconcile] RPC not found, using direct query')
      const { data: uazapiMsgs, error: queryError } = await supabase
        .from('uazapi_messages')
        .select('id, message_id, instance_id, text_body, type, from_me, timestamp, media_url, chat_id')
        .gte('timestamp', cutoff)
        .not('message_id', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(200)

      if (queryError) {
        stats.errors.push(`Query error: ${queryError.message}`)
      } else if (uazapiMsgs?.length) {
        // Buscar quais já têm ai_messages
        const msgIds = uazapiMsgs.map(m => m.message_id).filter(Boolean)
        const { data: existingBridges } = await supabase
          .from('ai_messages')
          .select('uazapi_message_id')
          .in('uazapi_message_id', msgIds)

        const bridgedIds = new Set((existingBridges || []).map(b => b.uazapi_message_id))
        const orphans = uazapiMsgs.filter(m => !bridgedIds.has(m.message_id))
        stats.orphans_found = orphans.length

        for (const orphan of orphans) {
          // Buscar conversation_id pelo chat_id ou instance
          let conversationId: string | null = null

          if (orphan.chat_id) {
            const { data: conv } = await supabase
              .from('ai_conversations')
              .select('id')
              .or(`uazapi_chat_id.eq.${orphan.chat_id}`)
              .in('status', ['aguardando', 'em_atendimento', 'finalizado'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            conversationId = conv?.id || null
          }

          if (!conversationId) {
            console.warn(`[reconcile] No conversation found for orphan msg ${orphan.message_id}`)
            continue
          }

          // Inserir em ai_messages
          const { error: insertError } = await supabase
            .from('ai_messages')
            .insert({
              conversation_id: conversationId,
              role: orphan.from_me ? 'assistant' : 'user',
              content: orphan.text_body || `[${orphan.type}]`,
              uazapi_message_id: orphan.message_id,
              media_url: orphan.media_url || null,
              media_type: orphan.type !== 'text' ? orphan.type : null,
              delivery_status: orphan.from_me ? 'sent' : null,
              whatsapp_instance_id: orphan.instance_id,
              created_at: orphan.timestamp,
            })

          if (insertError) {
            // Pode ser duplicata (race condition) — ignorar se for unique violation
            if (insertError.code === '23505') {
              console.log(`[reconcile] Skipping duplicate: ${orphan.message_id}`)
            } else {
              stats.errors.push(`Insert error for ${orphan.message_id}: ${insertError.message}`)
            }
          } else {
            stats.orphans_fixed++
            console.log(`[reconcile] Fixed orphan: ${orphan.message_id} → conversation ${conversationId}`)
          }
        }
      }
    }

    // ── PARTE 2: Processar dead-letter queue ──
    const { data: deadLetters, error: dlError } = await supabase
      .from('dead_letter_messages')
      .select('*')
      .eq('resolved', false)
      .lt('retry_count', 5)
      .order('created_at', { ascending: true })
      .limit(50)

    if (dlError) {
      stats.errors.push(`Dead-letter query error: ${dlError.message}`)
    } else if (deadLetters?.length) {
      stats.dead_letters_processed = deadLetters.length

      for (const dl of deadLetters) {
        const payload = dl.payload as Record<string, any>
        if (!payload?.conversation_id && !dl.conversation_id) continue

        const convId = payload.conversation_id || dl.conversation_id

        // Tentar inserir novamente
        const { error: retryError } = await supabase
          .from('ai_messages')
          .insert({
            ...payload,
            conversation_id: convId,
          })

        if (retryError) {
          // Incrementar retry count
          await supabase
            .from('dead_letter_messages')
            .update({ retry_count: (dl.retry_count || 0) + 1, error_message: retryError.message })
            .eq('id', dl.id)
        } else {
          // Marcar como resolvido
          await supabase
            .from('dead_letter_messages')
            .update({ resolved: true, resolved_at: new Date().toISOString() })
            .eq('id', dl.id)
          stats.dead_letters_resolved++
          console.log(`[reconcile] Resolved dead-letter ${dl.id} for conversation ${convId}`)
        }
      }
    }

    console.log(`[reconcile] Done:`, JSON.stringify(stats))

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[reconcile] Fatal error:', err.message)
    return new Response(JSON.stringify({ error: err.message, stats }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
