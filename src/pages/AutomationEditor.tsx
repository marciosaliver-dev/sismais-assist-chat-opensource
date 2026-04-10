import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, Loader2, Zap, Play, HelpCircle } from 'lucide-react'
import { useAutomations } from '@/hooks/useAutomations'
import { TriggerSelector } from '@/components/automations/editor/TriggerSelector'
import { FilterBuilder } from '@/components/automations/editor/FilterBuilder'
import { ActionList } from '@/components/automations/editor/ActionList'
import { VariableReference } from '@/components/automations/editor/VariableReference'
import { toast } from 'sonner'

export default function AutomationEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { automations, createAutomation, updateAutomation } = useAutomations()
  const isEditing = !!id

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [triggerType, setTriggerType] = useState('')
  const [triggerOptions, setTriggerOptions] = useState<Record<string, any>>({})
  const [filters, setFilters] = useState<{ logic: 'AND' | 'OR'; conditions: any[] }>({ logic: 'AND', conditions: [] })
  const [actions, setActions] = useState<any[]>([])
  const [showVars, setShowVars] = useState(false)
  const [category, setCategory] = useState('ticket')

  // Load existing automation
  useEffect(() => {
    if (id && automations) {
      const automation = automations.find(a => a.id === id)
      if (automation) {
        setName(automation.name)
        setDescription(automation.description || '')
        setIsActive(automation.is_active ?? true)
        setTriggerType(automation.trigger_type)
        setCategory((automation as any).category || 'ticket')

        const tc = automation.trigger_conditions as any
        if (tc && typeof tc === 'object' && 'logic' in tc) {
          setFilters(tc)
        } else if (Array.isArray(tc)) {
          setFilters({ logic: 'AND', conditions: tc })
        }

        const acts = automation.actions as any[]
        setActions(acts || [])
      }
    }
  }, [id, automations])

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Digite um nome para a automação')
      return
    }
    if (!triggerType) {
      toast.error('Selecione um gatilho')
      return
    }

    const payload = {
      name,
      description,
      trigger_type: triggerType,
      trigger_conditions: filters as any,
      actions: actions as any,
      is_active: isActive,
    }

    if (isEditing && id) {
      updateAutomation.mutate({ id, updates: payload }, {
        onSuccess: () => {
          toast.success('Automação salva!')
          navigate('/automations')
        }
      })
    } else {
      createAutomation.mutate(payload, {
        onSuccess: () => {
          toast.success('Automação criada!')
          navigate('/automations')
        }
      })
    }
  }

  const isSaving = createAutomation.isPending || updateAutomation.isPending

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/automations')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="cursor-pointer hover:text-foreground" onClick={() => navigate('/automations')}>Automações</span>
            <span>/</span>
            <span className="text-foreground font-medium">{isEditing ? 'Editar' : 'Nova Automação'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="active-toggle" />
            <Label htmlFor="active-toggle" className="text-xs">{isActive ? 'Ativa' : 'Inativa'}</Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowVars(v => !v)}>
            <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Variáveis
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Name & Description */}
            <div className="space-y-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da automação..."
                className="text-lg font-semibold border-none px-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50"
              />
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição (opcional)..."
                className="text-sm border-none px-0 h-auto focus-visible:ring-0 text-muted-foreground placeholder:text-muted-foreground/40"
              />
            </div>

            <Separator />

            {/* Section 1: Trigger */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Gatilho</h2>
                  <p className="text-xs text-muted-foreground">Quando isso acontecer...</p>
                </div>
              </div>
              <TriggerSelector
                selectedTrigger={triggerType}
                onSelect={(type, cat) => { setTriggerType(type); setCategory(cat) }}
                options={triggerOptions}
                onOptionsChange={setTriggerOptions}
              />
            </div>

            <Separator />

            {/* Section 2: Filters */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">🔍</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Filtros</h2>
                  <p className="text-xs text-muted-foreground">Somente se...</p>
                </div>
              </div>
              <FilterBuilder filters={filters} onChange={setFilters} />
            </div>

            <Separator />

            {/* Section 3: Actions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">⚙️</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Ações</h2>
                  <p className="text-xs text-muted-foreground">Então fazer...</p>
                </div>
              </div>
              <ActionList actions={actions} onChange={setActions} />
            </div>
          </div>
        </ScrollArea>

        {/* Variable Reference Panel */}
        {showVars && <VariableReference onClose={() => setShowVars(false)} />}
      </div>
    </div>
  )
}
