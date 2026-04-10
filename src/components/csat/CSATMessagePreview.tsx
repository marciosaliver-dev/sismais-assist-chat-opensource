import { Card } from '@/components/ui/card'

interface CSATMessagePreviewProps {
  template: string
  boardName?: string
}

export function CSATMessagePreview({ template, boardName }: CSATMessagePreviewProps) {
  const preview = template
    .replace(/\{\{nome\}\}/g, 'João Silva')
    .replace(/\{\{protocolo\}\}/g, '#12345')
    .replace(/\{\{board\}\}/g, boardName ?? 'Suporte')

  return (
    <Card className="bg-muted/40 border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        Pré-visualização
      </p>
      <div className="bg-background rounded-lg p-3 border border-border shadow-sm">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{preview}</p>
      </div>
    </Card>
  )
}
