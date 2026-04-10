import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContactForAvatar {
  contact_phone: string | null;
  instance_id: string | null;
  contact_picture_url: string | null;
}

export function useContactAvatarBatch(contacts: ContactForAvatar[]) {
  const needsFetch = contacts.filter(
    (c) => c.instance_id && c.contact_phone && !c.contact_picture_url
  );

  // Group by instance_id
  const instanceGroups = needsFetch.reduce<Record<string, string[]>>((acc, c) => {
    const iid = c.instance_id!;
    if (!acc[iid]) acc[iid] = [];
    const phone = c.contact_phone!.replace(/@.+$/, "").replace(/\D/g, "");
    if (phone && !acc[iid].includes(phone)) acc[iid].push(phone);
    return acc;
  }, {});

  const instanceId = Object.keys(instanceGroups)[0];
  const phones = instanceId ? instanceGroups[instanceId].slice(0, 50) : [];

  const { data: avatarMap } = useQuery({
    queryKey: ["contact-avatar-batch", instanceId, phones.join(",")],
    queryFn: async () => {
      if (!instanceId || phones.length === 0) return new Map<string, string>();

      const { data, error } = await supabase.functions.invoke("whatsapp-sync-avatars", {
        body: {
          instance_id: instanceId,
          batch: phones.map((p) => ({ phone: p })),
        },
      });

      if (error || !data?.results) return new Map<string, string>();

      const map = new Map<string, string>();
      for (const r of data.results) {
        if (r.avatar_url) {
          map.set(r.phone, r.avatar_url);
        }
      }
      return map;
    },
    enabled: phones.length > 0,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return avatarMap ?? new Map<string, string>();
}
