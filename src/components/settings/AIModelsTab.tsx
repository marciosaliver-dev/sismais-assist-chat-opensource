import { useAIModels } from '@/hooks/useAIModels'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Play, Cpu } from 'lucide-react'
import { toast } from 'sonner'

export function AIModelsTab() {
  const { models, isLoading, testModel } = useAIModels()

  const handleTest = async (modelId: string) => {
    try {
      const result = await testModel.mutateAsync(modelId)
      toast.success(`${modelId} — OK (${result.latency}ms)`)
    } catch {
      toast.error(`${modelId} — Falhou`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          Modelos de IA
        </h3>
        <p className="text-sm text-muted-foreground">
          Modelos LLM via OpenRouter usados pelos agentes. Cada agente pode usar um modelo diferente.
        </p>
      </div>

      <div className="grid gap-4">
        {models?.map(model => (
          <Card key={model.model_id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{model.display_name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{model.provider}</Badge>
                  <Badge variant="secondary">{model.agents_using.length} agente(s)</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <code className="text-xs text-muted-foreground">{model.model_id}</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado por: {model.agents_using.join(', ')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTest(model.model_id)}
                  disabled={testModel.isPending}
                >
                  {testModel.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Play className="w-4 h-4 mr-1" />
                  )}
                  Testar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!models || models.length === 0) && (
          <p className="text-center text-muted-foreground py-8">Nenhum modelo configurado.</p>
        )}
      </div>
    </div>
  )
}
