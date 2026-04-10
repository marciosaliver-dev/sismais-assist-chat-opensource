import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Wand2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import type { Tables } from '@/integrations/supabase/types'
import { cn } from '@/lib/utils'

type Agent = Tables<'ai_agents'>

interface SpecialtyFormSimpleProps {
  agent?: Agent | null
  onSuccess: () => void
  onCancel: () => void
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Profissional e objetivo' },
  { value: 'friendly',     label: 'Amigável e próximo' },
  { value: 'technical',    label: 'Técnico e preciso' },
  { value: 'empathetic',   label: 'Empático e paciente' },
]

const SPECIALTY_OPTIONS = [
  { value: 'triage',    label: 'Triagem (classifica e encaminha)' },
  { value: 'support',   label: 'Suporte técnico' },
  { value: 'financial', label: 'Financeiro e cobranças' },
  { value: 'sales',     label: 'Vendas e qualificação' },
  { value: 'copilot',   label: 'Copiloto (auxilia agentes humanos)' },
  { value: 'analytics', label: 'Analítico (métricas e relatórios)' },
]

export function SpecialtyFormSimple({ agent, onSuccess, onCancel }: SpecialtyFormSimpleProps) {
  const isEditing = Boolean(agent?.id)

  const [name, setName] = useState(agent?.name ?? '')
  const [description, setDescription] = useState(agent?.description ?? '')
  const [specialty, setSpecialty] = useState(agent?.specialty ?? 'support')
  const [tone, setTone] = useState('professional')
  const [threshold, setThreshold] = useState(agent?.confidence_threshold ?? 70)
  const [isActive, setIsActive] = useState(agent?.is_active ?? true)
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? '')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Gerar system prompt automático
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!description.trim()) {
        throw new Error('Adicione uma descrição antes de gerar o prompt')
      }
      const { data, error } = await supabase.functions.invoke('generate-agent-system-prompt', {
        body: { description, tone, escalation_threshold: threshold }
      })
      if (error) throw error
      return data.system_prompt as string
    },
    onSuccess: (prompt) => {
      setSystemPrompt(prompt)
      setShowAdvanced(true)
      toast.success('System prompt gerado automaticamente!')
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar prompt: ${err.message}`)
    },
  })

  // Salvar agente
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        specialty,
        system_prompt: systemPrompt,
        confidence_threshold: threshold,
        is_active: isActive,
        model: agent?.model ?? 'google/gemini-flash-1.5',
        rag_enabled: agent?.rag_enabled ?? true,
      }

      if (isEditing) {
        const { error } = await supabase.from('ai_agents').update(payload).eq('id', agent!.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('ai_agents').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Especialidade atualizada!' : 'Especialidade criada!')
      onSuccess()
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar: ${err.message}`)
    },
  })

  return (
    <div className="space-y-5">
      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="sf-name">Nome da especialidade</Label>
        <Input
          id="sf-name"
          placeholder="ex: Suporte NF-e, Atendimento Financeiro..."
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      {/* Tipo de especialidade */}
      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPECIALTY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Descrição */}
      <div className="space-y-1.5">
        <Label htmlFor="sf-desc">O que este especialista resolve? <span className="text-muted-foreground">(linguagem natural)</span></Label>
        <Textarea
          id="sf-desc"
          placeholder="ex: Responde dúvidas sobre emissão de notas fiscais, incluindo NFC-e, NF-e, erros SEFAZ e problemas com certificados digitais."
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {/* Tom de resposta */}
      <div className="space-y-1.5">
        <Label>Tom de resposta</Label>
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Threshold de escalação */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Escalar para humano se confiança abaixo de</Label>
          <span className="text-sm font-medium text-primary">{threshold}%</span>
        </div>
        <Slider
          value={[threshold]}
          onValueChange={([v]) => setThreshold(v)}
          min={0} max={100} step={5}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Quanto maior, mais frequentemente a IA escalará para humano. Recomendado: 60–75%.
        </p>
      </div>

      {/* Ativar/desativar */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Especialidade ativa</Label>
          <p className="text-xs text-muted-foreground">A IA usará esta especialidade para responder</p>
        </div>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </div>

      {/* Gerar system prompt */}
      <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">System Prompt</p>
            <p className="text-xs text-muted-foreground">
              {systemPrompt ? 'Prompt gerado — você pode editar abaixo' : 'Clique em Gerar para criar automaticamente com IA'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !description.trim()}
          >
            {generateMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
            Gerar com IA
          </Button>
        </div>

        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowAdvanced(v => !v)}
        >
          {showAdvanced ? '▼' : '▶'} {showAdvanced ? 'Ocultar' : 'Ver/Editar'} system prompt
        </button>

        {showAdvanced && (
          <Textarea
            placeholder="Descreva a descrição acima e clique em 'Gerar com IA', ou escreva o system prompt manualmente..."
            rows={8}
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            className="text-xs font-mono"
          />
        )}
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !name.trim() || !description.trim()}
        >
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          {isEditing ? 'Salvar alterações' : 'Criar especialidade'}
        </Button>
      </div>
    </div>
  )
}
