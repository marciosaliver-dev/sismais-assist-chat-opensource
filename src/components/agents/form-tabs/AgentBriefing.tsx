import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Plus, X, Globe, Video, BookOpen } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AIFieldGenerator } from '@/components/ai/AIFieldGenerator'

interface SearchUrl {
  url: string
  title: string
  category: string
}

interface Props {
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

const categoryOptions = [
  { value: 'documentacao', label: 'Documentação', icon: BookOpen },
  { value: 'videos', label: 'Vídeos', icon: Video },
  { value: 'site', label: 'Site', icon: Globe },
]

const categoryIcons: Record<string, typeof Globe> = {
  documentacao: BookOpen,
  videos: Video,
  site: Globe,
}

export function AgentBriefing({ data, onChange }: Props) {
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('documentacao')

  const searchUrls: SearchUrl[] = data.searchUrls || []

  const addUrl = () => {
    if (!newUrl.trim()) return
    const updated = [...searchUrls, {
      url: newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`,
      title: newTitle.trim() || new URL(newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`).hostname,
      category: newCategory,
    }]
    onChange({ searchUrls: updated })
    setNewUrl('')
    setNewTitle('')
  }

  const removeUrl = (index: number) => {
    onChange({ searchUrls: searchUrls.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-foreground">Nome da Empresa *</Label>
        <Input
          value={data.companyName || ''}
          onChange={(e) => onChange({ companyName: e.target.value })}
          placeholder="Ex: TechSolutions Ltda"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Descrição da Empresa</Label>
          <AIFieldGenerator
            fieldType="company_description"
            value={data.companyDescription || ''}
            onChange={(v) => onChange({ companyDescription: v })}
            context={{ company_name: data.companyName }}
          />
        </div>
        <Textarea
          className="min-h-[100px]"
          value={data.companyDescription || ''}
          onChange={(e) => onChange({ companyDescription: e.target.value })}
          placeholder="Descreva o que a empresa faz..."
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Produtos e Serviços *</Label>
          <AIFieldGenerator
            fieldType="products_services"
            value={data.productsServices || ''}
            onChange={(v) => onChange({ productsServices: v })}
            context={{ company_name: data.companyName, company_description: data.companyDescription }}
          />
        </div>
        <Textarea
          className="min-h-[120px]"
          value={data.productsServices || ''}
          onChange={(e) => onChange({ productsServices: e.target.value })}
          placeholder="Liste os produtos e serviços oferecidos..."
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Público-Alvo</Label>
        <Input
          value={data.targetCustomers || ''}
          onChange={(e) => onChange({ targetCustomers: e.target.value })}
          placeholder="Ex: PMEs e startups de tecnologia"
        />
      </div>

      {/* URLs para Pesquisa */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div>
          <Label className="text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#45E5E5]" />
            Fontes Externas para Pesquisa
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            URLs que o agente pode consultar quando a base de conhecimento não tiver a resposta
          </p>
        </div>

        {/* Lista de URLs cadastradas */}
        {searchUrls.length > 0 && (
          <div className="space-y-2">
            {searchUrls.map((item, index) => {
              const IconComp = categoryIcons[item.category] || Globe
              return (
                <div key={index} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                  <IconComp className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0">
                    {item.category}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeUrl(index)}
                    aria-label="Remover URL"
                  >
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* Adicionar nova URL */}
        <div className="space-y-2 p-3 rounded-lg border border-dashed border-border">
          <div className="flex gap-2">
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://suporte.sismais.com/portal/..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
            />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-1.5">
                      <opt.icon className="w-3.5 h-3.5" />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nome da fonte (ex: Central de Ajuda)"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addUrl}
              disabled={!newUrl.trim()}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
