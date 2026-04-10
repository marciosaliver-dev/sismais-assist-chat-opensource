import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Clock, Save, Loader2 } from 'lucide-react'

interface BusinessHour {
  id?: string
  board_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface BusinessHoursTabProps {
  boardId: string
}

export function BusinessHoursTab({ boardId }: BusinessHoursTabProps) {
  const queryClient = useQueryClient()
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const { data: savedHours, isLoading } = useQuery({
    queryKey: ['business-hours', boardId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('business_hours')
        .select('*')
        .eq('board_id', boardId)
        .order('day_of_week')
      if (error) throw error
      return (data || []) as BusinessHour[]
    },
    enabled: !!boardId,
  })

  // Initialize local state when data loads
  useEffect(() => {
    if (savedHours) {
      // Ensure all 7 days exist
      const allDays: BusinessHour[] = []
      for (let d = 0; d <= 6; d++) {
        const existing = savedHours.find(h => h.day_of_week === d)
        allDays.push(existing || {
          board_id: boardId,
          day_of_week: d,
          start_time: '08:00',
          end_time: '18:00',
          is_active: d >= 1 && d <= 5, // Mon-Fri default
        })
      }
      setHours(allDays)
      setHasChanges(false)
    }
  }, [savedHours, boardId])

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const h of hours) {
        const payload = {
          board_id: boardId,
          day_of_week: h.day_of_week,
          start_time: h.start_time,
          end_time: h.end_time,
          is_active: h.is_active,
          updated_at: new Date().toISOString(),
        }
        if (h.id) {
          const { error } = await (supabase as any)
            .from('business_hours')
            .update(payload)
            .eq('id', h.id)
          if (error) throw error
        } else {
          const { error } = await (supabase as any)
            .from('business_hours')
            .upsert(payload, { onConflict: 'board_id,day_of_week' })
          if (error) throw error
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours', boardId] })
      setHasChanges(false)
      toast.success('Horário útil salvo com sucesso')
    },
    onError: () => toast.error('Erro ao salvar horário útil'),
  })

  const updateDay = (dayIndex: number, field: keyof BusinessHour, value: any) => {
    setHours(prev => prev.map(h =>
      h.day_of_week === dayIndex ? { ...h, [field]: value } : h
    ))
    setHasChanges(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#10293F]" />
          <div>
            <h3 className="text-sm font-semibold text-[#10293F]">Horário Útil</h3>
            <p className="text-xs text-muted-foreground">
              O SLA será calculado apenas dentro do horário útil configurado
            </p>
          </div>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
          className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece] font-semibold"
          size="sm"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          Salvar
        </Button>
      </div>

      <div className="rounded-lg border border-[#E5E5E5] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[120px_80px_1fr_1fr] gap-3 px-4 py-2.5 bg-[#10293F] text-white">
          <span className="text-xs font-semibold uppercase">Dia</span>
          <span className="text-xs font-semibold uppercase">Ativo</span>
          <span className="text-xs font-semibold uppercase">Início</span>
          <span className="text-xs font-semibold uppercase">Fim</span>
        </div>

        {/* Rows */}
        {hours.map((h) => (
          <div
            key={h.day_of_week}
            className={`grid grid-cols-[120px_80px_1fr_1fr] gap-3 px-4 py-3 border-b border-[#F0F0F0] last:border-b-0 items-center ${
              !h.is_active ? 'opacity-50' : ''
            } ${h.day_of_week === 0 || h.day_of_week === 6 ? 'bg-[#F8FAFC]' : 'bg-white'}`}
          >
            <span className="text-sm font-medium text-[#333]">
              {DAY_NAMES[h.day_of_week]}
            </span>
            <Switch
              checked={h.is_active}
              onCheckedChange={v => updateDay(h.day_of_week, 'is_active', v)}
              aria-label={`${DAY_SHORT[h.day_of_week]} ativo`}
            />
            <Input
              type="time"
              value={h.start_time}
              onChange={e => updateDay(h.day_of_week, 'start_time', e.target.value)}
              disabled={!h.is_active}
              className="h-8 text-sm"
            />
            <Input
              type="time"
              value={h.end_time}
              onChange={e => updateDay(h.day_of_week, 'end_time', e.target.value)}
              disabled={!h.is_active}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Dias desativados não contam para o cálculo de SLA. O tempo em fila e de atendimento será contabilizado apenas dentro do horário útil configurado.
      </p>
    </div>
  )
}
