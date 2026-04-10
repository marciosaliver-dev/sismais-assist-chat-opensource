import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UazapiInstance {
  id: string;
  instance_name: string;
  api_url: string;
  api_token: string;
  qr_code: string | null;
  status: string;
  phone_number: string | null;
  profile_name: string | null;
  profile_picture_url: string | null;
  webhook_url: string | null;
  webhook_events: string[] | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useUazapiInstance() {
  const queryClient = useQueryClient();

  const { data: instance, isLoading } = useQuery({
    queryKey: ["uazapi-instance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uazapi_instances")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data as UazapiInstance | null;
    },
    refetchInterval: (query) => {
      const d = query.state.data as UazapiInstance | null | undefined;
      return d?.status === "qrcode" ? 3000 : 15000;
    },
  });

  const saveInstance = useMutation({
    mutationFn: async (data: Partial<UazapiInstance> & { instance_name: string; api_url: string; api_token: string }) => {
      if (instance?.id) {
        const { data: updated, error } = await supabase
          .from("uazapi_instances")
          .update(data)
          .eq("id", instance.id)
          .select()
          .single();
        if (error) throw error;
        return updated;
      } else {
        const { data: created, error } = await supabase
          .from("uazapi_instances")
          .insert({ ...data, is_active: true })
          .select()
          .single();
        if (error) throw error;
        return created;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uazapi-instance"] });
      toast.success("Configuração salva!");
    },
    onError: (e) => toast.error("Erro: " + (e as Error).message),
  });

  const connect = useMutation({
    mutationFn: async () => {
      if (!instance) throw new Error("Nenhuma instância configurada");
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: { action: "connect", instanceId: instance.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.qrcode) {
        supabase
          .from("uazapi_instances")
          .update({ qr_code: data.qrcode, status: "qrcode" })
          .eq("id", instance!.id)
          .then(() => queryClient.invalidateQueries({ queryKey: ["uazapi-instance"] }));
      }
      toast.success("QR Code gerado! Escaneie com o WhatsApp.");
    },
    onError: (e) => toast.error("Erro ao conectar: " + (e as Error).message),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!instance) throw new Error("Nenhuma instância configurada");
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: { action: "disconnect", instanceId: instance.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uazapi-instance"] });
      toast.success("Desconectado!");
    },
    onError: (e) => toast.error("Erro: " + (e as Error).message),
  });

  const checkStatus = useMutation({
    mutationFn: async () => {
      if (!instance) throw new Error("Nenhuma instância configurada");
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: { action: "status", instanceId: instance.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const newStatus = data?.state === "open" ? "connected" : data?.state || "disconnected";
      supabase
        .from("uazapi_instances")
        .update({
          status: newStatus,
          phone_number: data?.phone || instance?.phone_number,
        })
        .eq("id", instance!.id)
        .then(() => queryClient.invalidateQueries({ queryKey: ["uazapi-instance"] }));
    },
  });

  return { instance, isLoading, saveInstance, connect, disconnect, checkStatus };
}

// ===== Multi-instance hook: returns ALL active instances =====
export function useUazapiInstances() {
  const { data: instances, isLoading } = useQuery({
    queryKey: ["uazapi-instances-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uazapi_instances")
        .select("*")
        .eq("is_active", true)
        .order("instance_name");

      if (error) throw error;
      return (data || []) as UazapiInstance[];
    },
    refetchInterval: 30000,
  });

  return { instances: instances ?? [], isLoading };
}
