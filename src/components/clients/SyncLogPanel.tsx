import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Clock, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SyncLogEntry {
  id: string
  sync_type: string
  total_processed: number
  total_created: number
  total_updated: number
  total_errors: number
  error_details: any[]
  duration_ms: number
  created_at: string
  source: string
}

export default function SyncLogPanel() {
  const [expanded, setExpanded] = useState(false)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['customer-sync-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customer_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data || []) as SyncLogEntry[]
    },
    staleTime: 30_000,
  })

  const lastSync = logs[0]

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Carregando histórico de sincronização...
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2 flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        Nenhuma sincronização registrada
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-card">
      {/* Summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 text-xs">
          {lastSync.total_errors > 0 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <span className="font-medium text-foreground">Última sync:</span>
          <span className="text-muted-foreground">
            {new Date(lastSync.created_at).toLocaleDateString('pt-BR')}{' '}
            {new Date(lastSync.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-muted-foreground">—</span>
          <span className="text-muted-foreground">
            {lastSync.total_processed} processados, {lastSync.total_created} novos, {lastSync.total_updated} atualizados
          </span>
          {lastSync.total_errors > 0 && (
            <Badge className="text-[9px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[rgba(220,38,38,0.3)]">
              {lastSync.total_errors} erros
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground w-28 shrink-0">
                {new Date(log.created_at).toLocaleDateString('pt-BR')}{' '}
                {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Badge variant="outline" className="text-[9px] font-bold shrink-0">
                {log.sync_type}
              </Badge>
              <span className="text-foreground">
                {log.total_processed} proc. / {log.total_created} new / {log.total_updated} upd.
              </span>
              {log.total_errors > 0 && (
                <span className="text-[#DC2626] font-medium">{log.total_errors} erros</span>
              )}
              <span className="text-muted-foreground ml-auto">
                {(log.duration_ms / 1000).toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
