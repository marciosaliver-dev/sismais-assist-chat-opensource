import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props { config: Record<string, any>; onBatchUpdate: (u: Record<string, any>) => void }

export function ChangeCategoryProperties({ config, onBatchUpdate }: Props) {
  const { data: categories = [] } = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: async () => { const { data } = await (supabase as any).from('ticket_categories').select('id, name').eq('active', true).order('name'); return data || [] },
  })

  return (
    <div>
      <Label className="text-xs">Categoria</Label>
      <Select value={config.category_id || ''} onValueChange={v => {
        const c = categories.find((c: any) => c.id === v)
        onBatchUpdate({ category_id: v, category_name: c?.name || '' })
      }}>
        <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
        <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
}
