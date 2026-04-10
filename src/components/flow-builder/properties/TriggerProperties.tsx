import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/integrations/supabase/client'

interface TriggerPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function TriggerProperties({ config, onUpdate }: TriggerPropertiesProps) {
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([])
  const [stages, setStages] = useState<{ id: string; name: string; board_name?: string }[]>([])

  useEffect(() => {
    if (config.trigger_type === 'status_changed') {
      supabase.from('ticket_statuses').select('id, name').order('name').then(({ data }) => {
        if (data) setStatuses(data)
      })
    }
    if (config.trigger_type === 'stage_changed') {
      supabase.from('kanban_stages').select('id, name, board:kanban_boards(name)').order('position').then(({ data }) => {
        if (data) setStages(data.map((s: any) => ({ id: s.id, name: s.name, board_name: s.board?.name })))
      })
    }
  }, [config.trigger_type])

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Tipo de Gatilho</Label>
        <Select value={config.trigger_type || 'message_received'} onValueChange={(v) => onUpdate('trigger_type', v)}>
          <SelectTrigger className="text-xs mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="message_received">📩 Mensagem Recebida</SelectItem>
            <SelectItem value="ticket_created">🎫 Ticket Criado</SelectItem>
            <SelectItem value="status_changed">🔄 Mudança de Status</SelectItem>
            <SelectItem value="stage_changed">📋 Mudança de Etapa</SelectItem>
            <SelectItem value="conversation_closed">✅ Atendimento Finalizado</SelectItem>
            <SelectItem value="conversation_reopened">🔁 Atendimento Reaberto</SelectItem>
            <SelectItem value="agent_assigned">👤 Agente Atribuído</SelectItem>
            <SelectItem value="tag_added">🏷️ Tag Adicionada</SelectItem>
            <SelectItem value="priority_changed">🔺 Prioridade Alterada</SelectItem>
            <SelectItem value="sla_breached">⏰ SLA Violado</SelectItem>
            <SelectItem value="csat_received">⭐ CSAT Recebido</SelectItem>
            <SelectItem value="no_response_timeout">⏳ Timeout Sem Resposta</SelectItem>
            <SelectItem value="scheduled">📅 Agendado (Cron)</SelectItem>
            <SelectItem value="webhook">🔗 Webhook Externo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.trigger_type === 'message_received' && (
        <div>
          <Label className="text-xs">Palavras-chave (Opcional)</Label>
          <Input
            value={config.keywords?.join?.(', ') || config.keywords || ''}
            onChange={(e) => onUpdate('keywords', e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean))}
            placeholder="oi, olá, ajuda, suporte"
            className="text-xs mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Separe por vírgula. Deixe vazio para qualquer mensagem.
          </p>
        </div>
      )}

      {config.trigger_type === 'status_changed' && (
        <>
          <div>
            <Label className="text-xs">Status Anterior (Opcional)</Label>
            <Select value={config.from_status || '_any'} onValueChange={(v) => onUpdate('from_status', v === '_any' ? '' : v)}>
              <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">Qualquer</SelectItem>
                {statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Novo Status (Opcional)</Label>
            <Select value={config.to_status || '_any'} onValueChange={(v) => onUpdate('to_status', v === '_any' ? '' : v)}>
              <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">Qualquer</SelectItem>
                {statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Deixe como "Qualquer" para disparar em qualquer mudança de status.
          </p>
        </>
      )}

      {config.trigger_type === 'stage_changed' && (
        <>
          <div>
            <Label className="text-xs">Etapa Anterior (Opcional)</Label>
            <Select value={config.from_stage_id || '_any'} onValueChange={(v) => onUpdate('from_stage_id', v === '_any' ? '' : v)}>
              <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">Qualquer</SelectItem>
                {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.board_name ? `${s.board_name} → ` : ''}{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nova Etapa (Opcional)</Label>
            <Select value={config.to_stage_id || '_any'} onValueChange={(v) => onUpdate('to_stage_id', v === '_any' ? '' : v)}>
              <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">Qualquer</SelectItem>
                {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.board_name ? `${s.board_name} → ` : ''}{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Deixe como "Qualquer" para disparar em qualquer mudança de etapa.
          </p>
        </>
      )}

      {config.trigger_type === 'agent_assigned' && (
        <>
          <div>
            <Label className="text-xs">Tipo de Agente (Opcional)</Label>
            <Select value={config.agent_type_filter || '_any'} onValueChange={(v) => onUpdate('agent_type_filter', v === '_any' ? '' : v)}>
              <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">Qualquer</SelectItem>
                <SelectItem value="human">👤 Humano</SelectItem>
                <SelectItem value="ai">🤖 IA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Filtre por tipo de agente atribuído ou deixe "Qualquer".
          </p>
        </>
      )}

      {config.trigger_type === 'tag_added' && (
        <div>
          <Label className="text-xs">Tag Específica</Label>
          <Input
            value={config.tag || ''}
            onChange={(e) => onUpdate('tag', e.target.value)}
            placeholder="ex: vip, urgente, follow-up"
            className="text-xs mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Informe a tag que deve acionar este fluxo.
          </p>
        </div>
      )}

      {config.trigger_type === 'priority_changed' && (
        <>
          <div>
            <Label className="text-xs">Prioridade Anterior (Opcional)</Label>
            <Select value={config.from_priority || '_any'} onValueChange={(v) => onUpdate('from_priority', v === '_any' ? '' : v)}>
              <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">Qualquer</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nova Prioridade (Opcional)</Label>
            <Select value={config.to_priority || '_any'} onValueChange={(v) => onUpdate('to_priority', v === '_any' ? '' : v)}>
              <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">Qualquer</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {config.trigger_type === 'csat_received' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Nota Mínima</Label>
            <Input
              type="number" min={1} max={5}
              value={config.csat_min || ''}
              onChange={(e) => onUpdate('csat_min', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="1"
              className="text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Nota Máxima</Label>
            <Input
              type="number" min={1} max={5}
              value={config.csat_max || ''}
              onChange={(e) => onUpdate('csat_max', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="5"
              className="text-xs mt-1"
            />
          </div>
          <p className="text-xs text-muted-foreground col-span-2">
            Deixe vazio para qualquer nota de 1 a 5.
          </p>
        </div>
      )}

      {config.trigger_type === 'no_response_timeout' && (
        <div>
          <Label className="text-xs">Timeout (minutos)</Label>
          <Input
            type="number" min={1}
            value={config.timeout_minutes || ''}
            onChange={(e) => onUpdate('timeout_minutes', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="30"
            className="text-xs mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Tempo sem resposta do cliente antes de disparar o fluxo.
          </p>
        </div>
      )}

      {config.trigger_type === 'scheduled' && (
        <div>
          <Label className="text-xs">Expressão Cron</Label>
          <Input
            value={config.cron || ''}
            onChange={(e) => onUpdate('cron', e.target.value)}
            placeholder="0 9 * * *"
            className="text-xs font-mono mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Exemplo: "0 9 * * *" = Todos os dias às 9h
          </p>
        </div>
      )}

      {config.trigger_type === 'webhook' && (
        <div>
          <Label className="text-xs">Webhook Path</Label>
          <Input
            value={config.webhook_path || ''}
            onChange={(e) => onUpdate('webhook_path', e.target.value)}
            placeholder="/my-webhook"
            className="text-xs font-mono mt-1"
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        ⚡ Este é o ponto de entrada do fluxo
      </p>
    </div>
  )
}
