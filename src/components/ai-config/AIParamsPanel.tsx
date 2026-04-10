import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

interface AutonomyRow {
  id: string
  situation_type: string
  label: string
  autonomy_level: number
  auto_escalate_keywords: string[]
  escalate_after_hours: number
  escalate_after_repeat_count: number
}

export function AIParamsPanel() {
  const qc = useQueryClient()

  const { data: configs, isLoading } = useQuery<AutonomyRow[]>({
    queryKey: ['ai_autonomy_config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ai_autonomy_config')
        .select('*')
        .order('situation_type')
      if (error) throw error
      return data as AutonomyRow[]
    },
  })

  const [local, setLocal] = useState<AutonomyRow[]>([])
  useEffect(() => { if (configs) setLocal(configs) }, [configs])

  const updateMutation = useMutation({
    mutationFn: async () => {
      for (const row of local) {
        const { error } = await (supabase as any)
          .from('ai_autonomy_config')
          .update({
            autonomy_level: row.autonomy_level,
            escalate_after_hours: row.escalate_after_hours,
            escalate_after_repeat_count: row.escalate_after_repeat_count,
          })
          .eq('id', row.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('Configurações de autonomia salvas!')
      qc.invalidateQueries({ queryKey: ['ai_autonomy_config'] })
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const setField = (id: string, field: keyof AutonomyRow, value: any) => {
    setLocal(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-1">Nível de Autonomia por Tipo de Situação</h3>
        <p className="text-sm text-muted-foreground">
          Define quando a IA age sozinha (100%) ou escala para supervisão humana (0%).
        </p>
      </div>

      <div className="space-y-4">
        {local.map(row => (
          <div key={row.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">{row.label}</p>
              <span className="text-sm font-mono text-primary">{row.autonomy_level}%</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-10">0%</span>
              <Slider
                value={[row.autonomy_level]}
                onValueChange={([v]) => setField(row.id, 'autonomy_level', v)}
                min={0} max={100} step={5}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10 text-right">100%</span>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Escalar sem resposta após (horas)</Label>
                <Input
                  type="number"
                  min={1} max={72}
                  value={row.escalate_after_hours}
                  onChange={e => setField(row.id, 'escalate_after_hours', Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Escalar após repetição (vezes)</Label>
                <Input
                  type="number"
                  min={1} max={10}
                  value={row.escalate_after_repeat_count}
                  onChange={e => setField(row.id, 'escalate_after_repeat_count', Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Salvar configurações
        </Button>
      </div>
    </div>
  )
}
