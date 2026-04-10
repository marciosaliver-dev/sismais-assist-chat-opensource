import { useState } from 'react'
import { cn } from '@/lib/utils'

interface TranscriptionBlockProps {
  text: string
}

export function TranscriptionBlock({ text }: TranscriptionBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 120
  return (
    <div className="mt-1.5 px-1">
      <p className={cn("text-xs text-muted-foreground italic leading-snug break-words", !expanded && isLong && "line-clamp-2")} style={{ overflowWrap: 'anywhere' }}>
        🎤 {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-primary hover:underline mt-0.5 font-medium"
        >
          {expanded ? 'Recolher ▲' : 'Ver completo ▼'}
        </button>
      )}
    </div>
  )
}
