import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UazapiMessage {
  id: string;
  instance_id: string;
  chat_id: string;
  message_id: string;
  from_me: boolean;
  sender_phone: string | null;
  sender_name: string | null;
  type: string;
  text_body: string | null;
  caption: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  media_size: number | null;
  media_filename: string | null;
  thumbnail_url: string | null;
  quoted_message_id: string | null;
  buttons: unknown | null;
  list_data: unknown | null;
  location: unknown | null;
  contacts: unknown | null;
  status: string;
  timestamp: string;
  created_at: string;
}

export function useUazapiMessages(chatId?: string) {
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["uazapi-messages", chatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uazapi_messages")
        .select("*")
        .eq("chat_id", chatId!)
        .order("timestamp", { ascending: true });

      if (error) throw error;
      return data as UazapiMessage[];
    },
    enabled: !!chatId,
  });

  // Realtime
  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`uazapi-msgs-${chatId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "uazapi_messages", filter: `chat_id=eq.${chatId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["uazapi-messages", chatId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async (payload: { chatJid: string; type: string; text?: string; mediaUrl?: string; filename?: string; instanceId: string }) => {
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: { action: "sendMessage", ...payload },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uazapi-messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["uazapi-chats"] });
    },
    onError: (e) => toast.error("Erro ao enviar: " + (e as Error).message),
  });

  return { messages, isLoading, sendMessage };
}
