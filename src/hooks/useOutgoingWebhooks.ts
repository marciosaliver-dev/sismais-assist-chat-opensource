import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OutgoingWebhook {
  id: string;
  name: string;
  description: string | null;
  url: string;
  method: string;
  headers: Record<string, string>;
  event_type: string;
  filters: Record<string, any>;
  body_template: string | null;
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export function useOutgoingWebhooks() {
  const queryClient = useQueryClient();

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["outgoing-webhooks"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("outgoing_webhooks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as OutgoingWebhook[];
    },
  });

  const createWebhook = useMutation({
    mutationFn: async (webhook: Partial<OutgoingWebhook>) => {
      const { error } = await (supabase as any)
        .from("outgoing_webhooks")
        .insert(webhook);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoing-webhooks"] });
      toast.success("Webhook de saída criado!");
    },
    onError: () => toast.error("Erro ao criar webhook"),
  });

  const updateWebhook = useMutation({
    mutationFn: async ({ id, ...data }: Partial<OutgoingWebhook> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("outgoing_webhooks")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoing-webhooks"] });
      toast.success("Webhook atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar webhook"),
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("outgoing_webhooks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoing-webhooks"] });
      toast.success("Webhook removido!");
    },
    onError: () => toast.error("Erro ao remover webhook"),
  });

  const testWebhook = async (webhookId: string) => {
    const { data, error } = await supabase.functions.invoke("webhook-sender", {
      body: { test: true, webhook_id: webhookId },
    });
    if (error) throw error;
    return data;
  };

  const useWebhookLogs = (webhookId: string) =>
    useQuery({
      queryKey: ["outgoing-webhook-logs", webhookId],
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from("webhook_logs")
          .select("*")
          .eq("outgoing_webhook_id", webhookId)
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) throw error;
        return data || [];
      },
      enabled: !!webhookId,
    });

  return {
    webhooks,
    isLoading,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    useWebhookLogs,
  };
}
