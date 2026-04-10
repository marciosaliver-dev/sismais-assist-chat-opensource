import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const results = {
    sla_alerts: 0,
    auto_cancelled: 0,
    stalled_alerts: 0,
    moved_to_no_response: 0,
  }

  try {
    // ─── Helper: get cancellation board stages ───
    const { data: board } = await supabase
      .from('kanban_boards')
      .select('id')
      .eq('board_type', 'cancellation')
      .single()

    if (!board) {
      console.log('[cancellation-automations] No cancellation board found, skipping.')
      return new Response(JSON.stringify({ success: true, results, message: 'No cancellation board found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: stages } = await supabase
      .from('kanban_stages')
      .select('id, slug, name')
      .eq('board_id', board.id)

    if (!stages || stages.length === 0) {
      console.log('[cancellation-automations] No stages found for cancellation board.')
      return new Response(JSON.stringify({ success: true, results, message: 'No stages found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const stageBySlug = (slug: string) => stages.find(s => s.slug === slug)

    // ─── 1. SLA Alert: >2h in "Pedido de Cancelamento" without agent ───
    {
      const stage = stageBySlug('pedido-cancelamento')
      if (stage) {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        const { data: tickets } = await supabase
          .from('ai_conversations')
          .select('id, customer_name, ticket_number, started_at')
          .eq('kanban_board_id', board.id)
          .eq('stage_id', stage.id)
          .is('human_agent_id', null)
          .lt('started_at', twoHoursAgo)
          .not('status', 'in', '("finalizado","cancelado","resolvido")')

        if (tickets && tickets.length > 0) {
          for (const t of tickets) {
            console.log(`[cancellation-automations] SLA ALERT: Ticket #${t.ticket_number} (${t.customer_name}) has been in "Pedido de Cancelamento" for >2h without an agent. Started at ${t.started_at}`)
          }
          results.sla_alerts = tickets.length
        }
      }
    }

    // ─── 2. Auto-move: "Sem Resposta" >7 calendar days → "Cancelado" ───
    {
      const semRespostaStage = stageBySlug('sem-resposta')
      const canceladoStage = stageBySlug('cancelado')

      if (semRespostaStage && canceladoStage) {
        const { data: tickets } = await supabase
          .from('ai_conversations')
          .select('id, customer_name, ticket_number, started_at, context')
          .eq('kanban_board_id', board.id)
          .eq('stage_id', semRespostaStage.id)
          .not('status', 'in', '("finalizado","cancelado","resolvido")')

        if (tickets && tickets.length > 0) {
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

          for (const t of tickets) {
            // Check ticket_stage_history for when it entered sem-resposta
            const { data: history } = await supabase
              .from('ticket_stage_history')
              .select('moved_at')
              .eq('conversation_id', t.id)
              .eq('to_stage_id', semRespostaStage.id)
              .order('moved_at', { ascending: false })
              .limit(1)

            const enteredAt = history && history.length > 0
              ? new Date(history[0].moved_at).getTime()
              : new Date(t.started_at).getTime()

            if (enteredAt < sevenDaysAgo) {
              const ctx = (t.context as Record<string, unknown>) ?? {}
              const updatedContext = {
                ...ctx,
                final_result: ctx.final_result ?? 'cancelado',
                cancellation_reason: ctx.cancellation_reason ?? 'sem_resposta',
              }

              const { error: updateError } = await supabase
                .from('ai_conversations')
                .update({
                  stage_id: canceladoStage.id,
                  status: 'cancelado',
                  context: updatedContext,
                })
                .eq('id', t.id)
                .eq('stage_id', semRespostaStage.id) // idempotency guard

              if (!updateError) {
                await supabase.from('ticket_stage_history').insert({
                  conversation_id: t.id,
                  from_stage_id: semRespostaStage.id,
                  to_stage_id: canceladoStage.id,
                  moved_by: 'system:cancellation-automations',
                  notes: 'Auto-cancelado por inatividade (>7 dias sem resposta)',
                })

                console.log(`[cancellation-automations] AUTO-CANCEL: Ticket #${t.ticket_number} (${t.customer_name}) moved to "Cancelado" after >7 days in "Sem Resposta"`)
                results.auto_cancelled++
              } else {
                console.error(`[cancellation-automations] Failed to auto-cancel ticket #${t.ticket_number}:`, updateError)
              }
            }
          }
        }
      }
    }

    // ─── 3. Alert: >24h without movement in columns 2-4 ───
    {
      const stalledSlugs = ['contato-realizado', 'motivo-identificado', 'oferta-retencao']
      const stalledStages = stages.filter(s => stalledSlugs.includes(s.slug))

      if (stalledStages.length > 0) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        for (const stage of stalledStages) {
          const { data: tickets } = await supabase
            .from('ai_conversations')
            .select('id, customer_name, ticket_number, started_at')
            .eq('kanban_board_id', board.id)
            .eq('stage_id', stage.id)
            .not('status', 'in', '("finalizado","cancelado","resolvido")')

          if (tickets && tickets.length > 0) {
            for (const t of tickets) {
              // Check last stage history entry
              const { data: history } = await supabase
                .from('ticket_stage_history')
                .select('moved_at')
                .eq('conversation_id', t.id)
                .order('moved_at', { ascending: false })
                .limit(1)

              const lastMovement = history && history.length > 0
                ? history[0].moved_at
                : t.started_at

              if (lastMovement < twentyFourHoursAgo) {
                console.log(`[cancellation-automations] STALLED ALERT: Ticket #${t.ticket_number} (${t.customer_name}) has been in "${stage.name}" for >24h without movement. Last activity: ${lastMovement}`)
                results.stalled_alerts++
              }
            }
          }
        }
      }
    }

    // ─── 4. Auto-move: contact_attempts ≥ 3 → "Sem Resposta" ───
    {
      const semRespostaStage = stageBySlug('sem-resposta')
      const excludedSlugs = ['sem-resposta', 'revertido', 'cancelado']
      const excludedStageIds = stages.filter(s => excludedSlugs.includes(s.slug)).map(s => s.id)

      if (semRespostaStage) {
        const { data: tickets } = await supabase
          .from('ai_conversations')
          .select('id, customer_name, ticket_number, stage_id, context')
          .eq('kanban_board_id', board.id)
          .not('status', 'in', '("finalizado","cancelado","resolvido")')

        if (tickets && tickets.length > 0) {
          for (const t of tickets) {
            // Skip if already in excluded stages
            if (excludedStageIds.includes(t.stage_id)) continue

            const ctx = t.context as Record<string, unknown> | null
            const contactAttempts = parseInt(String(ctx?.contact_attempts ?? '0'), 10)

            if (contactAttempts >= 3) {
              const fromStageId = t.stage_id

              const { error: updateError } = await supabase
                .from('ai_conversations')
                .update({ stage_id: semRespostaStage.id })
                .eq('id', t.id)
                .neq('stage_id', semRespostaStage.id) // idempotency guard

              if (!updateError) {
                await supabase.from('ticket_stage_history').insert({
                  conversation_id: t.id,
                  from_stage_id: fromStageId,
                  to_stage_id: semRespostaStage.id,
                  moved_by: 'system:cancellation-automations',
                  notes: `Auto-movido para "Sem Resposta" após ${contactAttempts} tentativas de contato`,
                })

                console.log(`[cancellation-automations] AUTO-MOVE: Ticket #${t.ticket_number} (${t.customer_name}) moved to "Sem Resposta" after ${contactAttempts} contact attempts`)
                results.moved_to_no_response++
              } else {
                console.error(`[cancellation-automations] Failed to move ticket #${t.ticket_number} to sem-resposta:`, updateError)
              }
            }
          }
        }
      }
    }

    console.log('[cancellation-automations] Run complete:', JSON.stringify(results))

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('[cancellation-automations] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
