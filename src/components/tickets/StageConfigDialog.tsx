import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTicketStages, type TicketStage } from '@/hooks/useTicketStages'
import { Trash2, Plus, GripVertical } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StageConfigDialog({ open, onOpenChange }: Props) {
  const { stages, createStage, updateStage, deleteStage } = useTicketStages()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')

  const handleAdd = () => {
    if (!newName.trim()) return
    createStage.mutate({
      name: newName.trim(),
      color: newColor,
      position: stages.length,
      is_default: false,
      is_final: false
    })
    setNewName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Etapas</DialogTitle>
          <DialogDescription>Gerencie as etapas do Kanban de tickets</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {stages.map(stage => (
            <div key={stage.id} className="flex items-center gap-2 p-2 border rounded-lg">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
              <Input
                defaultValue={stage.name}
                className="h-8 text-sm"
                onBlur={(e) => {
                  if (e.target.value !== stage.name) {
                    updateStage.mutate({ id: stage.id, name: e.target.value })
                  }
                }}
              />
              <Input
                type="color"
                defaultValue={stage.color}
                className="w-10 h-8 p-0.5 cursor-pointer"
                onChange={(e) => updateStage.mutate({ id: stage.id, color: e.target.value })}
              />
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Final</Label>
                <Switch
                  checked={stage.is_final}
                  onCheckedChange={(v) => updateStage.mutate({ id: stage.id, is_final: v })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => deleteStage.mutate(stage.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-4 border-t">
          <Input
            placeholder="Nome da nova etapa"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-9"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-10 h-9 p-0.5 cursor-pointer"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
