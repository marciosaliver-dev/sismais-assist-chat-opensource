import React from 'react'

// ===== Helper: detect encrypted/inaccessible WhatsApp URLs =====
export function isEncryptedUrl(url?: string | null): boolean {
  if (!url) return false
  return url.includes('.enc') || (url.includes('mmg.whatsapp.net') && !url.includes('supabase'))
}

// ===== Helper: render inline markdown (links, bold, URLs) =====
export function linkifyText(text: string): React.ReactNode {
  const combinedRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*(.+?)\*\*)|(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi
  const result: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      result.push(
        React.createElement('a', {
          key: key++,
          href: match[3],
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-primary underline underline-offset-2 break-all hover:opacity-80 font-medium',
        }, match[2])
      )
    } else if (match[4]) {
      result.push(React.createElement('strong', { key: key++, className: 'font-semibold' }, match[5]))
    } else if (match[6]) {
      const href = match[6].startsWith('www.') ? `https://${match[6]}` : match[6]
      result.push(
        React.createElement('a', {
          key: key++,
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-primary underline underline-offset-2 break-all hover:opacity-80',
        }, match[6])
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex))
  }

  return result.length === 0 ? text : result
}

// ===== Helper: detect emoji-only messages =====
const EMOJI_REGEX = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u

export function isEmojiOnly(text: string): boolean {
  if (!text || text.trim().length === 0) return false
  const cleaned = text.replace(/\s/g, '')
  if (cleaned.length === 0) return false
  if (!EMOJI_REGEX.test(text.trim())) return false
  const chars = [...cleaned]
  return chars.length <= 24
}

export function getEmojiSize(text: string): string {
  const cleaned = text.replace(/\s/g, '')
  const chars = [...cleaned]
  const count = chars.length
  if (count <= 6) return 'text-5xl'
  if (count <= 12) return 'text-3xl'
  return 'text-2xl'
}

// ===== Priority badge config =====
export const priorityBadgeConfig: Record<string, { label: string; className: string }> = {
  critical: { label: 'Crítica', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  high: { label: 'Alta', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  medium: { label: 'Média', className: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800' },
  low: { label: 'Baixa', className: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800' },
}

// ===== Helper: get initials color =====
export function getInitialsColor(name: string): string {
  const colors = [
    'bg-primary/20 text-primary',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

// ===== Helper: format elapsed time =====
export function formatElapsedTime(startDate: string): string {
  const ms = Date.now() - new Date(startDate).getTime()
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (mins > 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`
  return `${mins}m ${secs}s`
}

// ===== Audio speed options =====
export const AUDIO_SPEED_OPTIONS = [1, 1.5, 2, 0.5]

// ===== Waveform generator =====
export function generateWaveform(seed: string, barCount: number): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const bars: number[] = []
  for (let i = 0; i < barCount; i++) {
    hash = (hash * 16807 + 12345) & 0x7fffffff
    const val = 0.15 + (hash % 100) / 100 * 0.85
    bars.push(val)
  }
  return bars
}

// ===== Emoji list =====
export const EMOJI_LIST = [
  "😀","😂","🥰","😍","🤩","😎","🤗","🤔","😅","😢","😡","👍","👎","❤️","🔥","🎉","👏","🙏","💪","✅",
  "😊","😘","🤣","😜","🙄","😴","🤮","💀","👻","🤖","👋","✌️","🤝","🫶","💯","⭐","🚀","💡","📌","🎯",
  "😃","😁","😆","😋","😝","🤑","🥳","😇","🥺","😤","🤯","🫡","🤫","🫣","😶","🤥","😬","🫠","🤧","😷",
]

// ===== Types =====
export interface ReplyInfo {
  messageId: string
  uazapiMessageId?: string | null
  content: string
  role: string
  senderName?: string
  mediaType?: string | null
}

export interface PendingMedia {
  file: File
  type: string
  previewUrl: string
}

export type AISuggestionMode = 'generate' | 'context' | 'improve'

export interface LightboxImage {
  url: string
  caption?: string
  senderName: string
  time: string | null
}
