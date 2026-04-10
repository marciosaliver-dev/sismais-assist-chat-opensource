import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useAgentSkills, type Skill } from '@/hooks/useAgentSkills'
import { SkillCard } from './SkillCard'
import { SkillFormDialog } from './SkillFormDialog'

const categories = [
  { value: 'all', label: 'Todas as categorias' },
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'vendas', label: 'Vendas' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'interno', label: 'Interno' },
  { value: 'general', label: 'Geral' },
]

export function SkillsManager() {
  const { skills, skillsLoading, deleteSkill } = useAgentSkills()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)

  const filtered = skills.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'all' || s.category === category
    return matchesSearch && matchesCategory
  })

  const handleDelete = async (skill: Skill) => {
    if (skill.is_system) {
      toast.error('Skills do sistema não podem ser deletadas')
      return
    }
    try {
      await deleteSkill.mutateAsync(skill.id)
      toast.success(`Skill "${skill.name}" removida`)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao deletar')
    }
  }

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingSkill(null)
    setDialogOpen(true)
  }

  if (skillsLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando skills...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Skills de Agentes</h3>
          <p className="text-sm text-muted-foreground">{skills.length} skill{skills.length !== 1 ? 's' : ''} cadastrada{skills.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nova Skill
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar skills..."
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onEdit={() => handleEdit(skill)}
              onDelete={() => handleDelete(skill)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {search || category !== 'all' ? 'Nenhuma skill encontrada com esses filtros' : 'Nenhuma skill cadastrada'}
          </p>
        </div>
      )}

      <SkillFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        skill={editingSkill}
      />
    </div>
  )
}
