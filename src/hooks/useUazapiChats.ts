import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UazapiChat {
  id: string;
  instance_id: string;
  chat_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_picture_url: string | null;
  is_group: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  is_muted: boolean;
  unread_count: number;
  last_message_preview: string | null;
  last_message_time: string | null;
  last_message_from_me: boolean | null;
  created_at: string;
  updated_at: string;
}

export function useUazapiChats(instanceId?: string) {
  const queryClient = useQueryClient();

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["uazapi-chats", instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uazapi_chats")
        .select("*")
        .eq("instance_id", instanceId!)
        .eq("is_archived", false)
        .order("is_pinned", { ascending: false })
        .order("last_message_time", { ascending: false });

      if (error) throw error;
      return data as UazapiChat[];
    },
    enabled: !!instanceId,
  });

  // Realtime
  useEffect(() => {
    if (!instanceId) return;
    const channel = supabase
      .channel(`uazapi-chats-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "uazapi_chats", filter: `instance_id=eq.${instanceId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["uazapi-chats", instanceId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, queryClient]);

  const pinChat = useMutation({
    mutationFn: async ({ chatId, pinned }: { chatId: string; pinned: boolean }) => {
      const { error } = await supabase.from("uazapi_chats").update({ is_pinned: pinned }).eq("id", chatId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["uazapi-chats"] }),
  });

  const archiveChat = useMutation({
    mutationFn: async ({ chatId, archived }: { chatId: string; archived: boolean }) => {
      const { error } = await supabase.from("uazapi_chats").update({ is_archived: archived }).eq("id", chatId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["uazapi-chats"] }),
  });

  return { chats, isLoading, pinChat, archiveChat };
}
