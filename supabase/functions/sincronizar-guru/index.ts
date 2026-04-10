import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GURU_BASE_URL = "https://digitalmanager.guru/api/v2";

// Status mapping: Guru → contratos_assinatura
const STATUS_MAP: Record<string, string> = {
  active: "ativo",
  cancelled: "cancelado",
  overdue: "inadimplente",
  suspended: "pausado",
  trial: "trial",
};

// Invoice/Transaction status mapping: Guru → faturas_assinatura
// Guru uses "approved" for paid transactions (not "paid")
const INVOICE_STATUS_MAP: Record<string, string> = {
  paid: "pago",
  approved: "pago",
  confirmed: "pago",
  completed: "pago",
  waiting_payment: "aberto",
  pending: "aberto",
  pastdue: "atrasado",
  overdue: "atrasado",
  canceled: "cancelado",
  cancelled: "cancelado",
  // Correção 7: refunded → "reembolsado" (não "cancelado")
  refunded: "reembolsado",
};

// Interval mapping: Guru → contratos_assinatura
const INTERVAL_MAP: Record<string, string> = {
  MONTHLY: "month",
  YEARLY: "year",
  SEMIANNUALLY: "semi_annual",
  WEEKLY: "month",
  DAILY: "month",
};

// deno-lint-ignore no-explicit-any
type GuruSubscription = Record<string, any>;

interface GuruPaginatedResponse {
  data: GuruSubscription[];
  has_more_pages: number | boolean | string;
  next_cursor?: string;
  total_rows?: number;
}

async function fetchGuruSubscriptions(
  apiKey: string,
  status: string,
  cursor?: string
): Promise<GuruPaginatedResponse> {
  const params = new URLSearchParams({ status, per_page: "100" });
  if (cursor) params.set("cursor", cursor);

  const url = `${GURU_BASE_URL}/subscriptions?${params.toString()}`;
  console.log(`[sincronizar-guru] GET ${url}`);

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "SISMAIS-Admin/1.0",
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Guru API ${resp.status}: ${body}`);
  }

  return resp.json() as Promise<GuruPaginatedResponse>;
}

// deno-lint-ignore no-explicit-any
async function fetchGuruInvoices(apiKey: string, subscriptionId: string): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const allInvoices: any[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({ per_page: "100" });
    if (cursor) params.set("cursor", cursor);

    const url = `${GURU_BASE_URL}/subscriptions/${subscriptionId}/invoices?${params.toString()}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "SISMAIS-Admin/1.0",
      },
    });

    if (!resp.ok) {
      if (resp.status === 404) return allInvoices;
      const body = await resp.text();
      throw new Error(`Guru Invoices API ${resp.status}: ${body}`);
    }

    const json = await resp.json();
    const data = json.data ?? json ?? [];
    if (Array.isArray(data)) {
      allInvoices.push(...data);
    }

    const hasMore =
      json.has_more_pages === 1 ||
      json.has_more_pages === true ||
      json.has_more_pages === "1";

    if (hasMore && json.next_cursor) {
      cursor = json.next_cursor;
    } else {
      break;
    }
  }

  return allInvoices;
}

// deno-lint-ignore no-explicit-any
async function fetchGuruTransactions(apiKey: string, startDate: string, endDate: string, cursor?: string): Promise<GuruPaginatedResponse> {
  const params = new URLSearchParams({ per_page: "100" });
  // Guru Transactions API requires ordered_at_ini + ordered_at_end, max 180 days apart
  params.set("ordered_at_ini", startDate);
  params.set("ordered_at_end", endDate);
  if (cursor) params.set("cursor", cursor);

  const url = `${GURU_BASE_URL}/transactions?${params.toString()}`;
  console.log(`[sincronizar-guru] GET ${url}`);

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "SISMAIS-Admin/1.0",
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Guru Transactions API ${resp.status}: ${body}`);
  }

  return resp.json() as Promise<GuruPaginatedResponse>;
}

// Fetch ALL transactions using 170-day sliding windows (Guru max = 180 days)
// deno-lint-ignore no-explicit-any
async function fetchAllTransactions(apiKey: string): Promise<{ transactions: any[], erros: string[] }> {
  // deno-lint-ignore no-explicit-any
  const transactions: any[] = [];
  const erros: string[] = [];
  const WINDOW_DAYS = 170; // Safety margin below 180-day API limit

  const startDate = new Date("2024-01-10");
  const today = new Date();
  let windowStart = new Date(startDate);
  let windowNum = 0;
  let firstSampleLogged = false;

  while (windowStart < today) {
    windowNum++;
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);
    if (windowEnd > today) windowEnd.setTime(today.getTime());

    const startStr = windowStart.toISOString().slice(0, 10);
    const endStr = windowEnd.toISOString().slice(0, 10);

    let cursor: string | undefined;
    let hasMore = true;
    let windowCount = 0;

    while (hasMore) {
      try {
        const response = await fetchGuruTransactions(apiKey, startStr, endStr, cursor);
        const txns = response.data ?? [];
        windowCount += txns.length;

        if (txns.length > 0 && !firstSampleLogged) {
          console.log(`[sincronizar-guru] SAMPLE transaction:`, JSON.stringify(txns[0], null, 2));
          firstSampleLogged = true;
        }

        transactions.push(...txns);

        const hasMoreBool =
          response.has_more_pages === 1 ||
          response.has_more_pages === true ||
          response.has_more_pages === "1";

        if (hasMoreBool && response.next_cursor && txns.length > 0) {
          cursor = response.next_cursor;
        } else {
          hasMore = false;
        }
      } catch (fetchErr) {
        erros.push(`Erro transactions window ${startStr}..${endStr} cursor=${cursor ?? "initial"}: ${fetchErr}`);
        hasMore = false;
      }
    }

    console.log(`[sincronizar-guru] Transactions window ${startStr}..${endStr}: ${windowCount} results`);

    // Move to next window
    windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() + 1);
  }

  console.log(`[sincronizar-guru] Total transações (all windows): ${transactions.length} | Erros: ${erros.length}`);
  return { transactions, erros };
}

function toDateString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "number") {
    const ms = val > 1e10 ? val : val * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof val === "object" && "date" in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>).date).slice(0, 10);
  }
  return String(val).slice(0, 10);
}

// Extract nested value trying multiple field paths
function extract(sub: GuruSubscription, ...paths: string[]): unknown {
  for (const path of paths) {
    const parts = path.split(".");
    let cur: unknown = sub;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") { cur = undefined; break; }
      cur = (cur as Record<string, unknown>)[p];
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return null;
}

// Detect payment method — payment.method can be null in Guru
// deno-lint-ignore no-explicit-any
function detectPaymentMethod(obj: Record<string, any>): string | null {
  const method = extract(obj, "payment.method", "payment_method") as string | null;
  if (method) return method;
  // Detect from payment sub-objects
  const ccBrand = extract(obj, "payment.credit_card.brand", "credit_card.brand");
  if (ccBrand) return "credit_card";
  const billetUrl = extract(obj, "payment.billet.url", "payment.billet.line");
  if (billetUrl) return "boleto";
  return null;
}

interface TxnData {
  valor: number;
  payment_method: string | null;
}

function mapToContrato(sub: GuruSubscription, txnData?: TxnData): Record<string, unknown> {
  // Correção 5: Adicionado customer.* paths
  const clienteNome = extract(sub, "contact.name", "subscriber.name", "customer.name", "name") as string | null;
  const clienteEmail = extract(sub, "contact.email", "subscriber.email", "customer.email", "email") as string | null;
  const clienteDoc = extract(sub, "contact.document", "contact.doc", "subscriber.document", "subscriber.doc", "customer.document") as string | null;
  // Correção 4: Adicionado plan.name, product_name, offer_name
  const planoNome = extract(sub, "product.name", "plan.name", "name", "product_name", "offer_name", "product.offer.name") as string | null;
  // Correção 6: Removido last_transaction.payment.method, adicionado paymentMethod
  const paymentMethodSub = extract(sub, "payment_method", "paymentMethod") as string | null;

  // Correção 1: Removidos paths last_transaction.* e next_product.*, adicionados offer.*, plan.*, genéricos
  let valorAssinatura = 0;
  if (txnData && txnData.valor > 0) {
    valorAssinatura = txnData.valor;
  } else {
    const rawAmount = extract(sub,
      "next_cycle_value",
      "current_invoice.value",
      "product.offer.value",
      "offer.price",
      "offer.amount",
      "offer.value",
      "plan.amount",
      "plan.price",
      "amount",
      "value",
      "price"
    ) as number ?? 0;
    valorAssinatura = typeof rawAmount === "number" ? rawAmount : Number(rawAmount) || 0;
  }

  // Billing interval: charged_every_days = 365
  const chargedEveryDays = extract(sub, "charged_every_days") as number | null;
  const intervalType = extract(sub, "product.offer.plan.interval_type", "next_product.offer.plan.interval_type") as string | null;

  let tipoIntervalo = "month";
  let cicloDias = 30;

  if (chargedEveryDays && typeof chargedEveryDays === "number") {
    cicloDias = chargedEveryDays;
    if (chargedEveryDays >= 360) tipoIntervalo = "year";
    else if (chargedEveryDays >= 170) tipoIntervalo = "semi_annual";
    else tipoIntervalo = "month";
  } else if (intervalType) {
    const it = intervalType.toLowerCase();
    if (it === "year" || it === "yearly") { tipoIntervalo = "year"; cicloDias = 365; }
    else if (it === "semi_annual" || it === "semiannually") { tipoIntervalo = "semi_annual"; cicloDias = 180; }
    else { tipoIntervalo = "month"; cicloDias = 30; }
  }

  if (valorAssinatura === 0) {
    console.warn(`[sincronizar-guru] ⚠️ VALOR ZERO sub=${sub.id}: txnData=${txnData ? `{valor:${txnData.valor}}` : "null"} — API GET /subscriptions não retorna campos de valor, depende de transaction enrichment`);
  }

  let mrr = valorAssinatura;
  if (tipoIntervalo === "year") mrr = valorAssinatura / 12;
  else if (tipoIntervalo === "semi_annual") mrr = valorAssinatura / 6;

  // Status: last_status = "active" (preferred over status)
  const statusRaw = ((sub.last_status ?? sub.status)?.toLowerCase?.() ?? "") as string;

  return {
    plataforma: "guru",
    id_externo: String(sub.id),
    cliente_nome: clienteNome,
    cliente_email: clienteEmail,
    cliente_documento: clienteDoc,
    plano_nome: planoNome,
    valor_assinatura: valorAssinatura,
    tipo_intervalo: tipoIntervalo,
    mrr: Math.round(mrr * 100) / 100,
    valor_arr: Math.round(mrr * 12 * 100) / 100,
    forma_pagamento: txnData?.payment_method ?? paymentMethodSub,
    status: STATUS_MAP[statusRaw] ?? "ativo",
    // Correção 3: Adicionado start_date
    data_inicio: toDateString(extract(sub, "started_at", "created_at", "start_date", "dates.started_at")),
    data_cancelamento: toDateString(extract(sub, "cancelled_at", "dates.canceled_at", "cancel_date")),
    codigo_assinatura: String(sub.subscription_code ?? sub.id),
    ciclo_dias: cicloDias,
    // Correção 2: Adicionados next_cycle, next_billing_date, next_charge_date
    data_proximo_ciclo: toDateString(extract(sub, "next_cycle_at", "next_cycle", "next_billing_date", "next_charge_date", "dates.next_cycle_at")),
    sincronizado_em: new Date().toISOString(),
    nome_contato: clienteNome,
    email_contato: clienteEmail,
    nome_produto: planoNome,
    nome_assinatura: planoNome,
  };
}

// ── Faturas sync logic ──────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncFaturas(adminClient: any, apiKey: string) {
  const erros: string[] = [];

  // 1. Build map of id_externo -> contrato.id for linking
  const contratoMap = new Map<string, string>();
  const DB_PAGE = 1000;
  let dbFrom = 0;
  while (true) {
    const { data, error: dbErr } = await adminClient
      .from("contratos_assinatura")
      .select("id, id_externo")
      .eq("plataforma", "guru")
      .range(dbFrom, dbFrom + DB_PAGE - 1);
    if (dbErr) { console.error("[sincronizar-guru] DB contrato fetch err:", dbErr); break; }
    // deno-lint-ignore no-explicit-any
    if (data) data.forEach((r: any) => { if (r.id_externo) contratoMap.set(String(r.id_externo), r.id); });
    if (!data || data.length < DB_PAGE) break;
    dbFrom += DB_PAGE;
  }
  console.log(`[sincronizar-guru] Mapa de contratos: ${contratoMap.size} registros`);

  // 2. Fetch all transactions from Guru API (170-day sliding windows)
  const { transactions: allTransactions, erros: txnErros } = await fetchAllTransactions(apiKey);
  erros.push(...txnErros);

  // 3. Also fetch invoices per subscription (for subscriptions that have them)
  // deno-lint-ignore no-explicit-any
  const allInvoices: any[] = [];
  const subIds = Array.from(contratoMap.keys());
  
  for (let i = 0; i < subIds.length; i++) {
    try {
      const invoices = await fetchGuruInvoices(apiKey, subIds[i]);
      for (const inv of invoices) {
        inv._subscription_id = subIds[i]; // attach subscription id
      }
      allInvoices.push(...invoices);
    } catch (err) {
      // Don't fail the whole sync for individual subscription invoice errors
      if (i < 3) console.error(`[sincronizar-guru] Erro buscar invoices sub ${subIds[i]}:`, err);
    }
  }

  console.log(`[sincronizar-guru] Total invoices de subscriptions: ${allInvoices.length}`);

  // 4. Deduplicate and merge: prefer transaction data, supplement with invoice data
  // deno-lint-ignore no-explicit-any
  const faturaMap = new Map<string, any>();

  // Process transactions first
  // deno-lint-ignore no-explicit-any
  for (const txn of allTransactions) {
    const id = String(txn.id ?? "");
    if (!id) continue;

    const subscriptionId = String(
      extract(txn, "subscription.id", "subscription_id") ?? ""
    );
    const contratoId = subscriptionId ? (contratoMap.get(subscriptionId) ?? null) : null;

    const statusRaw = (txn.status?.toLowerCase?.() ?? "");
    const status = INVOICE_STATUS_MAP[statusRaw] ?? "aberto";

    // Correção 8: Paths de valor de transação completos
    const rawAmount = (extract(txn, "payment.total", "payment.gross", "next_cycle_value", "current_invoice.value", "product.offer.value", "offer.price", "offer.amount", "values.total", "amount", "value", "price", "total") as number) ?? 0;
    const valor = typeof rawAmount === "number" ? rawAmount : Number(rawAmount) || 0;

    // Correção 13: Marketplace fields — prioridade top-level primeiro
    const marketplaceName = ((extract(txn, "marketplace_name", "payment.marketplace_name") as string) ?? "").toLowerCase();
    const marketplaceId = (extract(txn, "marketplace_id", "payment.marketplace_id") as string) ?? null;
    const referenciaExterna = marketplaceName === "asaas" && marketplaceId ? marketplaceId : null;

    faturaMap.set(id, {
      contrato_id: contratoId,
      plataforma: "guru",
      id_externo_fatura: id,
      id_externo_assinatura: subscriptionId || null,
      status,
      valor,
      // Correção 12: Datas com camelCase
      data_criacao: toDateString(extract(txn, "dates.created_at", "dates.ordered_at", "created_at", "createdAt")),
      data_vencimento: toDateString(extract(txn, "invoice.charge_at", "dates.expires_at", "due_date", "dueDate")),
      data_pagamento: status === "pago" ? (toDateString(extract(txn, "dates.confirmed_at", "paid_at", "paidAt", "payment_date")) ?? toDateString(extract(txn, "dates.created_at", "created_at"))) : null,
      forma_pagamento: detectPaymentMethod(txn),
      // Correção 10: Adicionado plan.name
      produto_nome: (extract(txn, "product.name", "plan.name", "offer.name") as string) ?? null,
      // Correção 9: Adicionado customer.* e buyer.document
      cliente_nome: (extract(txn, "contact.name", "subscriber.name", "customer.name", "buyer.name") as string) ?? null,
      cliente_email: (extract(txn, "contact.email", "subscriber.email", "customer.email", "buyer.email") as string) ?? null,
      cliente_documento: (extract(txn, "contact.document", "contact.doc", "subscriber.document", "subscriber.doc", "customer.document", "buyer.document") as string) ?? null,
      // Correção 11: Adicionado boleto_url e billet.url
      link_pagamento: (extract(txn, "checkout_url", "payment_url", "boleto_url", "billet.url", "invoice.payment_url") as string) ?? null,
      referencia_externa: referenciaExterna,
      sincronizado_em: new Date().toISOString(),
    });
  }

  // Process invoices (only add if not already from transactions)
  // deno-lint-ignore no-explicit-any
  for (const inv of allInvoices) {
    const invoiceCode = String(inv.invoice_code ?? inv.code ?? inv.id ?? "");
    if (!invoiceCode || faturaMap.has(invoiceCode)) continue;

    const subscriptionId = String(inv._subscription_id ?? "");
    const contratoId = subscriptionId ? (contratoMap.get(subscriptionId) ?? null) : null;

    const statusRaw = (inv.status?.toLowerCase?.() ?? "");
    const status = INVOICE_STATUS_MAP[statusRaw] ?? "aberto";

    const rawAmount = (extract(inv, "amount", "value", "total") as number) ?? 0;
    const valor = rawAmount;

    faturaMap.set(invoiceCode, {
      contrato_id: contratoId,
      plataforma: "guru",
      id_externo_fatura: invoiceCode,
      id_externo_assinatura: subscriptionId || null,
      status,
      valor,
      data_criacao: toDateString(extract(inv, "created_at", "createdAt")),
      data_vencimento: toDateString(extract(inv, "due_date", "dueDate")),
      data_pagamento: status === "pago" ? (toDateString(extract(inv, "paid_at", "paidAt")) ?? null) : null,
      forma_pagamento: (extract(inv, "payment_method", "paymentMethod") as string) ?? null,
      produto_nome: (extract(inv, "product.name", "plan.name") as string) ?? null,
      cliente_nome: null,
      cliente_email: null,
      link_pagamento: (extract(inv, "checkout_url", "payment_url") as string) ?? null,
      sincronizado_em: new Date().toISOString(),
    });
  }

  const faturaRecords = Array.from(faturaMap.values());
  console.log(`[sincronizar-guru] Total faturas mapeadas: ${faturaRecords.length}`);

  // 5. Upsert in batches
  let totalFaturas = 0;
  let errosFaturas = 0;
  const BATCH = 100;

  for (let i = 0; i < faturaRecords.length; i += BATCH) {
    const batch = faturaRecords.slice(i, i + BATCH);
    const { error } = await adminClient
      .from("faturas_assinatura")
      .upsert(batch, {
        onConflict: "plataforma,id_externo_fatura",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`[sincronizar-guru] Upsert faturas batch ${Math.floor(i / BATCH) + 1}:`, error.message);
      errosFaturas++;
      erros.push(`Erro upsert faturas batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    } else {
      totalFaturas += batch.length;
    }
  }

  console.log(`[sincronizar-guru] Faturas: ${totalFaturas} sincronizadas, ${errosFaturas} erros`);

  return { totalFaturas, errosFaturas, erros };
}

// ── Main handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const isCron = req.headers.get("x-cron-job") === "true";

    if (!isCron) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: user, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authError || !user?.user) {
        return new Response(
          JSON.stringify({ error: "Token inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const apiKey = Deno.env.get("GURU_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GURU_API_KEY não configurada nos secrets do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body for mode
    let modo = "full";
    try {
      const body = await req.json();
      modo = body?.modo ?? "full";
    } catch {
      // No body or invalid JSON, default to "full"
    }

    // ── MODE: faturas ─────────────────────────────────────────────────
    if (modo === "faturas") {
      console.log("[sincronizar-guru] Modo: faturas");

      const { totalFaturas, errosFaturas, erros } = await syncFaturas(adminClient, apiKey);

      // Write sync log (same as full mode)
      await adminClient.from("sync_logs_assinaturas").insert({
        plataforma: "guru",
        status: erros.length === 0 ? "sucesso" : totalFaturas > 0 ? "parcial" : "erro",
        total: totalFaturas,
        mensagem: erros.length === 0
          ? `${totalFaturas} faturas sincronizadas (modo faturas)`
          : `${totalFaturas} faturas sincronizadas, ${erros.length} erros (modo faturas)`,
        erros_count: erros.length,
        erros_amostra: erros.slice(0, 5),
      });

      // Update configuracoes_integracao_cobranca
      await adminClient
        .from("configuracoes_integracao_cobranca")
        .upsert(
          {
            plataforma: "guru",
            ultima_sincronizacao: new Date().toISOString(),
            total_sincronizados: totalFaturas,
            ativo: true,
            api_url_base: GURU_BASE_URL,
          },
          { onConflict: "plataforma" }
        );

      return new Response(
        JSON.stringify({ success: true, total_faturas: totalFaturas, erros: errosFaturas, detalhes: erros }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── MODE: full (contratos) ────────────────────────────────────────
    const statusesToSync = ["active", "cancelled", "suspended", "overdue", "trial"];
    const rawSubs: GuruSubscription[] = [];
    const erros: string[] = [];

    for (const status of statusesToSync) {
      let hasMore = true;
      let cursor: string | undefined;
      let pageNum = 0;

      while (hasMore) {
        try {
          pageNum++;
          const response = await fetchGuruSubscriptions(apiKey, status, cursor);
          const subs = response.data ?? [];

          if (subs.length > 0 && pageNum === 1) {
            console.log(`[sincronizar-guru] SAMPLE status=${status}:`, JSON.stringify(subs[0], null, 2));
            const s = subs[0];
            const topKeys = Object.keys(s);
            console.log(`[sincronizar-guru] SAMPLE KEYS:`, topKeys.join(", "));
            const valueFields = ["amount", "value", "price", "next_cycle_value", "offer", "plan", "product", "current_invoice"];
            for (const f of valueFields) {
              if (s[f] !== undefined) console.log(`[sincronizar-guru] FIELD ${f}:`, JSON.stringify(s[f]));
            }
          }

          console.log(
            `[sincronizar-guru] status=${status} cursor=${cursor ?? "initial"} count=${subs.length} has_more=${response.has_more_pages} total_rows=${response.total_rows ?? "?"}`
          );

          rawSubs.push(...subs);

          const hasMoreBool =
            response.has_more_pages === 1 ||
            response.has_more_pages === true ||
            response.has_more_pages === "1";

          if (hasMoreBool && response.next_cursor && subs.length > 0) {
            cursor = response.next_cursor;
          } else {
            hasMore = false;
          }
        } catch (fetchErr) {
          erros.push(`Erro ao buscar status=${status} cursor=${cursor ?? "initial"}: ${fetchErr}`);
          hasMore = false;
        }
      }
    }

    console.log(`[sincronizar-guru] Total buscados (bruto): ${rawSubs.length} | Erros fetch: ${erros.length}`);

    // ── Step 2: Deduplicate subscriptions by ID ──
    const subsMap = new Map<string, GuruSubscription>();
    for (const sub of rawSubs) {
      const id = String(sub.id);
      subsMap.set(id, sub); // last one wins (most recent status)
    }
    const uniqueSubs = Array.from(subsMap.values());
    console.log(`[sincronizar-guru] Após deduplicação: ${uniqueSubs.length} (removidos ${rawSubs.length - uniqueSubs.length} duplicados)`);

    // ── Step 3: Fetch all transactions to build value map (170-day sliding windows) ──
    const PAID_STATUSES = new Set(["paid", "approved", "confirmed", "completed"]);
    const txnMap = new Map<string, TxnData>();
    {
      const { transactions: allTxns, erros: txnErros } = await fetchAllTransactions(apiKey);
      erros.push(...txnErros);

      for (const txn of allTxns) {
        const txnStatus = (txn.status?.toLowerCase?.() ?? "");
        if (!PAID_STATUSES.has(txnStatus)) continue;

        const subscriptionId = String(
          extract(txn, "subscription.id", "subscription_id", "invoice.subscription_id") ?? ""
        );
        if (!subscriptionId) continue;

        // Correção 8 (mesmos paths no txnMap builder)
        const rawAmount = (extract(txn, "payment.total", "payment.gross", "next_cycle_value", "current_invoice.value", "product.offer.value", "offer.price", "offer.amount", "values.total", "amount", "value", "price", "total") as number) ?? 0;
        const valor = typeof rawAmount === "number" ? rawAmount : Number(rawAmount) || 0;
        const pm = detectPaymentMethod(txn);

        // Keep latest (last in array = most recent)
        txnMap.set(subscriptionId, { valor, payment_method: pm });
      }

      console.log(`[sincronizar-guru] Transações totais: ${allTxns.length} | Com pagamento pago (unique subs): ${txnMap.size}`);
    }

    // Pre-load manual fields to preserve on upsert
    const BATCH_SIZE = 200;
    const existingMap = new Map<string, Record<string, unknown>>();

    for (let i = 0; i < uniqueSubs.length; i += BATCH_SIZE) {
      const batchIds = uniqueSubs.slice(i, i + BATCH_SIZE).map((s) => String(s.id));
      const { data: existing } = await adminClient
        .from("contratos_assinatura")
        .select("id_externo, segmento_cliente, vendedor, anotacoes, motivo_cancelamento, motivo_cancelamento_2, numero_funcionarios")
        .eq("plataforma", "guru")
        .in("id_externo", batchIds);

      if (existing) {
        existing.forEach((r: Record<string, unknown>) => existingMap.set(r.id_externo as string, r));
      }
    }

    // ── Step 4: Map all subscriptions (transaction data used as enrichment only) ──
    const allContratos: Record<string, unknown>[] = [];

    if (txnMap.size === 0) {
      console.warn(`[sincronizar-guru] ⚠️ Transactions API returned 0 results — continuing without transaction enrichment`);
    }

    let valoresZero = 0;
    for (const sub of uniqueSubs) {
      try {
        const subId = String(sub.id);
        const txnData = txnMap.get(subId);
        const mapped = mapToContrato(sub, txnData);

        // Debug: log first 3 subscriptions with value details
        if (allContratos.length < 3) {
          const src = txnData && txnData.valor > 0 ? "transaction" : "subscription_fields";
          console.log(`[sincronizar-guru] MAPPED sub=${subId} valor=${mapped.valor_assinatura} source=${src} plano=${mapped.plano_nome} cliente=${mapped.cliente_nome}`);
          console.log(`[sincronizar-guru] SUB VALUE FIELDS: txnData=${txnData ? JSON.stringify(txnData) : "null"}, contact.name=${extract(sub, "contact.name")}, started_at=${sub.started_at}, cancelled_at=${sub.cancelled_at}, next_cycle_at=${sub.next_cycle_at}`);
        }

        if (mapped.valor_assinatura === 0) valoresZero++;

        const existing = existingMap.get(subId) ?? {};
        mapped.segmento_cliente = (existing.segmento_cliente as string | null) ?? null;
        mapped.vendedor = (existing.vendedor as string | null) ?? null;
        mapped.anotacoes = (existing.anotacoes as string | null) ?? null;
        mapped.motivo_cancelamento = (existing.motivo_cancelamento as string | null) ?? null;
        mapped.motivo_cancelamento_2 = (existing.motivo_cancelamento_2 as string | null) ?? null;
        mapped.numero_funcionarios = (existing.numero_funcionarios as number | null) ?? null;
        allContratos.push(mapped);
      } catch (mapErr) {
        erros.push(`Erro ao mapear subscription ${sub.id}: ${mapErr}`);
      }
    }

    console.log(`[sincronizar-guru] Total mapeados: ${allContratos.length} | Valores zero: ${valoresZero} | Erros: ${erros.length}`);

    // Upsert in batches
    let sincronizados = 0;

    for (let i = 0; i < allContratos.length; i += BATCH_SIZE) {
      const batch = allContratos.slice(i, i + BATCH_SIZE);

      const { error: upsertError } = await adminClient
        .from("contratos_assinatura")
        .upsert(batch, {
          onConflict: "plataforma,id_externo",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`[sincronizar-guru] Erro upsert batch ${i / BATCH_SIZE + 1}:`, upsertError);
        erros.push(`Erro upsert batch ${i / BATCH_SIZE + 1}: ${upsertError.message}`);
      } else {
        sincronizados += batch.length;
      }
    }

    // ── Cleanup: remove orphan contracts deleted from Guru ──
    let removidos = 0;
    const skipCleanup = allContratos.length < uniqueSubs.length * 0.1;

    if (skipCleanup) {
      console.warn(`[sincronizar-guru] ⚠️ Cleanup SKIPPED: mapped only ${allContratos.length} of ${uniqueSubs.length} subs (potential API failure protection)`);
    } else if (uniqueSubs.length > 0) {
      try {
        const activeIds = new Set(allContratos.map((c) => String(c.id_externo)));
        const orphanIds: string[] = [];

        let dbFrom = 0;
        const DB_PAGE = 1000;
        while (true) {
          const { data: dbRows } = await adminClient
            .from("contratos_assinatura")
            .select("id_externo")
            .eq("plataforma", "guru")
            .not("id_externo", "is", null)
            .range(dbFrom, dbFrom + DB_PAGE - 1);

          if (!dbRows || dbRows.length === 0) break;
          for (const row of dbRows) {
            if (row.id_externo && !activeIds.has(row.id_externo)) {
              orphanIds.push(row.id_externo);
            }
          }
          if (dbRows.length < DB_PAGE) break;
          dbFrom += DB_PAGE;
        }

        for (let i = 0; i < orphanIds.length; i += 100) {
          const batch = orphanIds.slice(i, i + 100);
          const { error: delErr } = await adminClient
            .from("contratos_assinatura")
            .delete()
            .eq("plataforma", "guru")
            .in("id_externo", batch);

          if (delErr) {
            erros.push(`Erro ao deletar órfãos batch ${i / 100 + 1}: ${delErr.message}`);
          } else {
            removidos += batch.length;
          }
        }

        console.log(`[sincronizar-guru] Cleanup: ${removidos} órfãos removidos de ${orphanIds.length} encontrados`);
      } catch (cleanupErr) {
        erros.push(`Erro no cleanup: ${cleanupErr}`);
        console.error("[sincronizar-guru] Erro cleanup:", cleanupErr);
      }
    } else {
      console.log("[sincronizar-guru] Cleanup IGNORADO: API retornou 0 assinaturas (possível falha de auth)");
    }

    // Write sync log
    await adminClient.from("sync_logs_assinaturas").insert({
      plataforma: "guru",
      status: erros.length === 0 ? "sucesso" : sincronizados > 0 ? "parcial" : "erro",
      total: sincronizados,
      mensagem: erros.length === 0
        ? `${sincronizados} contratos sincronizados, ${removidos} órfãos removidos`
        : `${sincronizados} sincronizados, ${removidos} removidos, ${erros.length} erros`,
      erros_count: erros.length,
      erros_amostra: erros.slice(0, 5),
    });

    // Update configuracoes_integracao_cobranca
    await adminClient
      .from("configuracoes_integracao_cobranca")
      .upsert(
        {
          plataforma: "guru",
          ultima_sincronizacao: new Date().toISOString(),
          total_sincronizados: sincronizados,
          ativo: true,
          api_url_base: GURU_BASE_URL,
        },
        { onConflict: "plataforma" }
      );

    console.log(`[sincronizar-guru] Concluído: ${sincronizados} sincronizados, ${erros.length} erros`);

    return new Response(
      JSON.stringify({
        sincronizados,
        removidos,
        erros,
        plataforma: "guru",
        total_buscados: allContratos.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sincronizar-guru] Erro geral:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno na sincronização.", detalhes: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
