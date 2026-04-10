import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, AlertTriangle, RefreshCw, DollarSign, Loader2, Wifi } from 'lucide-react'
import { useOpenRouterCredits, useSyncOpenRouterModels, useModelCatalog } from '@/hooks/useModelCatalog'
import { useExchangeRate } from '@/hooks/useExchangeRate'

export function WizardStepProvider() {
  const { data: credits, isLoading: loadingCredits } = useOpenRouterCredits()
  const { data: models = [], isLoading: loadingModels } = useModelCatalog({ activeOnly: false })
  const syncModels = useSyncOpenRouterModels()
  const { rate: exchangeRate } = useExchangeRate()

  const activeModels = models.filter(m => m.is_active)
  const remaining = credits?.balance ?? credits?.limit_remaining ?? 0
  const used = credits?.total_usage ?? credits?.usage ?? 0
  const limit = credits?.limit ?? 0
  const hasCredits = credits && remaining > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Provider & Créditos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verifique a conexão com o OpenRouter e o saldo de créditos disponíveis.
        </p>
      </div>

      {/* Provider Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#10293F] flex items-center justify-center">
                <Wifi className="w-5 h-5 text-[#45E5E5]" />
              </div>
              <div>
                <h3 className="font-medium text-sm">OpenRouter (Multi-LLM)</h3>
                <p className="text-xs text-muted-foreground">Gateway para modelos Google, OpenAI, Anthropic e mais</p>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Conectado
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Credits */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Saldo de Créditos</h3>
              <p className="text-xs text-muted-foreground">Créditos disponíveis para chamadas de IA</p>
            </div>
          </div>

          {loadingCredits ? (
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : credits ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                <p className="text-lg font-bold text-foreground">${remaining.toFixed(2)}</p>
                {exchangeRate && (
                  <p className="text-xs text-muted-foreground">R$ {(remaining * exchangeRate).toFixed(2)}</p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">Usado</p>
                <p className="text-lg font-bold text-foreground">${used.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">Limite</p>
                <p className="text-lg font-bold text-foreground">${limit.toFixed(2)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Não foi possível verificar créditos. Verifique a API Key do OpenRouter.
            </div>
          )}

          {credits && !hasCredits && (
            <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Saldo insuficiente. Adicione créditos no OpenRouter para que os agentes possam responder.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Catalog */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Catálogo de Modelos</h3>
                <p className="text-xs text-muted-foreground">
                  {loadingModels ? 'Carregando...' : `${activeModels.length} ativos de ${models.length} disponíveis`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncModels.mutate({})}
              disabled={syncModels.isPending}
            >
              {syncModels.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Sincronizar
            </Button>
          </div>

          {!loadingModels && activeModels.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Catálogo sincronizado com {activeModels.length} modelos ativos prontos para uso.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
