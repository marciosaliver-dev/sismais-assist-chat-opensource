import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ExternalLink, Loader2 } from 'lucide-react'

interface MessageTemplatesProps {
  instanceId?: string
}

interface MetaTemplate {
  name: string
  category: string
  language: string
  status: string
  components: Array<{ type: string; text?: string }>
}

export function MessageTemplates({ instanceId }: MessageTemplatesProps) {
  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['meta-templates-all', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-whatsapp-proxy', {
        body: { action: 'getTemplates', instanceId, statusFilter: 'ALL' },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return (data?.templates || []) as MetaTemplate[]
    },
    enabled: !!instanceId,
    staleTime: 60000,
  })

  const getCategoryVariant = (category: string) => {
    switch (category) {
      case 'UTILITY': return 'default' as const
      case 'MARKETING': return 'secondary' as const
      case 'AUTHENTICATION': return 'outline' as const
      default: return 'secondary' as const
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]'
      case 'PENDING': return 'bg-yellow-500 text-white'
      case 'REJECTED': return 'bg-destructive text-destructive-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const displayTemplates = templates || []

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Templates HSM</CardTitle>
      </CardHeader>

      <CardContent>
        {!instanceId ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Selecione uma instância Meta para ver os templates.
          </p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive text-center py-4">
            Erro ao carregar templates: {(error as Error).message}
          </p>
        ) : !displayTemplates.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum template encontrado nesta conta.
          </p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {displayTemplates.map((template, index) => {
                const body = template.components?.find(c => c.type === 'BODY')
                return (
                  <div key={`${template.name}-${template.language}-${index}`} className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{template.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={getCategoryVariant(template.category)}>
                            {template.category}
                          </Badge>
                          <Badge variant="outline">{template.language}</Badge>
                          <Badge className={getStatusBadge(template.status)}>
                            {template.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {body?.text && (
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2 font-mono">
                        {body.text}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Templates precisam ser aprovados pela Meta.
            <a
              href="https://business.facebook.com/latest/whatsapp_manager/message_templates"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-0.5"
            >
              Criar templates <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
