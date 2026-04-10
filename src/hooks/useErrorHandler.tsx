import { useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UseErrorHandlerReturn {
  isError: boolean
  error: Error | null
  ErrorDisplay: () => JSX.Element
  retry: () => void
}

/**
 * Hook reutilizável para error handling em páginas
 * Segue padrões Gmail/Intercom: mostra erro com botão de retry
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const handleError = (err: unknown) => {
    const errorObj = err instanceof Error ? err : new Error(String(err))
    setError(errorObj)
    setIsError(true)
    console.error('Error:', errorObj.message)
  }

  const handleRetry = () => {
    setIsError(false)
    setError(null)
  }

  const ErrorDisplay = ({ 
    title = 'Algo deu errado',
    message = 'Não foi possível carregar os dados. Tente novamente.',
    onRetry
  }: { 
    title?: string
    message?: string
    onRetry?: () => void
  } = {}) => {
    if (!isError) return <></>

    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <div className="text-center">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
          {error && (
            <p className="text-xs text-muted-foreground mt-2">{error.message}</p>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            handleRetry()
            onRetry?.()
          }}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return {
    isError,
    error,
    ErrorDisplay,
    retry: handleError
  }
}

/**
 * Componente skeleton para loading states
 * Segue padrão Gmail - mostra estrutura similar ao conteúdo
 */
export function PageSkeleton({ 
  type = 'default',
  className = '' 
}: { 
  type?: 'default' | 'cards' | 'table' | 'kanban'
  className?: string
}) {
  if (type === 'kanban') {
    return (
      <div className={`p-6 space-y-4 ${className}`}>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 space-y-3">
              <div className="h-6 w-24 bg-muted animate-pulse rounded" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-24 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'cards') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="h-10 bg-muted animate-pulse rounded" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  // Default
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
    </div>
  )
}

/**
 * Componente empty state padronizado
 * Segue padrão Intercom/WhatsApp
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel = 'Criar',
}: {
  icon?: React.ElementType
  title: string
  description?: string
  action?: () => void
  actionLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 gap-4">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && (
        <Button variant="outline" onClick={action}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}