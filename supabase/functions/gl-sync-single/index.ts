import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPool } from "npm:mysql2/promise";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Campos comuns entre Mais Simples e Maxpro
const COMMON_FIELDS = [
  "id", "nome", "fantasia", "data_status", "cpf_cnpj", "cidade", "uf",
  "telefone1", "celular", "email", "dt_inclusao", "nome_segmento",
  "status_pessoa", "status_pessoa_id", "contato_principal", "sistema_utilizado",
  "ultima_verificacao", "dias_instalacao", "dias_ult_ver", "dias_de_uso",
  "qtd_login", "engajamento", "tag", "dt_inicio_assinatura",
  "id_contato_active", "id_empresa_active", "dt_atualizacao",
];

const EXTRA_FIELDS = [
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

  for (const f of COMMON_FIELDS) {
    if (f === "id") continue;
    if (row[f] !== undefined && row[f] !== null) {
      mapped[f] = row[f];
    }
  }

  for (const f of EXTRA_FIELDS) {
    const targetField = f === "id_Sprinthub" ? "id_sprinthub" : f;
    if (row[f] !== undefined && row[f] !== null) {
      mapped[targetField] = row[f];
    }
  }

  mapped.support_eligible = (mapped.status_pessoa === 'Ativo');

  return mapped;
}

interface SyncSingleRequest {
  cpf_cnpj?: string;
  gl_id?: number;
  phone?: string;
}

async function querySingleFromMySQL(
  host: string,
  port: number,
  user: string,
  password: string,
  database: string,
  source: string,
  req: SyncSingleRequest
): Promise<Record<string, any>[]> {
  const pool = createPool({
    host, port, user, password, database,
    connectionLimit: 1,
    connectTimeout: 5000,
    waitForConnections: true,
  });

  try {
    let query = "SELECT * FROM view_registro_login WHERE ";
    const params: any[] = [];

    if (req.cpf_cnpj) {
      const digits = req.cpf_cnpj.replace(/\D/g, '');
      query += "REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?";
      params.push(digits);
    } else if (req.gl_id) {
      query += "id = ?";
      params.push(req.gl_id);
    } else if (req.phone) {
      const digits = req.phone.replace(/\D/g, '');
      const last8 = digits.slice(-8);
      query += "(telefone1 LIKE ? OR celular LIKE ?)";
      params.push(`%${last8}%`, `%${last8}%`);
    } else {
      return [];
    }

    query += " LIMIT 5";
    const [rows] = await pool.query(query, params) as [any[], any];
    return rows.map((row: any) => mapRow(row, source));
  } finally {
    await pool.end().catch(() => {});
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SyncSingleRequest = await req.json();

    if (!body.cpf_cnpj && !body.gl_id && !body.phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Informe cpf_cnpj, gl_id ou phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar debounce: se já sincronizou nos últimos 5 minutos, retornar cache
    if (body.cpf_cnpj) {
      const digits = body.cpf_cnpj.replace(/\D/g, '');
      const { data: existing } = await supabase
        .from("gl_client_licenses")
        .select("id, synced_at")
        .eq("cpf_cnpj", digits)
        .order("synced_at", { ascending: false })
        .limit(1)
        .single();

      if (existing?.synced_at) {
        const lastSync = new Date(existing.synced_at).getTime();
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        if (lastSync > fiveMinAgo) {
          return new Response(
            JSON.stringify({ success: true, source: "cache", message: "Sincronizado recentemente", synced_at: existing.synced_at }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Buscar de ambas as fontes MySQL
    const results: Record<string, any>[] = [];

    const sources = [
      {
        name: "mais_simples",
        host: Deno.env.get("GL_MS_MYSQL_HOST"),
        port: parseInt(Deno.env.get("GL_MS_MYSQL_PORT") || "3306"),
        user: Deno.env.get("GL_MS_MYSQL_USER"),
        password: Deno.env.get("GL_MS_MYSQL_PASSWORD"),
        database: Deno.env.get("GL_MS_MYSQL_DATABASE"),
      },
      {
        name: "maxpro",
        host: Deno.env.get("GL_MX_MYSQL_HOST"),
        port: parseInt(Deno.env.get("GL_MX_MYSQL_PORT") || "3306"),
        user: Deno.env.get("GL_MX_MYSQL_USER"),
        password: Deno.env.get("GL_MX_MYSQL_PASSWORD"),
        database: Deno.env.get("GL_MX_MYSQL_DATABASE"),
      },
    ];

    for (const src of sources) {
      if (!src.host || !src.user || !src.password || !src.database) {
        console.log(`[gl-sync-single] ${src.name}: env vars não configuradas, pulando`);
        continue;
      }

      try {
        const rows = await querySingleFromMySQL(
          src.host, src.port, src.user!, src.password!, src.database!, src.name, body
        );
        results.push(...rows);
      } catch (err) {
        console.error(`[gl-sync-single] ${src.name} error:`, err);
      }
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ success: true, found: false, message: "Nenhum registro encontrado no GL" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert no Supabase
    const { error } = await supabase
      .from("gl_client_licenses")
      .upsert(results, {
        onConflict: "gl_id,source_system",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("[gl-sync-single] upsert error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: true,
        synced: results.length,
        records: results.map(r => ({ gl_id: r.gl_id, source_system: r.source_system, status_pessoa: r.status_pessoa, nome: r.nome })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[gl-sync-single] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
