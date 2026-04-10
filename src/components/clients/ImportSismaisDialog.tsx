import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Search, Download, CheckCircle2, XCircle, Loader2, Users2 } from 'lucide-react'

type SismaisLead = {
  id: string
  nome: string
  fantasia: string | null
  documento: string | null
  email_principal: string | null
  telefone1: string | null
  is_cliente: boolean
}

type ImportResult = {
  id: string
  name: string
  status: 'created' | 'updated' | 'error'
  error?: string
  contracts_imported?: number
}

type Step = 'search' | 'select' | 'progress'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: () => void
}

export default function ImportSismaisDialog({ open, onOpenChange, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>('search')
  const [search, setSearch] = useState('')
  const [onlyClients, setOnlyClients] = useState(false)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SismaisLead[]>([])
  const [existingIds, setExistingIds] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [includeContracts, setIncludeContracts] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [progressCurrent, setProgressCurrent] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)

  function reset() {
    setStep('search')
    setSearch('')
    setResults([])
    setExistingIds([])
    setSelected(new Set())
    setImportResults([])
    setProgressCurrent(0)
    setProgressTotal(0)
    setImporting(false)
  }

  function handleClose(val: boolean) {
    if (!val) reset()
    onOpenChange(val)
  }

  async function handleSearch(importAll = false) {
    setSearching(true)
    try {
      const { data, error } = await supabase.functions.invoke('sismais-client-lookup', {
        body: {
          action: 'import',
          search: importAll ? '' : search,
          only_clients: importAll ? false : onlyClients,
          limit: importAll ? 200 : 50,
        }
      })
      if (error) throw error
      const items = data?.results || []
      setResults(items)
      setExistingIds(data?.existing_ids || [])
      if (importAll) {
        setSelected(new Set(items.map((r: SismaisLead) => String(r.id))))
      } else {
        setSelected(new Set())
      }
      setStep('select')
      if (items.length === 0) toast.info('Nenhum registro encontrado no Sismais GL')
    } catch (err) {
      toast.error('Erro ao buscar no Sismais GL')
      console.error(err)
    } finally {
      setSearching(false)
    }
  }

  function toggleAll() {
    if (selected.size === results.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(results.map(r => String(r.id))))
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function handleImport() {
    const ids = Array.from(selected)
    if (ids.length === 0) { toast.error('Selecione ao menos um registro'); return }

    setStep('progress')
    setImporting(true)
    setProgressTotal(ids.length)
    setProgressCurrent(0)
    setImportResults([])

    // Process in batches of 10
    const batchSize = 10
    const allResults: ImportResult[] = []

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      try {
        const { data, error } = await supabase.functions.invoke('sismais-client-lookup', {
          body: {
            action: 'import-execute',
            ids: batch,
            include_contracts: includeContracts,
          }
        })
        if (error) throw error
        const batchResults = data?.results || batch.map((id: string) => ({ id, name: '?', status: 'error' as const, error: 'Unknown' }))
        allResults.push(...batchResults)
      } catch {
        allResults.push(...batch.map(id => ({ id, name: '?', status: 'error' as const, error: 'Falha na requisição' })))
      }
      setProgressCurrent(Math.min(i + batchSize, ids.length))
      setImportResults([...allResults])
    }

    setImporting(false)
    const created = allResults.filter(r => r.status === 'created').length
    const updated = allResults.filter(r => r.status === 'updated').length
    const errors = allResults.filter(r => r.status === 'error').length
    toast.success(`Importação concluída: ${created} criados, ${updated} atualizados, ${errors} erros`)
    onImportComplete()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Importar do Sismais GL
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Search */}
        {step === 'search' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Busque pessoas no banco Sismais GL para importar como clientes do helpdesk.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CNPJ, telefone ou e-mail..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={() => handleSearch()} disabled={searching} className="gap-2">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={onlyClients} onCheckedChange={setOnlyClients} id="only-clients" />
                <Label htmlFor="only-clients" className="text-sm">Filtrar apenas clientes ativos</Label>
              </div>
              <Button variant="outline" onClick={() => handleSearch(true)} disabled={searching} className="gap-2">
                <Users2 className="w-4 h-4" />
                Importar Todos os Clientes
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Selection */}
        {step === 'select' && (
          <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {results.length} registros encontrados · {selected.size} selecionados
              </p>
              <Button variant="ghost" size="sm" onClick={() => setStep('search')}>← Voltar</Button>
            </div>

            <ScrollArea className="flex-1 max-h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === results.length && results.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(lead => {
                    const exists = existingIds.includes(String(lead.id))
                    return (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(String(lead.id))}
                            onCheckedChange={() => toggleOne(String(lead.id))}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{lead.nome || '—'}</div>
                            {lead.fantasia && <div className="text-xs text-muted-foreground">{lead.fantasia}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{lead.documento || '—'}</TableCell>
                        <TableCell className="text-sm">{lead.telefone1 || '—'}</TableCell>
                        <TableCell>
                          {exists ? (
                            <Badge variant="secondary" className="text-xs">Já importado</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Novo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center gap-2">
              <Switch checked={includeContracts} onCheckedChange={setIncludeContracts} id="include-contracts" />
              <Label htmlFor="include-contracts" className="text-sm">Incluir contratos associados</Label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleImport} disabled={selected.size === 0} className="gap-2">
                <Download className="w-4 h-4" />
                Importar {selected.size} {selected.size === 1 ? 'registro' : 'registros'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Progress */}
        {step === 'progress' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{importing ? 'Importando...' : 'Importação concluída'}</span>
                <span>{progressCurrent} / {progressTotal}</span>
              </div>
              <Progress value={progressTotal > 0 ? (progressCurrent / progressTotal) * 100 : 0} />
            </div>

            <ScrollArea className="max-h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {importResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted/50">
                    {r.status === 'error' ? (
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{r.name}</span>
                    <Badge variant={r.status === 'created' ? 'default' : r.status === 'updated' ? 'secondary' : 'destructive'} className="text-xs">
                      {r.status === 'created' ? 'Criado' : r.status === 'updated' ? 'Atualizado' : 'Erro'}
                    </Badge>
                    {(r.contracts_imported ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">+{r.contracts_imported} contratos</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button onClick={() => handleClose(false)} disabled={importing}>
                {importing ? 'Aguarde...' : 'Concluir'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
