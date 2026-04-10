import { cn } from '@/lib/utils'
import { Bot, Lock } from 'lucide-react'
import type { AtendimentoMessage } from './types'

interface Props {
  message: AtendimentoMessage
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function isHTML(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text)
}

const proseClasses = 'prose prose-sm max-w-none [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:bg-[var(--gms-g100)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:border [&_th]:border-[var(--gms-g200)] [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-[var(--gms-g200)] [&_a]:text-[var(--gms-info)] [&_a]:underline [&_strong]:font-semibold [&_mark]:bg-[var(--gms-yellow)]/30 [&_mark]:px-0.5 [&_mark]:rounded'

function RichContent({ content, className }: { content: string; className?: string }) {
  if (isHTML(content)) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: content }}
        className={cn(proseClasses, 'text-[13px] leading-relaxed break-words', className)}
        style={{ overflowWrap: 'anywhere' }}
      />
    )
  }
  return (
    <p className={cn('text-[13px] leading-relaxed break-words', className)} style={{ overflowWrap: 'anywhere' }}>
      {content}
    </p>
  )
}

export function ChatMessage({ message }: Props) {
  const { sender, content, senderName, timestamp, isInternal } = message

  // System message — centered
  if (sender === 'system') {
    return (
      <div className="flex justify-center py-1">
        <div className="bg-[var(--gms-g100)] border border-[var(--gms-g200)] rounded-full px-3 py-1 text-xs text-[var(--gms-g500)] flex items-center gap-1.5">
          <Bot className="w-3 h-3" />
          {content}
        </div>
      </div>
    )
  }

  // Internal note — yellow
  if (isInternal) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%]">
          <div className="bg-[var(--gms-yellow-bg)] border border-[var(--gms-yellow)]/30 rounded-xl rounded-br-sm px-3 py-2">
            <div className="flex items-center gap-1 mb-1">
              <Lock className="w-3 h-3 text-[var(--gms-warn)]" />
              <span className="text-[9px] font-semibold text-[var(--gms-warn)] uppercase">Nota interna</span>
            </div>
            <RichContent content={content} className="text-[var(--gms-g900)]" />
          </div>
          <p className="text-xs text-[var(--gms-g500)]/50 mt-0.5 text-right">{formatTime(timestamp)}</p>
        </div>
      </div>
    )
  }

  const isIncoming = sender === 'customer'
  const isAI = sender === 'ai'

  return (
    <div className={cn('flex', isIncoming ? 'justify-start' : 'justify-end')}>
      <div className="max-w-[70%]">
        {/* Sender name */}
        {senderName && (
          <div className={cn('flex items-center gap-1 mb-0.5', !isIncoming && 'justify-end')}>
            {isAI && <Bot className="w-3 h-3 text-[var(--gms-purple)]" />}
            <span className={cn(
              'text-xs font-medium',
              isAI ? 'text-[var(--gms-purple)]' : isIncoming ? 'text-[var(--gms-g500)]' : 'text-[var(--gms-info)]',
            )}>
              {senderName}
            </span>
          </div>
        )}
        {/* Bubble */}
        <div
          className={cn(
            'px-3 py-2',
            isIncoming
              ? 'bg-white border border-[var(--gms-g200)] rounded-xl rounded-bl-sm text-[var(--gms-g900)]'
              : isAI
                ? 'bg-[var(--gms-purple)]/10 border border-[var(--gms-purple)]/20 rounded-xl rounded-br-sm text-[var(--gms-g900)]'
                : 'bg-[var(--gms-cyan)] rounded-xl rounded-br-sm text-[var(--gms-navy)]',
          )}
        >
          <RichContent content={content} />
        </div>
        {/* Time */}
        <p className={cn(
          'text-xs mt-0.5 opacity-50',
          isIncoming ? 'text-left text-[var(--gms-g500)]' : 'text-right text-[var(--gms-g500)]',
        )}>
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  )
}