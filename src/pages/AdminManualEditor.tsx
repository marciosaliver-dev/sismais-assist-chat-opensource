import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Eye, Save, Send, X, Plus, Lightbulb, GripVertical, Trash2, ListOrdered, FileText, Download, Globe, Search, Library, Sparkles, Wand2, Tags, List, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useFirecrawl } from '@/hooks/useFirecrawl'
import RichTextEditor from '@/components/manuals/RichTextEditor'
import AIManualChat from '@/components/manuals/AIManualChat'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocInsert = Record<string, any>

const MODULE_OPTIONS = [
  { value: 'vendas_pdv', label: 'Vendas (PDV)' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'fiscal_nfe', label: 'Fiscal (NF-e)' },
  { value: 'geral', label: 'Geral' },
]

const TEMPLATES = [
  {
    label: 'Passo a Passo',
    icon: '📋',
    content: '<h2>Objetivo</h2>\n<p>Descreva o que o usuário vai aprender neste manual.</p>\n\n<h2>Pré-requisitos</h2>\n<ul>\n<li>Item necessário antes de começar</li>\n</ul>\n\n<h2>Passo 1 — Título do passo</h2>\n<p>Descreva o que o usuário deve fazer.</p>\n\n<h2>Passo 2 — Título do passo</h2>\n<p>Descreva o próximo passo.</p>\n\n<h2>Passo 3 — Título do passo</h2>\n<p>Descreva o passo final.</p>\n\n<h2>Resultado Esperado</h2>\n<p>O que o usuário deve ver após concluir todos os passos.</p>',
  },
  {
    label: 'FAQ',
    icon: '❓',
    content: '<h2>Perguntas Frequentes</h2>\n\n<h3>Como faço para...?</h3>\n<p>Resposta detalhada aqui.</p>\n\n<h3>Por que aparece o erro...?</h3>\n<p>Explicação do erro e como resolver.</p>\n\n<h3>Onde encontro a opção...?</h3>\n<p>Caminho: Menu > Submenu > Opção</p>',
  },
  {
    label: 'Troubleshooting',
    icon: '🔧',
    content: '<h2>Problema</h2>\n<p>Descreva o problema que o usuário está enfrentando.</p>\n\n<h2>Causa</h2>\n<p>Explique por que isso acontece.</p>\n\n<h2>Solução</h2>\n<ol>\n<li>Primeiro passo para resolver</li>\n<li>Segundo passo</li>\n<li>Terceiro passo</li>\n</ol>\n\n<h2>Se o problema persistir</h2>\n<p>Entre em contato com o suporte técnico.</p>',
  },
  {
    label: 'Novidade do Sistema',
    icon: '🆕',
    content: '<h2>O que mudou?</h2>\n<p>Resumo da novidade ou atualização.</p>\n\n<h2>Como funciona</h2>\n<p>Explicação detalhada da nova funcionalidade.</p>\n\n<h2>Como usar</h2>\n<ol>\n<li>Passo para acessar a novidade</li>\n<li>Como configurar</li>\n</ol>\n\n<h2>Dúvidas?</h2>\n<p>Fale com a equipe de suporte.</p>',
  },
]

export default function AdminManualEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const { crawlUrl, loading: crawlLoading } = useFirecrawl()

  const [title, setTitle] = useState('')
  const [module, setModule] = useState('geral')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  // Import dialogs
  const [importBaseOpen, setImportBaseOpen] = useState(false)
  const [importSearch, setImportSearch] = useState('')
  const [showUrlImport, setShowUrlImport] = useState(false)
  const [importUrl, setImportUrl] = useState('')

  // AI Chat
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [aiAction, setAiAction] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(true)
  const [feedsAi, setFeedsAi] = useState(true)
  const [difficulty, setDifficulty] = useState('iniciante')

  async function callAiAssistant(action: string) {
    setAiAction(action)
    try {
      const { data, error } = await supabase.functions.invoke('ai-article-assistant', {
        body: { action, title, module, content, description: '' },
      })
      if (error) throw error
      if (action === 'improve' && data?.content) {
        setContent(data.content)
        toast.success('Conteúdo melhorado pela IA!')
      } else if (action === 'summarize' && data?.summary) {
        toast.success(`Resumo: ${data.summary}`)
      } else if (action === 'suggest-tags' && data?.tags) {
        const newTags = [...new Set([...tags, ...data.tags])]
        setTags(newTags)
        toast.success(`${data.tags.length} tags sugeridas adicionadas!`)
      } else if (action === 'extract-steps' && data?.steps) {
        const stepsHtml = '<ol>' + data.steps.map((s: string) => `<li>${s}</li>`).join('') + '</ol>'
        setContent(prev => prev + '\n\n<h2>Passo a Passo</h2>\n' + stepsHtml)
        toast.success(`${data.steps.length} passos extraídos!`)
      }
    } catch {
      toast.error('Erro ao chamar assistente IA.')
    } finally {
      setAiAction(null)
    }
  }

  const { data: existing } = useQuery({
    queryKey: ['manual', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ai_knowledge_base')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Doc
    },
    enabled: !isNew,
  })

  useEffect(() => {
    if (existing) {
      setTitle(existing.title ?? '')
      const meta = existing.metadata as Record<string, unknown> | null
      setModule((meta?.module as string) ?? 'geral')
      setContent(existing.content ?? '')
      setTags((meta?.tags as string[]) ?? [])
      setIsPublic(existing.is_public ?? true)
      setFeedsAi(existing.feeds_ai ?? true)
      setDifficulty((meta?.difficulty_level as string) ?? 'iniciante')
    }
  }, [existing])

  // Knowledge base docs for "Import from Base" dialog
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: kbDocs = [] } = useQuery<Record<string, any>[]>({
    queryKey: ['kb-docs-for-import'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ai_knowledge_base')
        .select('id, title, content, tags, category')
        .neq('source_type', 'manual')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: importBaseOpen,
  })

  // Auto-import from ?from=<id> query param
  const fromDocId = searchParams.get('from')
  useEffect(() => {
    if (!fromDocId || !isNew) return
    const fetchAndFill = async () => {
      const { data } = await (supabase as any)
        .from('ai_knowledge_base')
        .select('title, content, tags')
        .eq('id', fromDocId)
        .single()
      if (data) {
        setTitle(data.title ?? '')
        setContent(data.content ?? '')
        setTags(data.tags ?? [])
        toast.success('Conteúdo importado da Base de Conhecimento — revise antes de publicar.')
      }
    }
    fetchAndFill()
  }, [fromDocId, isNew])

  function importFromKbDoc(doc: Record<string, any>) {
    setTitle(doc.title ?? '')
    setContent(doc.content ?? '')
    setTags(doc.tags ?? [])
    setImportBaseOpen(false)
    toast.success('Conteúdo importado — revise e edite antes de publicar.')
  }

  async function importFromUrl() {
    if (!importUrl.trim()) return
    try {
      const result = await crawlUrl(importUrl.trim())
      setTitle(result.title || importUrl)
      setContent(result.content || result.markdown || '')
      setImportUrl('')
      toast.success('Conteúdo importado via URL — revise antes de publicar.')
    } catch {
      // error already shown by useFirecrawl
    }
  }

  const filteredKbDocs = kbDocs.filter((d) =>
    !importSearch ||
    d.title?.toLowerCase().includes(importSearch.toLowerCase()) ||
    d.category?.toLowerCase().includes(importSearch.toLowerCase())
  )

  const wordCount = content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  const canPublish = !!title && !!content

  const saveMutation = useMutation({
    mutationFn: async (status: 'draft' | 'published') => {
      const metadata = {
        module,
        status,
        tags,
        difficulty_level: difficulty,
      }

      if (isNew) {
        const insert: DocInsert = {
          title,
          content,
          source_type: 'manual',
          is_public: isPublic,
          feeds_ai: feedsAi,
          difficulty_level: difficulty,
          metadata,
        }
        const { error } = await (supabase as any).from('ai_knowledge_base').insert(insert)
        if (error) throw error
      } else {
        const { error } = await (supabase as any)
          .from('ai_knowledge_base')
          .update({ title, content, is_public: isPublic, feeds_ai: feedsAi, difficulty_level: difficulty, metadata, updated_at: new Date().toISOString() })
          .eq('id', id!)
        if (error) throw error
      }
    },
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['manuais'] })
      toast.success(status === 'published' ? 'Manual publicado!' : 'Rascunho salvo.')
      navigate('/admin/manuais')
    },
    onError: () => toast.error('Erro ao salvar manual.'),
  })

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t))
  }

  const handleApplyAIContent = useCallback((html: string) => {
    setContent(html)
  }, [])

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/manuais')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-0.5">
                <span>Manuais</span>
                <span>/</span>
                <span>{isNew ? 'Novo Editor' : 'Editar Manual'}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                {isNew ? 'Criar Novo Manual' : 'Editar Manual'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setAiChatOpen(true)}
              className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Sparkles className="w-4 h-4" />
              Gerar com IA
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => callAiAssistant('improve')}
              disabled={!!aiAction || !content}
              className="gap-1.5"
            >
              {aiAction === 'improve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Melhorar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => callAiAssistant('suggest-tags')}
              disabled={!!aiAction || !content}
              className="gap-1.5"
            >
              {aiAction === 'suggest-tags' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tags className="w-3.5 h-3.5" />}
              Tags
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => callAiAssistant('extract-steps')}
              disabled={!!aiAction || !content}
              className="gap-1.5"
            >
              {aiAction === 'extract-steps' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <List className="w-3.5 h-3.5" />}
              Passos
            </Button>
            {isNew && (
              <>
                <Button variant="outline" onClick={() => setImportBaseOpen(true)} className="gap-2" title="Importar conteúdo da Base de Conhecimento">
                  <Library className="w-4 h-4" />
                  Da Base
                </Button>
                <Button variant="outline" onClick={() => setShowUrlImport(!showUrlImport)} className="gap-2" title="Importar conteúdo de uma URL via Firecrawl">
                  <Globe className="w-4 h-4" />
                  Da URL
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => saveMutation.mutate('draft')} disabled={saveMutation.isPending || !title} className="gap-2">
              <Save className="w-4 h-4" />
              Salvar Rascunho
            </Button>
            <Button onClick={() => saveMutation.mutate('published')} disabled={saveMutation.isPending || !canPublish} className="gap-2">
              <Send className="w-4 h-4" />
              Publicar
            </Button>
          </div>
        </div>

        {/* URL import bar */}
        {isNew && showUrlImport && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Globe className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">Importar conteúdo de URL</p>
              <p className="text-xs text-muted-foreground">O Firecrawl irá extrair o texto da página e preencher o editor.</p>
            </div>
            <Input
              value={importUrl.trim()}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://..."
              className="w-80 font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && importFromUrl()}
            />
            <Button onClick={importFromUrl} disabled={crawlLoading || !importUrl.trim()} className="gap-2 shrink-0">
              <Download className="w-4 h-4" />
              {crawlLoading ? 'Buscando...' : 'Importar'}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setShowUrlImport(false); setImportUrl('') }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-[1fr_340px] gap-6 items-start">
          {/* Editor Column */}
          <div className="space-y-5">
            {/* Title + Module */}
            <div className="grid grid-cols-[1fr_200px] gap-4">
              <div className="space-y-1.5">
                <Label>Título do Manual</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Como emitir Nota Fiscal de Consumidor (NFC-e)"
                  className="text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Módulo do Sistema</Label>
                <Select value={module} onValueChange={setModule}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rich Text Editor */}
            <div>
              <Label className="mb-1.5 block">Conteúdo do Manual</Label>
              <RichTextEditor value={content} onChange={setContent} />
              <div className="mt-1 text-xs text-muted-foreground">{wordCount} palavras</div>
            </div>

            {/* Tags */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                🏷️ Tags
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 pl-2.5 pr-1.5">
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Adicionar nova tag..."
                  className="flex-1 h-8 text-sm"
                />
                <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Actions bottom */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => navigate('/admin/manuais')}>
                Cancelar e Voltar
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => saveMutation.mutate('draft')} disabled={saveMutation.isPending || !title}>
                  Salvar como Rascunho
                </Button>
                <Button onClick={() => saveMutation.mutate('published')} disabled={saveMutation.isPending || !canPublish}>
                  Publicar Manual
                </Button>
              </div>
            </div>
          </div>

          {/* Preview Column */}
          <div className="space-y-4 sticky top-6">
            {/* Live Preview */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Visualização Rápida</span>
                </div>
                <Badge variant="outline" className="text-xs font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                  LIVE
                </Badge>
              </div>
              <div className="p-4">
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Visão do Cliente
                </p>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3 max-h-[400px] overflow-y-auto">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-bold text-primary mb-1">Manual do Sistema</p>
                    <h4 className="font-bold text-sm text-foreground leading-snug">
                      {title || 'Título do manual...'}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">Equipe de Suporte · Atualizado há 2 minutos</p>
                  </div>

                  {content ? (
                    <div
                      className="prose prose-xs max-w-none text-xs text-foreground/80 leading-relaxed
                        [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1
                        [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2
                        [&_.tip]:bg-blue-50 [&_.tip]:dark:bg-blue-950/30 [&_.tip]:border [&_.tip]:border-blue-200 [&_.tip]:dark:border-blue-800 [&_.tip]:rounded [&_.tip]:p-2 [&_.tip]:my-1 [&_.tip]:text-xs
                        [&_.warning]:bg-amber-50 [&_.warning]:dark:bg-amber-950/30 [&_.warning]:border [&_.warning]:border-amber-200 [&_.warning]:dark:border-amber-800 [&_.warning]:rounded [&_.warning]:p-2 [&_.warning]:my-1 [&_.warning]:text-xs
                        [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_mark]:rounded
                        [&_img]:rounded [&_img]:max-w-full [&_img]:my-1
                        [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1
                        [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">O conteúdo aparecerá aqui...</p>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((t) => (
                        <span key={t} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Templates — only for new manuals */}
            {isNew && !content && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Começar com Template
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      onClick={() => {
                        setContent(tpl.content)
                        toast.success(`Template "${tpl.label}" aplicado!`)
                      }}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-center"
                    >
                      <span className="text-xl">{tpl.icon}</span>
                      <span className="text-xs font-medium text-foreground">{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Visibility & Difficulty Controls */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Configurações</h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Visível na Central de Ajuda</p>
                  <p className="text-xs text-muted-foreground">Clientes podem ver este manual</p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alimenta IA (RAG)</p>
                  <p className="text-xs text-muted-foreground">Agentes IA usam este conteúdo</p>
                </div>
                <Switch checked={feedsAi} onCheckedChange={setFeedsAi} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Dificuldade</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iniciante">🟢 Iniciante</SelectItem>
                    <SelectItem value="intermediario">🟡 Intermediário</SelectItem>
                    <SelectItem value="avancado">🔴 Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SEO Tip */}
            {title && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-600">Dica</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {wordCount < 100 ? 'Manuais com mais de 100 palavras tendem a ser mais úteis para os clientes.' :
                   wordCount > 2000 ? 'Considere dividir em manuais menores para facilitar a leitura.' :
                   'Tamanho ideal! Manuais entre 100-2000 palavras são os mais acessados.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Import from Knowledge Base Dialog */}
      <Dialog open={importBaseOpen} onOpenChange={setImportBaseOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="w-5 h-5 text-primary" />
              Importar da Base de Conhecimento
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={importSearch}
              onChange={(e) => setImportSearch(e.target.value)}
              placeholder="Buscar por título ou categoria..."
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {filteredKbDocs.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                {kbDocs.length === 0 ? 'Nenhum documento na base de conhecimento.' : 'Nenhum resultado encontrado.'}
              </p>
            ) : (
              filteredKbDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => importFromKbDoc(doc)}
                  className="w-full text-left rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors p-4"
                >
                  <p className="font-medium text-sm text-foreground truncate">{doc.title}</p>
                  {doc.category && (
                    <Badge variant="secondary" className="text-xs mt-1">{doc.category}</Badge>
                  )}
                  {doc.content && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.content}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Manual Chat Panel */}
      <AIManualChat
        open={aiChatOpen}
        onOpenChange={setAiChatOpen}
        module={module}
        suggestedTitle={title}
        onApplyContent={handleApplyAIContent}
      />
    </div>
  )
}
