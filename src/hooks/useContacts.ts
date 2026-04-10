import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import type { UazapiChat } from "@/hooks/useUazapiChats";

const PAGE_SIZE = 50;

export function useContacts(isGroup: boolean, search: string, instanceId?: string, page: number = 1, sortField: string = "last_message_time", sortDirection: "asc" | "desc" = "desc") {
  const queryClient = useQueryClient();
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["contacts", isGroup, debouncedSearch, instanceId, page, sortField, sortDirection],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("uazapi_chats")
        .select("*", { count: "exact" })
        .eq("is_group", isGroup)
        .eq("is_archived", false)
        .order(sortField, { ascending: sortDirection === "asc" });

      if (instanceId) {
        query = query.eq("instance_id", instanceId);
      }

      if (debouncedSearch) {
        query = query.or(
          `contact_name.ilike.%${debouncedSearch}%,contact_phone.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return {
        contacts: data as (UazapiChat & { is_ignored?: boolean })[],
        totalCount: count ?? 0,
      };
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`contacts-${isGroup}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "uazapi_chats" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["contacts", isGroup] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isGroup, queryClient]);

  const toggleIgnore = useMutation({
    mutationFn: async ({ chatId, ignored }: { chatId: string; ignored: boolean }) => {
      const { error } = await supabase
        .from("uazapi_chats")
        .update({ is_ignored: ignored } as any)
        .eq("id", chatId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  return {
    contacts: data?.contacts ?? [],
    totalCount: data?.totalCount ?? 0,
    isLoading,
    isFetching,
    toggleIgnore,
    pageSize: PAGE_SIZE,
  };
}
