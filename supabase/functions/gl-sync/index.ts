import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPool } from "npm:mysql2/promise";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  source?: "mais_simples" | "maxpro" | "both";
  full_sync?: boolean; // se true, sincroniza tudo; se false, apenas alterados
}

interface SyncStats {
  source: string;
  total_fetched: number;
  upserted: number;
  errors: number;
  duration_ms: number;
  max_dt_atualizacao: string | null;
}

// Campos comuns entre Mais Simples e Maxpro
const COMMON_FIELDS = [
  "id", "nome", "fantasia", "data_status", "cpf_cnpj", "cidade", "uf",
  "telefone1", "celular", "email", "dt_inclusao", "nome_segmento",
  "status_pessoa", "status_pessoa_id", "contato_principal", "sistema_utilizado",
  "ultima_verificacao", "dias_instalacao", "dias_ult_ver", "dias_de_uso",
  "qtd_login", "engajamento", "tag", "dt_inicio_assinatura",
  "id_contato_active", "id_empresa_active", "dt_atualizacao",
];

// Campos exclusivos do Mais Simples
const MS_EXTRA_FIELDS = [
  "telefone2", "crm_data_ultima_sicronizacao", "empresa_id",
  "id_plano", "id_segmento", "email_valido", "id_Sprinthub",
  "dias_status_atual", "dias_assinatura", "ltv_dias",
];

function mapRow(row: any, source: string): Record<string, any> {
  const mapped: Record<string, any> = {
    gl_id: row.id,
    source_system: source,
    synced_at: new Date().toISOString(),
  };

  // Campos comuns
  for (const f of COMMON_FIELDS) {
    if (f === "id") continue; // já mapeado como gl_id
    if (row[f] !== undefined && row[f] !== null) {
      mapped[f] = row[f];
    }
  }

  // Campos extras (originalmente só MS, mas tenta para ambas as fontes)
  for (const f of MS_EXTRA_FIELDS) {
    const targetField = f === "id_Sprinthub" ? "id_sprinthub" : f;
    if (row[f] !== undefined && row[f] !== null) {
      mapped[targetField] = row[f];
    }
  }

  // Computar support_eligible a partir do status
  mapped.support_eligible = (mapped.status_pessoa === 'Ativo');

  return mapped;
}

async function syncSource(
  mysqlHost: string,
  mysqlPort: number,
  mysqlUser: string,
  mysqlPassword: string,
  mysqlDatabase: string,
  source: string,
  supabase: any,
  fullSync: boolean,
  lastSyncedAt: string | null
): Promise<SyncStats> {
  const startTime = Date.now();
  const stats: SyncStats = { source, total_fetched: 0, upserted: 0, errors: 0, duration_ms: 0, max_dt_atualizacao: null };

  let pool;
  try {
    pool = createPool({
      host: mysqlHost,
      port: mysqlPort,
      user: mysqlUser,
      password: mysqlPassword,
      database: mysqlDatabase,
      connectionLimit: 2,
      connectTimeout: 10000,
      waitForConnections: true,
    });

    // Query: sync incremental (por dt_atualizacao) ou full
    let query = "SELECT * FROM view_registro_login";
    const params: any[] = [];

    if (!fullSync && lastSyncedAt) {
      query += " WHERE dt_atualizacao > ?";
      params.push(lastSyncedAt);
    }

    const [rows] = await pool.query(query, params) as [any[], any];
    stats.total_fetched = rows.length;

    // Log de diagnóstico: verificar campos disponíveis no MySQL
    if (rows.length > 0) {
      const sample = rows[0];
      const allFields = [...COMMON_FIELDS, ...MS_EXTRA_FIELDS];
      const nullFields = allFields.filter(f => sample[f] === null || sample[f] === undefined);
      console.log(`[gl-sync] ${source}: campos disponíveis: ${Object.keys(sample).join(', ')}`);
      if (nullFields.length > 0) {
        console.log(`[gl-sync] ${source}: campos NULL/missing na amostra: ${nullFields.join(', ')}`);
      }
    }

    if (rows.length === 0) {
      console.log(`[gl-sync] ${source}: nenhum registro para sincronizar`);
      stats.duration_ms = Date.now() - startTime;
      return stats;
    }

    // Rastrear max dt_atualizacao da fonte
    let maxDt: string | null = null;
    for (const row of rows) {
      if (row.dt_atualizacao) {
        const val = typeof row.dt_atualizacao === "string"
          ? row.dt_atualizacao
          : new Date(row.dt_atualizacao).toISOString();
        if (!maxDt || val > maxDt) {
          maxDt = val;
        }
      }
    }
    stats.max_dt_atualizacao = maxDt;

    console.log(`[gl-sync] ${source}: ${rows.length} registros para processar (max_dt_atualizacao: ${maxDt})`);

    // Processar em batches de 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const mappedBatch = batch.map((row: any) => mapRow(row, source));

      // Primeira tentativa
      let { error } = await supabase
        .from("gl_client_licenses")
        .upsert(mappedBatch, {
          onConflict: "gl_id,source_system",
          ignoreDuplicates: false,
        });

      // Retry uma vez em caso de erro
      if (error) {
        console.warn(`[gl-sync] ${source} batch ${i}-${i + batch.length} failed, retrying...`, error.message);
        const retry = await supabase
          .from("gl_client_licenses")
          .upsert(mappedBatch, {
            onConflict: "gl_id,source_system",
            ignoreDuplicates: false,
          });
        error = retry.error;
      }

      if (error) {
        console.error(`[gl-sync] ${source} batch ${i}-${i + batch.length} error after retry:`, error.message);
        stats.errors += batch.length;
      } else {
        stats.upserted += batch.length;
      }
    }
  } catch (err) {
    console.error(`[gl-sync] ${source} connection/query error:`, err);
    stats.errors = -1; // indica erro de conexão
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
  }

  stats.duration_ms = Date.now() - startTime;
  return stats;
}

async function getLastSyncedAt(supabase: any, source: string): Promise<string | null> {
  const { data } = await supabase
    .from("customer_sync_log")
    .select("last_source_updated_at")
    .eq("source", source)
    .eq("sync_type", "incremental")
    .is("error_details", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data?.last_source_updated_at || null;
}

async function insertSyncLog(
  supabase: any,
  stats: SyncStats,
  syncType: "full" | "incremental",
  errorMessage: string | null
): Promise<void> {
  const { error } = await supabase
    .from("customer_sync_log")
    .insert({
      sync_type: syncType,
      source: stats.source,
      total_processed: stats.total_fetched,
      total_created: stats.upserted,
      total_updated: 0,
      total_errors: Math.max(0, stats.errors),
      duration_ms: stats.duration_ms,
      error_details: errorMessage,
      last_source_updated_at: stats.max_dt_atualizacao,
    });

  if (error) {
    console.error(`[gl-sync] Failed to insert sync log for ${stats.source}:`, error.message);
  }
}

// v1 — GL Sync: sincroniza view_registro_login dos bancos MySQL para gl_client_licenses
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ version: "v1", status: "ok", description: "GL MySQL sync to Supabase", ts: Date.now() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parâmetros
    let body: SyncRequest = {};
    try {
      body = await req.json();
    } catch {
      // body vazio = sync both incremental
    }

    const source = body.source || "both";
    const fullSync = body.full_sync ?? false;
    const syncType = fullSync ? "full" : "incremental";

    const results: SyncStats[] = [];

    // ============ MAIS SIMPLES ============
    if (source === "mais_simples" || source === "both") {
      const msHost = Deno.env.get("GL_MS_MYSQL_HOST");
      const msPort = parseInt(Deno.env.get("GL_MS_MYSQL_PORT") || "3306");
      const msUser = Deno.env.get("GL_MS_MYSQL_USER");
      const msPass = Deno.env.get("GL_MS_MYSQL_PASSWORD");
      const msDb = Deno.env.get("GL_MS_MYSQL_DATABASE");

      if (msHost && msUser && msPass && msDb) {
        // Buscar último sync incremental para esta fonte
        const msLastSyncedAt = fullSync ? null : await getLastSyncedAt(supabase, "mais_simples");
        const msStats = await syncSource(msHost, msPort, msUser, msPass, msDb, "mais_simples", supabase, fullSync, msLastSyncedAt);
        results.push(msStats);
        console.log(`[gl-sync] Mais Simples: ${msStats.upserted} upserted, ${msStats.errors} errors, ${msStats.duration_ms}ms`);

        // Inserir log de sync
        const errorMsg = msStats.errors === -1 ? "Connection/query error" : msStats.errors > 0 ? `${msStats.errors} batch errors` : null;
        await insertSyncLog(supabase, msStats, syncType, errorMsg);
      } else {
        console.warn("[gl-sync] Mais Simples: env vars não configuradas (GL_MS_MYSQL_*)");
        const failStats: SyncStats = { source: "mais_simples", total_fetched: 0, upserted: 0, errors: -1, duration_ms: 0, max_dt_atualizacao: null };
        results.push(failStats);
        await insertSyncLog(supabase, failStats, syncType, "Missing environment variables (GL_MS_MYSQL_*)");
      }
    }

    // ============ MAXPRO ============
    if (source === "maxpro" || source === "both") {
      const mxHost = Deno.env.get("GL_MX_MYSQL_HOST");
      const mxPort = parseInt(Deno.env.get("GL_MX_MYSQL_PORT") || "3306");
      const mxUser = Deno.env.get("GL_MX_MYSQL_USER");
      const mxPass = Deno.env.get("GL_MX_MYSQL_PASSWORD");
      const mxDb = Deno.env.get("GL_MX_MYSQL_DATABASE");

      if (mxHost && mxUser && mxPass && mxDb) {
        // Buscar último sync incremental para esta fonte
        const mxLastSyncedAt = fullSync ? null : await getLastSyncedAt(supabase, "maxpro");
        const mxStats = await syncSource(mxHost, mxPort, mxUser, mxPass, mxDb, "maxpro", supabase, fullSync, mxLastSyncedAt);
        results.push(mxStats);
        console.log(`[gl-sync] Maxpro: ${mxStats.upserted} upserted, ${mxStats.errors} errors, ${mxStats.duration_ms}ms`);

        // Inserir log de sync
        const errorMsg = mxStats.errors === -1 ? "Connection/query error" : mxStats.errors > 0 ? `${mxStats.errors} batch errors` : null;
        await insertSyncLog(supabase, mxStats, syncType, errorMsg);
      } else {
        console.warn("[gl-sync] Maxpro: env vars não configuradas (GL_MX_MYSQL_*)");
        const failStats: SyncStats = { source: "maxpro", total_fetched: 0, upserted: 0, errors: -1, duration_ms: 0, max_dt_atualizacao: null };
        results.push(failStats);
        await insertSyncLog(supabase, failStats, syncType, "Missing environment variables (GL_MX_MYSQL_*)");
      }
    }

    const totalUpserted = results.reduce((s, r) => s + r.upserted, 0);
    const totalErrors = results.reduce((s, r) => s + Math.max(0, r.errors), 0);

    return new Response(
      JSON.stringify({
        success: true,
        sync_type: syncType,
        results,
        summary: {
          total_upserted: totalUpserted,
          total_errors: totalErrors,
          total_duration_ms: results.reduce((s, r) => s + r.duration_ms, 0),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("[gl-sync] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
