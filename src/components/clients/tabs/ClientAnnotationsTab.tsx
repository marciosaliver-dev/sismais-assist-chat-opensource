import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ClientAnnotationsTabProps {
  annotations: any[]
  onAddAnnotation: (content: string) => void
  isPending: boolean
}

export function ClientAnnotationsTab({ annotations, onAddAnnotation, isPending }: ClientAnnotationsTabProps) {
  const navigate = useNavigate()
  const [newNote, setNewNote] = useState('')

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          placeholder="Escreva uma anotacao..."
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          rows={3}
        />
        <Button
          size="sm"
          disabled={!newNote.trim() || isPending}
          onClick={() => { if (newNote.trim()) { onAddAnnotation(newNote.trim()); setNewNote('') } }}
        >
          {isPending ? 'Salvando...' : 'Salvar Anotacao'}
        </Button>
      </div>
      {annotations.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma anotacao ainda.</p>
      ) : (
        <div className="space-y-3">
          {annotations.map((a: any) => (
            <div key={a.id} className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/30 p-3 space-y-1">
              <p className="text-sm text-foreground whitespace-pre-wrap">{a.content}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{a.author || 'Sistema'}</span>
                <span>-</span>
                <span>{format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                {a.conversation_id && (
                  <>
                    <span>-</span>
                    <button
                      className="text-primary hover:underline"
                      onClick={() => navigate(`/kanban/support?ticket=${a.conversation_id}`)}
                    >
                      Ver conversa
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
