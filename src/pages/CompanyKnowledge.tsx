import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCompanyKnowledge } from '@/hooks/useCompanyKnowledge'
import { SourceCard } from '@/components/company-knowledge/SourceCard'
import { AddSourceDialog } from '@/components/company-knowledge/AddSourceDialog'
import { Plus, Search, Building2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export default function CompanyKnowledge() {
  const { sources, createSource, deleteSource, reindexSource } = useCompanyKnowledge()
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filtered = (sources.data || []).filter(s => {
    if (typeFilter !== 'all' && s.source_type !== typeFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Conhecimento da Empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centralize informações que seus agentes IA usam para responder clientes
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Fonte
        </Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar fontes..."
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="docx">DOCX/TXT</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="social">Rede Social</SelectItem>
            <SelectItem value="confluence">Confluence</SelectItem>
            <SelectItem value="zoho">Zoho Desk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sources.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma fonte cadastrada</p>
          <p className="text-sm mt-1">Adicione PDFs, sites ou integrações para alimentar seus agentes</p>
          <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar primeira fonte
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(source => (
            <SourceCard
              key={source.id}
              source={source}
              onReindex={id => reindexSource.mutate(id)}
              onDelete={id => deleteSource.mutate(id)}
            />
          ))}
        </div>
      )}

      <AddSourceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={data => createSource.mutate(data as any)}
      />
    </div>
  )
}
