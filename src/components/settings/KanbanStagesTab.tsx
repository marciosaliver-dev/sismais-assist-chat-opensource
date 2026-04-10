import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, GripVertical, Flag } from "lucide-react";
import { BusinessHoursTab } from "./BusinessHoursTab";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLOR_PALETTE = [
  "#3b82f6", "#ef4444", "#22c55e", "#eab308", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#6b7280", "#14b8a6",
];

type Stage = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  is_entry: boolean;
  is_exit: boolean;
  board_id: string | null;
};

type Board = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
};

function SortableItem({ stage, onEdit, onDelete, onToggleExit }: {
  stage: Stage;
  onEdit: (s: Stage) => void;
  onDelete: (s: Stage) => void;
  onToggleExit: (s: Stage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
      <span className="flex-1 text-sm font-medium">{stage.name}</span>
      {stage.is_entry && (
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Entrada</span>
      )}
      <div className="flex items-center gap-1.5">
        <Flag className={`h-3.5 w-3.5 ${stage.is_exit ? "text-destructive" : "text-muted-foreground/40"}`} />
        <Switch
          checked={stage.is_exit}
          onCheckedChange={() => onToggleExit(stage)}
        />
        <span className="text-xs text-muted-foreground w-10">Saída</span>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(stage)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(stage)} disabled={stage.is_entry}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function KanbanStagesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Stage | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [icon, setIcon] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("kanban_boards").select("*").eq("active", true).order("sort_order");
      if (error) throw error;
      return data as Board[];
    },
  });

  const activeBoardId = selectedBoardId || boards.find(b => b.is_default)?.id || boards[0]?.id || "";

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["kanban-stages-settings", activeBoardId],
    enabled: !!activeBoardId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kanban_stages")
        .select("*")
        .eq("board_id", activeBoardId)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Stage[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (s: { id?: string; name: string; color: string; icon: string }) => {
      if (s.id) {
        const { error } = await (supabase as any).from("kanban_stages").update({ name: s.name, color: s.color, icon: s.icon || null }).eq("id", s.id);
        if (error) throw error;
      } else {
        const maxPos = stages.length > 0 ? Math.max(...stages.map(x => x.sort_order)) + 1 : 0;
        const { error } = await (supabase as any).from("kanban_stages").insert({ name: s.name, color: s.color, icon: s.icon || null, sort_order: maxPos, board_id: activeBoardId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-stages-settings"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-stages"] });
      setDialogOpen(false);
      toast.success(editing ? "Etapa atualizada" : "Etapa criada");
    },
    onError: () => toast.error("Erro ao salvar etapa"),
  });

  const toggleExit = useMutation({
    mutationFn: async (s: Stage) => {
      const { error } = await (supabase as any).from("kanban_stages").update({ is_exit: !s.is_exit }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-stages-settings"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-stages"] });
    },
  });

  const deleteStage = useMutation({
    mutationFn: async (s: Stage) => {
      const { count } = await supabase.from("ai_conversations").select("id", { count: "exact", head: true }).eq("stage_id", s.id);
      if (count && count > 0) {
        throw new Error(`Existem ${count} tickets nesta etapa. Não é possível excluir.`);
      }
      const { error } = await (supabase as any).from("kanban_stages").delete().eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-stages-settings"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-stages"] });
      toast.success("Etapa excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      for (const item of items) {
        await (supabase as any).from("kanban_stages").update({ sort_order: item.sort_order }).eq("id", item.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-stages-settings"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-stages"] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex(s => s.id === active.id);
    const newIndex = stages.findIndex(s => s.id === over.id);
    const newOrder = arrayMove(stages, oldIndex, newIndex);
    queryClient.setQueryData(["kanban-stages-settings", activeBoardId], newOrder);
    reorder.mutate(newOrder.map((s, i) => ({ id: s.id, sort_order: i })));
  };

  const openCreate = () => { setEditing(null); setName(""); setColor(COLOR_PALETTE[0]); setIcon(""); setDialogOpen(true); };
  const openEdit = (s: Stage) => { setEditing(s); setName(s.name); setColor(s.color); setIcon(s.icon || ""); setDialogOpen(true); };

  if (isLoading) return <div className="p-4 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <Card className="p-4 space-y-4">
      {boards.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Board:</span>
          <Select value={activeBoardId} onValueChange={setSelectedBoardId}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {boards.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <p className="text-sm font-medium mb-2">Preview das Etapas</p>
        <div className="flex gap-2 flex-wrap">
          {stages.map(s => (
            <Badge
              key={s.id}
              variant="outline"
              className="text-xs"
              style={{ borderColor: s.color, color: s.color }}
            >
              {s.name}
              {s.is_exit && <Flag className="h-3 w-3 ml-1" />}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Gerencie as etapas do Kanban. Arraste para reordenar.</p>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nova Etapa</Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {stages.map(s => (
              <SortableItem
                key={s.id}
                stage={s}
                onEdit={openEdit}
                onDelete={(st) => deleteStage.mutate(st)}
                onToggleExit={(st) => toggleExit.mutate(st)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {stages.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma etapa configurada para este board. Crie a primeira etapa acima.
        </div>
      )}

      {/* Business Hours Configuration */}
      {selectedBoardId && (
        <div className="mt-6 pt-6 border-t border-border">
          <BusinessHoursTab boardId={selectedBoardId} />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome da etapa" value={name} onChange={e => setName(e.target.value)} />
            <Input placeholder="Ícone (opcional, ex: Clock)" value={icon} onChange={e => setIcon(e.target.value)} />
            <div>
              <label className="text-sm font-medium mb-2 block">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c}
                    className="h-8 w-8 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: color === c ? "hsl(var(--foreground))" : "transparent" }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsert.mutate({ id: editing?.id, name, color, icon })} disabled={!name.trim()}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
