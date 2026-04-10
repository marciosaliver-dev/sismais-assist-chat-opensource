import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface IncomingWebhook {
  id: string;
  name: string;
  description: string | null;
  token: string;
  is_active: boolean;
  action_mode: string;
  flow_automation_id: string | null;
  actions: any[];
  field_mapping: Record<string, string>;
  template_type: string | null;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  payload: any;
  execution_status: string;
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

export function useIncomingWebhooks() {
  const queryClient = useQueryClient();

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['incoming-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incoming_webhooks' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as IncomingWebhook[];
    },
  });

  const createWebhook = useMutation({
    mutationFn: async (webhook: Partial<IncomingWebhook>) => {
      const { data, error } = await supabase
        .from('incoming_webhooks' as any)
        .insert({
          name: webhook.name || 'Novo Webhook',
          description: webhook.description || null,
          is_active: webhook.is_active ?? true,
          action_mode: webhook.action_mode || 'direct',
          flow_automation_id: webhook.flow_automation_id || null,
          actions: webhook.actions || [],
          field_mapping: webhook.field_mapping || {},
          template_type: webhook.template_type || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as IncomingWebhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-webhooks'] });
      toast.success('Webhook criado!');
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const updateWebhook = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<IncomingWebhook> }) => {
      const { data, error } = await supabase
        .from('incoming_webhooks' as any)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as IncomingWebhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-webhooks'] });
      toast.success('Webhook atualizado!');
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('incoming_webhooks' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-webhooks'] });
      toast.success('Webhook excluído!');
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  return { webhooks, isLoading, createWebhook, updateWebhook, deleteWebhook };
}

export function useWebhookLogs(webhookId: string | null) {
  return useQuery({
    queryKey: ['webhook-logs', webhookId],
    enabled: !!webhookId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_logs' as any)
        .select('*')
        .eq('webhook_id', webhookId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as unknown as WebhookLog[];
    },
  });
}
