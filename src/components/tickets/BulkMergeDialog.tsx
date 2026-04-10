import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface BulkMergeTicket {
  id: string;
  ticket_number?: number | null;
  customer_name?: string | null;
}

interface BulkMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tickets: BulkMergeTicket[];
  onSuccess?: () => void;
}

export function BulkMergeDialog({
  open,
  onOpenChange,
  tickets,
  onSuccess,
}: BulkMergeDialogProps) {
  const [keepId, setKeepId] = useState<string>("");
  const queryClient = useQueryClient();

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!keepId) throw new Error("Selecione o ticket principal");
      const mergeIds = tickets.filter((t) => t.id !== keepId).map((t) => t.id);
      const { error } = await supabase.rpc("merge_tickets" as any, {
        p_keep_id: keepId,
        p_merge_ids: mergeIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Tickets mesclados com sucesso");
      setKeepId("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(`Erro ao mesclar: ${err.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Mesclar {tickets.length} Tickets
          </DialogTitle>
          <DialogDescription>
            Escolha qual ticket será o principal. Os demais serão mesclados nele.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={keepId} onValueChange={setKeepId} className="py-2">
          {tickets.map((ticket) => (
            <label
              key={ticket.id}
              className="flex items-center gap-3 px-3 py-2.5 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors rounded-lg"
            >
              <RadioGroupItem value={ticket.id} id={ticket.id} />
              <Label htmlFor={ticket.id} className="flex items-center gap-2 cursor-pointer flex-1">
                <span className="text-xs font-mono text-muted-foreground">
                  #{ticket.ticket_number ?? "—"}
                </span>
                <span className="text-sm truncate">
                  {ticket.customer_name || "Sem nome"}
                </span>
              </Label>
            </label>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => mergeMutation.mutate()}
            disabled={!keepId || mergeMutation.isPending}
          >
            {mergeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            <GitMerge className="h-4 w-4 mr-1" />
            Mesclar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
