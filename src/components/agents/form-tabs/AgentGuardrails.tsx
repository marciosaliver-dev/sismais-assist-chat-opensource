import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Shield, Plus, Trash2, Lock } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface Guardrail {
  id?: string
  rule_type: string
  rule_content: string
  severity: string
  is_global?: boolean
}

interface Props {
  agentId?: string
  data: any
  onChange: (updates: any) => void
}

export function AgentGuardrails({ agentId, data, onChange }: Props) {
  const [globalRules, setGlobalRules] = useState<Guardrail[]>([])
  const [agentRules, setAgentRules] = useState<Guardrail[]>([])

  useEffect(() => {
    loadGuardrails()
  }, [agentId])

  useEffect(() => {
    onChange({ _guardrails: agentRules })
  }, [agentRules])

  async function loadGuardrails() {
    // Global rules
    const { data: globals } = await supabase
      .from('ai_guardrails')
      .select('*')
      .is('agent_id', null)
      .eq('is_active', true)
    setGlobalRules((globals || []).map(g => ({ ...g, is_global: true })))

    // Agent rules
    if (agentId) {
      const { data: agentG } = await supabase
        .from('ai_guardrails')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_active', true)
      setAgentRules(agentG || [])
    }
  }

  function addRule() {
    setAgentRules(prev => [...prev, { rule_type: 'custom', rule_content: '', severity: 'warn' }])
  }

  function updateRule(index: number, updates: Partial<Guardrail>) {
    setAgentRules(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r))
  }

  function removeRule(index: number) {
    setAgentRules(prev => prev.filter((_, i) => i !== index))
  }

  const thresholdRespond = data.confidence_threshold_respond ?? 0.70
  const thresholdWarn = data.confidence_threshold_warn ?? 0.50

  return (
    <div className="space-y-6">
      {/* Thresholds */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Shield className="w-4 h-4" /> Thresholds de Confiança
        </h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Responder normalmente quando confiança ≥ {Math.round(thresholdRespond * 100)}%</Label>
            <Slider
              value={[thresholdRespond]}
              onValueChange={([v]) => onChange({ confidence_threshold_respond: v })}
              min={0.3} max={1} step={0.05}
              className="mt-2"
            />
          </div>
          <div>
            <Label className="text-xs">Escalar para humano quando confiança &lt; {Math.round(thresholdWarn * 100)}%</Label>
            <Slider
              value={[thresholdWarn]}
              onValueChange={([v]) => onChange({ confidence_threshold_warn: v })}
              min={0.1} max={0.7} step={0.05}
              className="mt-2"
            />
          </div>
          {/* Visual preview */}
          <div className="flex h-3 rounded-full overflow-hidden text-[8px] font-bold">
            <div className="bg-red-500 flex items-center justify-center text-white" style={{ width: `${thresholdWarn * 100}%` }}>Escalar</div>
            <div className="bg-yellow-500 flex items-center justify-center text-navy" style={{ width: `${(thresholdRespond - thresholdWarn) * 100}%` }}>Review</div>
            <div className="bg-green-500 flex items-center justify-center text-white" style={{ width: `${(1 - thresholdRespond) * 100}%` }}>OK</div>
          </div>
        </div>
      </div>

      {/* Global rules (read-only) */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Lock className="w-4 h-4" /> Regras Globais (todas os agentes)
        </h3>
        {globalRules.map((rule, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-sm">
            <Badge variant="outline" className="shrink-0 text-xs">{rule.severity}</Badge>
            <span className="text-muted-foreground">{rule.rule_content}</span>
          </div>
        ))}
      </div>

      {/* Agent rules (editable) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Regras do Agente</h3>
          <Button variant="outline" size="sm" onClick={addRule}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        {agentRules.map((rule, i) => (
          <div key={i} className="flex gap-2 p-3 rounded-lg border">
            <Select value={rule.rule_type} onValueChange={v => updateRule(i, { rule_type: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="block_topic">Bloquear tema</SelectItem>
                <SelectItem value="require_escalation">Escalar</SelectItem>
                <SelectItem value="sanitize_pii">Proteger PII</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              value={rule.rule_content}
              onChange={e => updateRule(i, { rule_content: e.target.value })}
              placeholder="Descreva a regra..."
              className="min-h-[40px]"
              rows={1}
            />
            <Select value={rule.severity} onValueChange={v => updateRule(i, { severity: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="warn">Aviso</SelectItem>
                <SelectItem value="block">Bloquear</SelectItem>
                <SelectItem value="sanitize">Sanitizar</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => removeRule(i)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
        {agentRules.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma regra específica. As regras globais se aplicam.</p>
        )}
      </div>
    </div>
  )
}
