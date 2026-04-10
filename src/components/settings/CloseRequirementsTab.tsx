import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Info, ShieldCheck, Clock, CheckSquare, Sparkles, Shield } from "lucide-react";

const FIELD_DESCRIPTIONS: Record<string, string> = {
  helpdesk_client_id: "Exige que um cliente do helpdesk esteja vinculado antes de encerrar",
  ticket_category_id: "Exige que uma categoria de ticket esteja selecionada",
  ticket_module_id: "Exige que um módulo/procedimento esteja selecionado",
  ticket_subject: "Exige que o assunto do ticket esteja preenchido antes de encerrar",
  resolution_note: "Exige que o agente digite uma anotação de resolução",
  ai_name_validation: "A IA analisa se o nome do contato é válido (rejeita nomes como '.', números de telefone ou caracteres aleatórios)",
  ai_close_review: "A IA analisa toda a conversa e gera uma nota de encerramento estruturada com problema, ações e resolução",
};

const FIELD_LABELS: Record<string, string> = {
  helpdesk_client_id: "Cliente vinculado",
  ticket_category_id: "Categoria do ticket",
  ticket_module_id: "Módulo / Procedimento",
  ticket_subject: "Assunto do ticket",
  resolution_note: "Nota de resolução",
  ai_name_validation: "Validação IA do nome do contato",
  ai_close_review: "Nota de encerramento pela IA",
};

const AI_FIELDS = new Set(["ai_name_validation", "ai_close_review"]);

type Requirement = {
  id: string;
  field_name: string;
  is_required: boolean;
};

export default function CloseRequirementsTab() {
  const queryClient = useQueryClient();

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ["ticket-close-requirements-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_close_requirements").select("*");
      if (error) throw error;
      return data as Requirement[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (req: Requirement) => {
      const { error } = await supabase
        .from("ticket_close_requirements")
        .update({ is_required: !req.is_required })
        .eq("id", req.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-close-requirements-settings"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-close-requirements"] });
      toast.success("Requisito atualizado");
    },
    onError: () => toast.error("Erro ao atualizar requisito"),
  });

  // ─── Post-close settings (grace period + suppress tickets) ───
  const db = supabase as any;
  const { data: postCloseConfigs = [], isLoading: postCloseLoading } = useQuery({
    queryKey: ["post-close-settings"],
    queryFn: async () => {
      const { data, error } = await db
        .from("platform_ai_config")
        .select("id, feature, extra_config")
        .in("feature", ["post_close_grace_minutes", "suppress_post_close_tickets"]);
      if (error) throw error;
      return data as { id: string; feature: string; extra_config: Record<string, unknown> }[];
    },
  });

  const graceConfig = postCloseConfigs.find(c => c.feature === "post_close_grace_minutes");
  const suppressConfig = postCloseConfigs.find(c => c.feature === "suppress_post_close_tickets");
  const graceMinutes = (graceConfig?.extra_config?.minutes as number) ?? 10;
  const smartClassifyEnabled = !!(suppressConfig?.extra_config?.smart_classify ?? true);

  const updatePostCloseConfig = useMutation({
    mutationFn: async ({ feature, extra_config }: { feature: string; extra_config: Record<string, unknown> }) => {
      const existing = postCloseConfigs.find(c => c.feature === feature);
      if (existing) {
        const { error } = await db
          .from("platform_ai_config")
          .update({ extra_config })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from("platform_ai_config")
          .insert({ feature, extra_config });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-close-settings"] });
      toast.success("Configuração atualizada");
    },
    onError: () => toast.error("Erro ao atualizar configuração"),
  });

  if (isLoading) return <div className="p-4 text-muted-foreground text-sm">Carregando...</div>;

  const standardFields = requirements.filter(r => !AI_FIELDS.has(r.field_name));
  const aiFields = requirements.filter(r => AI_FIELDS.has(r.field_name));

  const renderRequirement = (req: Requirement) => {
    const isAI = AI_FIELDS.has(req.field_name);
    return (
      <div key={req.id} className="req-item">
        <div className="req-switch">
          <Switch
            checked={req.is_required}
            onCheckedChange={() => toggle.mutate(req)}
          />
        </div>
        <div className="req-content">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              {FIELD_LABELS[req.field_name] || req.field_name}
            </p>
            {isAI && (
              <Badge variant="outline" className="text-xs gap-1 px-1.5 py-0">
                <Bot className="w-3 h-3" />
                IA
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {FIELD_DESCRIPTIONS[req.field_name] || "Campo obrigatório para encerramento"}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="close-settings">
      {/* Standard field requirements */}
      <div className="close-card">
        <div className="close-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <CheckSquare className="w-5 h-5" />
              Campos Obrigatórios
            </h3>
            <p className="sc-desc">Defina quais campos devem estar preenchidos para encerrar um ticket.</p>
          </div>
        </div>
        <div className="close-card-content">
          {standardFields.map(renderRequirement)}
        </div>
      </div>

      {/* AI-powered validations */}
      {aiFields.length > 0 && (
        <div className="close-card">
          <div className="close-card-header">
            <div className="sc-info">
              <h3 className="sc-title">
                <Sparkles className="w-5 h-5" />
                Validações com IA
              </h3>
              <p className="sc-desc">Validações que utilizam inteligência artificial.</p>
            </div>
          </div>
          <div className="close-card-content">
            <div className="ai-info-box">
              <Info className="w-4 h-4" />
              <p>Estas validações utilizam IA e consomem tokens ao finalizar cada atendimento.</p>
            </div>
            {aiFields.map(renderRequirement)}
          </div>
        </div>
      )}

      {/* Post-close behavior */}
      <div className="close-card">
        <div className="close-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Shield className="w-5 h-5" />
              Comportamento Pós-Encerramento
            </h3>
            <p className="sc-desc">Configure como o sistema trata mensagens após o encerramento.</p>
          </div>
        </div>
        <div className="close-card-content">
          {/* Grace period */}
          <div className="post-item">
            <Clock className="w-5 h-5" />
            <div className="post-content">
              <Label className="text-sm font-medium">Período de tolerância (minutos)</Label>
              <p className="text-xs text-muted-foreground">
                Mensagens como "ok", "obrigado" e emojis são absorvidas sem criar novo ticket.
              </p>
              <Input
                type="number"
                min={1}
                max={1440}
                className="w-24"
                defaultValue={graceMinutes}
                disabled={postCloseLoading}
                onBlur={(e) => {
                  const val = parseInt(e.target.value) || 10;
                  if (val !== graceMinutes) {
                    updatePostCloseConfig.mutate({
                      feature: "post_close_grace_minutes",
                      extra_config: {
                        ...(graceConfig?.extra_config || {}),
                        minutes: Math.max(1, Math.min(1440, val)),
                      },
                    });
                  }
                }}
              />
            </div>
          </div>

          {/* Smart classify */}
          <div className="post-item">
            <div className="post-switch">
              <Switch
                checked={smartClassifyEnabled}
                disabled={postCloseLoading}
                onCheckedChange={(checked) => {
                  updatePostCloseConfig.mutate({
                    feature: "suppress_post_close_tickets",
                    extra_config: { ...(suppressConfig?.extra_config || {}), smart_classify: checked },
                  });
                }}
              />
            </div>
            <div className="post-content">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Classificação inteligente (IA)</p>
                <Badge variant="outline" className="text-xs gap-1 px-1.5 py-0">
                  <Bot className="w-3 h-3" />
                  IA
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mensagens ambíguas dentro do período de tolerância são classificadas pela IA:
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 ml-3 list-disc">
                <li><span className="font-medium text-foreground">CSAT</span> — absorve e processa avaliação</li>
                <li><span className="font-medium text-foreground">Agradecimento</span> — absorve sem criar ticket</li>
                <li><span className="font-medium text-foreground">Novo problema</span> — cria ticket normalmente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .close-settings { display: flex; flex-direction: column; gap: 16px; }
        .close-card { background: #fff; border: 1px solid #E5E5E5; border-radius: 8px; overflow: hidden; }
        .close-card-header { padding: 16px; border-bottom: 1px solid #E5E5E5; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #fff; }
        .close-card-header .sc-info { flex: 1; }
        .close-card-header .sc-title { font-size: 16px; font-weight: 600; color: #10293F; margin: 0; display: flex; align-items: center; gap: 8px; }
        .close-card-header .sc-title .w-5.h-5 { color: #45E5E5; }
        .close-card-header .sc-desc { font-size: 13px; color: #666; margin: 4px 0 0; }
        .close-card-content { padding: 16px; background: #F8FAFC; border-radius: 0 0 8px 8px; }
        .ai-info-box { display: flex; align-items: flex-start; gap: 8px; padding: 12px; background: #E8F9F9; border: 1px solid rgba(69,229,229,0.3); border-radius: 8px; margin-bottom: 16px; color: #10293F; font-size: 13px; }
        .ai-info-box .w-4.h-4 { flex-shrink: 0; margin-top: 2px; }
        .req-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border: 1px solid #E5E5E5; border-radius: 8px; margin-bottom: 8px; }
        .req-item:last-child { margin-bottom: 0; }
        .req-switch { flex-shrink: 0; margin-top: 2px; }
        .req-content { flex: 1; min-width: 0; }
        .post-item { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border: 1px solid #E5E5E5; border-radius: 8px; margin-bottom: 12px; }
        .post-item:last-child { margin-bottom: 0; }
        .post-item > .w-5.h-5 { color: #45E5E5; flex-shrink: 0; margin-top: 2px; }
        .post-switch { flex-shrink: 0; margin-top: 2px; }
        .post-content { flex: 1; min-width: 0; }
      `}</style>
    </div>
  );
}
