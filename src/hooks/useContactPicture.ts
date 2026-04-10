import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContactPicture(
  chatId: string | undefined,
  chatJid: string | undefined,
  instanceId: string | undefined,
  currentPictureUrl: string | null | undefined,
  customerPhone?: string | null
) {
  const { data: fetchedUrl, isLoading } = useQuery({
    queryKey: ["contact-picture", chatJid || customerPhone],
    queryFn: async () => {
      try {
        // Use whatsapp-sync-avatars for cached fetching
        const phone = customerPhone || chatJid?.replace("@s.whatsapp.net", "").replace("@g.us", "").replace("@lid", "");
        if (!phone || !instanceId) return null;

        const { data, error } = await supabase.functions.invoke("whatsapp-sync-avatars", {
          body: { instance_id: instanceId, phone },
        });
        if (error) return null;
        return data?.avatar_url || null;
      } catch {
        return null;
      }
    },
    enabled: !!instanceId && !currentPictureUrl && !!(chatJid || customerPhone),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    url: currentPictureUrl || fetchedUrl || null,
    isLoading: isLoading && !currentPictureUrl && !!(chatJid || customerPhone),
  };
}
