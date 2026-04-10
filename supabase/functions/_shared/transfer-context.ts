import { callOpenRouter } from './openrouter-client.ts'
import { getModelConfig } from './get-model-config.ts'
import { DEFAULT_LITE_MODEL } from './default-models.ts'

export interface TransferContext {
  previous_agent: string
  previous_specialty: string
  summary: string
  collected_data: string[]
  client_sentiment: string
  do_not_ask_again: string[]
}

/**
 * Gera resumo estruturado da conversa para transferência entre agentes.
 * Usa modelo rápido/barato pra minimizar custo e latência.
 */
export async function generateTransferContext(
  supabase: any,
  conversationId: string,
  previousAgentName: string,
  previousSpecialty: string,
): Promise<TransferContext> {
  // Buscar últimas 15 mensagens da conversa
  const { data: messages } = await supabase
    .from('ai_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(15)

  if (!messages || messages.length === 0) {
    return {
      previous_agent: previousAgentName,
      previous_specialty: previousSpecialty,
      summary: 'Conversa sem histórico disponível',
      collected_data: [],
      client_sentiment: 'neutro',
      do_not_ask_again: [],
    }
  }

  const history = messages.reverse().map((m: any) =>
    `${m.role === 'user' ? 'Cliente' : previousAgentName}: ${m.content}`
  ).join('\n')

  const modelConfig = await getModelConfig(
    supabase,
    'context_summary',
    DEFAULT_LITE_MODEL,
    0.1,
    500,
  )

  const prompt = `Analise esta conversa de atendimento e retorne um JSON com:
- "summary": resumo em 1-2 frases do que aconteceu e o que ficou pendente
- "collected_data": lista de dados já coletados (ex: ["nome", "empresa", "produto", "numero_boleto"])
- "client_sentiment": humor atual do cliente (satisfeito, neutro, irritado, urgente, ansioso)
- "do_not_ask_again": dados que já foram fornecidos e NÃO devem ser perguntados novamente

Conversa:
${history}

Responda APENAS o JSON, sem markdown.`

  try {
    const result = await callOpenRouter({
      model: modelConfig.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    })

    const jsonMatch = result.content?.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null

    if (!parsed) throw new Error('No JSON found in response')

    return {
      previous_agent: previousAgentName,
      previous_specialty: previousSpecialty,
      summary: parsed.summary || '',
      collected_data: parsed.collected_data || [],
      client_sentiment: parsed.client_sentiment || 'neutro',
      do_not_ask_again: parsed.do_not_ask_again || [],
    }
  } catch (err) {
    console.error('[transfer-context] Failed to generate:', err)
    // Fallback: retornar contexto básico sem LLM
    return {
      previous_agent: previousAgentName,
      previous_specialty: previousSpecialty,
      summary: `Conversa com ${previousAgentName} (${previousSpecialty})`,
      collected_data: [],
      client_sentiment: 'neutro',
      do_not_ask_again: [],
    }
  }
}
