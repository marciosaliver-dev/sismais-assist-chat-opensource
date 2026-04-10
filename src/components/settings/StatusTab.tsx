import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

type Status = {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  is_default: boolean;
  is_final: boolean;
  sort_order: number;
};

export default function StatusTab() {
  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ["ticket-statuses-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_statuses").select("*").order("sort_order");
      if (error) throw error;
      return data as Status[];
    },
  });

  if (isLoading) return <div className="p-4 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Os status são fixos do sistema e não podem ser editados, criados ou excluídos.
        </p>
      </div>

      <div className="space-y-2">
        {statuses.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="flex-1 text-sm font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{s.slug}</span>
            {s.is_default && (
              <Badge variant="secondary" className="text-xs">Padrão</Badge>
            )}
            {s.is_final && (
              <Badge variant="outline" className="text-xs text-destructive border-destructive/30">Final</Badge>
            )}
            <Badge variant="secondary" className="text-xs">Sistema</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
