import { useState } from 'react'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { useBoardLeaders } from '@/hooks/useBoardLeaders'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { X, UserPlus, Clock, Shield } from 'lucide-react'

interface SystemUser {
  user_id: string
  name: string
  email: string
  role: string
}

function useLeaderUsers() {
  return useQuery({
    queryKey: ['leader-users'],
    queryFn: async () => {
      // Buscar usuários com role lider ou admin
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'lider'])
        .eq('is_approved', true)

      if (error) throw error
      if (!roles || roles.length === 0) return []

      const userIds = roles.map(r => r.user_id)
      const { data: agents } = await supabase
        .from('human_agents')
        .select('user_id, name, email')
        .in('user_id', userIds)

      const agentMap = new Map<string, { name: string; email: string }>()
      for (const a of agents || []) {
        agentMap.set(a.user_id, { name: a.name, email: a.email || '' })
      }

      return roles.map(r => ({
        user_id: r.user_id,
        name: agentMap.get(r.user_id)?.name || r.user_id,
        email: agentMap.get(r.user_id)?.email || '',
        role: r.role,
      })) as SystemUser[]
    },
  })
}

function BoardLeaderCard({ board }: { board: { id: string; name: string; color: string; queue_alert_threshold_minutes: number | null } }) {
  const { leaders, isLoading, addLeader, removeLeader } = useBoardLeaders(board.id)
  const { data: leaderUsers } = useLeaderUsers()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [threshold, setThreshold] = useState(board.queue_alert_threshold_minutes?.toString() || '')
  const queryClient = useQueryClient()

  const updateThreshold = useMutation({
    mutationFn: async (minutes: number) => {
      const { error } = await (supabase as any)
        .from('kanban_boards')
        .update({ queue_alert_threshold_minutes: minutes || null })
        .eq('id', board.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-boards-active'] })
      toast.success(`Tempo de alerta atualizado para ${board.name}`)
    },
    onError: () => toast.error('Erro ao atualizar tempo de alerta'),
  })

  // Filtrar usuários que já são líderes deste board
  const existingUserIds = new Set(leaders.map(l => l.user_id))
  const availableUsers = (leaderUsers || []).filter(u => !existingUserIds.has(u.user_id))

  const handleAddLeader = () => {
    if (!selectedUserId) return
    addLeader.mutate({ boardId: board.id, userId: selectedUserId })
    setSelectedUserId('')
  }

  const handleSaveThreshold = () => {
    const minutes = parseInt(threshold) || 0
    updateThreshold.mutate(minutes)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-3 h-3 rounded-full" style={{ background: board.color || '#45E5E5' }} />
          {board.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Threshold de alerta */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Alertar após (minutos)
            </Label>
            <Input
              type="number"
              min={0}
              max={60}
              placeholder="0 = desabilitado"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button
            size="sm"
            onClick={handleSaveThreshold}
            disabled={updateThreshold.isPending}
            style={{ background: '#45E5E5', color: '#10293F' }}
          >
            Salvar
          </Button>
        </div>

        {/* Líderes associados */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
            <Shield className="h-3 w-3" />
            Líderes deste board
          </Label>

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : leaders.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum líder associado</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {leaders.map(leader => (
                <Badge key={leader.id} variant="secondary" className="gap-1 pr-1">
                  {leader.user_name || leader.user_email || 'Sem nome'}
                  <button
                    className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                    onClick={() => removeLeader.mutate(leader.id)}
                    aria-label={`Remover ${leader.user_name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Adicionar líder */}
          <div className="flex items-center gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecionar líder..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
                {availableUsers.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Todos os líderes já estão associados
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddLeader}
              disabled={!selectedUserId || addLeader.isPending}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function BoardLeadersTab() {
  const { data: boards, isLoading } = useKanbanBoards()

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Carregando boards...</p>
  }

  if (!boards || boards.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhum board ativo encontrado.</p>
  }

  return (
    <div className="space-y-4 py-4">
      <div>
        <h3 className="text-base font-semibold">Líderes e Alertas de Fila</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure líderes por board e o tempo limite para alertas de fila.
          Líderes recebem um alerta modal quando clientes ultrapassam o tempo configurado.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {boards.map(board => (
          <BoardLeaderCard
            key={board.id}
            board={board}
          />
        ))}
      </div>
    </div>
  )
}
