import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Save, Clock, Bell, Loader2 } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface SLARow {
  id: string
  priority: string
  name: string
  first_response_target_minutes: number
  resolution_target_minutes: number
}

interface AlertsConfig {
  notify_agent_80_pct: boolean
  notify_supervisor_exceeded: boolean
  notify_resolution_80_pct: boolean
  notify_targets: string
}

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low']

function formatMinutes(m: number): string {
  if (!m && m !== 0) return ''
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}min`
  return `${h}h ${min}min`
}

export default function SLAQualityTab() {
  const queryClient = useQueryClient()

  // ── SLA Config ──
  const { data: slaRows, isLoading: slaLoading } = useQuery({
    queryKey: ['ticket-sla-config-settings'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ticket_sla_config')
        .select('*')
        .eq('active', true)
      if (error) throw error
      return (data as SLARow[]).sort(
        (a: SLARow, b: SLARow) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
      )
    },
  })

  const [slaEdits, setSlaEdits] = useState<Record<string, { first: number; resolution: number }>>({})

  useEffect(() => {
    if (slaRows) {
      const map: Record<string, { first: number; resolution: number }> = {}
      for (const row of slaRows) {
        map[row.id] = { first: row.first_response_target_minutes, resolution: row.resolution_target_minutes }
      }
      setSlaEdits(map)
    }
  }, [slaRows])

  const saveSLA = useMutation({
    mutationFn: async () => {
      for (const [id, vals] of Object.entries(slaEdits)) {
        const { error } = await db
          .from('ticket_sla_config')
          .update({
            first_response_target_minutes: vals.first,
            resolution_target_minutes: vals.resolution,
          })
          .eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-sla-config-settings'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-sla-config'] })
      toast.success('SLA salvo', { description: 'Prazos atualizados com sucesso.' })
    },
    onError: (err: unknown) => toast.error('Erro ao salvar SLA', { description: String(err) }),
  })

  // ── Alerts Config ──
  const { data: alertsRaw, isLoading: alertsLoading } = useQuery({
    queryKey: ['platform_ai_config', 'sla_alerts'],
    queryFn: async () => {
      const { data, error } = await db
        .from('platform_ai_config')
        .select('*')
        .eq('feature', 'sla_alerts')
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const defaultAlerts: AlertsConfig = {
    notify_agent_80_pct: true,
    notify_supervisor_exceeded: true,
    notify_resolution_80_pct: true,
    notify_targets: 'agent',
  }

  const [alerts, setAlerts] = useState<AlertsConfig>(defaultAlerts)

  useEffect(() => {
    if (alertsRaw?.extra_config) {
      const ec = alertsRaw.extra_config as Record<string, unknown>
      setAlerts({
        notify_agent_80_pct: ec.notify_agent_80_pct as boolean ?? true,
        notify_supervisor_exceeded: ec.notify_supervisor_exceeded as boolean ?? true,
        notify_resolution_80_pct: ec.notify_resolution_80_pct as boolean ?? true,
        notify_targets: Array.isArray(ec.notify_targets) ? (ec.notify_targets as string[])[0] || 'agent' : 'agent',
      })
    }
  }, [alertsRaw])

  const saveAlerts = useMutation({
    mutationFn: async () => {
      const { error } = await db
        .from('platform_ai_config')
        .upsert({
          feature: 'sla_alerts',
          extra_config: {
            notify_agent_80_pct: alerts.notify_agent_80_pct,
            notify_supervisor_exceeded: alerts.notify_supervisor_exceeded,
            notify_resolution_80_pct: alerts.notify_resolution_80_pct,
            notify_targets: [alerts.notify_targets],
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'feature' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform_ai_config', 'sla_alerts'] })
      toast.success('Alertas salvos', { description: 'Configurações de alertas atualizadas.' })
    },
    onError: (err: unknown) => toast.error('Erro ao salvar alertas', { description: String(err) }),
  })

  const isLoading = slaLoading || alertsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="sla-settings">
      {/* ── SLA por Prioridade ── */}
      <div className="sla-card">
        <div className="sla-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Clock className="w-5 h-5" />
              Configuração de SLA por Prioridade
            </h3>
            <p className="sc-desc">Defina os prazos de primeira resposta e resolução para cada nível de prioridade.</p>
          </div>
          <Button
            size="sm"
            onClick={() => saveSLA.mutate()}
            disabled={saveSLA.isPending}
            className="btn-primary"
          >
            {saveSLA.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Tudo
          </Button>
        </div>
        <div className="sla-card-content">
          <table className="sla-table">
            <thead>
              <tr>
                <th>Prioridade</th>
                <th>Primeira Resposta</th>
                <th>Equivalente</th>
                <th>Resolução</th>
                <th>Equivalente</th>
              </tr>
            </thead>
            <tbody>
              {slaRows?.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.name}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      className="sla-input"
                      value={slaEdits[row.id]?.first ?? ''}
                      onChange={(e) =>
                        setSlaEdits((prev) => ({
                          ...prev,
                          [row.id]: { ...prev[row.id], first: parseInt(e.target.value) || 0 },
                        }))
                      }
                    />
                  </td>
                  <td className="text-muted">{formatMinutes(slaEdits[row.id]?.first || 0)}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      className="sla-input"
                      value={slaEdits[row.id]?.resolution ?? ''}
                      onChange={(e) =>
                        setSlaEdits((prev) => ({
                          ...prev,
                          [row.id]: { ...prev[row.id], resolution: parseInt(e.target.value) || 0 },
                        }))
                      }
                    />
                  </td>
                  <td className="text-muted">{formatMinutes(slaEdits[row.id]?.resolution || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Alertas SLA ── */}
      <div className="sla-card">
        <div className="sla-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Bell className="w-5 h-5" />
              Alertas e Notificações
            </h3>
            <p className="sc-desc">Configure quando e quem será notificado sobre eventos de SLA.</p>
          </div>
          <Button
            size="sm"
            onClick={() => saveAlerts.mutate()}
            disabled={saveAlerts.isPending}
            className="btn-primary"
          >
            {saveAlerts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
        <div className="sla-card-content">
          <div className="sla-toggle">
            <Label htmlFor="alert-agent-80">
              Notificar o agente responsável quando atingir 80% do prazo de primeira resposta
            </Label>
            <Switch
              id="alert-agent-80"
              checked={alerts.notify_agent_80_pct}
              onCheckedChange={(v) => setAlerts((p) => ({ ...p, notify_agent_80_pct: v }))}
            />
          </div>
          <div className="sla-toggle">
            <Label htmlFor="alert-supervisor">
              Notificar o supervisor quando o SLA de primeira resposta for ultrapassado
            </Label>
            <Switch
              id="alert-supervisor"
              checked={alerts.notify_supervisor_exceeded}
              onCheckedChange={(v) => setAlerts((p) => ({ ...p, notify_supervisor_exceeded: v }))}
            />
          </div>
          <div className="sla-toggle">
            <Label htmlFor="alert-resolution">
              Notificar quando o SLA de resolução estiver em 80%
            </Label>
            <Switch
              id="alert-resolution"
              checked={alerts.notify_resolution_80_pct}
              onCheckedChange={(v) => setAlerts((p) => ({ ...p, notify_resolution_80_pct: v }))}
            />
          </div>
          <div className="sla-field">
            <Label>Quem recebe as notificações</Label>
            <Select value={alerts.notify_targets} onValueChange={(v) => setAlerts((p) => ({ ...p, notify_targets: v }))}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agente responsável</SelectItem>
                <SelectItem value="all">Todos os agentes</SelectItem>
                <SelectItem value="supervisors">Supervisores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <style>{`
        .sla-settings { display: flex; flex-direction: column; gap: 16px; }
        .sla-card { background: #fff; border: 1px solid #E5E5E5; border-radius: 8px; overflow: hidden; }
        .sla-card-header { padding: 16px; border-bottom: 1px solid #E5E5E5; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #fff; }
        .sla-card-header .sc-info { flex: 1; }
        .sla-card-header .sc-title { font-size: 16px; font-weight: 600; color: #10293F; margin: 0; display: flex; align-items: center; gap: 8px; }
        .sla-card-header .sc-title .w-5.h-5 { color: #45E5E5; }
        .sla-card-header .sc-desc { font-size: 13px; color: #666; margin: 4px 0 0; }
        .sla-card-content { padding: 16px 20px; background: #F8FAFC; border-radius: 0 0 8px 8px; }
        .sla-table { width: 100%; border-collapse: collapse; }
        .sla-table th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #666; border-bottom: 1px solid #E5E5E5; }
        .sla-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid #F0F0F0; }
        .sla-table tr:last-child td { border-bottom: none; }
        .sla-input { width: 80px; padding: 6px 10px; border: 1px solid #E5E5E5; border-radius: 6px; font-size: 13px; }
        .sla-input:focus { outline: none; border-color: #45E5E5; box-shadow: 0 0 0 3px rgba(69,229,229,0.15); }
        .sla-toggle { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #F0F0F0; }
        .sla-toggle:last-of-type { border-bottom: none; }
        .sla-toggle Label { font-size: 13px; color: #333; }
        .sla-field { padding-top: 16px; display: flex; flex-direction: column; gap: 8px; }
        .sla-field Label { font-size: 13px; font-weight: 500; color: #333; }
      `}</style>
    </div>
  )
}
