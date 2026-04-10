import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLOR_PALETTE = [
  "#45E5E5", "#3b82f6", "#ef4444", "#22c55e", "#FFB800",
  "#a855f7", "#f97316", "#06b6d4", "#ec4899", "#14b8a6",
];

type Category = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  is_default: boolean;
  sort_order: number;
};

function SortableItem({ category, onEdit, onDelete, onToggle }: {
  category: Category;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
  onToggle: (c: Category) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="sc-item">
      <button {...attributes} {...listeners} className="sc-drag" aria-label="Arrastar">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="sc-color" style={{ backgroundColor: category.color }} />
      <span className="sc-name">{category.name}</span>
      {category.is_default && <span className="sc-badge">Padrão</span>}
      <div className="sc-actions">
        <Switch
          checked={category.active}
          onCheckedChange={() => onToggle(category)}
          className="sc-switch"
        />
        <button className="sc-btn-icon" onClick={() => onEdit(category)} aria-label="Editar">
          <Pencil className="w-4 h-4" />
        </button>
        <button 
          className="sc-btn-icon sc-btn-del" 
          onClick={() => onDelete(category)} 
          disabled={category.is_default}
          aria-label="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function CategoriesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["ticket-categories-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (cat: { id?: string; name: string; color: string }) => {
      if (cat.id) {
        const { error } = await supabase.from("ticket_categories").update({ name: cat.name, color: cat.color }).eq("id", cat.id);
        if (error) throw error;
      } else {
        const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
        const { error } = await supabase.from("ticket_categories").insert({ name: cat.name, color: cat.color, sort_order: maxOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-categories-settings"] });
      setDialogOpen(false);
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
    },
    onError: () => toast.error("Erro ao salvar categoria"),
  });

  const toggleActive = useMutation({
    mutationFn: async (cat: Category) => {
      const { error } = await supabase.from("ticket_categories").update({ active: !cat.active }).eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket-categories-settings"] }),
  });

  const deleteCat = useMutation({
    mutationFn: async (cat: Category) => {
      const { count } = await supabase
        .from("ai_conversations")
        .select("id", { count: "exact", head: true })
        .eq("ticket_category_id", cat.id);
      if (count && count > 0) {
        throw new Error(`Existem ${count} tickets com esta categoria. Desative-a em vez de excluir.`);
      }
      const { error } = await supabase.from("ticket_categories").delete().eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-categories-settings"] });
      toast.success("Categoria excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      for (const item of items) {
        await supabase.from("ticket_categories").update({ sort_order: item.sort_order }).eq("id", item.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket-categories-settings"] }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    const newOrder = arrayMove(categories, oldIndex, newIndex);
    queryClient.setQueryData(["ticket-categories-settings"], newOrder);
    reorder.mutate(newOrder.map((c, i) => ({ id: c.id, sort_order: i })));
  };

  const openCreate = () => { setEditing(null); setName(""); setColor(COLOR_PALETTE[0]); setDialogOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setName(c.name); setColor(c.color); setDialogOpen(true); };

  if (isLoading) return <div className="p-4 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="sc-info">
          <h3 className="sc-title">Categorias</h3>
          <p className="sc-desc">Gerencie as categorias de tickets do sistema</p>
        </div>
        <Button size="sm" onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nova Categoria
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="sc-list">
            {categories.map(c => (
              <SortableItem
                key={c.id}
                category={c}
                onEdit={openEdit}
                onDelete={(cat) => deleteCat.mutate(cat)}
                onToggle={(cat) => toggleActive.mutate(cat)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="field">
              <label className="field-label">Nome da categoria</label>
              <Input 
                placeholder="Ex.: Suporte Técnico" 
                value={name} 
                onChange={e => setName(e.target.value)} 
              />
            </div>
            <div className="field">
              <label className="field-label">Cor</label>
              <div className="color-grid">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c}
                    className={`color-btn ${color === c ? "active" : ""}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsert.mutate({ id: editing?.id, name, color })} disabled={!name.trim()}>
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
        .sc-info { flex: 1; }
        .sc-title {
          font-size: 16px;
          font-weight: 600;
          color: #10293F;
          margin: 0;
        }
        .sc-desc {
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
        .sc-color {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sc-name {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: #333;
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
        .sc-switch {
          width: 36px;
          height: 20px;
        }
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
        .color-grid {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .color-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 150ms;
        }
        .color-btn:hover {
          transform: scale(1.1);
        }
        .color-btn.active {
          border-color: #10293F;
          box-shadow: 0 0 0 2px #fff, 0 0 0 4px #10293F;
        }
      `}</style>
    </div>
  );
}
