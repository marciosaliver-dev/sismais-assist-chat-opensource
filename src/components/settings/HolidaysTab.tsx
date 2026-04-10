import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, CalendarDays, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { HolidayFormDialog } from "./HolidayFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface Holiday {
  id: string;
  name: string;
  date: string;
  scope: "national" | "state" | "municipal";
  state_code: string | null;
  city_name: string | null;
  recurring: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const SCOPE_LABELS: Record<string, string> = {
  national: "Nacional",
  state: "Estadual",
  municipal: "Municipal",
};

const SCOPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  national: "default",
  state: "secondary",
  municipal: "outline",
};

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear + i);

export default function HolidaysTab() {
  const qc = useQueryClient();
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["business_holidays", yearFilter, scopeFilter],
    queryFn: async () => {
      let query = supabase
        .from("business_holidays" as any)
        .select("*")
        .order("date", { ascending: true });

      if (scopeFilter !== "all") {
        query = query.eq("scope", scopeFilter);
      }

      if (yearFilter !== "all") {
        // Buscar feriados do ano selecionado + recorrentes (que valem para todos os anos)
        query = query.or(
          `and(date.gte.${yearFilter}-01-01,date.lte.${yearFilter}-12-31),recurring.eq.true`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      const holidays = (data || []) as unknown as Holiday[];

      // Para recorrentes, ajustar a data de exibição para o ano selecionado
      if (yearFilter !== "all") {
        return holidays.map((h) => {
          if (h.recurring && !h.date.startsWith(yearFilter)) {
            return { ...h, date: `${yearFilter}${h.date.substring(4)}` };
          }
          return h;
        }).sort((a, b) => a.date.localeCompare(b.date));
      }
      return holidays;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("business_holidays" as any)
        .update({ is_active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business_holidays"] });
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("business_holidays" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business_holidays"] });
      toast.success("Feriado excluído");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao excluir feriado"),
  });

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="holidays-settings">
      <div className="holidays-card">
        <div className="holidays-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <CalendarDays className="w-5 h-5" />
              Feriados
            </h3>
            <p className="sc-desc">Gerencie feriados nacionais, estaduais e municipais</p>
          </div>
          <Button onClick={() => { setEditingHoliday(null); setDialogOpen(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Novo Feriado
          </Button>
        </div>

        <div className="holidays-filters">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Escopo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="national">Nacional</SelectItem>
              <SelectItem value="state">Estadual</SelectItem>
              <SelectItem value="municipal">Municipal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="holidays-card-content">
          <table className="holidays-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Data</th>
                <th>Escopo</th>
                <th className="text-center">Recorrente</th>
                <th className="text-center">Ativo</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-muted-foreground">Nenhum feriado encontrado</p>
                  </td>
                </tr>
              ) : (
                holidays.map((h) => (
                  <tr key={h.id}>
                    <td className="font-medium">{h.name}</td>
                    <td>{formatDate(h.date)}</td>
                    <td>
                      <Badge variant={SCOPE_VARIANTS[h.scope]}>
                        {SCOPE_LABELS[h.scope]}
                        {h.state_code && ` (${h.state_code})`}
                        {h.city_name && ` — ${h.city_name}`}
                      </Badge>
                    </td>
                    <td className="text-center">
                      {h.recurring && <RefreshCw className="w-4 h-4 mx-auto text-muted-foreground" />}
                    </td>
                    <td className="text-center">
                      <Switch
                        checked={h.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: h.id, is_active: checked })
                        }
                      />
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="sc-btn-icon"
                          onClick={() => { setEditingHoliday(h); setDialogOpen(true); }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="sc-btn-icon sc-btn-del"
                          onClick={() => setDeleteTarget(h)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HolidayFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        holiday={editingHoliday}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir feriado?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        .holidays-settings { display: flex; flex-direction: column; gap: 16px; }
        .holidays-card { background: #fff; border: 1px solid #E5E5E5; border-radius: 8px; overflow: hidden; }
        .holidays-card-header { padding: 16px; border-bottom: 1px solid #E5E5E5; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #fff; }
        .holidays-card-header .sc-info { flex: 1; }
        .holidays-card-header .sc-title { font-size: 16px; font-weight: 600; color: #10293F; margin: 0; display: flex; align-items: center; gap: 8px; }
        .holidays-card-header .sc-title .w-5.h-5 { color: #45E5E5; }
        .holidays-card-header .sc-desc { font-size: 13px; color: #666; margin: 4px 0 0; }
        .holidays-filters { padding: 12px 16px; border-bottom: 1px solid #E5E5E5; display: flex; gap: 12px; background: #F8FAFC; }
        .holidays-card-content { padding: 0; }
        .holidays-table { width: 100%; border-collapse: collapse; }
        .holidays-table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #666; border-bottom: 1px solid #E5E5E5; background: #F8FAFC; }
        .holidays-table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #F0F0F0; }
        .holidays-table tr:last-child td { border-bottom: none; }
        .holidays-table tr:hover { background: #F8FAFC; }
        .sc-btn-icon { width: 32px; height: 32px; border: none; background: transparent; color: #888; cursor: pointer; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: all 150ms; }
        .sc-btn-icon:hover { background: #E8F9F9; color: #10293F; }
        .sc-btn-del:hover { background: #FEF2F2; color: #DC2626; }
      `}</style>
    </div>
  );
}
