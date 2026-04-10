import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Save, Clock, MessageSquareMore, XCircle, Timer } from 'lucide-react'
import { usePlatformAIConfig, useUpdatePlatformAIConfig } from '@/hooks/usePlatformAIConfig'
import { cn } from '@/lib/utils'

interface InactiveConfig {
  first_followup_minutes: number
  second_followup_minutes: number
  close_minutes: number
}

const DEFAULTS: InactiveConfig = {
  first_followup_minutes: 10,
  second_followup_minutes: 30,
  close_minutes: 50,
}

export function BehaviorTab() {
  const { data: config, isLoading } = usePlatformAIConfig('inactive_conversation')
  const updateConfig = useUpdatePlatformAIConfig()

  const [values, setValues] = useState<InactiveConfig>(DEFAULTS)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (config?.extra_config) {
      const ec = config.extra_config as Partial<InactiveConfig>
      setValues({
        first_followup_minutes: Number(ec.first_followup_minutes) || DEFAULTS.first_followup_minutes,
        second_followup_minutes: Number(ec.second_followup_minutes) || DEFAULTS.second_followup_minutes,
        close_minutes: Number(ec.close_minutes) || DEFAULTS.close_minutes,
      })
    }
  }, [config])

  const handleChange = (key: keyof InactiveConfig, raw: string) => {
    const num = Math.max(1, parseInt(raw) || 1)
    setValues(prev => ({ ...prev, [key]: num }))
    setDirty(true)
  }

  const handleSave = () => {
    updateConfig.mutate({
      feature: 'inactive_conversation',
      model: 'config',
      enabled: config?.enabled ?? true,
      extra_config: { ...values },
    })
    setDirty(false)
  }

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
  }

  const stages = [
    {
      key: 'first_followup_minutes' as const,
      label: '1o Follow-up',
      description: 'Primeira mensagem de reengajamento enviada ao cliente inativo. Tom caloroso e contextual.',
      icon: MessageSquareMore,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-l-blue-500',
    },
    {
      key: 'second_followup_minutes' as const,
      label: '2o Follow-up',
      description: 'Segunda mensagem avisando que o atendimento sera encerrado se nao houver resposta.',
      icon: Timer,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-l-amber-500',
    },
    {
      key: 'close_minutes' as const,
      label: 'Encerramento',
      description: 'Encerra a conversa por inatividade e move o ticket para "Fechado por IA" para aprovacao humana.',
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-l-red-500',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Follow-up por Inatividade
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure os tempos de espera antes de cada mensagem automatica quando o cliente para de responder.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!dirty || updateConfig.isPending}
          size="sm"
          className="gap-1.5"
        >
          <Save className="w-4 h-4" />
          {updateConfig.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Timeline visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Fluxo de Follow-up</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Badge variant="outline" className="gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Cliente para de responder
            </Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
              {values.first_followup_minutes} min → 1o Follow-up
            </Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
              {values.second_followup_minutes} min → 2o Follow-up
            </Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
              {values.close_minutes} min → Encerramento
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Config cards */}
      <div className="grid gap-4">
        {stages.map((stage) => {
          const Icon = stage.icon
          return (
            <Card key={stage.key} className={cn('border-l-4', stage.borderColor)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={cn('p-2.5 rounded-lg shrink-0', stage.bgColor)}>
                    <Icon className={cn('w-5 h-5', stage.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{stage.label}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{stage.description}</p>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={stage.key} className="text-xs text-muted-foreground whitespace-nowrap">
                        Tempo de espera:
                      </Label>
                      <Input
                        id={stage.key}
                        type="number"
                        min={1}
                        max={1440}
                        value={values[stage.key]}
                        onChange={(e) => handleChange(stage.key, e.target.value)}
                        className="w-24 h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">minutos</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        Os tempos sao contados a partir da ultima mensagem do cliente. As mensagens de follow-up sao geradas pela IA com base no contexto da conversa. O cron verifica conversas inativas a cada 3 minutos.
      </p>
    </div>
  )
}
