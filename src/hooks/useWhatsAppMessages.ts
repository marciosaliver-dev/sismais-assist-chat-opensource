import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { whatsappService } from "@/services/whatsappService";
import { useEffect } from "react";

export interface Conversation {
  phone: string;
  name: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function useConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["whatsapp-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const conversationsMap = new Map<string, Conversation>();

      for (const msg of data || []) {
        const existing = conversationsMap.get(msg.from_phone);
        if (!existing) {
          conversationsMap.set(msg.from_phone, {
            phone: msg.from_phone,
            name: null,
            lastMessage: msg.text_body || "",
            lastMessageAt: msg.created_at,
            unreadCount: msg.direction === "inbound" && msg.status !== "read" ? 1 : 0,
          });
        } else if (msg.direction === "inbound" && msg.status !== "read") {
          existing.unreadCount++;
        }
      }

      return Array.from(conversationsMap.values()).sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-messages-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useMessages(phone: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["whatsapp-messages", phone],
    queryFn: async () => {
      if (!phone) return [];

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .or(`from_phone.eq.${phone},to_phone.eq.${phone}`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!phone,
  });

  useEffect(() => {
    if (!phone) return;

    const channel = supabase
      .channel(`messages-${phone}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", phone] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phone, queryClient]);

  return query;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: whatsappService.sendMessage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", variables.phone] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
  });
}
