import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Holiday } from "./HolidaysTab";

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface FormData {
  name: string;
  date: string;
  scope: "national" | "state" | "municipal";
  state_code: string;
  city_name: string;
  recurring: boolean;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holiday: Holiday | null;
}

export function HolidayFormDialog({ open, onOpenChange, holiday }: Props) {
  const qc = useQueryClient();
  const isEditing = !!holiday;

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: "",
      date: "",
      scope: "national",
      state_code: "",
      city_name: "",
      recurring: false,
      is_active: true,
    },
  });

  const scope = watch("scope");

  useEffect(() => {
    if (open && holiday) {
      reset({
        name: holiday.name,
        date: holiday.date,
        scope: holiday.scope,
        state_code: holiday.state_code || "",
        city_name: holiday.city_name || "",
        recurring: holiday.recurring,
        is_active: holiday.is_active,
      });
    } else if (open) {
      reset({
        name: "",
        date: "",
        scope: "national",
        state_code: "",
        city_name: "",
        recurring: false,
        is_active: true,
      });
    }
  }, [open, holiday, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        date: data.date,
        scope: data.scope,
        state_code: data.scope === "state" || data.scope === "municipal" ? data.state_code || null : null,
        city_name: data.scope === "municipal" ? data.city_name || null : null,
        recurring: data.recurring,
        is_active: data.is_active,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("business_holidays" as any)
          .update(payload as any)
          .eq("id", holiday!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("business_holidays" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business_holidays"] });
      toast.success(isEditing ? "Feriado atualizado" : "Feriado cadastrado");
      onOpenChange(false);
    },
    onError: (err: any) => {
      if (err?.message?.includes("duplicate") || err?.message?.includes("unique")) {
        toast.error("Este feriado já existe nesta data");
      } else {
        toast.error("Erro ao salvar feriado");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Feriado" : "Novo Feriado"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              placeholder="Ex: Natal"
              {...register("name", { required: true })}
            />
            {errors.name && <p className="text-sm text-destructive">Nome obrigatório</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data *</Label>
            <Input
              id="date"
              type="date"
              {...register("date", { required: true })}
            />
            {errors.date && <p className="text-sm text-destructive">Data obrigatória</p>}
          </div>

          <div className="space-y-2">
            <Label>Escopo</Label>
            <Select value={scope} onValueChange={(v) => setValue("scope", v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="national">Nacional</SelectItem>
                <SelectItem value="state">Estadual</SelectItem>
                <SelectItem value="municipal">Municipal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "state" && (
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={watch("state_code")}
                onValueChange={(v) => setValue("state_code", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {BR_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === "municipal" && (
            <>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={watch("state_code")}
                  onValueChange={(v) => setValue("state_code", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {BR_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city_name">Cidade</Label>
                <Input
                  id="city_name"
                  placeholder="Ex: Salvador"
                  {...register("city_name")}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="recurring">Recorrente (mesmo dia todo ano)</Label>
            <Switch
              id="recurring"
              checked={watch("recurring")}
              onCheckedChange={(v) => setValue("recurring", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Ativo</Label>
            <Switch
              id="is_active"
              checked={watch("is_active")}
              onCheckedChange={(v) => setValue("is_active", v)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : isEditing ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
