import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";

interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  url: string;
}

// Extract first URL from text
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/(https?:\/\/[^\s<]+)/i);
  return match ? match[1] : null;
}

export function LinkPreview({ url }: { url: string }) {
  const { data, isLoading, isError } = useQuery<LinkPreviewData>({
    queryKey: ["link-preview", url],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("link-preview", {
        body: { url },
      });
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mt-2 rounded-lg border border-border overflow-hidden max-w-[360px]">
        <Skeleton className="w-full h-[140px]" />
        <div className="p-2.5 space-y-1.5">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      </div>
    );
  }

  if (isError || !data?.title) return null;

  const domain = data.siteName || (() => {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-lg border border-border overflow-hidden max-w-[360px] hover:bg-muted/30 transition-colors group"
    >
      {data.image && (
        <div className="w-full h-[140px] overflow-hidden bg-muted">
          <img
            src={data.image}
            alt={data.title || ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div className="p-2.5 space-y-0.5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          {domain}
        </p>
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
          {data.title}
        </p>
        {data.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}
