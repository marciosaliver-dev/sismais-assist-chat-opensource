export interface Step {
  title: string
  content: string
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Divide HTML em steps com base em headings (h2, h3 ou markdown ##).
 * Retorna null se não encontrar ao menos 2 headings ou se html for nulo.
 */
export function parseSteps(html: string | null | undefined): Step[] | null {
  if (!html) return null

  const patterns: { regex: RegExp; type: 'html' | 'md' }[] = [
    { regex: /<h2[^>]*>([\s\S]*?)<\/h2>/gi, type: 'html' },
    { regex: /<h3[^>]*>([\s\S]*?)<\/h3>/gi, type: 'html' },
    { regex: /^## (.+)$/gm, type: 'md' },
  ]

  for (const { regex, type } of patterns) {
    const matches = [...html.matchAll(regex)]
    if (matches.length < 2) continue

    const steps: Step[] = []

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]
      const matchStart = match.index!
      const matchEnd = matchStart + match[0].length
      const title = type === 'html' ? stripTags(match[1]).trim() : match[1].trim()
      const contentStart = matchEnd
      const contentEnd = i + 1 < matches.length ? matches[i + 1].index! : html.length
      const content = html.slice(contentStart, contentEnd).trim()
      steps.push({ title, content })
    }

    return steps
  }

  return null
}

/**
 * Conta o número de headings sem fazer parse completo.
 * Retorna 0 se houver menos de 2 headings ou se html for nulo.
 */
export function countSteps(html: string | null | undefined): number {
  if (!html) return 0

  const h2Matches = [...html.matchAll(/<h2[^>]*>/gi)]
  if (h2Matches.length >= 2) return h2Matches.length

  const h3Matches = [...html.matchAll(/<h3[^>]*>/gi)]
  if (h3Matches.length >= 2) return h3Matches.length

  const mdMatches = [...html.matchAll(/^## .+$/gm)]
  if (mdMatches.length >= 2) return mdMatches.length

  return 0
}

/**
 * Estima o tempo de leitura em minutos (mínimo 1).
 */
export function estimateReadingTime(html: string | null | undefined): number {
  if (!html) return 1
  const text = stripTags(html).replace(/\s+/g, ' ').trim()
  const words = text ? text.split(' ').length : 0
  return Math.max(1, Math.ceil(words / 200))
}
