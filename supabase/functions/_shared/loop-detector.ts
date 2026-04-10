/**
 * Detector de respostas repetidas (anti-loop) para o sistema Sismais.
 *
 * Compara a resposta gerada pela IA com as últimas N respostas da conversa.
 * Se detectar similaridade excessiva (loop), retorna sinal de escalação.
 *
 * Métodos de detecção:
 * 1. Similaridade Jaccard entre tokens (trigrams)
 * 2. Detecção de perguntas repetidas
 * 3. Contagem de respostas quase idênticas
 */

export interface LoopDetectionResult {
  isLoop: boolean
  reason?: string
  similarity?: number
  /** Quantas respostas similares foram encontradas */
  matchCount: number
}

/**
 * Gera trigrams (conjuntos de 3 palavras consecutivas) de um texto.
 */
function getTrigrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\sà-ú]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)

  const trigrams = new Set<string>()
  for (let i = 0; i <= words.length - 3; i++) {
    trigrams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  }
  return trigrams
}

/**
 * Calcula similaridade Jaccard entre dois conjuntos de trigrams.
 * Retorna valor entre 0 (nenhuma similaridade) e 1 (idênticos).
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  for (const item of a) {
    if (b.has(item)) intersection++
  }

  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Extrai perguntas de um texto (frases que terminam com ?).
 */
function extractQuestions(text: string): string[] {
  const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean)
  return sentences.filter(s => text.includes(s + '?')).map(s => s.toLowerCase().replace(/[^\w\sà-ú]/g, ''))
}

/**
 * Detecta se a nova resposta da IA é um loop (repetição) comparando
 * com as últimas respostas assistentes na conversa.
 *
 * @param newResponse - A resposta que a IA acabou de gerar
 * @param previousAssistantMessages - Últimas mensagens do assistente (mais recentes primeiro)
 * @param options - Configurações de threshold
 */
export function detectLoop(
  newResponse: string,
  previousAssistantMessages: string[],
  options?: {
    /** Threshold de similaridade para considerar loop (default: 0.75) */
    similarityThreshold?: number
    /** Máximo de mensagens anteriores para comparar (default: 5) */
    maxCompare?: number
    /** Mínimo de matches para considerar loop (default: 2) */
    minMatches?: number
  }
): LoopDetectionResult {
  const threshold = options?.similarityThreshold ?? 0.60
  const maxCompare = options?.maxCompare ?? 5
  const minMatches = options?.minMatches ?? 2

  // Sem histórico suficiente → sem loop (mínimo 1 para detectar repetição imediata)
  if (previousAssistantMessages.length < 1) {
    return { isLoop: false, matchCount: 0 }
  }

  const recentMessages = previousAssistantMessages.slice(0, maxCompare)
  const newTrigrams = getTrigrams(newResponse)

  // Se a resposta é muito curta, usar comparação direta normalizada
  const normalizedNew = newResponse.toLowerCase().replace(/[^\w\sà-ú]/g, '').trim()

  let matchCount = 0
  let highestSimilarity = 0

  for (const prevMsg of recentMessages) {
    const normalizedPrev = prevMsg.toLowerCase().replace(/[^\w\sà-ú]/g, '').trim()

    // Comparação exata (após normalização)
    if (normalizedNew === normalizedPrev) {
      matchCount++
      highestSimilarity = 1.0
      continue
    }

    // Comparação por trigrams
    const prevTrigrams = getTrigrams(prevMsg)
    const similarity = jaccardSimilarity(newTrigrams, prevTrigrams)

    if (similarity >= threshold) {
      matchCount++
    }

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity
    }
  }

  // Detecção 0: Single near-identical match (similarity > 0.90)
  if (highestSimilarity > 0.90 && matchCount >= 1) {
    return {
      isLoop: true,
      reason: `Resposta quase idêntica detectada (similaridade: ${(highestSimilarity * 100).toFixed(0)}%)`,
      similarity: highestSimilarity,
      matchCount,
    }
  }

  // Detecção 1: Múltiplas respostas similares
  if (matchCount >= minMatches) {
    return {
      isLoop: true,
      reason: `IA repetiu resposta similar ${matchCount} vezes (similaridade: ${(highestSimilarity * 100).toFixed(0)}%)`,
      similarity: highestSimilarity,
      matchCount,
    }
  }

  // Detecção 2: Mesma pergunta feita 2+ vezes pela IA
  const newQuestions = extractQuestions(newResponse)
  if (newQuestions.length > 0) {
    for (const question of newQuestions) {
      let questionRepeatCount = 0
      for (const prevMsg of recentMessages) {
        const prevQuestions = extractQuestions(prevMsg)
        if (prevQuestions.some(pq => jaccardSimilarity(getTrigrams(question), getTrigrams(pq)) > 0.8)) {
          questionRepeatCount++
        }
      }
      if (questionRepeatCount >= 2) {
        return {
          isLoop: true,
          reason: `IA repetiu a mesma pergunta ${questionRepeatCount + 1} vezes`,
          similarity: highestSimilarity,
          matchCount: questionRepeatCount + 1,
        }
      }
    }
  }

  return {
    isLoop: false,
    similarity: highestSimilarity,
    matchCount,
  }
}
