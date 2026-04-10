import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const db = supabase as any

interface SLARow {
  id: string
  priority: string
  first_response_minutes: number
  resolution_hours: number
  escalation_after_minutes: number | null
  notify_agents: boolean
  notify_managers_on_breach: boolean
  active: boolean
}

const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  critical: { label: 'Crítica', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
  high:     { label: 'Alta',    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' },
  medium:   { label: 'Média',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200' },
  low:      { label: 'Baixa',   className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200' },
}

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low']

export default function SLAConfigTab() {
  const qc = useQueryClient()
  const [editRows, setEditRows] = useState<Record<string, Partial<SLARow>>>({})

  const { data: rows, isLoading } = useQuery({
    queryKey: ['sla-configurations'],
    queryFn: async () => {
      const { data, error } = await db
        .from('sla_configurations')
        .select('*')
        .order('priority', { ascending: true })
      if (error) throw error
      return ((data || []) as SLARow[]).sort(
        (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
      )
    },
  })

  useEffect(() => {
    if (rows) {
      const init: Record<string, Partial<SLARow>> = {}
      for (const r of rows) init[r.id] = { ...r }
      setEditRows(init)
    }
  }, [rows])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = Object.entries(editRows).map(([id, data]) =>
        db.from('sla_configurations')
          .update({
            first_response_minutes: Number(data.first_response_minutes) || 0,
            resolution_hours: Number(data.resolution_hours) || 0,
            escalation_after_minutes: data.escalation_after_minutes ? Number(data.escalation_after_minutes) : null,
            notify_agents: data.notify_agents,
            notify_managers_on_breach: data.notify_managers_on_breach,
            active: data.active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
      )
      const results = await Promise.all(promises)
      for (const r of results) {
        if (r.error) throw r.error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla-configurations'] })
      qc.invalidateQueries({ queryKey: ['ticket-sla-config'] })
      toast.success('Configurações de SLA salvas')
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  })

  const updateField = (id: string, field: keyof SLARow, value: unknown) => {
    setEditRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
          Nenhuma configuração de SLA encontrada. Execute a migration para criar os valores padrão.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            SLA por Prioridade
          </CardTitle>
          <CardDescription>
            Defina os tempos de primeira resposta, resolução e escalonamento para cada nível de prioridade.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Prioridade</TableHead>
                <TableHead>1ª Resposta (min)</TableHead>
                <TableHead>Resolução (h)</TableHead>
                <TableHead>Escalar após (min)</TableHead>
                <TableHead className="text-center">Avisar agentes</TableHead>
                <TableHead className="text-center">Avisar gestores</TableHead>
                <TableHead className="text-center">Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const edit = editRows[row.id] || row
                const cfg = PRIORITY_LABELS[row.priority]
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant="outline" className={cfg?.className}>
                        {cfg?.label || row.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={edit.first_response_minutes ?? ''}
                        onChange={(e) => updateField(row.id, 'first_response_minutes', e.target.value)}
                        className="w-20 h-7 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={edit.resolution_hours ?? ''}
                        onChange={(e) => updateField(row.id, 'resolution_hours', e.target.value)}
                        className="w-20 h-7 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={edit.escalation_after_minutes ?? ''}
                        onChange={(e) => updateField(row.id, 'escalation_after_minutes', e.target.value || null)}
                        className="w-24 h-7 text-sm"
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={!!edit.notify_agents}
                        onCheckedChange={(v) => updateField(row.id, 'notify_agents', v)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={!!edit.notify_managers_on_breach}
                        onCheckedChange={(v) => updateField(row.id, 'notify_managers_on_breach', v)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={!!edit.active}
                        onCheckedChange={(v) => updateField(row.id, 'active', v)}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  )
}
