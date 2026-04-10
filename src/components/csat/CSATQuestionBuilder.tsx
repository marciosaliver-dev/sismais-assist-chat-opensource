import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import type { CSATQuestion } from '@/hooks/useCSATBoardConfig'

interface CSATQuestionBuilderProps {
  questions: CSATQuestion[]
  onChange: (questions: CSATQuestion[]) => void
}

function toKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40)
}

const TYPE_LABELS: Record<CSATQuestion['type'], string> = {
  scale: 'Escala 1-5',
  text: 'Texto livre',
  yes_no: 'Sim / Não',
}

export function CSATQuestionBuilder({ questions, onChange }: CSATQuestionBuilderProps) {
  function addQuestion() {
    onChange([
      ...questions,
      { key: `pergunta_${questions.length + 1}`, label: '', type: 'scale' },
    ])
  }

  function updateLabel(index: number, label: string) {
    const updated = questions.map((q, i) =>
      i === index ? { ...q, label, key: toKey(label) || `pergunta_${i + 1}` } : q
    )
    onChange(updated)
  }

  function updateType(index: number, type: CSATQuestion['type']) {
    onChange(questions.map((q, i) => (i === index ? { ...q, type } : q)))
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 text-center">
          Nenhuma pergunta adicional configurada.
        </p>
      ) : (
        questions.map((q, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />

            <Input
              value={q.label}
              onChange={(e) => updateLabel(i, e.target.value)}
              placeholder="Texto da pergunta"
              className="flex-1 h-8 text-sm"
            />

            <Select
              value={q.type}
              onValueChange={(v) => updateType(i, v as CSATQuestion['type'])}
            >
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as CSATQuestion['type'][]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
              onClick={() => removeQuestion(i)}
              aria-label="Remover pergunta"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}

      <Button variant="outline" size="sm" className="gap-2" onClick={addQuestion}>
        <Plus className="h-4 w-4" />
        Adicionar pergunta
      </Button>
    </div>
  )
}
