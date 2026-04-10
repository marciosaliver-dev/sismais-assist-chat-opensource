import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface ArticleFeedbackProps {
  articleId: string
}

export function ArticleFeedback({ articleId }: ArticleFeedbackProps) {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleFeedback = async (helpful: boolean) => {
    setLoading(true)
    try {
      const column = helpful ? 'helpful_count' : 'not_helpful_count'
      const { data: current } = await supabase
        .from('ai_knowledge_base')
        .select(column)
        .eq('id', articleId)
        .single()

      if (current) {
        await supabase
          .from('ai_knowledge_base')
          .update({ [column]: (current[column] || 0) + 1 })
          .eq('id', articleId)
      }

      setSubmitted(true)
      toast.success('Obrigado pelo feedback!')
    } catch {
      toast.error('Erro ao enviar feedback')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Obrigado pelo seu feedback!
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 justify-center py-4 border-t mt-6">
      <span className="text-sm text-muted-foreground">Este artigo foi útil?</span>
      <Button variant="outline" size="sm" onClick={() => handleFeedback(true)} disabled={loading}>
        <ThumbsUp className="h-4 w-4 mr-1" /> Sim
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleFeedback(false)} disabled={loading}>
        <ThumbsDown className="h-4 w-4 mr-1" /> Não
      </Button>
    </div>
  )
}
