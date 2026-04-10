import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props { config: Record<string, any>; onBatchUpdate: (u: Record<string, any>) => void }

export function ChangeModuleProperties({ config, onBatchUpdate }: Props) {
  const { data: modules = [] } = useQuery({
    queryKey: ['ticket-modules'],
    queryFn: async () => { const { data } = await (supabase as any).from('ticket_modules').select('id, name').eq('active', true).order('name'); return data || [] },
  })

  return (
    <div>
      <Label className="text-xs">Módulo</Label>
      <Select value={config.module_id || ''} onValueChange={v => {
        const m = modules.find((m: any) => m.id === v)
        onBatchUpdate({ module_id: v, module_name: m?.name || '' })
      }}>
        <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
        <SelectContent>{modules.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
}
