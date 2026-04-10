import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GitMerge, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SmartMergeTicket {
  id: string;
  ticket_number?: number | null;
  customer_name?: string | null;
  ticket_subject?: string | null;
  status?: string | null;
  agent_name?: string | null;
  helpdesk_client_name?: string | null;
  helpdesk_client_id?: string | null;
  ticket_category_id?: string | null;
  ticket_category_name?: string | null;
  ticket_module_id?: string | null;
  ticket_module_name?: string | null;
  handler_type?: string | null;
}

interface SmartMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tickets: SmartMergeTicket[];
  onSuccess?: () => void;
}

type FieldKey = "ticket_subject" | "status" | "agent" | "client" | "category" | "module";

const FIELD_LABELS: Record<FieldKey, string> = {
  ticket_subject: "Assunto",
  status: "Status",
  agent: "Agente",
  client: "Cliente",
  category: "Categoria",
  module: "Módulo",
};

function getFieldValue(ticket: SmartMergeTicket, field: FieldKey): string | null | undefined {
  switch (field) {
    case "ticket_subject": return ticket.ticket_subject;
    case "status": return ticket.status;
    case "agent": return ticket.agent_name;
    case "client": return ticket.helpdesk_client_name;
    case "category": return ticket.ticket_category_name;
    case "module": return ticket.ticket_module_name;
  }
}

export function SmartMergeDialog({
  open,
  onOpenChange,
  tickets,
  onSuccess,
}: SmartMergeDialogProps) {
  const [keepId, setKeepId] = useState<string>(tickets[0]?.id ?? "");
  const [fieldChoices, setFieldChoices] = useState<Record<FieldKey, string>>(() => {
    const defaultId = tickets[0]?.id ?? "";
    return {
      ticket_subject: defaultId,
      status: defaultId,
      agent: defaultId,
      client: defaultId,
      category: defaultId,
      module: defaultId,
    };
  });

  const queryClient = useQueryClient();

  const ticketA = tickets[0];
  const ticketB = tickets[1];

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!keepId) throw new Error("Selecione o ticket principal");
      const mergeIds = tickets.filter((t) => t.id !== keepId).map((t) => t.id);

      // Passo 1: merge RPC — absorve mensagens e histórico
      const { error: mergeError } = await supabase.rpc("merge_tickets" as any, {
        p_keep_id: keepId,
        p_merge_ids: mergeIds,
      });
      if (mergeError) throw mergeError;

      // Passo 2: atualizar campos escolhidos no ticket mantido
      const getChosen = (field: FieldKey) => tickets.find((t) => t.id === fieldChoices[field]);
      const updateFields: Record<string, unknown> = {};

      const subjectChosen = getChosen("ticket_subject");
      if (subjectChosen?.ticket_subject !== undefined)
        updateFields.ticket_subject = subjectChosen.ticket_subject;

      const statusChosen = getChosen("status");
      if (statusChosen?.status !== undefined)
        updateFields.status = statusChosen.status;

      const clientChosen = getChosen("client");
      if (clientChosen?.helpdesk_client_id !== undefined)
        updateFields.helpdesk_client_id = clientChosen.helpdesk_client_id;

      const categoryChosen = getChosen("category");
      if (categoryChosen?.ticket_category_id !== undefined)
        updateFields.ticket_category_id = categoryChosen.ticket_category_id;

      const moduleChosen = getChosen("module");
      if (moduleChosen?.ticket_module_id !== undefined)
        updateFields.ticket_module_id = moduleChosen.ticket_module_id;

      if (Object.keys(updateFields).length > 0) {
        const { error: updateError } = await supabase
          .from("ai_conversations")
          .update(updateFields)
          .eq("id", keepId);
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Tickets mesclados com sucesso");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(`Erro ao mesclar: ${err.message}`);
    },
  });

  if (!ticketA || !ticketB) return null;

  const fields: FieldKey[] = ["ticket_subject", "status", "agent", "client", "category", "module"];

  const ColHeader = ({ ticket, isKeep }: { ticket: SmartMergeTicket; isKeep: boolean }) => (
    <div
      className={cn(
        "flex-1 text-center px-3 py-2 rounded-lg border-2 cursor-pointer transition-all select-none",
        isKeep
          ? "border-gms-cyan bg-gms-cyan-light text-gms-navy font-semibold"
          : "border-transparent bg-gms-g100 text-gms-g500 hover:border-gms-g300"
      )}
      onClick={() => setKeepId(ticket.id)}
    >
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold">
        {isKeep && <CheckCircle2 className="w-3 h-3 text-gms-cyan" />}
        <span>#{ticket.ticket_number ?? "—"}</span>
      </div>
      <div className="text-[10px] mt-0.5 truncate font-normal">
        {ticket.customer_name ?? "—"}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-gms-cyan" />
            Mesclar Tickets
          </DialogTitle>
          <DialogDescription>
            Escolha qual ticket será o principal e selecione os dados a manter de cada campo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Cabeçalho de colunas */}
          <div className="flex items-center gap-2">
            <div className="w-24 shrink-0" />
            <ColHeader ticket={ticketA} isKeep={keepId === ticketA.id} />
            <ColHeader ticket={ticketB} isKeep={keepId === ticketB.id} />
          </div>

          {/* Linhas de campos */}
          <div className="border border-gms-g200 rounded-lg overflow-hidden divide-y divide-gms-g200">
            {fields.map((field) => {
              const valA = getFieldValue(ticketA, field);
              const valB = getFieldValue(ticketB, field);
              const chosenId = fieldChoices[field];

              return (
                <div key={field} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="w-24 shrink-0 text-[11px] font-semibold text-gms-g700 uppercase tracking-wide">
                    {FIELD_LABELS[field]}
                  </div>

                  {/* Opção A */}
                  <button
                    className={cn(
                      "flex-1 text-left px-2.5 py-1.5 rounded-md border text-[12px] transition-all",
                      chosenId === ticketA.id
                        ? "border-gms-cyan bg-gms-cyan-light text-gms-navy font-medium ring-1 ring-gms-cyan"
                        : "border-gms-g200 bg-white text-gms-g500 hover:border-gms-g300 hover:bg-gms-g100"
                    )}
                    onClick={() => setFieldChoices((prev) => ({ ...prev, [field]: ticketA.id }))}
                  >
                    {valA || <span className="text-gms-g300 italic">—</span>}
                  </button>

                  {/* Opção B */}
                  <button
                    className={cn(
                      "flex-1 text-left px-2.5 py-1.5 rounded-md border text-[12px] transition-all",
                      chosenId === ticketB.id
                        ? "border-gms-cyan bg-gms-cyan-light text-gms-navy font-medium ring-1 ring-gms-cyan"
                        : "border-gms-g200 bg-white text-gms-g500 hover:border-gms-g300 hover:bg-gms-g100"
                    )}
                    onClick={() => setFieldChoices((prev) => ({ ...prev, [field]: ticketB.id }))}
                  >
                    {valB || <span className="text-gms-g300 italic">—</span>}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-gms-g500 bg-gms-g100 rounded-md px-3 py-2">
            O histórico de mensagens do ticket secundário será incorporado ao ticket principal.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mergeMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mergeMutation.mutate()}
            disabled={mergeMutation.isPending || !keepId}
            className="bg-gms-cyan text-gms-navy hover:bg-gms-cyan-hover font-semibold"
          >
            {mergeMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Mesclando...</>
            ) : (
              <><GitMerge className="w-4 h-4 mr-2" /> Mesclar Tickets</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
