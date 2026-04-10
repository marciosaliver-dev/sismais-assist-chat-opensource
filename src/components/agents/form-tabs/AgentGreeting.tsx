import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Sparkles } from 'lucide-react'

interface Props {
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

const EXAMPLE_CHIPS = [
  { label: 'Tom descontraído', value: 'Use tom descontraído e amigável, como se fosse um amigo prestativo. Seja leve e use emojis com moderação.' },
  { label: 'Formal e profissional', value: 'Seja formal e profissional. Trate o cliente com "você" e mantenha linguagem técnica e objetiva.' },
  { label: 'Empático e acolhedor', value: 'Tom acolhedor e empático. Demonstre que se importa com o problema do cliente antes de ir ao assunto técnico.' },
]

export function AgentGreeting({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-foreground">Instruções de Saudação</Label>
        <Textarea
          className="min-h-[120px]"
          value={data.greeting || ''}
          onChange={(e) => onChange({ greeting: e.target.value })}
          placeholder="Ex: Use um tom descontraído e amigável. Pergunte como o cliente está antes de ir direto ao assunto..."
        />
        <p className="text-xs text-muted-foreground">
          Essas instruções guiam o tom e estilo da saudação gerada pela IA.
          A IA usará automaticamente o nome do contato, a saudação correta por horário
          e mencionará feriados quando aplicável.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Exemplos de instrução:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onChange({ greeting: chip.value })}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md bg-muted/40 border border-border p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-foreground">Injetado automaticamente pela IA</p>
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
          <li>Nome do contato (quando disponível no cadastro)</li>
          <li>Saudação por horário — Bom dia, Boa tarde ou Boa noite</li>
          <li>Feriados e datas especiais do calendário brasileiro</li>
        </ul>
      </div>
    </div>
  )
}
