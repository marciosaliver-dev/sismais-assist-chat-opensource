import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Tables } from '@/integrations/supabase/types'

type Conversation = Tables<'ai_conversations'>

interface DeleteConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: Conversation
  onDeleted?: () => void
}

export function DeleteConversationDialog({
  open,
  onOpenChange,
  conversation,
  onDeleted,
}: DeleteConversationDialogProps) {
  const { user } = useSupabaseAuth()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!user) return
    setDeleting(true)
    try {
      // 1. Create deletion log with snapshot
      const { error: logError } = await supabase
        .from('conversation_deletion_logs' as any)
        .insert({
          conversation_id: conversation.id,
          ticket_number: conversation.ticket_number,
          customer_phone: conversation.customer_phone,
          customer_name: conversation.customer_name,
          deleted_by: user.id,
          reason: reason.trim() || null,
          conversation_snapshot: {
            status: conversation.status,
            handler_type: conversation.handler_type,
            started_at: conversation.started_at,
            resolved_at: conversation.resolved_at,
            human_agent_id: conversation.human_agent_id,
            current_agent_id: conversation.current_agent_id,
            tags: conversation.tags,
            priority: conversation.priority,
            kanban_board_id: conversation.kanban_board_id,
            kanban_stage_id: conversation.kanban_stage_id,
          },
        })

      if (logError) throw logError

      // 2. Delete messages first (FK constraint)
      const { error: msgError } = await supabase
        .from('ai_messages')
        .delete()
        .eq('conversation_id', conversation.id)

      if (msgError) throw msgError

      // 3. Delete the conversation
      const { error: convError } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversation.id)

      if (convError) throw convError

      toast.success(`Ticket #${conversation.ticket_number} excluído com sucesso`)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      onOpenChange(false)
      onDeleted?.()
    } catch (err: unknown) {
      toast.error('Erro ao excluir: ' + ((err as Error).message || 'falha'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Excluir Ticket #{conversation.ticket_number}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Esta ação é <strong>irreversível</strong>. O ticket, todas as mensagens e dados associados serão
              permanentemente removidos. Um log de auditoria será mantido.
            </p>
            <p className="text-xs text-muted-foreground">
              Cliente: {conversation.customer_name || conversation.customer_phone}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="delete-reason" className="text-sm font-medium">
            Motivo da exclusão (opcional)
          </Label>
          <Textarea
            id="delete-reason"
            placeholder="Descreva o motivo da exclusão..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {deleting ? 'Excluindo...' : 'Excluir permanentemente'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
