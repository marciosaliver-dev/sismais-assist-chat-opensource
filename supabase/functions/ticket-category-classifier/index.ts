import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { conversation_id, message_content } = await req.json()
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: 'conversation_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch active categories
    const { data: categories } = await supabase
      .from('ticket_categories')
      .select('id, name, description')
      .eq('active', true)
      .order('sort_order')

    if (!categories || categories.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no categories' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch active modules
    const { data: modules } = await supabase
      .from('ticket_modules')
      .select('id, name')
      .eq('active', true)
      .order('name')

    // Fetch last messages for context
    const { data: messages } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(15)

    const conversationText = (messages || [])
      .reverse()
      .map(m => `${m.role}: ${m.content}`)
      .join('\n')

    // Fetch client system context
    let clientContext = ''
    const { data: convData } = await supabase
      .from('ai_conversations')
      .select('helpdesk_client_id')
      .eq('id', conversation_id)
      .single()

    if (convData?.helpdesk_client_id) {
      const { data: clientData } = await supabase
        .from('helpdesk_clients')
        .select('subscribed_product, gl_status_mais_simples, gl_status_maxpro, company_name')
        .eq('id', convData.helpdesk_client_id)
        .single()

      if (clientData) {
        const sistema = clientData.subscribed_product ||
          (clientData.gl_status_mais_simples ? 'Mais Simples' : '') ||
          (clientData.gl_status_maxpro ? 'Maxpro' : '')
        const status = clientData.gl_status_mais_simples || clientData.gl_status_maxpro || 'Desconhecido'
        clientContext = `\nINFORMAÇÕES DO CLIENTE:\n- Empresa: ${clientData.company_name || 'N/A'}\n- Sistema utilizado: ${sistema || 'N/A'}\n- Status da licença: ${status}`
      }
    }

    // Also use single message if provided
    const fullContext = message_content
      ? `Mensagem mais recente: ${message_content}\n\n--- Histórico ---\n${conversationText}${clientContext}`
      : `${conversationText}${clientContext}`

    if (!fullContext.trim()) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no messages' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Build category list for LLM
    const categoryList = categories.map(c =>
      `- ID: ${c.id} | Nome: "${c.name}"${c.description ? ` | Descrição: ${c.description}` : ''}`
    ).join('\n')

    const moduleList = modules && modules.length > 0
      ? modules.map(m => `- ID: ${m.id} | Nome: "${m.name}"`).join('\n')
      : ''

    const systemPrompt = `Você é um classificador de tickets de suporte técnico.
Analise a conversa e:
1. Classifique em UMA das categorias abaixo (ou null se incerto)
2. Gere um título/assunto curto e descritivo para o ticket (máximo 80 caracteres)
3. Gere um resumo do problema relatado pelo cliente (máximo 200 caracteres)
${moduleList ? '4. Classifique o módulo do sistema, se aplicável.' : ''}
Considere o sistema utilizado pelo cliente para classificar o módulo corretamente.

CATEGORIAS DISPONÍVEIS:
${categoryList}
${moduleList ? `\nMÓDULOS DISPONÍVEIS:\n${moduleList}` : ''}

Responda APENAS em JSON válido:
{
  "category_id": "uuid da categoria ou null",
  "category_confidence": 0.0,
  "ticket_subject": "título curto do problema",
  "problem_summary": "resumo do problema em 1-2 frases"${moduleList ? ',\n  "module_id": "uuid do módulo ou null"' : ''}
}

Se não conseguir classificar com confiança > 0.3, ainda assim retorne ticket_subject e problem_summary.`

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullContext.substring(0, 4000) },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })

    if (!llmResponse.ok) {
      const errText = await llmResponse.text()
      console.error('[category-classifier] LLM error:', errText)
      return new Response(JSON.stringify({ error: 'LLM request failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const llmData = await llmResponse.json()
    const content = llmData.choices?.[0]?.message?.content || ''

    let classification: { category_id?: string | null; category_confidence?: number; module_id?: string | null; ticket_subject?: string | null; problem_summary?: string | null }
    try {
      classification = JSON.parse(content)
    } catch {
      console.error('[category-classifier] Failed to parse LLM response:', content)
      return new Response(JSON.stringify({ error: 'Invalid LLM response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[category-classifier] conv=${conversation_id} category=${classification.category_id} confidence=${classification.category_confidence} module=${classification.module_id}`)

    // Busca classification_version atual para incrementar
    const { data: currentConv } = await supabase
      .from('ai_conversations')
      .select('classification_version')
      .eq('id', conversation_id)
      .single()

    const newVersion = ((currentConv?.classification_version as number) || 0) + 1

    // Sempre salva ticket_subject, problem_summary e incrementa version
    const alwaysUpdate: Record<string, unknown> = {
      classification_version: newVersion,
    }
    alwaysUpdate.ticket_subject = ((classification.ticket_subject ?? '') as string).substring(0, 120) || null
    alwaysUpdate.problem_summary = (((classification as any).problem_summary ?? '') as string).substring(0, 300) || null

    // Só atualiza category/module se confiança > 0.3
    const finalUpdate: Record<string, unknown> = { ...alwaysUpdate }
    if (classification.category_id && (classification.category_confidence || 0) > 0.3) {
      const validCategory = categories.find(c => c.id === classification.category_id)
      if (validCategory) {
        finalUpdate.ticket_category_id = classification.category_id
        if (classification.module_id && modules?.find(m => m.id === classification.module_id)) {
          finalUpdate.ticket_module_id = classification.module_id
        }
        await supabase.from('ai_conversations').update(finalUpdate).eq('id', conversation_id)

        return new Response(JSON.stringify({
          classified: true,
          category_id: classification.category_id,
          category_name: validCategory.name,
          confidence: classification.category_confidence,
          module_id: classification.module_id || null,
          ticket_subject: alwaysUpdate.ticket_subject || null,
          problem_summary: alwaysUpdate.problem_summary || null,
          classification_version: newVersion,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    await supabase.from('ai_conversations').update(finalUpdate).eq('id', conversation_id)

    return new Response(JSON.stringify({
      classified: false,
      reason: 'low confidence or invalid category',
      ticket_subject: alwaysUpdate.ticket_subject || null,
      problem_summary: alwaysUpdate.problem_summary || null,
      classification_version: newVersion,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[category-classifier] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
