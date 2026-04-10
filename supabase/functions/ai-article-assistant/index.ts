import { callOpenRouter } from '../_shared/openrouter-client.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'
import { DEFAULT_CONTENT_MODEL } from '../_shared/default-models.ts'

const MODEL = DEFAULT_CONTENT_MODEL

const SYSTEM_PROMPTS: Record<string, string> = {
  generate: `Você é um redator técnico especialista em criar artigos de base de conhecimento para sistemas ERP e helpdesk.
Gere um artigo completo, bem estruturado e em português brasileiro.
Use formatação Markdown com títulos (##), subtítulos (###), listas e blocos de código quando apropriado.
O artigo deve ser claro, objetivo e útil para usuários finais e equipes de suporte.
Inclua: introdução breve, passo a passo detalhado (se aplicável), dicas úteis e conclusão.`,

  improve: `Você é um editor técnico especialista em melhorar artigos de base de conhecimento.
Reescreva e melhore o conteúdo fornecido em português brasileiro.
Mantenha a formatação Markdown. Melhore: clareza, organização, completude e tom profissional.
Corrija erros gramaticais, remova redundâncias e adicione detalhes úteis onde necessário.
Retorne APENAS o conteúdo melhorado, sem comentários sobre as mudanças.`,

  summarize: `Você é um especialista em criar resumos concisos para artigos técnicos.
Gere uma descrição/resumo curto (máximo 2 frases) do conteúdo fornecido, em português brasileiro.
O resumo deve capturar o objetivo principal do artigo e ser útil como prévia em listagens.
Retorne APENAS o resumo, sem aspas ou prefixos.`,

  'suggest-tags': `Você é um especialista em categorização de conteúdo técnico.
Analise o conteúdo e sugira de 3 a 6 tags relevantes em português brasileiro.
As tags devem ser palavras-chave curtas (1-2 palavras) que ajudem na busca e categorização.
Retorne APENAS um array JSON de strings, exemplo: ["financeiro", "relatório", "exportação"]`,

  'extract-steps': `Você é um especialista em documentação técnica de processos.
Extraia um passo a passo claro e numerado do conteúdo fornecido, em português brasileiro.
Cada passo deve ser uma instrução direta e concisa.
Retorne APENAS um array JSON de strings, onde cada string é um passo.
Exemplo: ["Acesse o menu Configurações", "Clique em Usuários", "Selecione Novo Usuário"]`,
}

function buildMessages(action: string, body: Record<string, any>): Array<{ role: string; content: string }> {
  const systemPrompt = SYSTEM_PROMPTS[action]
  if (!systemPrompt) throw new Error(`Ação desconhecida: ${action}`)

  let userMessage = ''

  switch (action) {
    case 'generate':
      userMessage = `Crie um artigo completo sobre: "${body.title || 'Sem título'}"`
      if (body.module) userMessage += `\nMódulo/Área: ${body.module}`
      if (body.description) userMessage += `\nDescrição adicional: ${body.description}`
      break

    case 'improve':
      userMessage = `Melhore o seguinte artigo:\n\n${body.content || ''}`
      break

    case 'summarize':
      userMessage = `Resuma o seguinte conteúdo:\n\n${body.content || ''}`
      break

    case 'suggest-tags':
      userMessage = `Sugira tags para o seguinte conteúdo:\n\n${body.content || ''}`
      if (body.title) userMessage = `Título: ${body.title}\n\n${userMessage}`
      break

    case 'extract-steps':
      userMessage = `Extraia o passo a passo do seguinte conteúdo:\n\n${body.content || ''}`
      break
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]
}

function parseResponse(action: string, content: string): Record<string, any> {
  switch (action) {
    case 'generate':
    case 'improve':
      return { content }

    case 'summarize':
      return { summary: content.trim() }

    case 'suggest-tags': {
      try {
        const match = content.match(/\[[\s\S]*\]/)
        const tags = match ? JSON.parse(match[0]) : [content.trim()]
        return { tags }
      } catch {
        return { tags: content.split(',').map((t: string) => t.trim().replace(/^["']|["']$/g, '')) }
      }
    }

    case 'extract-steps': {
      try {
        const match = content.match(/\[[\s\S]*\]/)
        const steps = match ? JSON.parse(match[0]) : [content.trim()]
        return { steps }
      } catch {
        return { steps: content.split('\n').filter((l: string) => l.trim()).map((l: string) => l.replace(/^\d+[\.\)]\s*/, '').trim()) }
      }
    }

    default:
      return { content }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action } = body

    if (!action || !SYSTEM_PROMPTS[action]) {
      return new Response(
        JSON.stringify({ error: `Ação inválida: ${action}. Ações disponíveis: ${Object.keys(SYSTEM_PROMPTS).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const messages = buildMessages(action, body)

    const result = await callOpenRouter({
      model: MODEL,
      messages,
      temperature: action === 'generate' ? 0.7 : 0.3,
      max_tokens: action === 'generate' || action === 'improve' ? 4000 : 1000,
    })

    const parsed = parseResponse(action, result.content || '')

    return new Response(
      JSON.stringify({
        ...parsed,
        usage: result.usage,
        model_used: result.model_used,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[ai-article-assistant] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
