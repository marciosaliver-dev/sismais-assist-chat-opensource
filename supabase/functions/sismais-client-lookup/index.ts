import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LookupRequest {
  action: "lookup" | "explore" | "update" | "contracts" | "import" | "import-execute";
  phone?: string;
  documento?: string;
  external_id?: string;
  nome?: string;
  email?: string;
  fantasia?: string;
  update_data?: Record<string, unknown>;
  search?: string;
  only_clients?: boolean;
  limit?: number;
  ids?: string[];
  include_contracts?: boolean;
}

// Helper: discover the correct table name in the external DB
const CANDIDATE_TABLES = ["pessoas", "leads", "clientes", "contatos", "customers", "contacts"];
async function discoverTable(db: any): Promise<string | null> {
  for (const t of CANDIDATE_TABLES) {
    const { error } = await db.from(t).select("id").limit(1);
    if (!error) return t;
  }
  return null;
}

// v10 – added import & import-execute actions
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ version: "v10", status: "ok", ts: Date.now() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const localSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await localSupabase.auth.getUser(token);
    if (authError || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalUrl = Deno.env.get("SISMAIS_GL_SUPABASE_URL");
    const externalKey = Deno.env.get("SISMAIS_GL_SERVICE_ROLE_KEY");

    if (!externalUrl || !externalKey) {
      return new Response(JSON.stringify({ error: "External DB not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalDb = createClient(externalUrl, externalKey, {
      global: { headers: { apikey: externalKey, Authorization: `Bearer ${externalKey}` } },
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch (parseErr) {
      console.error(`[sismais-client-lookup] JSON parse error:`, parseErr);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Robust payload extraction
    let payload: Record<string, unknown>;
    if (typeof rawBody === 'string') {
      try { payload = JSON.parse(rawBody); } catch (_) { payload = {}; }
    } else {
      payload = (rawBody as Record<string, unknown>) || {};
    }
    
    for (let i = 0; i < 5 && payload && !payload.action; i++) {
      const inner = (payload as any)?.body;
      if (!inner) break;
      if (typeof inner === 'string') {
        try { payload = JSON.parse(inner); } catch (_) { break; }
      } else {
        payload = inner;
      }
    }

    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload as unknown as string); } catch (_) { payload = {}; }
    }

    console.log('[sismais-client-lookup] v10 action:', payload?.action, 'has_phone:', !!payload?.phone, 'has_documento:', !!payload?.documento);

    if (!payload?.action) {
      return new Response(JSON.stringify({ error: "Missing action field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const actionStr = String(payload.action).trim().toLowerCase();
    const normalizedAction = actionStr === "profile" ? "lookup" : actionStr;
    if (!["lookup", "explore", "update", "contracts", "import", "import-execute"].includes(normalizedAction)) {
      return new Response(JSON.stringify({ error: "Invalid action", received_action: payload.action }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const body = { ...payload, action: normalizedAction } as unknown as LookupRequest;

    switch (body.action) {
      // ==================== IMPORT: Search leads for batch import ====================
      case "import": {
        const search = (body.search || "").trim();
        const onlyClients = body.only_clients ?? false;
        const limit = Math.min(body.limit || 50, 200);

        const tableName = await discoverTable(externalDb);
        if (!tableName) {
          return new Response(JSON.stringify({ error: "No compatible table found in external DB", tried: CANDIDATE_TABLES }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log("[import] using table:", tableName, "| only_clients:", onlyClients, "| search_length:", search.length);
        

        // First try with all desired columns, fallback to minimal if it fails
        let query = externalDb
          .from(tableName)
          .select("id, nome, fantasia, documento, email_principal, telefone1, is_cliente")
          .order("nome", { ascending: true })
          .limit(limit);

        if (onlyClients) {
          query = query.eq("is_cliente", true);
        }

        if (search.length >= 2) {
          const term = `%${search}%`;
          query = query.or(`nome.ilike.${term},fantasia.ilike.${term},documento.ilike.${term},email_principal.ilike.${term},telefone1.ilike.${term}`);
        }

        const { data, error } = await query;
        console.log("[import] query result: rows=", data?.length ?? 0, "error=", error?.message ?? "none");
        
        if (error) {
          // If column error, try minimal select
          console.error("[import] query error:", error.message);
          const { data: fallbackData, error: fallbackError } = await externalDb
            .from(tableName)
            .select("id, nome, fantasia, documento, telefone1, is_cliente")
            .order("nome", { ascending: true })
            .limit(limit);
          
          if (fallbackError) {
            console.error("[import] fallback query error:", fallbackError.message);
            return new Response(JSON.stringify({ error: "Query failed", details: fallbackError.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          
          // Use fallback data
          const fallbackResults = (fallbackData || []).map((d: any) => ({ ...d, email_principal: null }));
          const extIds = fallbackResults.map((d: any) => String(d.id));
          let existIds: string[] = [];
          if (extIds.length > 0) {
            const { data: existing } = await serviceSupabase
              .from("helpdesk_clients")
              .select("external_id")
              .in("external_id", extIds);
            existIds = (existing || []).map((e: any) => e.external_id);
          }
          return new Response(JSON.stringify({
            success: true,
            results: fallbackResults,
            total: fallbackResults.length,
            existing_ids: existIds,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check which ones already exist locally
        const externalIds = (data || []).map((d: any) => String(d.id));
        let existingIds: string[] = [];
        if (externalIds.length > 0) {
          const { data: existing } = await serviceSupabase
            .from("helpdesk_clients")
            .select("external_id")
            .in("external_id", externalIds);
          existingIds = (existing || []).map((e: any) => e.external_id);
        }

        return new Response(JSON.stringify({
          success: true,
          results: data || [],
          total: (data || []).length,
          existing_ids: existingIds,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ==================== IMPORT-EXECUTE: Actually import selected leads ====================
      case "import-execute": {
        const ids = body.ids || [];
        const includeContracts = body.include_contracts ?? false;

        if (ids.length === 0) {
          return new Response(JSON.stringify({ error: "No IDs provided" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const extTableName = await discoverTable(externalDb);
        if (!extTableName) {
          return new Response(JSON.stringify({ error: "No compatible table found in external DB" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const results: { id: string; name: string; status: "created" | "updated" | "error"; error?: string; contracts_imported?: number }[] = [];

        for (const extId of ids) {
          try {
            // Fetch full lead data
            const { data: lead, error: leadErr } = await externalDb
              .from(extTableName)
              .select("*")
              .eq("id", extId)
              .maybeSingle();

            if (leadErr || !lead) {
              results.push({ id: extId, name: "?", status: "error", error: leadErr?.message || "Not found" });
              continue;
            }

            // Check if already exists
            const { data: existing } = await serviceSupabase
              .from("helpdesk_clients")
              .select("id")
              .eq("external_id", String(extId))
              .maybeSingle();

            const clientPayload = {
              external_id: String(extId),
              name: lead.nome || lead.fantasia || "Sem nome",
              company_name: lead.fantasia || null,
              cnpj: lead.documento || null,
              cpf: lead.cpf || null,
              email: lead.email_principal || null,
              phone: lead.telefone1 || null,
              notes: lead.observacoes || null,
            };

            let clientId: string;
            let opStatus: "created" | "updated";

            if (existing) {
              const { error: upErr } = await serviceSupabase
                .from("helpdesk_clients")
                .update(clientPayload)
                .eq("id", existing.id);
              if (upErr) throw upErr;
              clientId = existing.id;
              opStatus = "updated";
            } else {
              const { data: inserted, error: insErr } = await serviceSupabase
                .from("helpdesk_clients")
                .insert(clientPayload)
                .select("id")
                .single();
              if (insErr) throw insErr;
              clientId = inserted.id;
              opStatus = "created";
            }

            let contractsImported = 0;

            // Import contracts if requested
            if (includeContracts) {
              const contractTables = ["contratos", "contracts", "servicos"];
              for (const table of contractTables) {
                try {
                  let { data: contracts } = await externalDb
                    .from(table)
                    .select("*")
                    .eq("lead_id", extId);
                  
                  if (!contracts || contracts.length === 0) {
                    const { data: c2 } = await externalDb
                      .from(table)
                      .select("*")
                      .eq("cliente_id", extId);
                    contracts = c2;
                  }

                  if (contracts && contracts.length > 0) {
                    for (const c of contracts) {
                      const contractPayload = {
                        client_id: clientId,
                        contract_name: c.descricao || c.nome || c.plano || `Contrato ${c.id}`,
                        plan_name: c.plano || c.tipo || null,
                        start_date: c.data_inicio || c.created_at || null,
                        end_date: c.data_fim || c.validade || null,
                        status: c.status || c.situacao || "active",
                        monthly_value: c.valor_mensal || c.valor || null,
                        notes: c.observacoes || null,
                      };

                      await serviceSupabase
                        .from("helpdesk_client_contracts")
                        .upsert(contractPayload, { onConflict: "client_id,contract_name" })
                        .select();
                      
                      contractsImported++;
                    }
                    break; // Found contracts in this table, stop trying others
                  }
                } catch {
                  // Table doesn't exist, try next
                }
              }
            }

            results.push({ id: extId, name: clientPayload.name, status: opStatus, contracts_imported: contractsImported });
          } catch (err: any) {
            results.push({ id: extId, name: "?", status: "error", error: err?.message || "Unknown error" });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          results,
          total: ids.length,
          created: results.filter(r => r.status === "created").length,
          updated: results.filter(r => r.status === "updated").length,
          errors: results.filter(r => r.status === "error").length,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ==================== EXISTING ACTIONS (unchanged) ====================
      case "explore": {
        const tables = ["leads", "clientes", "pessoas", "contatos", "customers", "contacts"];
        const results: Record<string, unknown> = {};

        for (const table of tables) {
          try {
            const { data, error } = await externalDb
              .from(table)
              .select("*")
              .limit(1);
            if (!error && data) {
              results[table] = {
                exists: true,
                columns: data.length > 0 ? Object.keys(data[0]) : [],
                sample: data[0] || null,
              };
            }
          } catch {
            // Table doesn't exist
          }
        }

        return new Response(JSON.stringify({ success: true, tables: results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "lookup": {
        const { phone, documento, external_id, nome, email, fantasia } = body;
        if (!phone && !documento && !external_id && !nome && !email && !fantasia) {
          return new Response(JSON.stringify({ error: "At least one search field required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let cachedProfile = null;
        if (phone) {
          const phoneVariants = [phone];
          if (phone.startsWith("55")) phoneVariants.push(phone.slice(2));
          if (!phone.startsWith("55")) phoneVariants.push("55" + phone);

          for (const pv of phoneVariants) {
            const { data } = await serviceSupabase
              .from("customer_profiles")
              .select("*")
              .eq("phone", pv)
              .maybeSingle();
            if (data) { cachedProfile = data; break; }
          }
        } else if (documento) {
          const { data } = await serviceSupabase
            .from("customer_profiles")
            .select("*")
            .eq("documento", documento)
            .maybeSingle();
          cachedProfile = data;
        }

        if (cachedProfile?.last_synced_at) {
          const syncedAt = new Date(cachedProfile.last_synced_at);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (syncedAt > hourAgo) {
            return new Response(JSON.stringify({ success: true, data: cachedProfile, source: "cache" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        const lookupTable = await discoverTable(externalDb);
        if (!lookupTable) {
          return new Response(JSON.stringify({ success: true, data: cachedProfile, source: "cache_only", found: false, reason: "no_external_table" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let externalData = null;
        const phoneClean = phone?.replace(/\D/g, "") || "";

        if (phoneClean) {
          const phoneSearches = [phoneClean];
          if (phoneClean.startsWith("55")) phoneSearches.push(phoneClean.slice(2));
          if (!phoneClean.startsWith("55")) phoneSearches.push("55" + phoneClean);

          for (const ps of phoneSearches) {
            const { data } = await externalDb
              .from(lookupTable)
              .select("*")
              .ilike("telefone1", `%${ps}%`)
              .maybeSingle();
            if (data) { externalData = data; break; }
          }
        }

        if (!externalData && documento) {
          const { data } = await externalDb
            .from(lookupTable)
            .select("*")
            .eq("documento", documento.replace(/\D/g, ""))
            .maybeSingle();
          externalData = data;
        }

        if (!externalData && nome) {
          const { data } = await externalDb
            .from(lookupTable)
            .select("*")
            .ilike("nome", `%${nome}%`)
            .limit(1)
            .maybeSingle();
          externalData = data;
        }

        if (!externalData && email) {
          const { data } = await externalDb
            .from(lookupTable)
            .select("*")
            .ilike("email_principal", `%${email}%`)
            .maybeSingle();
          externalData = data;
        }

        if (!externalData && fantasia) {
          const { data } = await externalDb
            .from(lookupTable)
            .select("*")
            .ilike("fantasia", `%${fantasia}%`)
            .limit(1)
            .maybeSingle();
          externalData = data;
        }

        if (!externalData) {
          return new Response(JSON.stringify({ success: true, data: cachedProfile, source: "cache_only", found: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const profileData = {
          phone: phoneClean || externalData.telefone1?.replace(/\D/g, "") || "",
          external_id: externalData.id,
          nome: externalData.nome || externalData.fantasia,
          documento: externalData.documento,
          email: externalData.email_principal,
          fantasia: externalData.fantasia,
          dados_cadastrais: {
            nome: externalData.nome,
            fantasia: externalData.fantasia,
            documento: externalData.documento,
            email: externalData.email_principal,
            telefone: externalData.telefone1,
            segmento_id: externalData.segmento_id,
            is_cliente: externalData.is_cliente,
            is_afiliado: externalData.is_afiliado,
          },
          raw_data: externalData,
          last_synced_at: new Date().toISOString(),
        };

        const { data: upserted, error: upsertError } = await serviceSupabase
          .from("customer_profiles")
          .upsert(profileData, { onConflict: "phone" })
          .select()
          .single();

        if (upsertError) console.error("Upsert error:", upsertError);

        return new Response(JSON.stringify({
          success: true,
          data: upserted || { ...profileData, ...cachedProfile },
          source: "external",
          found: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "contracts": {
        const { phone, documento, external_id } = body;
        if (!phone && !documento && !external_id) {
          return new Response(JSON.stringify({ success: true, contracts: [], found: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let leadId = external_id;
        if (!leadId) {
          const cTable = await discoverTable(externalDb);
          let lead = null;
          if (cTable && phone) {
            const phoneClean = phone.replace(/\D/g, "");
            const phoneSearches = [phoneClean];
            if (phoneClean.startsWith("55")) phoneSearches.push(phoneClean.slice(2));
            if (!phoneClean.startsWith("55")) phoneSearches.push("55" + phoneClean);
            for (const ps of phoneSearches) {
              const { data } = await externalDb.from(cTable).select("id").ilike("telefone1", `%${ps}%`).maybeSingle();
              if (data) { lead = data; break; }
            }
          }
          if (!lead && cTable && documento) {
            const { data } = await externalDb.from(cTable).select("id").eq("documento", documento.replace(/\D/g, "")).maybeSingle();
            lead = data;
          }
          leadId = lead?.id;
        }

        if (!leadId) {
          return new Response(JSON.stringify({ success: true, contracts: [], found: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const contractTables = ["contratos", "contracts", "servicos"];
        let contracts: unknown[] = [];
        let contractTableName = "";

        for (const table of contractTables) {
          try {
            const { data, error } = await externalDb.from(table).select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
            if (!error && data && data.length > 0) {
              contracts = data;
              contractTableName = table;
              break;
            }
            if (!error) {
              const { data: data2, error: error2 } = await externalDb.from(table).select("*").eq("cliente_id", leadId).order("created_at", { ascending: false });
              if (!error2 && data2 && data2.length > 0) {
                contracts = data2;
                contractTableName = table;
                break;
              }
            }
          } catch { /* skip */ }
        }

        return new Response(JSON.stringify({ success: true, contracts, table: contractTableName, lead_id: leadId, found: contracts.length > 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const { external_id, update_data } = body;
        if (!external_id || !update_data) {
          return new Response(JSON.stringify({ error: "external_id and update_data required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const uTable = await discoverTable(externalDb);
        if (!uTable) {
          return new Response(JSON.stringify({ error: "No compatible table found in external DB" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await externalDb.from(uTable).update(update_data).eq("id", external_id).select().single();

        if (error) {
          return new Response(JSON.stringify({ error: "Update failed", details: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (data) {
          await serviceSupabase.from("customer_profiles").update({
            nome: data.nome,
            documento: data.documento,
            email: data.email_principal,
            fantasia: data.fantasia,
            raw_data: data,
            last_synced_at: new Date().toISOString(),
          }).eq("external_id", external_id);
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("sismais-client-lookup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
