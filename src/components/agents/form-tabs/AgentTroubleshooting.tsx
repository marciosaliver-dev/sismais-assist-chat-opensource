import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { HelpCircle, Plus, X } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface Props {
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

export function AgentTroubleshooting({ data, onChange }: Props) {
  const diagnosticQuestions: string[] = data.diagnosticQuestions || []
  const commonIssues: { problem: string; solution: string }[] = data.commonIssues || []

  const addQuestion = () => {
    onChange({ diagnosticQuestions: [...diagnosticQuestions, ''] })
  }

  const updateQuestion = (index: number, value: string) => {
    const updated = [...diagnosticQuestions]
    updated[index] = value
    onChange({ diagnosticQuestions: updated })
  }

  const removeQuestion = (index: number) => {
    onChange({ diagnosticQuestions: diagnosticQuestions.filter((_, i) => i !== index) })
  }

  const addIssue = () => {
    onChange({ commonIssues: [...commonIssues, { problem: '', solution: '' }] })
  }

  const updateIssue = (index: number, field: 'problem' | 'solution', value: string) => {
    const updated = [...commonIssues]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ commonIssues: updated })
  }

  const removeIssue = (index: number) => {
    onChange({ commonIssues: commonIssues.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Perguntas de Diagnóstico</Label>
          <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {diagnosticQuestions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary shrink-0" />
              <Input
                value={q}
                onChange={(e) => updateQuestion(i, e.target.value)}
                placeholder="Ex: Qual navegador você está usando?"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(i)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Problemas Comuns</Label>
          <Button type="button" variant="outline" size="sm" onClick={addIssue}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="space-y-3">
          {commonIssues.map((issue, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Problema</Label>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeIssue(i)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <Input
                  value={issue.problem}
                  onChange={(e) => updateIssue(i, 'problem', e.target.value)}
                  placeholder="Ex: Erro ao fazer login"
                />
                <Label className="text-xs text-muted-foreground">Solução</Label>
                <Textarea
                  className="min-h-[60px]"
                  value={issue.solution}
                  onChange={(e) => updateIssue(i, 'solution', e.target.value)}
                  placeholder="Ex: Verificar email, limpar cache..."
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
