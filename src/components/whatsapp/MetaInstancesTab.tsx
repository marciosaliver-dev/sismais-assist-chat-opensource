import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useChannelInstances } from '@/hooks/useChannelInstances'
import { MetaInstanceCard } from './MetaInstanceCard'
import { MetaInstanceForm } from './MetaInstanceForm'
import { TooltipProvider } from '@/components/ui/tooltip'

export function MetaInstancesTab() {
  const {
    instances,
    isLoading,
    upsertInstance,
    testConnection,
    toggleActive,
  } = useChannelInstances('meta_whatsapp')

  const [formOpen, setFormOpen] = useState(false)
  const [editingInstance, setEditingInstance] = useState<any>(null)

  const handleEdit = (instance: any) => {
    setEditingInstance(instance)
    setFormOpen(true)
  }

  const handleNew = () => {
    setEditingInstance(null)
    setFormOpen(true)
  }

  const handleSave = (data: any) => {
    upsertInstance.mutate(data, {
      onSuccess: () => {
        setFormOpen(false)
        setEditingInstance(null)
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Carregando instâncias...
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Instâncias Meta Cloud API</h3>
            <p className="text-xs text-muted-foreground">
              Gerencie números WhatsApp conectados via API oficial da Meta
            </p>
          </div>
          <Button onClick={handleNew} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Nova Instância
          </Button>
        </div>

        {instances.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <p className="text-sm">Nenhuma instância Meta WhatsApp configurada</p>
            <Button variant="link" onClick={handleNew} className="mt-2">
              Adicionar primeira instância
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {instances.map((inst: any) => (
              <MetaInstanceCard
                key={inst.id}
                instance={inst}
                onEdit={handleEdit}
                onTestConnection={(id) => testConnection.mutate(id)}
                onToggleActive={(id, active) => toggleActive.mutate({ instanceId: id, isActive: active })}
                isTestingConnection={testConnection.isPending && testConnection.variables === inst.id}
              />
            ))}
          </div>
        )}

        <MetaInstanceForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editingInstance={editingInstance}
          onSave={handleSave}
          isSaving={upsertInstance.isPending}
        />
      </div>
    </TooltipProvider>
  )
}
