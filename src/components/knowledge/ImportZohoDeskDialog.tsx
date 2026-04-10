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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Globe,
  ImageIcon,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

interface ZohoArticle {
  id: number
  title: string
  content_html: string
  status: string
  tags: string[]
  url: string
}

interface ZohoSection {
  id: number
  name: string
  description: string | null
  articles: ZohoArticle[]
}

interface ZohoCategory {
  id: number
  name: string
  description: string | null
  sections: ZohoSection[]
}

interface ZohoPayload {
  exported_at: string
  source_url: string
  portal_name: string
  categories: ZohoCategory[]
}

interface ImportStatsJson {
  products: number
  groups: number
  articles: number
  skipped: number
  errors: number
  images_rehosted?: number
}

interface ImportStatsApi {
  total_found: number
  imported: number
  duplicates: number
  skipped: number
  errors: number
  images_rehosted?: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// ─── Component ──────────────────────────────────────────────────────

export function ImportZohoDeskDialog({ open, onOpenChange, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<'json' | 'api'>('json')

  // JSON tab state
  const [payload, setPayload] = useState<ZohoPayload | null>(null)
  const [fileName, setFileName] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())

  // API tab state
  const [apiToken, setApiToken] = useState('')
  const [apiOrgId, setApiOrgId] = useState('')
  const [apiDomain, setApiDomain] = useState('desk.zoho.com')
  const [apiDepartmentId, setApiDepartmentId] = useState('')

  // Shared state
  const [importing, setImporting] = useState(false)
  const [resultJson, setResultJson] = useState<ImportStatsJson | null>(null)
  const [resultApi, setResultApi] = useState<ImportStatsApi | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalSections = payload?.categories.reduce((a, c) => a + c.sections.length, 0) ?? 0
  const totalArticles = payload?.categories.reduce(
    (a, c) => a + c.sections.reduce((b, s) => b + s.articles.length, 0),
    0
  ) ?? 0
  const publishedArticles = payload?.categories.reduce(
    (a, c) =>
      a +
      c.sections.reduce(
        (b, s) => b + s.articles.filter((a) => a.status !== 'draft' && a.status !== '1').length,
        0
      ),
    0
  ) ?? 0

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setResultJson(null)
    setResultApi(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        if (!json.categories || !Array.isArray(json.categories)) {
          setError('Arquivo inválido: campo "categories" não encontrado. Use o script extractor correto.')
          setPayload(null)
          return
        }
        setPayload(json)
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

  async function handleImportJson() {
    if (!payload) return
    setImporting(true)
    setError(null)
    setResultJson(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('import-freshdesk-kb', {
        body: { data: payload },
      })

      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)

      setResultJson(data.stats)
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

  async function handleImportApi() {
    if (!apiToken || !apiOrgId) {
      setError('Token e Org ID são obrigatórios.')
      return
    }
    setImporting(true)
    setError(null)
    setResultApi(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('import-zoho-kb', {
        body: {
          mode: 'api',
          token: apiToken,
          orgId: apiOrgId,
          domain: apiDomain || 'desk.zoho.com',
          departmentId: apiDepartmentId || undefined,
        },
      })

      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)

      setResultApi(data.stats)
      toast.success(`Importação via API concluída! ${data.stats.imported} artigos importados.`)
      onSuccess?.()
    } catch (err: any) {
      const msg = err.message || 'Erro na importação via API'
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
    setResultJson(null)
    setResultApi(null)
    setError(null)
    setExpandedCategories(new Set())
    if (fileRef.current) fileRef.current.value = ''
    onOpenChange(false)
  }

  const hasResult = resultJson || resultApi

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-primary" />
            Importar do Zoho Desk
          </DialogTitle>
          <DialogDescription>
            Importe artigos com formatação e imagens do portal{' '}
            <a
              href="https://suporte.sismais.com/portal/pt-br/kb/maissimples"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              suporte.sismais.com <ExternalLink className="w-3 h-3" />
            </a>
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        {!hasResult && (
          <div className="flex border-b border-border">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'json'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('json')}
              disabled={importing}
            >
              <FileJson className="w-4 h-4 inline mr-1.5" />
              Arquivo JSON
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'api'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('api')}
              disabled={importing}
            >
              <Globe className="w-4 h-4 inline mr-1.5" />
              API Zoho Desk
            </button>
          </div>
        )}

        {/* ─── JSON Tab ─── */}
        {activeTab === 'json' && !hasResult && (
          <>
            {/* Step 1: Instructions */}
            {!payload && (
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
                      Cole o conteúdo de{' '}
                      <code className="bg-muted px-1 rounded text-xs font-mono">
                        /freshdesk-extractor.js
                      </code>{' '}
                      e pressione Enter
                    </li>
                    <li>O arquivo JSON será baixado automaticamente</li>
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
                  <p className="text-xs text-muted-foreground mt-1">zohodesk-kb-export.json</p>
                </div>
              </div>
            )}

            {/* Step 2: Preview */}
            {payload && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileJson className="w-4 h-4" />
                  <span>{fileName}</span>
                  <span>·</span>
                  <span>Exportado em {new Date(payload.exported_at).toLocaleString('pt-BR')}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {payload.categories.length} categoria{payload.categories.length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="secondary">
                    {totalSections} seção{totalSections !== 1 ? 'ões' : ''}
                  </Badge>
                  <Badge variant="secondary">
                    {totalArticles} artigo{totalArticles !== 1 ? 's' : ''} total
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    {publishedArticles} publicado{publishedArticles !== 1 ? 's' : ''}
                  </Badge>
                  {totalArticles - publishedArticles > 0 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      {totalArticles - publishedArticles} rascunho{totalArticles - publishedArticles !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>

                {/* Category tree preview */}
                <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {payload.categories.map((cat) => {
                    const expanded = expandedCategories.has(cat.id)
                    const catArticles = cat.sections.reduce((a, s) => a + s.articles.length, 0)
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
                            {cat.sections.length} seção{cat.sections.length !== 1 ? 'ões' : ''} · {catArticles} artigo{catArticles !== 1 ? 's' : ''}
                          </span>
                        </button>
                        {expanded && (
                          <div className="bg-muted/20">
                            {cat.sections.map((section) => {
                              const pub = section.articles.filter(
                                (a) => a.status !== 'draft' && a.status !== '1'
                              ).length
                              return (
                                <div
                                  key={section.id}
                                  className="flex items-center gap-2 px-6 py-2 text-sm border-t border-border/50"
                                >
                                  <span className="text-muted-foreground">└</span>
                                  <span className="flex-1 text-muted-foreground truncate">
                                    {section.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {pub} artigo{pub !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <p className="text-xs text-muted-foreground">
                  Cada categoria vira um <strong>Produto</strong> e cada seção vira um <strong>Grupo</strong>.
                  Imagens serão rehostadas no Supabase Storage. Duplicatas (mesma URL) serão ignoradas.
                </p>
              </div>
            )}
          </>
        )}

        {/* ─── API Tab ─── */}
        {activeTab === 'api' && !hasResult && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Importação direta via API do Zoho Desk</p>
              <p className="text-muted-foreground">
                Busca categorias e artigos automaticamente. Imagens são rehostadas no Supabase Storage.
                Artigos ficam disponíveis para clientes e alimentam a IA.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="api-token">OAuth Token *</Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="Token OAuth do Zoho Desk"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  disabled={importing}
                />
                <p className="text-xs text-muted-foreground">
                  Gere em{' '}
                  <a href="https://accounts.zoho.com/developerconsole" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    accounts.zoho.com/developerconsole
                  </a>{' '}
                  com scope <code className="bg-muted px-1 rounded text-xs">Desk.articles.READ</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="api-org">Org ID *</Label>
                <Input
                  id="api-org"
                  placeholder="ID da organização Zoho Desk"
                  value={apiOrgId}
                  onChange={(e) => setApiOrgId(e.target.value)}
                  disabled={importing}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="api-domain">Domínio</Label>
                  <Input
                    id="api-domain"
                    placeholder="desk.zoho.com"
                    value={apiDomain}
                    onChange={(e) => setApiDomain(e.target.value)}
                    disabled={importing}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-dept">Department ID</Label>
                  <Input
                    id="api-dept"
                    placeholder="Opcional"
                    value={apiDepartmentId}
                    onChange={(e) => setApiDepartmentId(e.target.value)}
                    disabled={importing}
                  />
                </div>
              </div>
            </div>

            {importing && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                <p className="font-medium text-foreground">Importando artigos via API...</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Buscando categorias, artigos e rehostando imagens. Isso pode levar alguns minutos.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Results (shared) ─── */}
        {hasResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Importação concluída com sucesso!</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Artigos disponíveis na base de conhecimento com formatação e imagens preservadas.
                </p>
              </div>
            </div>

            {resultJson && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{resultJson.products}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Produtos criados</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{resultJson.groups}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Grupos criados</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{resultJson.articles}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Artigos importados</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{resultJson.skipped}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ignorados / duplicatas</p>
                </div>
                {(resultJson.images_rehosted ?? 0) > 0 && (
                  <div className="col-span-2 rounded-lg border border-border bg-card p-3 text-center">
                    <p className="text-lg font-bold text-foreground flex items-center justify-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      {resultJson.images_rehosted}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Imagens rehostadas</p>
                  </div>
                )}
                {resultJson.errors > 0 && (
                  <p className="col-span-2 text-sm text-destructive">
                    {resultJson.errors} artigo{resultJson.errors !== 1 ? 's' : ''} com erro.
                  </p>
                )}
              </div>
            )}

            {resultApi && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{resultApi.total_found}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Artigos encontrados</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{resultApi.imported}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Importados</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{resultApi.duplicates}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Duplicatas</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{resultApi.skipped}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ignorados</p>
                </div>
                {(resultApi.images_rehosted ?? 0) > 0 && (
                  <div className="col-span-2 rounded-lg border border-border bg-card p-3 text-center">
                    <p className="text-lg font-bold text-foreground flex items-center justify-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      {resultApi.images_rehosted}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Imagens rehostadas</p>
                  </div>
                )}
                {resultApi.errors > 0 && (
                  <p className="col-span-2 text-sm text-destructive">
                    {resultApi.errors} artigo{resultApi.errors !== 1 ? 's' : ''} com erro.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFile}
        />

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-2">
          <div>
            {activeTab === 'json' && !hasResult && (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                {payload ? 'Trocar arquivo' : 'Selecionar JSON'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              {hasResult ? 'Fechar' : 'Cancelar'}
            </Button>
            {activeTab === 'json' && payload && !hasResult && (
              <Button onClick={handleImportJson} disabled={importing}>
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
            {activeTab === 'api' && !hasResult && (
              <Button onClick={handleImportApi} disabled={importing || !apiToken || !apiOrgId}>
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando via API...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    Importar via API
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
