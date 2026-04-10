import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { RefreshCw, Database, Search, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useGLSyncStatus } from '@/hooks/useGLSyncStatus'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_BADGE: Record<string, string> = {
  Ativo: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Bloqueado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'Trial 7 Dias': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Gratuita: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

export default function GLSyncDashboard() {
  const { licenses, syncLog, stats } = useGLSyncStatus()
  const [syncing, setSyncing] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function triggerSync(source: string) {
    setSyncing(source)
    try {
      const { error } = await supabase.functions.invoke('gl-sync', {
        body: { source_system: source, mode: 'full' },
      })
      if (error) throw error
      toast.success(`Sync ${source} iniciado!`)
      licenses.refetch()
      syncLog.refetch()
    } catch (err: any) {
      toast.error(`Erro no sync: ${err.message}`)
    } finally {
      setSyncing(null)
    }
  }

  const filtered = (licenses.data || []).filter((l: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (l.nome?.toLowerCase().includes(q) || l.cpf_cnpj?.includes(q) || l.fantasia?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q))
  })

  return (
    <div className="page-container">
      <div className="page-content space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sincronizacao Sismais GL</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Licenças e status de sincronizacao com Mais Simples e Maxpro</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Database className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <XCircle className="w-5 h-5 mx-auto mb-1 text-red-600" />
              <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
              <p className="text-xs text-muted-foreground">Bloqueados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {stats.lastSync ? formatDistanceToNow(new Date(stats.lastSync), { locale: ptBR, addSuffix: true }) : '--'}
              </p>
              <p className="text-xs text-muted-foreground">Ultimo Sync</p>
            </CardContent>
          </Card>
        </div>

        {/* Sync buttons */}
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={() => triggerSync('mais_simples')} disabled={!!syncing}>
            {syncing === 'mais_simples' ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            Sync Mais Simples
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => triggerSync('maxpro')} disabled={!!syncing}>
            {syncing === 'maxpro' ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            Sync Maxpro
          </Button>
          <Button className="gap-2 bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]" onClick={() => triggerSync('all')} disabled={!!syncing}>
            {syncing === 'all' ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            Sync Tudo
          </Button>
        </div>

        {/* Search + Table */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filtrar por nome, CNPJ, email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {licenses.isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#10293F]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Nome</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">CNPJ/CPF</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Sistema</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Fonte</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wide">Sync</th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {filtered.map((l: any) => (
                  <tr key={`${l.gl_id}-${l.source_system}`} className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground">{l.nome}</p>
                      {l.fantasia && l.fantasia !== l.nome && <p className="text-xs text-muted-foreground">{l.fantasia}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{l.cpf_cnpj || '--'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.sistema_utilizado || '--'}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[l.status_pessoa] || 'bg-yellow-100 text-yellow-700'}`}>
                        {l.status_pessoa || 'Desconhecido'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px]">{l.source_system === 'mais_simples' ? 'MS' : 'MP'}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {l.synced_at ? formatDistanceToNow(new Date(l.synced_at), { locale: ptBR, addSuffix: true }) : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
