import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import {
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'

interface FreshdeskArticle {
  id: number
  title: string
  content_html: string
  content_text: string
  status: number
  tags: string[]
  url: string
}

interface FreshdeskFolder {
  id: number
  name: string
  description: string | null
  articles: FreshdeskArticle[]
}

interface FreshdeskCategory {
  id: number
  name: string
  description: string | null
  folders: FreshdeskFolder[]
}

interface FreshdeskPayload {
  exported_at: string
  source_url: string
  categories: FreshdeskCategory[]
}

interface ImportStats {
  products: number
  groups: number
  articles: number
  skipped: number
  errors: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ImportFreshdeskDialog({ open, onOpenChange, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [payload, setPayload] = useState<FreshdeskPayload | null>(null)
  const [fileName, setFileName] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalFolders = payload?.categories.reduce((a, c) => a + c.folders.length, 0) ?? 0
  const totalArticles = payload?.categories.reduce(
    (a, c) => a + c.folders.reduce((b, f) => b + f.articles.length, 0),
    0
  ) ?? 0
  const publishedArticles = payload?.categories.reduce(
    (a, c) => a + c.folders.reduce((b, f) => b + f.articles.filter(a => a.status === 2).length, 0),
    0
  ) ?? 0

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setResult(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        if (!json.categories || !Array.isArray(json.categories)) {
          setError('Arquivo inválido: "categories" não encontrado. Use o script extractor correto.')
          setPayload(null)
          return
        }
        setPayload(json)
        // Auto-expand first category for preview
        if (json.categories.length > 0) {
          setExpandedCategories(new Set([json.categories[0].id]))
        }
      } catch {
        setError('Arquivo JSON inválido.')
        setPayload(null)
      }
    }
    reader.readAsText(file)
  }

  function toggleCategory(id: number) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleImport() {
    if (!payload) return
    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('import-freshdesk-kb', {
        body: { data: payload },
      })

      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)

      setResult(data.stats)
      toast.success(`Importação concluída! ${data.stats.articles} artigos importados.`)
      onSuccess?.()
    } catch (err: any) {
      const msg = err.message || 'Erro na importação'
      setError(msg)
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  function handleClose() {
    if (importing) return
    setPayload(null)
    setFileName('')
    setResult(null)
    setError(null)
    setExpandedCategories(new Set())
    if (fileRef.current) fileRef.current.value = ''
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-primary" />
            Importar do Freshdesk
          </DialogTitle>
          <DialogDescription>
            Importe artigos do portal{' '}
            <a
              href="https://suporte.sismais.com/portal/pt-br/kb/maissimples"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              suporte.sismais.com <ExternalLink className="w-3 h-3" />
            </a>{' '}
            com a mesma estrutura de categorias e pastas.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Instructions */}
        {!payload && !result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
              <p className="font-medium text-foreground">Como extrair os artigos:</p>
              <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
                <li>
                  Abra{' '}
                  <a
                    href="https://suporte.sismais.com/portal/pt-br/kb/maissimples"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    suporte.sismais.com
                  </a>{' '}
                  no navegador
                </li>
                <li>Pressione F12 e vá para a aba Console</li>
                <li>
                  Copie o conteúdo do arquivo{' '}
                  <code className="bg-muted px-1 rounded text-xs">
                    /freshdesk-extractor.js
                  </code>{' '}
                  e cole no console
                </li>
                <li>Pressione Enter — o arquivo JSON será baixado automaticamente</li>
                <li>Faça upload do JSON abaixo</li>
              </ol>
            </div>

            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                Clique para selecionar o arquivo JSON
              </p>
              <p className="text-xs text-muted-foreground mt-1">freshdesk-kb-export.json</p>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {payload && !result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileJson className="w-4 h-4" />
              <span>{fileName}</span>
              <span>·</span>
              <span>Exportado em {new Date(payload.exported_at).toLocaleString('pt-BR')}</span>
            </div>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {payload.categories.length} categoria{payload.categories.length !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="secondary">
                {totalFolders} pasta{totalFolders !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="secondary">
                {totalArticles} artigo{totalArticles !== 1 ? 's' : ''} total
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {publishedArticles} publicado{publishedArticles !== 1 ? 's' : ''} (serão importados)
              </Badge>
              {totalArticles - publishedArticles > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {totalArticles - publishedArticles} rascunho{totalArticles - publishedArticles !== 1 ? 's' : ''} (ignorados)
                </Badge>
              )}
            </div>

            {/* Category tree preview */}
            <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {payload.categories.map((cat) => {
                const expanded = expandedCategories.has(cat.id)
                const catArticles = cat.folders.reduce((a, f) => a + f.articles.length, 0)
                return (
                  <div key={cat.id} className="border-b border-border last:border-b-0">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
                      onClick={() => toggleCategory(cat.id)}
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1 truncate">{cat.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {cat.folders.length} pasta{cat.folders.length !== 1 ? 's' : ''} · {catArticles} artigo{catArticles !== 1 ? 's' : ''}
                      </span>
                    </button>
                    {expanded && (
                      <div className="bg-muted/20">
                        {cat.folders.map((folder) => (
                          <div
                            key={folder.id}
                            className="flex items-center gap-2 px-6 py-2 text-sm border-t border-border/50"
                          >
                            <span className="text-muted-foreground">└</span>
                            <span className="flex-1 text-muted-foreground truncate">{folder.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {folder.articles.filter(a => a.status === 2).length} artigo{folder.articles.filter(a => a.status === 2).length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              Cada categoria vira um <strong>Produto</strong> e cada pasta vira um <strong>Grupo</strong> na base de conhecimento.
              Artigos duplicados (mesma URL) serão ignorados automaticamente.
            </p>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Result */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Importação concluída com sucesso!</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Os artigos já estão disponíveis na base de conhecimento.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.products}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Produtos criados</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.groups}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Grupos criados</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-primary">{result.articles}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Artigos importados</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ignorados / duplicatas</p>
              </div>
            </div>
            {result.errors > 0 && (
              <p className="text-sm text-destructive">
                {result.errors} artigo{result.errors !== 1 ? 's' : ''} com erro — verifique os logs da Edge Function.
              </p>
            )}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFile}
        />

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-2">
          <div className="flex gap-2">
            {!result && (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                {payload ? 'Trocar arquivo' : 'Selecionar JSON'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              {result ? 'Fechar' : 'Cancelar'}
            </Button>
            {payload && !result && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <FileJson className="w-4 h-4 mr-2" />
                    Importar {publishedArticles} artigo{publishedArticles !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
