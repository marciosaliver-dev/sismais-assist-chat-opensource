import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface WebhookPayload {
  event: "status_changed" | "client_updated" | "client_created";
  data: {
    gl_id: number;
    source_system: "mais_simples" | "maxpro";
    status_pessoa?: string;
    nome?: string;
    fantasia?: string;
    cpf_cnpj?: string;
    email?: string;
    telefone1?: string;
    celular?: string;
    sistema_utilizado?: string;
    [key: string]: any;
  };
  timestamp?: string;
}

// v1 — GL Status Webhook: recebe notificações de mudança de status do GL
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        version: "v1",
        status: "ok",
        description: "GL Status Webhook Receiver",
        ts: Date.now(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  try {
    // Autenticação: aceita x-webhook-secret OU Authorization Bearer service role
    const webhookSecret = req.headers.get("x-webhook-secret");
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("GL_WEBHOOK_SECRET");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const validWebhookSecret = expectedSecret && webhookSecret === expectedSecret;
    const validBearer =
      authHeader?.startsWith("Bearer ") &&
      authHeader.slice(7) === serviceRoleKey;

    if (!validWebhookSecret && !validBearer) {
      console.log("[gl-status-webhook] 401 — autenticação inválida");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const payload: WebhookPayload = await req.json();
    const { event, data, timestamp } = payload;

    console.log(`[gl-status-webhook] Evento recebido: ${event}, gl_id=${data?.gl_id}, source_system=${data?.source_system}, ts=${timestamp || new Date().toISOString()}`);

    // Validação dos campos obrigatórios
    if (!data?.gl_id || !data?.source_system) {
      console.log("[gl-status-webhook] 400 — gl_id ou source_system ausentes");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: data.gl_id and data.source_system" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { gl_id, source_system } = data;

    // Estratégia 1: upsert direto se status_pessoa e nome presentes
    if (data.status_pessoa && data.nome) {
      console.log(`[gl-status-webhook] Estratégia: direct_upsert para gl_id=${gl_id}`);

      const support_eligible = data.status_pessoa === "Ativo";
      const synced_at = new Date().toISOString();

      const record: Record<string, any> = {
        gl_id,
        source_system,
        synced_at,
        support_eligible,
      };

      // Copiar todos os campos conhecidos presentes no payload
      const knownFields = [
        "nome", "fantasia", "data_status", "cpf_cnpj", "cidade", "uf",
        "telefone1", "celular", "email", "dt_inclusao", "nome_segmento",
        "status_pessoa", "status_pessoa_id", "contato_principal",
        "sistema_utilizado", "ultima_verificacao", "dias_instalacao",
        "dias_ult_ver", "dias_de_uso", "qtd_login", "engajamento", "tag",
        "dt_inicio_assinatura", "id_contato_active", "id_empresa_active",
        "dt_atualizacao", "telefone2", "empresa_id", "id_plano", "id_segmento",
        "email_valido", "dias_status_atual", "dias_assinatura", "ltv_dias",
      ];

      for (const field of knownFields) {
        if (data[field] !== undefined) {
          record[field] = data[field];
        }
      }

      const { error: upsertError } = await supabase
        .from("gl_client_licenses")
        .upsert(record, { onConflict: "gl_id,source_system", ignoreDuplicates: false });

      if (upsertError) {
        console.log(`[gl-status-webhook] Erro no upsert: ${upsertError.message}`);
        await supabase.from("gl_webhook_log").insert({
          event,
          gl_id,
          source_system,
          status_pessoa: data.status_pessoa || null,
          payload: data,
          processing_method: "direct_upsert",
          success: false,
          error_message: upsertError.message,
        }).catch(() => {});
        return new Response(
          JSON.stringify({ success: false, error: upsertError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      console.log(`[gl-status-webhook] direct_upsert concluído para gl_id=${gl_id}, support_eligible=${support_eligible}`);

      // Logar webhook recebido
      await supabase.from("gl_webhook_log").insert({
        event,
        gl_id,
        source_system,
        status_pessoa: data.status_pessoa,
        payload: data,
        processing_method: "direct_upsert",
        success: true,
      }).then(({ error }) => {
        if (error) console.log(`[gl-status-webhook] Erro ao logar webhook: ${error.message}`);
      });

      return new Response(
        JSON.stringify({
          success: true,
          method: "direct_upsert",
          gl_id,
          source_system,
          status_pessoa: data.status_pessoa,
          support_eligible,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Estratégia 2: payload parcial — delegar ao gl-sync-single
    console.log(`[gl-status-webhook] Estratégia: sync_single para gl_id=${gl_id}`);

    const { data: syncResult, error: syncError } = await supabase.functions.invoke(
      "gl-sync-single",
      {
        body: {
          gl_id,
          cpf_cnpj: data.cpf_cnpj,
        },
      }
    );

    if (syncError) {
      console.log(`[gl-status-webhook] Erro no gl-sync-single: ${syncError.message}`);
      await supabase.from("gl_webhook_log").insert({
        event,
        gl_id,
        source_system,
        status_pessoa: data.status_pessoa || null,
        payload: data,
        processing_method: "sync_single",
        success: false,
        error_message: syncError.message,
      }).catch(() => {});
      return new Response(
        JSON.stringify({ success: false, error: syncError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`[gl-status-webhook] sync_single concluído para gl_id=${gl_id}`);

    await supabase.from("gl_webhook_log").insert({
      event,
      gl_id,
      source_system,
      status_pessoa: data.status_pessoa || null,
      payload: data,
      processing_method: "sync_single",
      success: true,
    }).then(({ error }) => {
      if (error) console.log(`[gl-status-webhook] Erro ao logar webhook: ${error.message}`);
    });

    return new Response(
      JSON.stringify({
        success: true,
        method: "sync_single",
        gl_id,
        source_system,
        sync_result: syncResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.log(`[gl-status-webhook] Erro inesperado: ${err.message}`);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
