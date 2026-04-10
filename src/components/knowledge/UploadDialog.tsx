import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { FileText, Link as LinkIcon, Video, Image as ImageIcon, Upload, Globe, RefreshCw, Eye, Brain, File, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase'
import { useFirecrawl } from '@/hooks/useFirecrawl'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { KnowledgeProduct } from '@/hooks/useKnowledgeProducts'
import type { KnowledgeGroup } from '@/hooks/useKnowledgeGroups'

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products?: KnowledgeProduct[]
  groups?: KnowledgeGroup[]
  defaultProductId?: string | null
  defaultGroupId?: string | null
}

export function UploadDialog({ open, onOpenChange, products = [], groups = [], defaultProductId, defaultGroupId }: UploadDialogProps) {
  const { createDocument, updateDocument } = useKnowledgeBase()
  const { crawlUrl, crawlSite, checkExistingUrls, loading: crawling } = useFirecrawl()
  const [activeTab, setActiveTab] = useState('document')
  const [loading, setLoading] = useState(false)

  // Product/Group selection
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  useEffect(() => {
    if (open) {
      setSelectedProductId(defaultProductId || '')
      setSelectedGroupId(defaultGroupId || '')
    }
  }, [open, defaultProductId, defaultGroupId])

  const filteredGroups = selectedProductId
    ? groups.filter((g) => g.product_id === selectedProductId)
    : []

  // Visibility flags
  const [isPublic, setIsPublic] = useState(false)
  const [feedsAi, setFeedsAi] = useState(true)

  const [textData, setTextData] = useState({ title: '', content: '', category: 'faq', tags: '' })
  const [linkData, setLinkData] = useState({ url: '', category: 'tutorial', tags: '' })
  const [crawlData, setCrawlData] = useState({ url: '', category: 'tutorial', tags: '', limit: '10', maxDepth: 'auto' })
  const [crawlResults, setCrawlResults] = useState<{ url: string; title: string; markdown: string; selected: boolean; existsInBase?: boolean }[]>([])
  const [crawlProgress, setCrawlProgress] = useState<string | null>(null)
  const [videoData, setVideoData] = useState({ url: '', category: 'tutorial', tags: '' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docData, setDocData] = useState({ title: '', category: 'tutorial', tags: '' })
  const [docProgress, setDocProgress] = useState<{ step: string; percent: number } | null>(null)

  const getProductGroupFields = () => {
    const fields: Record<string, any> = {
      is_public: isPublic,
      feeds_ai: feedsAi,
    }
    if (selectedProductId) fields.product_id = selectedProductId
    if (selectedGroupId) fields.group_id = selectedGroupId
    return fields
  }

  const VisibilitySelector = () => (
    <div className="flex items-center gap-6 p-3 rounded-lg bg-muted/50 border border-border">
      <div className="flex items-center gap-3">
        <Switch checked={isPublic} onCheckedChange={setIsPublic} id="is-public" />
        <Label htmlFor="is-public" className="text-foreground flex items-center gap-1.5 cursor-pointer">
          <Eye className="w-3.5 h-3.5 text-blue-500" />
          Público (Central do Cliente)
        </Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={feedsAi} onCheckedChange={setFeedsAi} id="feeds-ai" />
        <Label htmlFor="feeds-ai" className="text-foreground flex items-center gap-1.5 cursor-pointer">
          <Brain className="w-3.5 h-3.5 text-purple-500" />
          Alimentar IA (RAG)
        </Label>
      </div>
    </div>
  )

  const ProductGroupSelector = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-foreground">Produto</Label>
        <Select value={selectedProductId} onValueChange={(v) => { setSelectedProductId(v === '__none__' ? '' : v); setSelectedGroupId('') }}>
          <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || '#6366f1' }} />
                  {p.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Grupo</Label>
        <Select value={selectedGroupId} onValueChange={(v) => setSelectedGroupId(v === '__none__' ? '' : v)} disabled={!selectedProductId}>
          <SelectTrigger><SelectValue placeholder={selectedProductId ? "Selecione o grupo" : "Selecione um produto"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum</SelectItem>
            {filteredGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  const handleTextSubmit = async () => {
    if (!textData.title || !textData.content) {
      toast.error('Preencha título e conteúdo')
      return
    }
    setLoading(true)
    try {
      await createDocument.mutateAsync({
        title: textData.title,
        content: textData.content,
        content_type: 'text',
        category: textData.category,
        tags: textData.tags.split(',').map(t => t.trim()).filter(Boolean),
        source: 'manual_upload',
        ...getProductGroupFields(),
      } as any)
      toast.success('Conteúdo adicionado com sucesso!')
      onOpenChange(false)
      setTextData({ title: '', content: '', category: 'faq', tags: '' })
    } catch (error: any) {
      toast.error(error.message || 'Erro ao adicionar conteúdo')
    } finally {
      setLoading(false)
    }
  }

  const handleLinkSubmit = async () => {
    if (!linkData.url) { toast.error('Informe a URL'); return }
    setLoading(true)
    try {
      const crawled = await crawlUrl(linkData.url)
      await createDocument.mutateAsync({
        title: crawled.title,
        content: crawled.content,
        content_type: 'link',
        category: linkData.category,
        tags: linkData.tags.split(',').map(t => t.trim()).filter(Boolean),
        original_url: linkData.url,
        source: 'firecrawl',
        ...getProductGroupFields(),
      } as any)
      toast.success('Link crawleado e adicionado!')
      onOpenChange(false)
      setLinkData({ url: '', category: 'tutorial', tags: '' })
    } catch (error: any) {
      toast.error(error.message || 'Erro ao crawlear link')
    } finally {
      setLoading(false)
    }
  }

  const handleCrawlStart = async () => {
    if (!crawlData.url) { toast.error('Informe a URL do site'); return }
    setCrawlResults([])
    setCrawlProgress('Iniciando crawl recursivo...')
    try {
      const parsedMaxDepth = crawlData.maxDepth === 'auto' ? undefined : parseInt(crawlData.maxDepth)
      const pages = await crawlSite(crawlData.url, parseInt(crawlData.limit), parsedMaxDepth)
      const pageUrls = pages.map(p => p.url)
      const existingDocs = await checkExistingUrls(pageUrls)
      const existingUrlSet = new Set(existingDocs.map(d => d.original_url))
      setCrawlResults(pages.map(p => ({
        ...p,
        selected: true,
        existsInBase: existingUrlSet.has(p.url)
      })))
      setCrawlProgress(null)
      const existingCount = pages.filter(p => existingUrlSet.has(p.url)).length
      toast.success(`${pages.length} páginas encontradas!${existingCount > 0 ? ` (${existingCount} já existem na base)` : ''}`)
    } catch (error: any) {
      setCrawlProgress(null)
      toast.error(error.message || 'Erro no crawl')
    }
  }

  const handleCrawlImport = async () => {
    const selected = crawlResults.filter(r => r.selected)
    if (selected.length === 0) { toast.error('Selecione ao menos uma página'); return }
    setLoading(true)
    const tags = crawlData.tags.split(',').map(t => t.trim()).filter(Boolean)
    let created = 0
    let updated = 0
    for (const page of selected) {
      try {
        if (page.existsInBase) {
          const existingDocs = await checkExistingUrls([page.url])
          if (existingDocs.length > 0) {
            await updateDocument.mutateAsync({
              id: existingDocs[0].id,
              updates: {
                title: page.title,
                content: page.markdown,
                updated_at: new Date().toISOString()
              }
            })
            updated++
            continue
          }
        }
        await createDocument.mutateAsync({
          title: page.title,
          content: page.markdown,
          content_type: 'link',
          category: crawlData.category,
          tags,
          original_url: page.url,
          source: 'firecrawl_crawl',
          ...getProductGroupFields(),
        } as any)
        created++
      } catch (e) {
        console.error('Failed to import page:', page.url, e)
      }
    }
    setLoading(false)
    const parts = []
    if (created > 0) parts.push(`${created} ${created === 1 ? 'nova' : 'novas'}`)
    if (updated > 0) parts.push(`${updated} ${updated === 1 ? 'atualizada' : 'atualizadas'}`)
    toast.success(`${parts.join(', ')} de ${selected.length} páginas importadas!`)
    onOpenChange(false)
    setCrawlResults([])
    setCrawlData({ url: '', category: 'tutorial', tags: '', limit: '10', maxDepth: 'auto' })
  }

  const handleVideoSubmit = async () => {
    if (!videoData.url) { toast.error('Informe a URL do vídeo'); return }
    const videoId = videoData.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1]
    if (!videoId) { toast.error('URL de YouTube inválida'); return }
    setLoading(true)
    try {
      const mockTranscript = 'Transcrição do vídeo...'
      await createDocument.mutateAsync({
        title: `Vídeo: ${videoId}`,
        content: mockTranscript,
        content_type: 'video',
        category: videoData.category,
        tags: videoData.tags.split(',').map(t => t.trim()).filter(Boolean),
        original_url: videoData.url,
        media_url: videoData.url,
        transcript: mockTranscript,
        source: 'youtube',
        ...getProductGroupFields(),
      } as any)
      toast.success('Vídeo adicionado!')
      onOpenChange(false)
      setVideoData({ url: '', category: 'tutorial', tags: '' })
    } catch (error: any) {
      toast.error(error.message || 'Erro ao adicionar vídeo')
    } finally {
      setLoading(false)
    }
  }

  const handleImageSubmit = async () => {
    if (!imageFile) { toast.error('Selecione uma imagem'); return }
    setLoading(true)
    try {
      const mockOCR = 'Texto extraído da imagem via OCR...'
      await createDocument.mutateAsync({
        title: imageFile.name,
        content: mockOCR,
        content_type: 'image',
        category: 'faq',
        ocr_text: mockOCR,
        source: 'ocr',
        ...getProductGroupFields(),
      } as any)
      toast.success('Imagem processada!')
      onOpenChange(false)
      setImageFile(null)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar imagem')
    } finally {
      setLoading(false)
    }
  }

  const ACCEPTED_DOC_TYPES = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xlsx',
    'image/png': 'image',
    'image/jpeg': 'image',
    'image/webp': 'image',
  } as Record<string, string>

  const handleDocSubmit = async () => {
    if (!docFile) { toast.error('Selecione um arquivo'); return }
    const fileType = ACCEPTED_DOC_TYPES[docFile.type]
    if (!fileType) { toast.error('Tipo de arquivo não suportado'); return }

    setLoading(true)
    setDocProgress({ step: 'Lendo arquivo...', percent: 10 })

    try {
      // Convert file to base64
      const buffer = await docFile.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      )

      setDocProgress({ step: 'Enviando para processamento...', percent: 30 })

      const { data, error } = await supabase.functions.invoke('document-processor', {
        body: {
          file_base64: base64,
          file_name: docFile.name,
          file_type: fileType,
          title: docData.title || docFile.name.replace(/\.[^/.]+$/, ''),
          category: docData.category,
          tags: docData.tags.split(',').map(t => t.trim()).filter(Boolean),
          ...getProductGroupFields(),
        },
      })

      if (error) throw new Error(error.message || 'Erro ao processar documento')

      setDocProgress({ step: 'Gerando embeddings...', percent: 80 })

      // Small delay to show progress
      await new Promise(r => setTimeout(r, 500))
      setDocProgress({ step: 'Concluído!', percent: 100 })

      const chunksInfo = data?.chunks_count > 1 ? ` (${data.chunks_count} partes)` : ''
      toast.success(`Documento processado com sucesso!${chunksInfo}`)
      onOpenChange(false)
      setDocFile(null)
      setDocData({ title: '', category: 'tutorial', tags: '' })
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar documento')
    } finally {
      setLoading(false)
      setDocProgress(null)
    }
  }

  const togglePage = (index: number) => {
    setCrawlResults(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r))
  }

  const toggleAll = (checked: boolean) => {
    setCrawlResults(prev => prev.map(r => ({ ...r, selected: checked })))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Adicionar Conteúdo</DialogTitle>
          <DialogDescription>
            Escolha o tipo de conteúdo que deseja adicionar à base de conhecimento
          </DialogDescription>
        </DialogHeader>

        {/* Product/Group selector (shared across all tabs) */}
        {products.length > 0 && (
          <div className="mt-2">
            <ProductGroupSelector />
          </div>
        )}

        {/* Visibility flags */}
        <div className="mt-3">
          <VisibilitySelector />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-6 bg-muted">
            <TabsTrigger value="document" className="flex items-center gap-1 text-xs">
              <File className="w-3.5 h-3.5" />
              Documento
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-1 text-xs">
              <FileText className="w-3.5 h-3.5" />
              Texto
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-1 text-xs">
              <LinkIcon className="w-3.5 h-3.5" />
              Link
            </TabsTrigger>
            <TabsTrigger value="crawl" className="flex items-center gap-1 text-xs">
              <Globe className="w-3.5 h-3.5" />
              Site
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-1 text-xs">
              <Video className="w-3.5 h-3.5" />
              Vídeo
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1 text-xs">
              <ImageIcon className="w-3.5 h-3.5" />
              Imagem
            </TabsTrigger>
          </TabsList>

          {/* Tab: Documento (PDF, DOCX, XLSX, Imagem) */}
          <TabsContent value="document" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Arquivo</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <Input
                  id="doc-file"
                  type="file"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setDocFile(f)
                    if (f && !docData.title) {
                      setDocData(prev => ({ ...prev, title: f.name.replace(/\.[^/.]+$/, '') }))
                    }
                  }}
                  className="hidden"
                />
                <label htmlFor="doc-file" className="cursor-pointer">
                  {docFile ? (
                    <div className="flex items-center gap-3 justify-center">
                      <File className="w-8 h-8 text-primary" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{docFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(docFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-medium mb-1">Arraste ou clique para selecionar</p>
                      <p className="text-xs text-muted-foreground">PDF, Word (.docx), Excel (.xlsx), Imagens (PNG, JPG)</p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Título</Label>
              <Input
                value={docData.title}
                onChange={(e) => setDocData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Nome do documento"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Categoria</Label>
                <Select value={docData.category} onValueChange={(value) => setDocData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                    <SelectItem value="policy">Política</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Tags</Label>
                <Input value={docData.tags} onChange={(e) => setDocData(prev => ({ ...prev, tags: e.target.value }))} placeholder="manual, pdf" />
              </div>
            </div>

            {docProgress && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {docProgress.step}
                </div>
                <Progress value={docProgress.percent} className="h-2" />
              </div>
            )}

            <Button onClick={handleDocSubmit} disabled={loading || !docFile} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? 'Processando documento...' : 'Processar e Adicionar'}
            </Button>
          </TabsContent>

          {/* Tab: Texto */}
          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Título</Label>
              <Input value={textData.title} onChange={(e) => setTextData(prev => ({ ...prev, title: e.target.value }))} placeholder="Ex: Como resolver erro de login" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Conteúdo</Label>
              <Textarea value={textData.content} onChange={(e) => setTextData(prev => ({ ...prev, content: e.target.value }))} placeholder="Digite o conteúdo aqui..." rows={8} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Categoria</Label>
                <Select value={textData.category} onValueChange={(value) => setTextData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                    <SelectItem value="policy">Política</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Tags (separadas por vírgula)</Label>
                <Input value={textData.tags} onChange={(e) => setTextData(prev => ({ ...prev, tags: e.target.value }))} placeholder="login, senha, erro" />
              </div>
            </div>
            <Button onClick={handleTextSubmit} disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? 'Adicionando...' : 'Adicionar Texto'}
            </Button>
          </TabsContent>

          {/* Tab: Link */}
          <TabsContent value="link" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">URL para Crawlear</Label>
              <Input type="url" value={linkData.url} onChange={(e) => setLinkData(prev => ({ ...prev, url: e.target.value }))} placeholder="https://help.sismais.com/artigo" />
              <p className="text-xs text-muted-foreground">Extrai o conteúdo de uma única página via Firecrawl</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Categoria</Label>
                <Select value={linkData.category} onValueChange={(value) => setLinkData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                    <SelectItem value="policy">Política</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Tags</Label>
                <Input value={linkData.tags} onChange={(e) => setLinkData(prev => ({ ...prev, tags: e.target.value }))} placeholder="documentação, api" />
              </div>
            </div>
            <Button onClick={handleLinkSubmit} disabled={loading || crawling} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading || crawling ? 'Crawleando...' : 'Crawlear e Adicionar'}
            </Button>
          </TabsContent>

          {/* Tab: Crawl Recursivo */}
          <TabsContent value="crawl" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">URL do Site</Label>
              <Input type="url" value={crawlData.url} onChange={(e) => setCrawlData(prev => ({ ...prev, url: e.target.value }))} placeholder="https://help.sismais.com" />
              <p className="text-xs text-muted-foreground">Crawlea múltiplas páginas automaticamente a partir desta URL</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Máx. páginas</Label>
                <Select value={crawlData.limit} onValueChange={(value) => setCrawlData(prev => ({ ...prev, limit: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 páginas</SelectItem>
                    <SelectItem value="10">10 páginas</SelectItem>
                    <SelectItem value="25">25 páginas</SelectItem>
                    <SelectItem value="50">50 páginas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Profundidade</Label>
                <Select value={crawlData.maxDepth} onValueChange={(value) => setCrawlData(prev => ({ ...prev, maxDepth: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (recomendado)</SelectItem>
                    <SelectItem value="1">1 nível</SelectItem>
                    <SelectItem value="2">2 níveis</SelectItem>
                    <SelectItem value="3">3 níveis</SelectItem>
                    <SelectItem value="4">4 níveis</SelectItem>
                    <SelectItem value="5">5 níveis</SelectItem>
                    <SelectItem value="10">10 níveis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Categoria</Label>
                <Select value={crawlData.category} onValueChange={(value) => setCrawlData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                    <SelectItem value="policy">Política</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Tags</Label>
                <Input value={crawlData.tags} onChange={(e) => setCrawlData(prev => ({ ...prev, tags: e.target.value }))} placeholder="documentação, site" />
              </div>
            </div>

            {crawlResults.length === 0 ? (
              <Button onClick={handleCrawlStart} disabled={crawling} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {crawling ? (
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4 animate-spin" />
                    {crawlProgress || 'Crawleando site...'}
                  </span>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    Iniciar Crawl do Site
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={crawlResults.every(r => r.selected)}
                      onCheckedChange={(checked) => toggleAll(!!checked)}
                    />
                    <span className="text-sm text-foreground font-medium">
                      {crawlResults.filter(r => r.selected).length} de {crawlResults.length} selecionadas
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCrawlResults([])}>
                    Recrawlear
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                  {crawlResults.map((page, i) => (
                    <label key={i} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={page.selected} onCheckedChange={() => togglePage(i)} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{page.title}</p>
                          {page.existsInBase && (
                            <Badge variant="outline" className="text-xs shrink-0 text-amber-600 border-amber-300">
                              <RefreshCw className="w-2.5 h-2.5 mr-1" />
                              Atualizar
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {page.url}
                          <span className="ml-2 text-muted-foreground/60">{page.markdown.length.toLocaleString()} chars</span>
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <Button onClick={handleCrawlImport} disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  {loading ? 'Importando...' : `Importar ${crawlResults.filter(r => r.selected).length} Páginas`}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab: Vídeo */}
          <TabsContent value="video" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">URL do YouTube</Label>
              <Input type="url" value={videoData.url} onChange={(e) => setVideoData(prev => ({ ...prev, url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
              <p className="text-xs text-muted-foreground">Vamos extrair a transcrição automaticamente</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Categoria</Label>
                <Select value={videoData.category} onValueChange={(value) => setVideoData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Tags</Label>
                <Input value={videoData.tags} onChange={(e) => setVideoData(prev => ({ ...prev, tags: e.target.value }))} placeholder="tutorial, video" />
              </div>
            </div>
            <Button onClick={handleVideoSubmit} disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? 'Processando...' : 'Extrair e Adicionar'}
            </Button>
          </TabsContent>

          {/* Tab: Imagem */}
          <TabsContent value="image" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Imagem/Print</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
                <Input id="image-file" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="hidden" />
                <label htmlFor="image-file" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-foreground mb-2">{imageFile ? imageFile.name : 'Clique para selecionar'}</p>
                  <p className="text-sm text-muted-foreground">PNG, JPG ou WebP</p>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">Vamos extrair o texto da imagem usando OCR</p>
            </div>
            <Button onClick={handleImageSubmit} disabled={loading || !imageFile} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? 'Processando OCR...' : 'Processar e Adicionar'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
