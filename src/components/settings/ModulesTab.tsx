import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Module = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  is_default?: boolean;
  sort_order: number;
};

function SortableItem({ mod, onEdit, onDelete, onToggle }: {
  mod: Module;
  onEdit: (m: Module) => void;
  onDelete: (m: Module) => void;
  onToggle: (m: Module) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: mod.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="sc-item">
      <button {...attributes} {...listeners} className="sc-drag" aria-label="Arrastar">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="sc-info">
        <span className="sc-name">{mod.name}</span>
        {mod.description && <span className="sc-desc">{mod.description}</span>}
      </div>
      {mod.is_default && <span className="sc-badge">Padrão</span>}
      <div className="sc-actions">
        <Switch checked={mod.active} onCheckedChange={() => onToggle(mod)} className="sc-switch" />
        <button className="sc-btn-icon" onClick={() => onEdit(mod)} aria-label="Editar">
          <Pencil className="w-4 h-4" />
        </button>
        <button className="sc-btn-icon sc-btn-del" onClick={() => onDelete(mod)} disabled={mod.is_default} aria-label="Excluir">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function ModulesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["ticket-modules-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_modules").select("*").order("sort_order");
      if (error) throw error;
      return data as Module[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (m: { id?: string; name: string; description: string }) => {
      if (m.id) {
        const { error } = await supabase.from("ticket_modules").update({ name: m.name, description: m.description }).eq("id", m.id);
        if (error) throw error;
      } else {
        const maxOrder = modules.length > 0 ? Math.max(...modules.map(x => x.sort_order)) + 1 : 0;
        const { error } = await supabase.from("ticket_modules").insert({ name: m.name, description: m.description, sort_order: maxOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-modules-settings"] });
      setDialogOpen(false);
      toast.success(editing ? "Módulo atualizado" : "Módulo criado");
    },
    onError: () => toast.error("Erro ao salvar módulo"),
  });

  const toggleActive = useMutation({
    mutationFn: async (m: Module) => {
      const { error } = await supabase.from("ticket_modules").update({ active: !m.active }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket-modules-settings"] }),
  });

  const deleteMod = useMutation({
    mutationFn: async (m: Module) => {
      const { count } = await supabase.from("ai_conversations").select("id", { count: "exact", head: true }).eq("ticket_module_id", m.id);
      if (count && count > 0) {
        throw new Error(`Existem ${count} tickets com este módulo. Desative-o em vez de excluir.`);
      }
      const { error } = await supabase.from("ticket_modules").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-modules-settings"] });
      toast.success("Módulo excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      for (const item of items) {
        await supabase.from("ticket_modules").update({ sort_order: item.sort_order }).eq("id", item.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket-modules-settings"] }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = modules.findIndex(m => m.id === active.id);
    const newIndex = modules.findIndex(m => m.id === over.id);
    const newOrder = arrayMove(modules, oldIndex, newIndex);
    queryClient.setQueryData(["ticket-modules-settings"], newOrder);
    reorder.mutate(newOrder.map((m, i) => ({ id: m.id, sort_order: i })));
  };

  const openCreate = () => { setEditing(null); setName(""); setDescription(""); setDialogOpen(true); };
  const openEdit = (m: Module) => { setEditing(m); setName(m.name); setDescription(m.description || ""); setDialogOpen(true); };

  if (isLoading) return <div className="p-4 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="sc-info">
          <h3 className="sc-title">Módulos / Procedimentos</h3>
          <p className="sc-desc">Gerencie os módulos do sistema</p>
        </div>
        <Button size="sm" onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          Novo Módulo
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
          <div className="sc-list">
            {modules.map(m => (
              <SortableItem key={m.id} mod={m} onEdit={openEdit} onDelete={(mod) => deleteMod.mutate(mod)} onToggle={(mod) => toggleActive.mutate(mod)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="field">
              <label className="field-label">Nome do módulo</label>
              <Input placeholder="Ex.: Faturamento" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Descrição (opcional)</label>
              <Textarea placeholder="Descrição curta..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsert.mutate({ id: editing?.id, name, description })} disabled={!name.trim()}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .sc-header {
          padding: 16px;
          background: #fff;
          border: 1px solid #E5E5E5;
          border-radius: 8px 8px 0 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .sc-header .sc-info { flex: 1; }
        .sc-header .sc-title {
          font-size: 16px;
          font-weight: 600;
          color: #10293F;
          margin: 0;
        }
        .sc-header .sc-desc {
          font-size: 13px;
          color: #666;
          margin: 4px 0 0;
        }
        .sc-list {
          padding: 12px;
          background: #F8FAFC;
          border: 1px solid #E5E5E5;
          border-top: none;
          border-radius: 0 0 8px 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 500px;
          overflow-y: auto;
        }
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sc-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: #F8FAFC;
          border: 1px solid #E5E5E5;
          border-radius: 8px;
          transition: all 150ms;
        }
        .sc-item:hover {
          background: #fff;
          box-shadow: 0 2px 8px rgba(16,41,63,0.08);
        }
        .sc-drag {
          background: none;
          border: none;
          color: #999;
          cursor: grab;
          padding: 4px;
          display: flex;
          border-radius: 4px;
        }
        .sc-drag:hover {
          background: #E5E5E5;
          color: #666;
        }
        .sc-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sc-name {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }
        .sc-desc {
          font-size: 12px;
          color: #888;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sc-badge {
          font-size: 10px;
          font-weight: 600;
          color: #666;
          background: #E5E5E5;
          padding: 2px 8px;
          border-radius: 9999px;
        }
        .sc-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sc-switch { width: 36px; height: 20px; }
        .sc-btn-icon {
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          color: #888;
          cursor: pointer;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 150ms;
        }
        .sc-btn-icon:hover {
          background: #E8F9F9;
          color: #10293F;
        }
        .sc-btn-del:hover {
          background: #FEF2F2;
          color: #DC2626;
        }
      `}</style>
    </div>
  );
}
