/**
 * Centralized default model constants.
 *
 * REGRA: Nenhuma edge function deve ter modelo hardcoded.
 * Toda função deve usar getModelConfig() com estes fallbacks.
 *
 * Quando precisar trocar o modelo padrão do sistema inteiro,
 * basta alterar AQUI — um único lugar.
 *
 * Prioridade de resolução:
 * 1. ai_agents.model (configuração do agente individual)
 * 2. platform_ai_config (configuração por feature)
 * 3. Constantes abaixo (último recurso)
 */

// ── Modelo padrão para agentes (chat, support, sales, etc.) ──
export const DEFAULT_AGENT_MODEL = 'google/gemini-3.1-flash-lite-preview'

// ── Modelo para tarefas leves (classificação, routing, resumo) ──
export const DEFAULT_LITE_MODEL = 'google/gemini-3.1-flash-lite-preview'

// ── Modelo para tarefas multimodal (áudio, imagem, OCR) — Nano Banana 2 ──
export const DEFAULT_MULTIMODAL_MODEL = 'google/gemini-3.1-flash-image-preview'

// ── Modelo para geração de conteúdo (prompts, artigos, builders) ──
export const DEFAULT_CONTENT_MODEL = 'google/gemini-3.1-flash-lite-preview'

// ── Cadeia de fallback padrão (quando modelo primário falha) ──
export const DEFAULT_FALLBACK_CHAIN = [
  'google/gemini-3.1-flash-lite-preview',
  'google/gemini-3-flash-preview',
  'openai/gpt-4o-mini',
  'anthropic/claude-haiku-4-5-20251001',
]

// ── Cadeia de fallback para multimodal (áudio/imagem) — Nano Banana 2 primário ──
export const DEFAULT_MULTIMODAL_FALLBACK_CHAIN = [
  'google/gemini-3.1-flash-image-preview',
  'google/gemini-3-flash-preview',
  'openai/gpt-4o-mini',
]

/**
 * Constrói cadeia de fallback única a partir do modelo primário + fallbacks do agente + defaults.
 */
export function buildFallbackChain(
  primaryModel: string,
  agentFallbacks: string[] = [],
): string[] {
  const chain = [
    primaryModel,
    ...agentFallbacks,
    ...DEFAULT_FALLBACK_CHAIN,
  ]
  return [...new Set(chain)]
}
