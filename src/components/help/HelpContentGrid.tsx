import { Loader2, BookOpen } from 'lucide-react'
import { HelpContentCard } from './HelpContentCard'
import type { PublicKnowledgeItem } from '@/hooks/usePublicKnowledge'

interface HelpContentGridProps {
  items: PublicKnowledgeItem[]
  isLoading: boolean
  emptyMessage?: string
}

export function HelpContentGrid({ items, isLoading, emptyMessage = 'Nenhum conteúdo encontrado.' }: HelpContentGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((item) => (
        <HelpContentCard key={item.id} item={item} />
      ))}
    </div>
  )
}
