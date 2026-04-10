import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

interface Props { config: Record<string, any>; onUpdate: (key: string, value: any) => void; onBatchUpdate: (u: Record<string, any>) => void }

export function MoveToStageProperties({ config, onUpdate, onBatchUpdate }: Props) {
  const { data: boards = [] } = useQuery({
    queryKey: ['kanban-boards-active'],
    queryFn: async () => { const { data } = await (supabase as any).from('kanban_boards').select('id, name').eq('active', true).order('sort_order'); return data || [] },
  })
  const { data: stages = [] } = useQuery({
    queryKey: ['kanban-stages-for-board', config.board_id],
    enabled: !!config.board_id,
    queryFn: async () => { const { data } = await (supabase as any).from('kanban_stages').select('id, name').eq('board_id', config.board_id).eq('active', true).order('sort_order'); return data || [] },
  })

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Board</Label>
        <Select value={config.board_id || ''} onValueChange={v => { const b = boards.find((b: any) => b.id === v); onBatchUpdate({ board_id: v, board_name: b?.name || '', stage_id: '', stage_name: '' }) }}>
          <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>{boards.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {config.board_id && (
        <div><Label className="text-xs">Etapa</Label>
          <Select value={config.stage_id || ''} onValueChange={v => { const s = stages.find((s: any) => s.id === v); onBatchUpdate({ stage_id: v, stage_name: s?.name || '' }) }}>
            <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>{stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={!!config.run_enter_automations} onCheckedChange={v => onUpdate('run_enter_automations', !!v)} />
        Executar automações on_enter
      </label>
    </div>
  )
}
