import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Clock, Save, Loader2, Users, Shield, CalendarOff, Copy } from 'lucide-react'

interface BusinessHour {
  id?: string
  board_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function BusinessHoursGlobalTab() {
  const queryClient = useQueryClient()
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Buscar horário global (board_id IS NULL)
  const { data: savedHours, isLoading } = useQuery({
    queryKey: ['business-hours-global'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('business_hours')
        .select('*')
        .is('board_id', null)
        .order('day_of_week')
      if (error) throw error
      return (data || []) as BusinessHour[]
    },
  })

  // Buscar agentes humanos online
  const { data: humanAgents } = useQuery({
    queryKey: ['human-agents-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_agents')
        .select('id, name, is_online, is_active, status')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data || []
    },
    refetchInterval: 30_000, // Atualizar a cada 30s
  })

  // Buscar próximos feriados
  const { data: upcomingHolidays } = useQuery({
    queryKey: ['upcoming-holidays'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await (supabase as any)
        .from('business_holidays')
        .select('name, date, recurring')
        .eq('is_active', true)
        .gte('date', today)
        .order('date')
        .limit(5)
      if (error) throw error
      return data || []
    },
  })

  // Inicializar estado local
  useEffect(() => {
    if (savedHours) {
      const allDays: BusinessHour[] = []
      for (let d = 0; d <= 6; d++) {
        const existing = savedHours.find((h: BusinessHour) => h.day_of_week === d)
        allDays.push(existing || {
          board_id: null,
          day_of_week: d,
          start_time: '08:00',
          end_time: '18:00',
          is_active: d >= 1 && d <= 5,
        })
      }
      setHours(allDays)
      setHasChanges(false)
    }
  }, [savedHours])

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const h of hours) {
        const payload = {
          board_id: null,
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
      queryClient.invalidateQueries({ queryKey: ['business-hours-global'] })
      setHasChanges(false)
      toast.success('Horário de expediente salvo com sucesso')
    },
    onError: () => toast.error('Erro ao salvar horário de expediente'),
  })

  const updateDay = (dayIndex: number, field: keyof BusinessHour, value: any) => {
    setHours(prev => prev.map(h =>
      h.day_of_week === dayIndex ? { ...h, [field]: value } : h
    ))
    setHasChanges(true)
  }

  // Copiar seg-sex para todos os dias úteis (baseado no primeiro dia ativo)
  const copyToWeekdays = () => {
    const refDay = hours.find(h => h.is_active && h.day_of_week >= 1 && h.day_of_week <= 5)
    if (!refDay) return
    setHours(prev => prev.map(h => {
      if (h.day_of_week >= 1 && h.day_of_week <= 5) {
        return { ...h, start_time: refDay.start_time, end_time: refDay.end_time, is_active: true }
      }
      return h
    }))
    setHasChanges(true)
    toast.info('Horário copiado para todos os dias úteis')
  }

  const onlineCount = humanAgents?.filter(a => a.is_online).length || 0
  const totalCount = humanAgents?.length || 0

  // Determinar status atual do expediente
  const now = new Date()
  const brasilFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  })
  const parts = brasilFormatter.formatToParts(now)
  const getP = (type: string) => parts.find(p => p.type === type)?.value || ''
  const currentHour = parseInt(getP('hour'))
  const currentMinute = parseInt(getP('minute'))
  const currentMinutes = currentHour * 60 + currentMinute
  // Calcular dia da semana em BRT
  const brasilDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const dateParts = brasilDateFormatter.formatToParts(now)
  const getDP = (type: string) => dateParts.find(p => p.type === type)?.value || ''
  const spDate = new Date(parseInt(getDP('year')), parseInt(getDP('month')) - 1, parseInt(getDP('day')))
  const currentDow = spDate.getDay()

  const todayConfig = hours.find(h => h.day_of_week === currentDow)
  let isCurrentlyOpen = false
  if (todayConfig?.is_active) {
    const [sh, sm] = todayConfig.start_time.split(':').map(Number)
    const [eh, em] = todayConfig.end_time.split(':').map(Number)
    isCurrentlyOpen = currentMinutes >= (sh * 60 + sm) && currentMinutes < (eh * 60 + em)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Expediente status */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isCurrentlyOpen ? 'bg-[#F0FDF4]' : 'bg-[#FEF2F2]'
            }`}>
              <Clock className={`w-4 h-4 ${isCurrentlyOpen ? 'text-[#16A34A]' : 'text-[#DC2626]'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expediente agora</p>
              <p className="text-sm font-semibold">
                {isCurrentlyOpen ? (
                  <span className="text-[#16A34A]">Aberto</span>
                ) : (
                  <span className="text-[#DC2626]">Fechado</span>
                )}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {DAY_NAMES[currentDow]} — {String(currentHour).padStart(2, '0')}:{String(currentMinute).padStart(2, '0')} BRT
          </p>
        </div>

        {/* Humanos online */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              onlineCount > 0 ? 'bg-[#E8F9F9]' : 'bg-[#FFFBEB]'
            }`}>
              <Users className={`w-4 h-4 ${onlineCount > 0 ? 'text-[#10293F]' : 'text-[#92400E]'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atendentes online</p>
              <p className="text-sm font-semibold">
                {onlineCount > 0 ? (
                  <span className="text-[#10293F]">{onlineCount} de {totalCount}</span>
                ) : (
                  <span className="text-[#92400E]">Nenhum online</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {humanAgents?.map(a => (
              <Badge
                key={a.id}
                variant="outline"
                className={`text-[10px] ${a.is_online
                  ? 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30'
                  : 'bg-[#F5F5F5] text-[#666] border-[#E5E5E5]'
                }`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${a.is_online ? 'bg-[#16A34A]' : 'bg-[#CCC]'}`} />
                {a.name?.split(' ')[0]}
              </Badge>
            ))}
          </div>
        </div>

        {/* Regra de transferência */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#EFF6FF]">
              <Shield className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Regra de transferência</p>
              <p className="text-sm font-semibold text-[#10293F]">Ativa</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            IA só transfere para humano se houver atendente online E dentro do expediente.
            Caso contrário, IA continua e avisa o próximo dia útil.
          </p>
        </div>
      </div>

      {/* Horário de expediente */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#10293F]" />
            <div>
              <h3 className="text-sm font-semibold text-[#10293F]">Horário de Expediente</h3>
              <p className="text-xs text-muted-foreground">
                Horário global — usado pela IA para decidir transferências e follow-ups
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToWeekdays}
              className="text-xs"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copiar para dias úteis
            </Button>
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
        </div>

        <div className="rounded-lg border border-[#E5E5E5] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[140px_70px_1fr_1fr] gap-3 px-4 py-2.5 bg-[#10293F] text-white">
            <span className="text-xs font-semibold uppercase">Dia</span>
            <span className="text-xs font-semibold uppercase">Ativo</span>
            <span className="text-xs font-semibold uppercase">Início</span>
            <span className="text-xs font-semibold uppercase">Fim</span>
          </div>

          {/* Rows */}
          {hours.map((h) => {
            const isToday = h.day_of_week === currentDow
            return (
              <div
                key={h.day_of_week}
                className={`grid grid-cols-[140px_70px_1fr_1fr] gap-3 px-4 py-3 border-b border-[#F0F0F0] last:border-b-0 items-center ${
                  !h.is_active ? 'opacity-50' : ''
                } ${isToday ? 'bg-[#E8F9F9]/50 ring-1 ring-inset ring-[#45E5E5]/20' : h.day_of_week === 0 || h.day_of_week === 6 ? 'bg-[#F8FAFC]' : 'bg-white'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#333]">
                    {DAY_NAMES[h.day_of_week]}
                  </span>
                  {isToday && (
                    <Badge className="bg-[#45E5E5] text-[#10293F] text-[9px] px-1.5 py-0 font-bold border-0">
                      HOJE
                    </Badge>
                  )}
                </div>
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
            )
          })}
        </div>
      </div>

      {/* Próximos feriados */}
      {upcomingHolidays && upcomingHolidays.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-[#FFB800]" />
            <h4 className="text-sm font-semibold text-[#10293F]">Próximos feriados</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingHolidays.map((h: any, i: number) => (
              <Badge
                key={i}
                variant="outline"
                className="bg-[#FFFBEB] text-[#92400E] border-[#FFB800]/50 text-xs"
              >
                {new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} — {h.name}
                {h.recurring && ' (anual)'}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Explicação */}
      <div className="rounded-lg border border-[#E5E5E5] bg-[#F8FAFC] p-4 space-y-2">
        <h4 className="text-sm font-semibold text-[#10293F]">Como funciona</h4>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-[#45E5E5] mt-0.5">●</span>
            <span><strong>Dentro do expediente + humano online:</strong> IA conversa primeiro, e transfere para humano quando necessário.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#FFB800] mt-0.5">●</span>
            <span><strong>Dentro do expediente + sem humano:</strong> IA continua atendendo e avisa que a equipe retorna em breve.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#DC2626] mt-0.5">●</span>
            <span><strong>Fora do expediente:</strong> IA atende normalmente, sem follow-ups automáticos. Se pedir humano, avisa o próximo dia útil.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#7C3AED] mt-0.5">●</span>
            <span><strong>Feriados:</strong> Mesma regra de "fora do expediente". Configure feriados na aba Feriados.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
