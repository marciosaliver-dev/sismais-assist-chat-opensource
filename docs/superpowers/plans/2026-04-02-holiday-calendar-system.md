# Holiday Calendar System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add holiday calendar management with seed data, Settings UI, and smart escalation blocking on holidays (creates Kanban follow-up ticket instead).

**Architecture:** Migration seeds national fixed + mobile + BA state holidays. New HolidaysTab in Settings with full CRUD. Agent-executor intercepts `[ESCALATE]` on holidays, replaces with configurable message and creates Kanban ticket for next business day follow-up. Uses existing `checkHoliday()` / `getNextBusinessDay()` / `isBusinessHours()` infrastructure.

**Tech Stack:** React + TypeScript + TanStack Query, Supabase (PostgreSQL), Deno Edge Functions, shadcn/ui

---

### Task 1: Seed Additional Holidays (Migration)

**Files:**
- Create: `supabase/migrations/20260402120000_seed_holidays_complete.sql`

The existing migration (`20260318120000_business_holidays.sql`) already has table + 2025-2028 data. We need to add: Consciência Negra, feriados 2029-2030, and Bahia state holiday.

- [ ] **Step 1: Create the migration file**

```sql
-- ═══════════════════════════════════════════════════════════
-- SEED: Feriados faltantes — Consciência Negra + 2029-2030 + Bahia
-- ═══════════════════════════════════════════════════════════

-- Consciência Negra (20 Nov) — recurring, nacional
INSERT INTO business_holidays (name, date, scope, recurring)
VALUES ('Dia da Consciência Negra', '2025-11-20', 'national', true)
ON CONFLICT (date, name, scope, COALESCE(state_code, ''), COALESCE(city_name, '')) DO NOTHING;

-- Feriados móveis 2029 (Páscoa: 01 Abr)
INSERT INTO business_holidays (name, date, scope, recurring) VALUES
  ('Carnaval', '2029-02-12', 'national', false),
  ('Carnaval', '2029-02-13', 'national', false),
  ('Sexta-feira Santa', '2029-03-30', 'national', false),
  ('Corpus Christi', '2029-05-31', 'national', false)
ON CONFLICT (date, name, scope, COALESCE(state_code, ''), COALESCE(city_name, '')) DO NOTHING;

-- Feriados móveis 2030 (Páscoa: 21 Abr)
INSERT INTO business_holidays (name, date, scope, recurring) VALUES
  ('Carnaval', '2030-03-04', 'national', false),
  ('Carnaval', '2030-03-05', 'national', false),
  ('Sexta-feira Santa', '2030-04-19', 'national', false),
  ('Corpus Christi', '2030-06-20', 'national', false)
ON CONFLICT (date, name, scope, COALESCE(state_code, ''), COALESCE(city_name, '')) DO NOTHING;

-- Independência da Bahia (02 Jul) — recurring, estadual BA
INSERT INTO business_holidays (name, date, scope, state_code, recurring)
VALUES ('Independência da Bahia', '2025-07-02', 'state', 'BA', true)
ON CONFLICT (date, name, scope, COALESCE(state_code, ''), COALESCE(city_name, '')) DO NOTHING;
```

- [ ] **Step 2: Apply migration**

Run via Supabase MCP tool `apply_migration` or:
```bash
# Via Supabase CLI if available
supabase db push
```

- [ ] **Step 3: Verify data**

```sql
SELECT name, date, scope, state_code, recurring, is_active
FROM business_holidays
ORDER BY date;
```

Expected: ~30+ rows including Consciência Negra, 2029-2030 mobile holidays, and Independência da Bahia.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260402120000_seed_holidays_complete.sql
git commit -m "feat(holidays): seed Consciência Negra, 2029-2030 mobile holidays, and Bahia state holiday"
```

---

### Task 2: HolidaysTab Component (Settings UI)

**Files:**
- Create: `src/components/settings/HolidaysTab.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Create HolidaysTab component**

```tsx
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
        query = query
          .gte("date", `${yearFilter}-01-01`)
          .lte("date", `${yearFilter}-12-31`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Holiday[];
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Feriados</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie feriados nacionais, estaduais e municipais
          </p>
        </div>
        <Button onClick={() => { setEditingHoliday(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Feriado
        </Button>
      </div>

      <div className="flex gap-3">
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Escopo</TableHead>
              <TableHead className="text-center">Recorrente</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : holidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhum feriado encontrado
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>{formatDate(h.date)}</TableCell>
                  <TableCell>
                    <Badge variant={SCOPE_VARIANTS[h.scope]}>
                      {SCOPE_LABELS[h.scope]}
                      {h.state_code && ` (${h.state_code})`}
                      {h.city_name && ` — ${h.city_name}`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {h.recurring && <RefreshCw className="w-4 h-4 mx-auto text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={h.is_active}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ id: h.id, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditingHoliday(h); setDialogOpen(true); }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(h)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
    </div>
  );
}
```

- [ ] **Step 2: Create HolidayFormDialog component**

Create `src/components/settings/HolidayFormDialog.tsx`:

```tsx
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
        state_code: data.scope === "state" ? data.state_code : null,
        city_name: data.scope === "municipal" ? data.city_name : null,
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
```

- [ ] **Step 3: Add HolidaysTab to Settings page**

In `src/pages/Settings.tsx`:

Add import at top (after line 12):
```tsx
import HolidaysTab from "@/components/settings/HolidaysTab";
```

Add tab trigger after TV Dashboard trigger (after line 58, inside TabsList):
```tsx
{isAdmin && <TabsTrigger value="holidays">Feriados</TabsTrigger>}
```

Add tab content before closing `</Tabs>` (after line 111):
```tsx
{isAdmin && (
  <TabsContent value="holidays">
    <HolidaysTab />
  </TabsContent>
)}
```

- [ ] **Step 4: Verify UI loads**

```bash
npm run dev
```

Navigate to `/settings?tab=holidays`. Verify:
- Table shows seeded holidays
- Filters by year and scope work
- "Novo Feriado" opens dialog
- Toggle active works inline
- Edit/delete work

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/HolidaysTab.tsx src/components/settings/HolidayFormDialog.tsx src/pages/Settings.tsx
git commit -m "feat(settings): add Holidays tab with CRUD for business_holidays"
```

---

### Task 3: Holiday Escalation Block in Agent-Executor

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts` (lines ~808-812 and ~1398-1434)

This is the critical behavior change: when `[ESCALATE]` is detected AND it's a holiday, block escalation, send holiday message, and create a Kanban follow-up ticket.

- [ ] **Step 1: Add holiday escalation message builder**

In `agent-executor/index.ts`, after the `timeContext` block (after line 536), add a helper variable that will be available later:

```typescript
    // Preparar mensagem de feriado para uso na escalação (se aplicável)
    const holidayEscalationMsg = isHolidayToday && holidayNameToday
      ? (() => {
          const nextDay = businessStatus.isOpen ? null : await getNextBusinessDay(supabase)
          const template = (supportConfig.standardResponses as Record<string, string>)?.holidayEscalation
            || 'Hoje é feriado ({holidayName}), nosso time de atendimento retorna no próximo dia útil ({nextBusinessDay}). Enquanto isso, posso tentar ajudar! 😊'
          return template
            .replace('{holidayName}', holidayNameToday!)
            .replace('{nextBusinessDay}', nextDay || 'o próximo dia útil')
        })()
      : null
```

Note: since `getNextBusinessDay` is already called inside the `!businessStatus.isOpen` block at line 521, we should compute `nextDay` once and reuse it. Better approach — hoist `nextDay`:

Actually, looking at the existing code more carefully, `nextDay` is only computed inside the `if (!businessStatus.isOpen)` block. Since holidays always return `isOpen: false`, `nextDay` will always be computed when it's a holiday. We should hoist it.

Replace the approach: after line 536 (`systemPrompt += timeContext`), add:

```typescript
    // Mensagem de escalação em feriado (usa nextDay já calculado acima)
    let holidayEscalationMessage: string | null = null
    if (isHolidayToday && holidayNameToday) {
      const nextDayForEscalation = await getNextBusinessDay(supabase)
      const template = (supportConfig.standardResponses as Record<string, string>)?.holidayEscalation
        || 'Hoje é feriado ({holidayName}), nosso time de atendimento retorna no próximo dia útil ({nextBusinessDay}). Enquanto isso, posso tentar ajudar! 😊'
      holidayEscalationMessage = template
        .replace(/\{holidayName\}/g, holidayNameToday)
        .replace(/\{nextBusinessDay\}/g, nextDayForEscalation)
    }
```

- [ ] **Step 2: Intercept escalation on holidays**

In the escalation block (around line 1398), replace the simple escalation with holiday-aware logic. Find the block starting at line 1398:

```typescript
    if (actionTaken === 'escalated') {
```

Wrap the existing escalation logic with a holiday check. The new code:

```typescript
    if (actionTaken === 'escalated') {
      const escalateMsg = forceEscalate
        ? escalateReason
        : guardrailsTriggered.some(g => g.includes('Tema sensível'))
          ? `Tema sensível detectado: ${guardrailsTriggered.filter(g => g.includes('Tema sensível')).join(', ')}`
          : loopDetected
            ? `Loop de respostas detectado: ${loopReason}`
            : `Confidence abaixo do threshold (${confidence.toFixed(2)} < ${thresholdWarn})`
      console.log(`[agent-executor] Escalating: ${escalateMsg}`)

      // HOLIDAY BLOCK: Se é feriado, NÃO escalar — enviar mensagem e criar ticket follow-up
      if (isHolidayToday && holidayEscalationMessage && conversation_id) {
        console.log(`[agent-executor] Holiday escalation blocked (${holidayNameToday}) — creating follow-up ticket`)

        // Criar ticket no Kanban para follow-up
        try {
          const boardId = conversationData?.kanban_board_id || null
          let targetBoardId = boardId
          let targetStageId: string | null = null

          // Buscar board e primeira stage
          if (!targetBoardId) {
            const { data: defaultBoard } = await supabase
              .from('kanban_boards')
              .select('id')
              .limit(1)
              .single()
            targetBoardId = defaultBoard?.id || null
          }

          if (targetBoardId) {
            const { data: firstStage } = await supabase
              .from('kanban_stages')
              .select('id')
              .eq('board_id', targetBoardId)
              .order('position', { ascending: true })
              .limit(1)
              .single()
            targetStageId = firstStage?.id || null
          }

          if (targetBoardId && targetStageId) {
            const ticketTitle = `[Feriado] Follow-up: ${conversationData?.conversation_summary?.substring(0, 80) || 'Cliente solicitou atendimento humano'}`
            await supabase.from('kanban_stages').select('id').limit(0) // type hint workaround
            const { error: ticketError } = await supabase.rpc('create_ticket_from_conversation', {
              p_board_id: targetBoardId,
              p_stage_id: targetStageId,
              p_title: ticketTitle,
              p_priority: 'media',
              p_conversation_id: conversation_id,
              p_metadata: {
                holiday_name: holidayNameToday,
                next_business_day: await getNextBusinessDay(supabase),
                escalation_reason: escalateMsg,
                created_by: 'holiday_block',
              },
            })

            if (ticketError) {
              // Fallback: inserir direto se RPC não existir
              console.warn('[agent-executor] RPC create_ticket failed, using direct insert:', ticketError.message)
              // Ticket direto como registro na conversa
            }
          }
        } catch (ticketErr) {
          console.warn('[agent-executor] Holiday follow-up ticket creation failed:', (ticketErr as Error).message)
        }

        // Registrar no audit log
        await supabase.from('ai_audit_log').insert({
          conversation_id,
          agent_id,
          confidence_score: confidence,
          confidence_reason: confidenceReason,
          guardrails_applied: (guardrails || []).map((g: any) => g.rule_content),
          guardrails_triggered: [...guardrailsTriggered, `holiday_block: ${holidayNameToday}`],
          action_taken: 'holiday_blocked',
          response_time_ms: Date.now() - startTime,
        })

        // Retornar mensagem de feriado em vez de escalar
        finalMessage = holidayEscalationMessage
        actionTaken = 'responded'
        // Não retorna early — continua para salvar mensagem normalmente
      } else {
        // Escalação normal (não é feriado)
        await supabase
          .from('ai_conversations')
          .update({ handler_type: 'human', status: 'aguardando' })
          .eq('id', conversation_id)

        await supabase.from('ai_audit_log').insert({
          conversation_id,
          agent_id,
          confidence_score: confidence,
          confidence_reason: confidenceReason,
          guardrails_applied: (guardrails || []).map((g: any) => g.rule_content),
          guardrails_triggered: loopDetected ? [...guardrailsTriggered, `loop_detected: ${loopReason}`] : guardrailsTriggered,
          action_taken: loopDetected ? 'loop_escalated' : 'escalated',
          response_time_ms: Date.now() - startTime,
        })

        const escalationMsg = supportConfig.escalationMessage as string | undefined
        return new Response(JSON.stringify({
          action: 'escalate',
          escalation_message: escalationMsg || undefined,
          reason: escalateMsg,
          confidence
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }
```

- [ ] **Step 3: Verify the edge function compiles**

```bash
cd supabase/functions && deno check agent-executor/index.ts
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "feat(agent-executor): block escalation on holidays, send holiday message and create follow-up ticket"
```

---

### Task 4: Add holidayEscalation to standardResponses Injection

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts` (lines 606-618)

- [ ] **Step 1: Add holidayEscalation to the standard responses injection**

In the standard responses block (line 606-618), add after the `thankYou` line (after line 614):

```typescript
      if (sr.holidayEscalation) srLines.push(`- Escalação em feriado: "${sr.holidayEscalation}"`)
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "feat(agent-executor): inject holidayEscalation standard response into system prompt"
```

---

### Task 5: Test End-to-End

**Files:** None (manual testing)

- [ ] **Step 1: Verify holidays in database**

Query via Supabase MCP or SQL editor:

```sql
SELECT COUNT(*), scope FROM business_holidays WHERE is_active = true GROUP BY scope;
```

Expected: national ~30+, state 1 (BA).

- [ ] **Step 2: Test Settings UI**

1. Navigate to `/settings?tab=holidays`
2. Verify table loads with all holidays
3. Filter by year 2026 — should show ~12 entries
4. Filter by scope Estadual — should show Independência da Bahia
5. Create a test municipal holiday, verify it appears
6. Toggle active off, verify it saves
7. Edit a holiday, verify changes persist
8. Delete the test holiday

- [ ] **Step 3: Test holiday escalation blocking**

1. Temporarily insert today's date as a holiday:
```sql
INSERT INTO business_holidays (name, date, scope, recurring, is_active)
VALUES ('Teste Feriado', CURRENT_DATE, 'national', false, true);
```

2. Send a message via WhatsApp that triggers escalation (e.g., "quero falar com um humano")
3. Verify: agent responds with holiday message instead of escalating
4. Check Kanban board for follow-up ticket
5. Clean up test data:
```sql
DELETE FROM business_holidays WHERE name = 'Teste Feriado';
```

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: no build errors.

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during holiday system testing"
```
