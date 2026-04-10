import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { GraduationCap, Plus, Pencil, Trash2, Save, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  agentId?: string
}

interface QAPair {
  id: string
  title: string
  content: string
  created_at: string | null
}

export function AgentQATraining({ agentId }: Props) {
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')

  // Fetch Q&A pairs for this agent
  const { data: qaPairs, isLoading } = useQuery({
    queryKey: ['agent-qa', agentId],
    queryFn: async () => {
      if (!agentId) return []
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .select('id, title, content, created_at')
        .eq('category', 'qa')
        .eq('source', 'agent_training')
        .eq('is_active', true)
        .contains('agent_filter', [agentId])
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as QAPair[]
    },
    enabled: !!agentId
  })

  // Create Q&A pair
  const createQA = useMutation({
    mutationFn: async ({ q, a }: { q: string; a: string }) => {
      const content = `Pergunta: ${q}\n\nResposta: ${a}`
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .insert({
          title: q,
          content,
          content_type: 'text',
          category: 'qa',
          source: 'agent_training',
          agent_filter: [agentId!],
          tags: ['qa', 'treinamento']
        })
        .select('id')
        .single()

      if (error) throw error

      // Fire-and-forget embedding generation
      supabase.functions.invoke('generate-embedding', {
        body: { document_id: data.id, content, title: q }
      }).catch(e => console.error('Embedding error:', e))

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-qa', agentId] })
      setQuestion('')
      setAnswer('')
      toast.success('Par Q&A adicionado!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao adicionar Q&A')
    }
  })

  // Update Q&A pair
  const updateQA = useMutation({
    mutationFn: async ({ id, q, a }: { id: string; q: string; a: string }) => {
      const content = `Pergunta: ${q}\n\nResposta: ${a}`
      const { error } = await supabase
        .from('ai_knowledge_base')
        .update({ title: q, content, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      // Re-generate embedding
      supabase.functions.invoke('generate-embedding', {
        body: { document_id: id, content, title: q }
      }).catch(e => console.error('Embedding error:', e))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-qa', agentId] })
      setEditingId(null)
      toast.success('Q&A atualizado!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar Q&A')
    }
  })

  // Delete Q&A pair (soft delete)
  const deleteQA = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_knowledge_base')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-qa', agentId] })
      toast.success('Q&A removido')
    }
  })

  const handleAdd = () => {
    if (!question.trim() || !answer.trim()) {
      toast.error('Preencha a pergunta e a resposta')
      return
    }
    createQA.mutate({ q: question.trim(), a: answer.trim() })
  }

  const startEdit = (pair: QAPair) => {
    setEditingId(pair.id)
    setEditQuestion(pair.title)
    // Extract answer from content format "Pergunta: ...\n\nResposta: ..."
    const answerMatch = pair.content.match(/Resposta:\s*([\s\S]*)/)
    setEditAnswer(answerMatch ? answerMatch[1].trim() : pair.content)
  }

  const handleSaveEdit = () => {
    if (!editingId || !editQuestion.trim() || !editAnswer.trim()) return
    updateQA.mutate({ id: editingId, q: editQuestion.trim(), a: editAnswer.trim() })
  }

  if (!agentId) {
    return (
      <div className="text-center py-12 space-y-3">
        <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
        <p className="text-muted-foreground text-sm">Salve o agente primeiro para adicionar treinamento Q&A</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Add new Q&A */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-foreground font-medium">Novo Par Pergunta/Resposta</Label>
          {qaPairs && qaPairs.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {qaPairs.length} {qaPairs.length === 1 ? 'par' : 'pares'}
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pergunta do cliente (ex: Como resetar minha senha?)"
          />
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Resposta ideal que o agente deve dar..."
            rows={3}
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={createQA.isPending || !question.trim() || !answer.trim()}
            size="sm"
            className="gap-1.5"
          >
            {createQA.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Adicionar
          </Button>
        </div>
      </div>

      <Separator />

      {/* Q&A list */}
      <div className="space-y-2">
        <Label className="text-foreground font-medium">Pares Q&A Existentes</Label>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : qaPairs && qaPairs.length > 0 ? (
          <div className="space-y-2">
            {qaPairs.map((pair) => (
              <Card key={pair.id} className="border-border">
                <CardContent className="p-3">
                  {editingId === pair.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                        placeholder="Pergunta"
                      />
                      <Textarea
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        placeholder="Resposta"
                        rows={3}
                      />
                      <div className="flex gap-1">
                        <Button type="button" size="sm" onClick={handleSaveEdit} disabled={updateQA.isPending} className="gap-1">
                          <Save className="w-3 h-3" /> Salvar
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="w-3 h-3" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{pair.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {pair.content.replace(/^Pergunta:.*?\n\nResposta:\s*/s, '')}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(pair)} aria-label="Editar pergunta">
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteQA.mutate(pair.id)} aria-label="Excluir pergunta">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 border border-dashed border-border rounded-lg">
            <GraduationCap className="w-8 h-8 mx-auto text-muted-foreground opacity-30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum par Q&A adicionado ainda</p>
            <p className="text-xs text-muted-foreground">Adicione perguntas e respostas para treinar este agente</p>
          </div>
        )}
      </div>
    </div>
  )
}
