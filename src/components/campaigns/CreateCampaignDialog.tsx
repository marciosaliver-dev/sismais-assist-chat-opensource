import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { CAMPAIGN_TYPES, SCHEDULE_PRESETS, APPROVAL_LABELS, type CampaignTypeKey } from './CampaignTypeConfig'
import { useCampaigns, type CampaignInsert } from '@/hooks/useCampaigns'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface CreateCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const { createCampaign } = useCampaigns()

  const [step, setStep] = useState<'type' | 'config'>('type')
  const [selectedType, setSelectedType] = useState<CampaignTypeKey | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scheduleCron, setScheduleCron] = useState('')
  const [approvalMode, setApprovalMode] = useState<'auto' | 'approval_required'>('auto')
  const [messagePrompt, setMessagePrompt] = useState('')
  const [agentId, setAgentId] = useState('')
  const [instanceId, setInstanceId] = useState('')
  const [maxPerRun, setMaxPerRun] = useState(50)
  const [maxPerDay, setMaxPerDay] = useState(200)
  const [minHoursBetween, setMinHoursBetween] = useState(24)

  // Fetch agents and instances
  const { data: agents = [] } = useQuery({
    queryKey: ['ai-agents-active'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_agents').select('id, name, specialty').eq('is_active', true)
      return data || []
    },
  })

  const { data: instances = [] } = useQuery({
    queryKey: ['whatsapp-instances-active'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('uazapi_instances_public').select('id, instance_name, phone_number').eq('is_active', true)
      return data || []
    },
  })

  const handleSelectType = (type: CampaignTypeKey) => {
    setSelectedType(type)
    const config = CAMPAIGN_TYPES[type]
    setName(`Campanha de ${config.label}`)
    setDescription(config.description)
    setScheduleCron(config.defaultCron)
    setApprovalMode(config.defaultApproval)
    setMessagePrompt(config.defaultPrompt)
    setStep('config')
  }

  const handleCreate = () => {
    if (!selectedType || !name) return

    const config = CAMPAIGN_TYPES[selectedType]
    const insert: CampaignInsert = {
      name,
      description,
      campaign_type: selectedType,
      approval_mode: approvalMode,
      schedule_cron: scheduleCron || undefined,
      message_mode: 'ai_generated',
      message_prompt: messagePrompt || undefined,
      agent_id: (agentId && agentId !== '__auto__') ? agentId : undefined,
      whatsapp_instance_id: (instanceId && instanceId !== '__auto__') ? instanceId : undefined,
      target_rules: config.defaultRules as unknown as any[],
      max_contacts_per_run: maxPerRun,
      max_contacts_per_day: maxPerDay,
      min_hours_between_contacts: minHoursBetween,
    }

    createCampaign.mutate(insert, {
      onSuccess: () => {
        onOpenChange(false)
        resetForm()
      }
    })
  }

  const resetForm = () => {
    setStep('type')
    setSelectedType(null)
    setName('')
    setDescription('')
    setScheduleCron('')
    setMessagePrompt('')
    setAgentId('')
    setInstanceId('')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'type' ? 'Nova Campanha Proativa' : `Configurar: ${CAMPAIGN_TYPES[selectedType!]?.label}`}
          </DialogTitle>
          <DialogDescription>
            {step === 'type'
              ? 'Selecione o tipo de campanha proativa'
              : 'Configure os parâmetros da campanha'}
          </DialogDescription>
        </DialogHeader>

        {step === 'type' ? (
          <div className="grid grid-cols-1 gap-3">
            {(Object.entries(CAMPAIGN_TYPES) as [CampaignTypeKey, typeof CAMPAIGN_TYPES[CampaignTypeKey]][]).map(([key, config]) => {
              const Icon = config.icon
              return (
                <button
                  key={key}
                  onClick={() => handleSelectType(key)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-accent/50 transition-all text-left group"
                >
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', config.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{config.label}</h4>
                      <Badge variant="outline" className={cn('text-xs', APPROVAL_LABELS[config.defaultApproval].color)}>
                        {APPROVAL_LABELS[config.defaultApproval].label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{config.targetHint}</p>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nome da Campanha</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome..." />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>

            {/* Approval mode */}
            <div className="space-y-1.5">
              <Label>Modo de Aprovação</Label>
              <Select value={approvalMode} onValueChange={(v: any) => setApprovalMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (sem aprovação)</SelectItem>
                  <SelectItem value="approval_required">Requer Aprovação Humana</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{APPROVAL_LABELS[approvalMode].description}</p>
            </div>

            {/* Schedule */}
            <div className="space-y-1.5">
              <Label>Agendamento</Label>
              <Select value={scheduleCron} onValueChange={setScheduleCron}>
                <SelectTrigger><SelectValue placeholder="Selecionar horário..." /></SelectTrigger>
                <SelectContent>
                  {SCHEDULE_PRESETS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AI prompt */}
            <div className="space-y-1.5">
              <Label>Instruções para IA (prompt)</Label>
              <Textarea
                value={messagePrompt}
                onChange={e => setMessagePrompt(e.target.value)}
                rows={3}
                placeholder="Instruções de como a IA deve gerar a mensagem..."
              />
              <p className="text-xs text-muted-foreground">A IA usará estas instruções + contexto do cliente para gerar mensagens personalizadas</p>
            </div>

            {/* Agent */}
            <div className="space-y-1.5">
              <Label>Agente IA Responsável</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger><SelectValue placeholder="Automático (baseado no tipo)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Automático</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.specialty})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* WhatsApp Instance */}
            <div className="space-y-1.5">
              <Label>Instância WhatsApp</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger><SelectValue placeholder="Automático (primeira ativa)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Automático</SelectItem>
                  {instances.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.instance_name} {i.phone_number ? `(${i.phone_number})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Máx por execução</Label>
                <Input type="number" value={maxPerRun} onChange={e => setMaxPerRun(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Máx por dia</Label>
                <Input type="number" value={maxPerDay} onChange={e => setMaxPerDay(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horas entre contatos</Label>
                <Input type="number" value={minHoursBetween} onChange={e => setMinHoursBetween(Number(e.target.value))} />
              </div>
            </div>
          </div>
        )}

        {step === 'config' && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStep('type')}>Voltar</Button>
            <Button onClick={handleCreate} disabled={!name || createCampaign.isPending}>
              {createCampaign.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Campanha
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
