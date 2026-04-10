import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FeedbackForm } from '@/components/feedback/FeedbackForm'
import { FeedbackList } from '@/components/feedback/FeedbackList'
import { Plus } from 'lucide-react'

export default function Feedback() {
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="page-container"><div className="page-content">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reporte bugs, sugira melhorias ou solicite novas funcionalidades
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Solicitação
        </Button>
      </div>

      <FeedbackList />

      <FeedbackForm open={formOpen} onOpenChange={setFormOpen} />
    </div></div>
  )
}
