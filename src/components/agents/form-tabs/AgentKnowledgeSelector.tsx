import { Building2 } from 'lucide-react'

interface Props {
  agentId?: string
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

export function AgentKnowledgeSelector({ agentId, data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-dashed border-border bg-muted/20">
        <Building2 className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Fontes de Conhecimento da Empresa</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure URLs, documentos e integrações que o agente pode consultar para responder perguntas sobre sua empresa.
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center py-8">
        Em breve — configuração de fontes externas, Confluence, Notion e Google Drive.
      </p>
    </div>
  )
}
