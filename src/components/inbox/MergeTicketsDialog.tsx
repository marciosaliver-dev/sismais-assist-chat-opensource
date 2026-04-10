import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GitMerge, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface MergeTicketsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  ticketNumber?: number | null;
  helpdeskClientId: string | null;
}

export function MergeTicketsDialog({
  open,
  onOpenChange,
  conversationId,
  ticketNumber,
  helpdeskClientId,
}: MergeTicketsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["merge-candidates", helpdeskClientId],
    queryFn: async () => {
      if (!helpdeskClientId) return [];
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id, ticket_number, customer_name, status, started_at, customer_phone")
        .eq("helpdesk_client_id", helpdeskClientId)
        .neq("id", conversationId)
        .neq("is_merged", true)
        .neq("status", "cancelado")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!helpdeskClientId,
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("merge_tickets" as any, {
        p_keep_id: conversationId,
        p_merge_ids: selectedIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast("Tickets mesclados com sucesso");
      setSelectedIds([]);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao mesclar tickets: ${err.message}`);
    },
  });

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Mesclar Tickets
            {ticketNumber != null && (
              <span className="text-muted-foreground font-normal text-sm">
                — #{ticketNumber}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Selecione os tickets que deseja mesclar com o ticket atual.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {!helpdeskClientId ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Este ticket não está vinculado a um cliente. Vincule primeiro para poder mesclar.
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum outro ticket encontrado para este cliente.
            </p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {candidates.map((ticket) => (
                <label
                  key={ticket.id}
                  className="flex items-center gap-3 px-2 py-2.5 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.includes(ticket.id)}
                    onCheckedChange={() => toggleId(ticket.id)}
                  />
                  <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">
                    #{ticket.ticket_number}
                  </span>
                  <span className="text-sm truncate flex-1">
                    {ticket.customer_name || ticket.customer_phone || "Sem nome"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    {ticket.status}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {ticket.started_at ? formatDate(ticket.started_at) : "—"}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="relative">
          {selectedIds.length > 0 ? (
            <div className="w-full flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.length} ticket{selectedIds.length > 1 ? 's' : ''} selecionado{selectedIds.length > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                  Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={() => mergeMutation.mutate()}
                  disabled={mergeMutation.isPending}
                  className="bg-primary text-primary-foreground"
                >
                  {mergeMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  <GitMerge className="h-4 w-4 mr-1" />
                  Mesclar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
