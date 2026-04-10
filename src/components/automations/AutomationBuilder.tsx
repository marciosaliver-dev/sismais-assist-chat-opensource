import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Zap, GitBranch, Play } from 'lucide-react'
import { useAutomations } from '@/hooks/useAutomations'
import { useAgents } from '@/hooks/useAgents'
import { toast } from 'sonner'
import type { Tables } from '@/integrations/supabase/types'

type Automation = Tables<'ai_automations'>

interface AutomationBuilderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  automation?: Automation | null
}

const TRIGGER_LABELS: Record<string, string> = {
  message_received: '📩 Mensagem Recebida',
  ticket_created: '🎫 Ticket Criado',
  ticket_updated: '🔄 Ticket Atualizado',
  ai_response_sent: '🤖 IA Respondeu',
  human_takeover: '👤 Humano Assumiu',
  csat_received: '⭐ CSAT Recebido',
  scheduled: '⏰ Agendado (Cron)',
}

export function AutomationBuilder({ open, onOpenChange, automation }: AutomationBuilderProps) {
  const { createAutomation, updateAutomation } = useAutomations()
  const { agents } = useAgents()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'message_received',
    trigger_conditions: [] as any[],
    actions: [] as any[],
    schedule_cron: '',
  })

  useEffect(() => {
    if (automation) {
      setFormData({
        name: automation.name || '',
        description: automation.description || '',
        trigger_type: automation.trigger_type || 'message_received',
        trigger_conditions: (automation.trigger_conditions as any[]) || [],
        actions: (automation.actions as any[]) || [],
        schedule_cron: automation.schedule_cron || '',
      })
    } else {
      setFormData({
        name: '', description: '', trigger_type: 'message_received',
        trigger_conditions: [], actions: [], schedule_cron: '',
      })
    }
    setStep(1)
  }, [automation, open])

  const handleSave = async () => {
    if (!formData.name) { toast.error('Nome é obrigatório'); return }
    if (formData.actions.length === 0) { toast.error('Adicione pelo menos uma ação'); return }
    try {
      if (automation?.id) {
        await updateAutomation.mutateAsync({ id: automation.id, updates: formData })
      } else {
        await createAutomation.mutateAsync(formData)
      }
      onOpenChange(false)
    } catch {}
  }

  const addCondition = () => {
    setFormData(p => ({
      ...p, trigger_conditions: [...p.trigger_conditions, { field: 'sentiment', operator: 'equals', value: '' }]
    }))
  }

  const updateCondition = (i: number, updates: any) => {
    const c = [...formData.trigger_conditions]; c[i] = { ...c[i], ...updates }
    setFormData(p => ({ ...p, trigger_conditions: c }))
  }

  const removeCondition = (i: number) => {
    setFormData(p => ({ ...p, trigger_conditions: p.trigger_conditions.filter((_, idx) => idx !== i) }))
  }

  const addAction = () => {
    setFormData(p => ({ ...p, actions: [...p.actions, { type: 'send_message', params: {} }] }))
  }

  const updateAction = (i: number, updates: any) => {
    const a = [...formData.actions]; a[i] = { ...a[i], ...updates }
    setFormData(p => ({ ...p, actions: a }))
  }

  const removeAction = (i: number) => {
    setFormData(p => ({ ...p, actions: p.actions.filter((_, idx) => idx !== i) }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{automation ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
          <DialogDescription>Crie workflows automatizados para seu helpdesk</DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStep(s)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {s}
              </button>
              {s < 4 && <div className={`w-8 h-0.5 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <div className="min-h-[300px]">
          {/* STEP 1: Basic */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Automação *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Boas-vindas automáticas"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="O que essa automação faz..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Trigger */}
          {step === 2 && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-warning" />
                    Quando Executar (Trigger)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Gatilho</Label>
                    <Select value={formData.trigger_type} onValueChange={(v) => setFormData(p => ({ ...p, trigger_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.trigger_type === 'scheduled' && (
                    <div className="space-y-2">
                      <Label>Expressão Cron</Label>
                      <Input
                        value={formData.schedule_cron}
                        onChange={(e) => setFormData(p => ({ ...p, schedule_cron: e.target.value }))}
                        placeholder="0 9 * * * (todo dia às 9h)"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use <a href="https://crontab.guru" target="_blank" rel="noreferrer" className="underline">crontab.guru</a> para ajuda
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-primary" />
                      Condições (Opcional)
                    </span>
                    <Button onClick={addCondition} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" /> Adicionar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.trigger_conditions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma condição. Automação executará sempre que o trigger disparar.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {formData.trigger_conditions.map((cond, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                          <Select value={cond.field} onValueChange={(v) => updateCondition(i, { field: v })}>
                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sentiment">Sentimento</SelectItem>
                              <SelectItem value="urgency">Urgência</SelectItem>
                              <SelectItem value="customer_phone">Telefone</SelectItem>
                              <SelectItem value="time_of_day">Hora do Dia</SelectItem>
                              <SelectItem value="handler_type">Tipo Handler</SelectItem>
                              <SelectItem value="priority">Prioridade</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={cond.operator} onValueChange={(v) => updateCondition(i, { operator: v })}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">É igual a</SelectItem>
                              <SelectItem value="not_equals">Diferente de</SelectItem>
                              <SelectItem value="contains">Contém</SelectItem>
                              <SelectItem value="greater_than">Maior que</SelectItem>
                              <SelectItem value="less_than">Menor que</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={cond.value}
                            onChange={(e) => updateCondition(i, { value: e.target.value })}
                            placeholder="Valor"
                            className="flex-1"
                          />
                          <Button onClick={() => removeCondition(i)} size="icon" variant="ghost" className="text-destructive shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* STEP 3: Actions */}
          {step === 3 && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-primary" />
                      Ações a Executar
                    </span>
                    <Button onClick={addAction} size="sm" className="bg-primary text-primary-foreground">
                      <Plus className="w-4 h-4 mr-1" /> Adicionar Ação
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.actions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Adicione pelo menos uma ação para executar
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {formData.actions.map((action, i) => (
                        <Card key={i} className="bg-muted/30">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">Passo {i + 1}</Badge>
                              <Button onClick={() => removeAction(i)} size="icon" variant="ghost" className="text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="space-y-2">
                              <Label>Tipo de Ação</Label>
                              <Select value={action.type} onValueChange={(v) => updateAction(i, { type: v, params: {} })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="send_message">📤 Enviar Mensagem</SelectItem>
                                  <SelectItem value="assign_agent">🤖 Atribuir Agente</SelectItem>
                                  <SelectItem value="escalate_to_human">👤 Escalonar para Humano</SelectItem>
                                  <SelectItem value="wait">⏳ Aguardar</SelectItem>
                                  <SelectItem value="ai_respond">💬 Resposta IA</SelectItem>
                                  <SelectItem value="http_request">🌐 Webhook HTTP</SelectItem>
                                  <SelectItem value="update_conversation">📝 Atualizar Conversa</SelectItem>
                                  <SelectItem value="add_tag">🏷️ Adicionar Tag</SelectItem>
                                  <SelectItem value="search_knowledge">🔍 Buscar Conhecimento</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Action params */}
                            {action.type === 'send_message' && (
                              <div className="space-y-2">
                                <Label>Mensagem</Label>
                                <Textarea
                                  value={action.params.message || ''}
                                  onChange={(e) => updateAction(i, { params: { ...action.params, message: e.target.value } })}
                                  placeholder="Digite a mensagem..."
                                  rows={3}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Variáveis: {'{customer_name}'}, {'{ticket_id}'}, {'{agent_name}'}
                                </p>
                              </div>
                            )}

                            {action.type === 'assign_agent' && (
                              <div className="space-y-2">
                                <Label>Agente</Label>
                                <Select
                                  value={action.params.agent_id || ''}
                                  onValueChange={(v) => updateAction(i, { params: { ...action.params, agent_id: v } })}
                                >
                                  <SelectTrigger><SelectValue placeholder="Selecione o agente" /></SelectTrigger>
                                  <SelectContent>
                                    {agents?.map((ag) => (
                                      <SelectItem key={ag.id} value={ag.id}>{ag.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {action.type === 'escalate_to_human' && (
                              <div className="space-y-2">
                                <Label>Motivo</Label>
                                <Input
                                  value={action.params.reason || ''}
                                  onChange={(e) => updateAction(i, { params: { ...action.params, reason: e.target.value } })}
                                  placeholder="Ex: Cliente insatisfeito"
                                />
                              </div>
                            )}

                            {action.type === 'wait' && (
                              <div className="space-y-2">
                                <Label>Aguardar (segundos)</Label>
                                <Input
                                  type="number"
                                  value={action.params.duration_seconds || 0}
                                  onChange={(e) => updateAction(i, { params: { ...action.params, duration_seconds: parseInt(e.target.value) } })}
                                />
                              </div>
                            )}

                            {action.type === 'http_request' && (
                              <div className="space-y-2">
                                <Label>URL do Webhook</Label>
                                <Input
                                  value={action.params.url || ''}
                                  onChange={(e) => updateAction(i, { params: { ...action.params, url: e.target.value } })}
                                  placeholder="https://api.exemplo.com/webhook"
                                />
                                <Label>Método</Label>
                                <Select
                                  value={action.params.method || 'POST'}
                                  onValueChange={(v) => updateAction(i, { params: { ...action.params, method: v } })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="PUT">PUT</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {action.type === 'add_tag' && (
                              <div className="space-y-2">
                                <Label>Tag</Label>
                                <Input
                                  value={action.params.tag || ''}
                                  onChange={(e) => updateAction(i, { params: { ...action.params, tag: e.target.value } })}
                                  placeholder="vip, urgente, follow-up"
                                />
                              </div>
                            )}

                            {action.type === 'search_knowledge' && (
                              <div className="space-y-2">
                                <Label>Query de Busca</Label>
                                <Input
                                  value={action.params.query || ''}
                                  onChange={(e) => updateAction(i, { params: { ...action.params, query: e.target.value } })}
                                  placeholder="Use {message} para a mensagem do cliente"
                                />
                                <Label>Top K resultados</Label>
                                <Input
                                  type="number"
                                  value={action.params.top_k || 5}
                                  onChange={(e) => updateAction(i, { params: { ...action.params, top_k: parseInt(e.target.value) } })}
                                />
                              </div>
                            )}

                            {action.type === 'update_conversation' && (
                              <div className="space-y-2">
                                <Label>Campo</Label>
                                <Select
                                  value={action.params.field || 'status'}
                                  onValueChange={(v) => updateAction(i, { params: { ...action.params, field: v } })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="status">Status</SelectItem>
                                    <SelectItem value="priority">Prioridade</SelectItem>
                                    <SelectItem value="handler_type">Tipo Handler</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Label>Valor</Label>
                                <Input
                                  value={action.params.value || ''}
                                  onChange={(e) => updateAction(i, { params: { ...action.params, value: e.target.value } })}
                                  placeholder="Ex: resolved, high, human"
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumo da Automação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-semibold">{formData.name}</p>
                </div>
                {formData.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Descrição</p>
                    <p className="text-sm">{formData.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Trigger</p>
                  <Badge variant="outline">{TRIGGER_LABELS[formData.trigger_type] || formData.trigger_type}</Badge>
                </div>
                {formData.trigger_type === 'scheduled' && formData.schedule_cron && (
                  <div>
                    <p className="text-sm text-muted-foreground">Cron</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{formData.schedule_cron}</code>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Condições</p>
                  <p>{formData.trigger_conditions.length === 0 ? 'Nenhuma (sempre executar)' : `${formData.trigger_conditions.length} condição(ões)`}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ações</p>
                  <div className="space-y-1 mt-1">
                    {formData.actions.map((a, i) => (
                      <div key={i} className="text-sm flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{i + 1}</Badge>
                        {a.type}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
            Anterior
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)}>Próximo</Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={createAutomation.isPending || updateAutomation.isPending}
              >
                {createAutomation.isPending || updateAutomation.isPending
                  ? 'Salvando...'
                  : automation ? 'Atualizar' : 'Criar Automação'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
