import { cn } from '@/lib/utils'
import { User, Sparkles } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  msg: ChatMessage
}

export function ChatBubble({ msg }: Props) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-[#45E5E5]/20' : 'bg-violet-500/20'
      )}>
        {isUser
          ? <User className="w-4 h-4 text-[#10293F]" />
          : <Sparkles className="w-4 h-4 text-violet-500" />
        }
      </div>
      <div className={cn(
        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%]',
        isUser
          ? 'bg-[#10293F] text-white rounded-tr-sm'
          : 'bg-muted text-foreground rounded-tl-sm'
      )}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  )
}
