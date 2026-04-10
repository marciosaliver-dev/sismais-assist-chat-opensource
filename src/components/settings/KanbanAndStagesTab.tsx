import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { icons } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Plus, Pencil, Trash2, GripVertical, Flag, Settings2, Zap,
  Headphones, Rocket, CreditCard, Layout, ChevronDown, ChevronUp,
  LogIn, LogOut, X, HelpCircle, Bell, BarChart3, Bot,
} from "lucide-react";
import { CSATBoardConfigForm } from "@/components/csat/CSATBoardConfigForm";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StageAutomationsDialog } from "@/components/tickets/StageAutomationsDialog";

// ── Constants ──
const COLOR_PALETTE = [
  "#3b82f6", "#ef4444", "#22c55e", "#eab308", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#6b7280", "#14b8a6",
];

const BOARD_TYPE_MAP: Record<string, { label: string; color: string }> = {
  support: { label: "Suporte", color: "#06b6d4" },
  onboarding: { label: "Onboarding", color: "#a855f7" },
  billing: { label: "Cobranças", color: "#22c55e" },
  custom: { label: "Personalizado", color: "#6b7280" },
};

const STATUS_TYPE_MAP: Record<string, string> = {
  queue: "Em Fila",
  in_progress: "Em Atendimento",
  waiting: "Aguardando",
  finished: "Finalizado",
  custom: "Personalizado",
};

const BOARD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Headphones, Rocket, CreditCard, Layout,
};

// ── Types ──
type Board = {
  id: string; name: string; description: string | null; icon: string | null;
  color: string | null; board_type: string | null; is_default: boolean;
  active: boolean; sort_order: number;
  queue_alert_threshold_minutes: number | null;
};

type Stage = {
  id: string; name: string; slug: string | null; color: string; icon: string | null;
  sort_order: number; is_entry: boolean; is_exit: boolean; is_ai_validation: boolean; active: boolean;
  wip_limit: number | null; board_id: string | null; status_type: string | null;
  queue_alert_threshold_minutes: number | null;
};

type Status = {
  id: string; name: string; slug: string; color: string; icon: string | null;
  active: boolean; is_default: boolean; is_final: boolean; is_system: boolean;
  status_type: string | null; sort_order: number;
};

// ── Helper: render lucide icon by name ──
function LucideIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (icons as any)[name] || (BOARD_ICONS as any)[name] || Layout;
  return <Icon className={className} />;
}

// ── Section 1: Boards List ──
function BoardsSection({
  boards, stageCounts, onEdit, onConfigureStages, onToggleActive, configuringBoardId, onOpenCSAT,
}: {
  boards: Board[];
  stageCounts: Record<string, number>;
  onEdit: (b: Board | null) => void;
  onConfigureStages: (boardId: string | null) => void;
  onToggleActive: (b: Board) => void;
  configuringBoardId: string | null;
  onOpenCSAT: (id: string, name: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Kanbans</h3>
        <Button size="sm" onClick={() => onEdit(null)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Kanban
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {boards.map(b => {
          const typeInfo = BOARD_TYPE_MAP[b.board_type || "custom"] || BOARD_TYPE_MAP.custom;
          const isConfiguring = configuringBoardId === b.id;
          return (
            <Card key={b.id} className={`p-4 space-y-3 transition-all ${!b.active ? "opacity-50" : ""} ${isConfiguring ? "ring-2 ring-primary" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: b.color || "#06b6d4" }}>
                  <LucideIcon name={b.icon || "Layout"} className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{b.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0" style={{ borderColor: typeInfo.color, color: typeInfo.color }}>
                      {typeInfo.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stageCounts[b.id] || 0} etapas
                  </p>
                </div>
                <Switch checked={b.active} onCheckedChange={() => onToggleActive(b)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => onConfigureStages(isConfiguring ? null : b.id)}>
                  <Settings2 className="h-3.5 w-3.5 mr-1" />
                  {isConfiguring ? "Fechar" : "Configurar Etapas"}
                  {isConfiguring ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => onOpenCSAT(b.id, b.name)}>
                  <BarChart3 className="h-3 w-3" /> CSAT
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(b)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Helper: time unit for alert threshold ──
type TimeUnit = 'minutes' | 'hours' | 'days'

function decomposeMinutes(totalMinutes: number | null): { value: string; unit: TimeUnit } {
  if (totalMinutes == null) return { value: '', unit: 'minutes' }
  if (totalMinutes > 0 && totalMinutes % 1440 === 0) return { value: String(totalMinutes / 1440), unit: 'days' }
  if (totalMinutes > 0 && totalMinutes % 60 === 0) return { value: String(totalMinutes / 60), unit: 'hours' }
  return { value: String(totalMinutes), unit: 'minutes' }
}

function composeToMinutes(value: string, unit: TimeUnit): number | null {
  const num = parseFloat(value)
  if (!value || isNaN(num) || num <= 0) return null
  if (unit === 'hours') return Math.round(num * 60)
  if (unit === 'days') return Math.round(num * 1440)
  return Math.round(num)
}

const TIME_UNIT_LABELS: Record<TimeUnit, string> = { minutes: 'min', hours: 'horas', days: 'dias' }

// ── Alert threshold inline editor ──
function AlertThresholdField({ value, onChange, placeholder }: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
}) {
  const decomposed = decomposeMinutes(value)
  const [localValue, setLocalValue] = useState(decomposed.value)
  const [unit, setUnit] = useState<TimeUnit>(decomposed.unit)

  const handleBlur = () => {
    const newMinutes = composeToMinutes(localValue, unit)
    onChange(newMinutes)
  }

  const handleUnitChange = (newUnit: string) => {
    const u = newUnit as TimeUnit
    // Preserve the current minutes value and re-decompose with new unit
    const currentMinutes = composeToMinutes(localValue, unit)
    if (currentMinutes != null) {
      const factor = u === 'days' ? 1440 : u === 'hours' ? 60 : 1
      setLocalValue(String(+(currentMinutes / factor).toFixed(2)))
    }
    setUnit(u)
    // Trigger save with current value in new unit
    onChange(currentMinutes)
  }

  return (
    <div className="space-y-1">
      <FieldLabel label="Alerta de Tempo na Fila" tooltip="Tempo para alertar visualmente no card quando um ticket está aguardando. Cards que ultrapassarem esse tempo ficam com fundo vermelho e pulsação suave." />
      <div className="flex gap-1.5">
        <Input
          type="number"
          min={0}
          step="any"
          placeholder={placeholder}
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className="h-8 text-xs px-2 flex-1"
        />
        <Select value={unit} onValueChange={handleUnitChange}>
          <SelectTrigger className="h-8 text-xs w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">min</SelectItem>
            <SelectItem value="hours">horas</SelectItem>
            <SelectItem value="days">dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <span className="text-xs text-muted-foreground/70 leading-tight block">{placeholder}</span>
    </div>
  )
}

// ── Helper: label with tooltip ──
function FieldLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// ── Section 2: Sortable Stage Card (horizontal) ──
function SortableStageCard({ stage, onUpdate, onDelete, onSetEntry, onSetExit, onAutomations }: {
  stage: Stage;
  onUpdate: (id: string, data: Partial<Stage>) => void;
  onDelete: (s: Stage) => void;
  onSetEntry: (s: Stage) => void;
  onSetExit: (s: Stage) => void;
  onAutomations: (s: Stage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [editing, setEditing] = useState(false);
  const [localName, setLocalName] = useState(stage.name);

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-3 p-4 border rounded-lg bg-card min-w-[260px] max-w-[300px] shrink-0">
      {/* Header: grip + color dot + name + delete */}
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="h-3.5 w-3.5 rounded-full shrink-0 ring-2 ring-background" style={{ backgroundColor: stage.color }} />
        {editing ? (
          <Input
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={() => { onUpdate(stage.id, { name: localName }); setEditing(false); }}
            onKeyDown={e => { if (e.key === "Enter") { onUpdate(stage.id, { name: localName }); setEditing(false); } }}
            className="h-7 text-xs px-1 flex-1"
            autoFocus
          />
        ) : (
          <span className="text-sm font-medium truncate flex-1 cursor-pointer hover:text-primary transition-colors" onClick={() => setEditing(true)}>
            {stage.name}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive shrink-0" onClick={() => onDelete(stage)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Color palette */}
      <div className="space-y-1">
        <FieldLabel label="Cor" tooltip="Cor usada na coluna do Kanban e nos badges de etapa." />
        <div className="flex gap-1.5 flex-wrap">
          {COLOR_PALETTE.map(c => (
            <button
              key={c}
              className="h-5 w-5 rounded-full border-2 transition-all hover:scale-110"
              style={{ backgroundColor: c, borderColor: stage.color === c ? "hsl(var(--foreground))" : "transparent" }}
              onClick={() => onUpdate(stage.id, { color: c })}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Section: Fluxo */}
      <div className="space-y-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Fluxo</span>

        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs">
            <LogIn className="h-3.5 w-3.5 text-primary" />
            <FieldLabel label="Entrada" tooltip="Etapa onde novos tickets entram automaticamente ao iniciar um atendimento. Apenas uma etapa pode ser de entrada." />
            <input type="radio" name={`entry-${stage.board_id}`} checked={stage.is_entry} onChange={() => onSetEntry(stage)} className="ml-auto accent-[hsl(var(--primary))]" />
          </label>
          <span className="text-xs text-muted-foreground/70 pl-6 block leading-tight">Primeira etapa do fluxo de atendimento</span>
        </div>

        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs">
            <LogOut className="h-3.5 w-3.5 text-destructive" />
            <FieldLabel label="Saída" tooltip="Marcar como saída significa que tickets movidos para cá serão considerados encerrados. Pode haver mais de uma etapa de saída." />
            <Switch checked={stage.is_exit} onCheckedChange={() => onSetExit(stage)} className="ml-auto scale-75" />
          </label>
          <span className="text-xs text-muted-foreground/70 pl-6 block leading-tight">Tickets encerrados ao chegar aqui</span>
        </div>
      </div>

      <Separator />

      {/* Section: Comportamento */}
      <div className="space-y-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Comportamento</span>

        {/* Status type */}
        <div className="space-y-1">
          <FieldLabel label="Tipo de Status" tooltip="Define qual status operacional o ticket assume ao entrar nesta etapa. Aguardando = nenhum humano atendendo. Em Atendimento = humano ativo. Finalizado = ticket encerrado." />
          <Select value={stage.status_type || 'aguardando'} onValueChange={v => onUpdate(stage.id, { status_type: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aguardando">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(215,16%,47%)]" />Aguardando</span>
              </SelectItem>
              <SelectItem value="em_atendimento">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(217,91%,60%)]" />Em Atendimento</span>
              </SelectItem>
              <SelectItem value="finalizado">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(142,71%,45%)]" />Finalizado</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground/70 leading-tight block">Status ao entrar nesta etapa</span>
        </div>

        {/* WIP limit */}
        <div className="space-y-1">
          <FieldLabel label="WIP (Work In Progress)" tooltip="Limite máximo de tickets simultâneos nesta etapa. Deixe vazio para ilimitado." />
          <Input
            type="number"
            min={0}
            placeholder="Ilimitado"
            value={stage.wip_limit ?? ""}
            onChange={e => onUpdate(stage.id, { wip_limit: e.target.value ? parseInt(e.target.value) : null })}
            className="h-8 text-xs px-2"
          />
          <span className="text-xs text-muted-foreground/70 leading-tight block">Máx. tickets simultâneos (vazio = ilimitado)</span>
        </div>

        {/* Queue alert threshold */}
        <AlertThresholdField
          value={stage.queue_alert_threshold_minutes}
          onChange={v => onUpdate(stage.id, { queue_alert_threshold_minutes: v })}
          placeholder="Usar padrão do board"
        />

        {/* Active toggle */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel label="Ativo" tooltip="Desativar oculta a etapa do Kanban sem excluir. Tickets existentes nela permanecem acessíveis." />
            <Switch checked={stage.active} onCheckedChange={() => onUpdate(stage.id, { active: !stage.active })} className="scale-75" />
          </div>
          <span className="text-xs text-muted-foreground/70 leading-tight block">Ocultar sem excluir</span>
        </div>
      </div>

      <Separator />

      {/* Automations button */}
      <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => onAutomations(stage)}>
        <Zap className="h-3.5 w-3.5 mr-1" /> Automações
      </Button>
    </div>
  );
}

function StagesConfigurator({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [automationsStage, setAutomationsStage] = useState<{ id: string; name: string } | null>(null);

  // Fetch board data for alert threshold
  const { data: board } = useQuery({
    queryKey: ["kanban-board-detail", boardId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("kanban_boards").select("*").eq("id", boardId).single();
      if (error) throw error;
      return data as Board;
    },
  });

  const updateBoardThreshold = useMutation({
    mutationFn: async (minutes: number | null) => {
      const { error } = await (supabase as any).from("kanban_boards").update({ queue_alert_threshold_minutes: minutes }).eq("id", boardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board-detail", boardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-boards-settings"] });
      toast.success("Alerta padrão do board atualizado");
    },
  });

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["kanban-stages-config", boardId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("kanban_stages").select("*").eq("board_id", boardId).order("sort_order");
      if (error) throw error;
      return data as Stage[];
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Stage> }) => {
      const { error } = await (supabase as any).from("kanban_stages").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-stages-config", boardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-stage-counts"] });
    },
  });

  const setEntry = useMutation({
    mutationFn: async (stage: Stage) => {
      // Clear all entry flags for this board, then set the new one
      await (supabase as any).from("kanban_stages").update({ is_entry: false }).eq("board_id", boardId);
      await (supabase as any).from("kanban_stages").update({ is_entry: true }).eq("id", stage.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kanban-stages-config", boardId] }),
  });

  const deleteStage = useMutation({
    mutationFn: async (stage: Stage) => {
      const { count } = await (supabase as any).from("ai_conversations").select("id", { count: "exact", head: true }).eq("kanban_stage_id", stage.id);
      if (count && count > 0) throw new Error(`${count} tickets nesta etapa. Mova-os antes de excluir.`);
      const { error } = await (supabase as any).from("kanban_stages").delete().eq("id", stage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-stages-config", boardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-stage-counts"] });
      toast.success("Etapa excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStage = useMutation({
    mutationFn: async () => {
      const maxSort = stages.length > 0 ? Math.max(...stages.map(s => s.sort_order)) + 1 : 0;
      const { error } = await (supabase as any).from("kanban_stages").insert({
        name: "Nova Etapa", color: COLOR_PALETTE[0], sort_order: maxSort, board_id: boardId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-stages-config", boardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-stage-counts"] });
      toast.success("Etapa criada");
    },
  });

  const reorder = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      for (const item of items) {
        await (supabase as any).from("kanban_stages").update({ sort_order: item.sort_order }).eq("id", item.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kanban-stages-config", boardId] }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = stages.findIndex(s => s.id === active.id);
    const newIdx = stages.findIndex(s => s.id === over.id);
    const newOrder = arrayMove(stages, oldIdx, newIdx);
    queryClient.setQueryData(["kanban-stages-config", boardId], newOrder);
    reorder.mutate(newOrder.map((s, i) => ({ id: s.id, sort_order: i })));
  };

  // AI validation toggle: check if this board has a fechado_por_ia stage
  const aiValidationStage = stages.find(s => s.is_ai_validation);
  const aiValidationEnabled = !!aiValidationStage?.active;

  const toggleAiValidation = useMutation({
    mutationFn: async () => {
      if (aiValidationStage) {
        // Toggle active on existing stage
        await (supabase as any).from("kanban_stages").update({ active: !aiValidationStage.active }).eq("id", aiValidationStage.id);
      } else {
        // Create the stage (before the exit stage)
        const exitStage = stages.find(s => s.is_exit);
        const sortOrder = exitStage ? exitStage.sort_order : stages.length;
        if (exitStage) {
          await (supabase as any).from("kanban_stages").update({ sort_order: exitStage.sort_order + 1 }).eq("id", exitStage.id);
        }
        await (supabase as any).from("kanban_stages").insert({
          name: "Fechado por IA", slug: "fechado_por_ia", color: "#7C3AED", icon: "bot",
          sort_order: sortOrder, board_id: boardId, is_entry: false, is_exit: false,
          is_ai_validation: true, status_type: "em_atendimento", active: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-stages-config", boardId] });
      queryClient.invalidateQueries({ queryKey: ["ticket-stages", boardId] });
      toast.success(aiValidationEnabled ? "Validação IA desativada" : "Validação IA ativada");
    },
  });

  if (isLoading) return <div className="p-4 text-xs text-muted-foreground">Carregando etapas...</div>;

  return (
    <Card className="p-4 space-y-3 border-primary/20">
      {/* AI validation toggle */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-[#7C3AED]/5 border border-[#7C3AED]/20">
        <Bot className="h-4 w-4 text-[#7C3AED] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">Validação humana para fechamentos por IA</p>
          <p className="text-[11px] text-muted-foreground">Tickets fechados pela IA vão para uma etapa de validação antes de serem concluídos</p>
        </div>
        <Switch checked={aiValidationEnabled} onCheckedChange={() => toggleAiValidation.mutate()} />
      </div>

      {/* Board-level alert threshold */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
        <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <AlertThresholdField
            value={board?.queue_alert_threshold_minutes ?? null}
            onChange={v => updateBoardThreshold.mutate(v)}
            placeholder="Padrão: 10 min (sistema)"
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Arraste para reordenar. Clique no nome para editar.</p>
        <Button size="sm" variant="outline" onClick={() => addStage.mutate()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova Etapa
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stages.map(s => (
              <SortableStageCard
                key={s.id}
                stage={s}
                onUpdate={(id, data) => updateStage.mutate({ id, data })}
                onDelete={st => deleteStage.mutate(st)}
                onSetEntry={st => setEntry.mutate(st)}
                onSetExit={st => updateStage.mutate({ id: st.id, data: { is_exit: !st.is_exit } })}
                onAutomations={st => setAutomationsStage({ id: st.id, name: st.name })}
              />
            ))}
            {stages.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-xs w-full">
                Nenhuma etapa. Crie a primeira acima.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
      {automationsStage && (
        <StageAutomationsDialog
          open={!!automationsStage}
          onOpenChange={() => setAutomationsStage(null)}
          stageId={automationsStage.id}
          stageLabel={automationsStage.name}
        />
      )}
    </Card>
  );
}

// ── Section 3: Sortable Status Item ──
function SortableStatusItem({ status, onEdit, onDelete, onToggleFinal }: {
  status: Status;
  onEdit: (s: Status) => void;
  onDelete: (s: Status) => void;
  onToggleFinal: (s: Status) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: status.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const typeLabel = STATUS_TYPE_MAP[status.status_type || "custom"] || "Personalizado";

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
      <span className="flex-1 text-sm font-medium">{status.name}</span>
      <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
      {status.is_system && <Badge variant="secondary" className="text-xs">Sistema</Badge>}
      {status.is_default && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Padrão</span>}
      <div className="flex items-center gap-1.5">
        <Flag className={`h-3.5 w-3.5 ${status.is_final ? "text-destructive" : "text-muted-foreground/40"}`} />
        <Switch checked={status.is_final} onCheckedChange={() => onToggleFinal(status)} disabled={status.is_default || status.is_system} />
        <span className="text-xs text-muted-foreground w-8">Final</span>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(status)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(status)} disabled={status.is_system}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Main Component ──
export default function KanbanAndStagesTab() {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Board state ──
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [boardName, setBoardName] = useState("");
  const [boardDesc, setBoardDesc] = useState("");
  const [boardType, setBoardType] = useState("custom");
  const [boardIcon, setBoardIcon] = useState("Layout");
  const [boardColor, setBoardColor] = useState(COLOR_PALETTE[6]);
  const [configuringBoardId, setConfiguringBoardId] = useState<string | null>(null);
  const [csatBoardId, setCsatBoardId] = useState<string | null>(null);
  const [csatBoardName, setCsatBoardName] = useState('');

  // ── Status state ──
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  const [statusName, setStatusName] = useState("");
  const [statusColor, setStatusColor] = useState(COLOR_PALETTE[0]);
  const [statusIcon, setStatusIcon] = useState("");
  const [statusType, setStatusType] = useState("custom");

  // ── Queries ──
  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("kanban_boards").select("*").order("sort_order");
      if (error) throw error;
      return data as Board[];
    },
  });

  const { data: stageCounts = {} } = useQuery({
    queryKey: ["kanban-stage-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("kanban_stages").select("board_id").eq("active", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((s: any) => { counts[s.board_id] = (counts[s.board_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ["ticket-statuses-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_statuses").select("*").order("sort_order");
      if (error) throw error;
      return data as Status[];
    },
  });

  // ── Board mutations ──
  const upsertBoard = useMutation({
    mutationFn: async () => {
      if (editingBoard) {
        await (supabase as any).from("kanban_boards").update({
          name: boardName, description: boardDesc || null, board_type: boardType, icon: boardIcon, color: boardColor,
        }).eq("id", editingBoard.id);
      } else {
        const maxSort = boards.length > 0 ? Math.max(...boards.map(b => b.sort_order)) + 1 : 0;
        await (supabase as any).from("kanban_boards").insert({
          name: boardName, description: boardDesc || null, board_type: boardType, icon: boardIcon, color: boardColor, sort_order: maxSort,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-boards-settings"] });
      setBoardDialogOpen(false);
      toast.success(editingBoard ? "Kanban atualizado" : "Kanban criado");
    },
    onError: () => toast.error("Erro ao salvar kanban"),
  });

  const toggleBoardActive = useMutation({
    mutationFn: async (b: Board) => {
      await (supabase as any).from("kanban_boards").update({ active: !b.active }).eq("id", b.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kanban-boards-settings"] }),
  });

  // ── Status mutations ──
  const generateSlug = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const upsertStatus = useMutation({
    mutationFn: async () => {
      if (editingStatus) {
        await supabase.from("ticket_statuses").update({
          name: statusName, color: statusColor, icon: statusIcon || null, status_type: statusType as any,
        }).eq("id", editingStatus.id);
      } else {
        const slug = generateSlug(statusName);
        const maxOrder = statuses.length > 0 ? Math.max(...statuses.map(s => s.sort_order)) + 1 : 0;
        await supabase.from("ticket_statuses").insert({
          name: statusName, slug, color: statusColor, icon: statusIcon || null,
          status_type: statusType as any, sort_order: maxOrder,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-statuses-settings"] });
      setStatusDialogOpen(false);
      toast.success(editingStatus ? "Status atualizado" : "Status criado");
    },
    onError: () => toast.error("Erro ao salvar status"),
  });

  const toggleFinal = useMutation({
    mutationFn: async (s: Status) => {
      await supabase.from("ticket_statuses").update({ is_final: !s.is_final }).eq("id", s.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket-statuses-settings"] }),
  });

  const deleteStatus = useMutation({
    mutationFn: async (s: Status) => {
      if (s.is_system) throw new Error("Status de sistema não pode ser excluído.");
      const { count } = await (supabase as any).from("ai_conversations").select("id", { count: "exact", head: true }).eq("ticket_status_id", s.id);
      if (count && count > 0) throw new Error(`${count} tickets com este status. Não é possível excluir.`);
      await supabase.from("ticket_statuses").delete().eq("id", s.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-statuses-settings"] });
      toast.success("Status excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderStatuses = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      for (const item of items) {
        await supabase.from("ticket_statuses").update({ sort_order: item.sort_order }).eq("id", item.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket-statuses-settings"] }),
  });

  const handleStatusDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = statuses.findIndex(s => s.id === active.id);
    const newIdx = statuses.findIndex(s => s.id === over.id);
    const newOrder = arrayMove(statuses, oldIdx, newIdx);
    queryClient.setQueryData(["ticket-statuses-settings"], newOrder);
    reorderStatuses.mutate(newOrder.map((s, i) => ({ id: s.id, sort_order: i })));
  };

  // ── Board dialog helpers ──
  const openBoardCreate = () => {
    setEditingBoard(null); setBoardName(""); setBoardDesc(""); setBoardType("custom"); setBoardIcon("Layout"); setBoardColor(COLOR_PALETTE[6]);
    setBoardDialogOpen(true);
  };
  const openBoardEdit = (b: Board | null) => {
    if (!b) return openBoardCreate();
    setEditingBoard(b); setBoardName(b.name); setBoardDesc(b.description || ""); setBoardType(b.board_type || "custom"); setBoardIcon(b.icon || "Layout"); setBoardColor(b.color || COLOR_PALETTE[6]);
    setBoardDialogOpen(true);
  };

  // ── Status dialog helpers ──
  const openStatusCreate = () => {
    setEditingStatus(null); setStatusName(""); setStatusColor(COLOR_PALETTE[0]); setStatusIcon(""); setStatusType("custom");
    setStatusDialogOpen(true);
  };
  const openStatusEdit = (s: Status) => {
    setEditingStatus(s); setStatusName(s.name); setStatusColor(s.color); setStatusIcon(s.icon || ""); setStatusType(s.status_type || "custom");
    setStatusDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Boards */}
      <BoardsSection
        boards={boards}
        stageCounts={stageCounts}
        onEdit={openBoardEdit}
        onConfigureStages={setConfiguringBoardId}
        onToggleActive={b => toggleBoardActive.mutate(b)}
        configuringBoardId={configuringBoardId}
        onOpenCSAT={(id, name) => { setCsatBoardId(id); setCsatBoardName(name); }}
      />

      {/* Section 2: Stages (conditional) */}
      {configuringBoardId && (
        <StagesConfigurator boardId={configuringBoardId} />
      )}

      {/* Separator + explanatory text */}
      <Separator />
      <div className="bg-muted/50 border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Status</strong> são o ciclo de vida operacional do ticket.{" "}
          <strong>Etapas</strong> são a posição visual no Kanban.{" "}
          Os dois podem ser combinados via <strong>Automações</strong>.
        </p>
      </div>

      {/* CSAT Config Dialog */}
      <Dialog open={!!csatBoardId} onOpenChange={(open) => !open && setCsatBoardId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuração CSAT — {csatBoardName}</DialogTitle>
          </DialogHeader>
          {csatBoardId && (
            <CSATBoardConfigForm boardId={csatBoardId} boardName={csatBoardName} />
          )}
        </DialogContent>
      </Dialog>

      {/* Section 3: Statuses (read-only) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Status de Tickets</h3>
          <Badge variant="secondary" className="text-xs">Fixos do Sistema</Badge>
        </div>
        <div className="space-y-2">
          {statuses.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-sm font-medium">{s.name}</span>
              <Badge variant="outline" className="text-xs">{STATUS_TYPE_MAP[s.status_type || "custom"] || "Personalizado"}</Badge>
              <Badge variant="secondary" className="text-xs">Sistema</Badge>
              {s.is_default && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Padrão</span>}
              {s.is_final && (
                <Badge variant="outline" className="text-xs text-destructive border-destructive/30">Final</Badge>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
