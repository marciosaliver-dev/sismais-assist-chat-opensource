import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Status mapping — deve ser idêntico ao sincronizar-guru
const STATUS_MAP: Record<string, string> = {
  active: "ativo",
  started: "ativo",
  trial: "trial",
  pastdue: "inadimplente",
  overdue: "inadimplente",
  suspended: "pausado",
  canceled: "cancelado",
  cancelled: "cancelado",
  expired: "cancelado",
  inactive: "cancelado",
  "trial canceled": "cancelado",
  "trial cancelled": "cancelado",
};

// Interval mapping (same as sincronizar-guru)
const INTERVAL_MAP: Record<string, string> = {
  MONTHLY: "month",
  YEARLY: "year",
  SEMIANNUALLY: "semi_annual",
  WEEKLY: "month",
  DAILY: "month",
};

// Event → contract status mapping
const EVENT_STATUS_MAP: Record<string, string> = {
  "subscription.created": "ativo",
  "subscription.active": "ativo",
  "subscription.activated": "ativo",
  "subscription.started": "ativo",
  "subscription.renewed": "ativo",
  "subscription.reactivated": "ativo",
  "subscription.overdue": "inadimplente",
  "subscription.pastdue": "inadimplente",
  "subscription.suspended": "pausado",
  "subscription.cancelled": "cancelado",
  "subscription.canceled": "cancelado",
  "subscription.expired": "cancelado",
  "subscription.inactive": "cancelado",
  "subscription.finished": "cancelado",
  "subscription.trial_canceled": "cancelado",
  "subscription.trial_cancelled": "cancelado",
  "subscription.trial_ended": "cancelado",
};

// Event → invoice (transaction) status mapping
const INVOICE_EVENT_MAP: Record<string, string> = {
  "invoice.paid": "pago",
  "charge.completed": "pago",
  "charge.paid": "pago",
  "payment.approved": "pago",
  "payment.confirmed": "pago",
  "transaction.paid": "pago",
  "transaction.approved": "pago",
  "invoice.created": "aberto",
  "invoice.generated": "aberto",
  "charge.created": "aberto",
  "transaction.created": "aberto",
  "invoice.overdue": "atrasado",
  "invoice.pastdue": "atrasado",
  "charge.overdue": "atrasado",
  "transaction.overdue": "atrasado",
  "invoice.refunded": "reembolsado",
  "invoice.refund": "reembolsado",
  "charge.refunded": "reembolsado",
  "charge.chargeback": "reembolsado",
  "charge.dispute": "reembolsado",
  "payment.refunded": "reembolsado",
  "payment.chargeback": "reembolsado",
  "transaction.refunded": "reembolsado",
  "invoice.canceled": "cancelado",
  "invoice.cancelled": "cancelado",
  "charge.canceled": "cancelado",
  "charge.cancelled": "cancelado",
  "transaction.canceled": "cancelado",
  "transaction.cancelled": "cancelado",
};

// Invoice event → contract status
const INVOICE_TO_CONTRACT_STATUS: Record<string, string> = {
  "invoice.paid": "ativo",
  "charge.completed": "ativo",
  "charge.paid": "ativo",
  "payment.approved": "ativo",
  "payment.confirmed": "ativo",
  "transaction.paid": "ativo",
  "transaction.approved": "ativo",
  "invoice.overdue": "inadimplente",
  "invoice.pastdue": "inadimplente",
  "charge.overdue": "inadimplente",
  "transaction.overdue": "inadimplente",
};

// Manual fields to preserve on upsert
const MANUAL_FIELDS = [
  "segmento_cliente",
  "vendedor",
  "anotacoes",
  "motivo_cancelamento",
  "motivo_cancelamento_2",
  "numero_funcionarios",
] as const;

// deno-lint-ignore no-explicit-any
function extract(obj: Record<string, any>, ...paths: string[]): unknown {
  for (const path of paths) {
    const parts = path.split(".");
    let cur: unknown = obj;
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
  const ccBrand = extract(obj, "payment.credit_card.brand", "credit_card.brand");
  if (ccBrand) return "credit_card";
  const billetUrl = extract(obj, "payment.billet.url", "payment.billet.line");
  if (billetUrl) return "boleto";
  return null;
}

// Correção 15: Adicionado instanceof Date
function toDateString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "number") {
    const ms = val > 1e10 ? val : val * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof val === "object" && val !== null && "date" in val) {
    return String((val as Record<string, unknown>).date).slice(0, 10);
  }
  return String(val).slice(0, 10);
}

// deno-lint-ignore no-explicit-any
async function updateContractFromInvoice(adminClient: any, subscriptionId: string, newStatus: string) {
  if (!subscriptionId) return;

  const { data: existing } = await adminClient
    .from("contratos_assinatura")
    .select("id, status")
    .eq("plataforma", "guru")
    .eq("id_externo", subscriptionId)
    .maybeSingle();

  if (!existing) return;
  if (existing.status === newStatus) return;
  if (existing.status === "cancelado" && newStatus === "ativo") return;

  const { error } = await adminClient
    .from("contratos_assinatura")
    .update({ status: newStatus, sincronizado_em: new Date().toISOString() })
    .eq("plataforma", "guru")
    .eq("id_externo", subscriptionId);

  if (error) {
    console.error(`[webhook-guru] Erro ao atualizar contrato via invoice: ${error.message}`);
  } else {
    console.log(`[webhook-guru] Contrato ${subscriptionId} atualizado via invoice -> ${newStatus}`);
  }
}

// Transaction status mapping
const TXN_STATUS_MAP: Record<string, string> = {
  approved: "pago",
  paid: "pago",
  confirmed: "pago",
  completed: "pago",
  waiting_payment: "aberto",
  pending: "aberto",
  refused: "cancelado",
  refunded: "reembolsado",
  canceled: "cancelado",
  cancelled: "cancelado",
  chargeback: "reembolsado",
};

// Process a transaction webhook (webhook_type=transaction)
// deno-lint-ignore no-explicit-any
async function processTransaction(adminClient: any, data: any) {
  const txnId = String(data.id ?? "");
  if (!txnId) return;

  const subscriptionId = String(
    extract(data, "subscription.id", "subscription_id", "invoice.subscription_id") ?? ""
  );

  // Find linked contract
  let contratoId: string | null = null;
  if (subscriptionId) {
    const { data: contrato } = await adminClient
      .from("contratos_assinatura")
      .select("id")
      .eq("plataforma", "guru")
      .eq("id_externo", subscriptionId)
      .maybeSingle();
    contratoId = contrato?.id ?? null;
  }

  const statusRaw = (data.status?.toLowerCase?.() ?? "");
  const status = TXN_STATUS_MAP[statusRaw] ?? "aberto";

  // Correção 16: Paths de valor completos
  const valor = (extract(data, "payment.total", "payment.gross", "next_cycle_value", "current_invoice.value", "product.offer.value", "values.total", "amount", "value", "price", "total") as number) ?? 0;

  // deno-lint-ignore no-explicit-any
  const faturaRecord: Record<string, any> = {
    plataforma: "guru",
    id_externo_fatura: txnId,
    id_externo_assinatura: subscriptionId || null,
    contrato_id: contratoId,
    status,
    valor: typeof valor === "number" ? valor : Number(valor) || 0,
    forma_pagamento: detectPaymentMethod(data),
    data_criacao: toDateString(extract(data, "dates.ordered_at", "dates.created_at")),
    data_vencimento: toDateString(extract(data, "invoice.charge_at", "dates.expires_at")),
    data_pagamento: status === "pago"
      ? (toDateString(extract(data, "dates.confirmed_at")) ?? new Date().toISOString().slice(0, 10))
      : null,
    cliente_nome: (extract(data, "contact.name", "subscriber.name") as string) ?? null,
    cliente_email: (extract(data, "contact.email", "subscriber.email") as string) ?? null,
    cliente_documento: (extract(data, "contact.doc", "subscriber.doc") as string) ?? null,
    produto_nome: (extract(data, "product.name") as string) ?? null,
    link_pagamento: (extract(data, "checkout_url", "invoice.payment_url") as string) ?? null,
    // Conciliação Guru↔Asaas
    referencia_externa: ((extract(data, "payment.marketplace_name") as string) ?? "").toLowerCase() === "asaas"
      ? (extract(data, "payment.marketplace_id") as string) ?? null
      : null,
    sincronizado_em: new Date().toISOString(),
  };

  const { error } = await adminClient
    .from("faturas_assinatura")
    .upsert(faturaRecord, { onConflict: "plataforma,id_externo_fatura", ignoreDuplicates: false });

  if (error) {
    console.error(`[webhook-guru] Erro upsert transação: ${error.message}`);
  } else {
    console.log(`[webhook-guru] Transação ${txnId} -> ${status} (valor=${valor})`);
  }

  // Update linked contract status if payment was successful
  if (status === "pago" && subscriptionId) {
    await updateContractFromInvoice(adminClient, subscriptionId, "ativo");
  }

  return { txnId, status, valor, subscriptionId };
}

// deno-lint-ignore no-explicit-any
async function processInvoice(adminClient: any, evento: string, data: any) {
  const invoiceStatus = INVOICE_EVENT_MAP[evento.toLowerCase()];
  if (!invoiceStatus) return;

  const invoiceData = data.invoice ?? data.charge ?? data.payment ?? data;
  const faturaId = String(invoiceData.id ?? data.id ?? "");
  if (!faturaId) return;

  const subscriptionId = String(
    extract(data, "subscription.id", "subscription_id", "invoice.subscription_id") ?? 
    extract(invoiceData, "subscription.id", "subscription_id") ?? ""
  );

  // Find linked contract
  let contratoId: string | null = null;
  if (subscriptionId) {
    const { data: contrato } = await adminClient
      .from("contratos_assinatura")
      .select("id")
      .eq("plataforma", "guru")
      .eq("id_externo", subscriptionId)
      .maybeSingle();
    contratoId = contrato?.id ?? null;
  }

  const rawAmount = (extract(invoiceData, "value", "amount", "price") as number) ?? 0;
  const valor = typeof rawAmount === "number" ? rawAmount : Number(rawAmount) || 0;

  // deno-lint-ignore no-explicit-any
  const faturaRecord: Record<string, any> = {
    plataforma: "guru",
    id_externo_fatura: faturaId,
    id_externo_assinatura: subscriptionId || null,
    contrato_id: contratoId,
    status: invoiceStatus,
    valor,
    forma_pagamento: detectPaymentMethod(data),
    data_vencimento: toDateString(extract(invoiceData, "charge_at", "due_date", "dueDate")),
    data_pagamento: invoiceStatus === "pago" ? (toDateString(extract(data, "dates.confirmed_at", "paid_at")) ?? new Date().toISOString().slice(0, 10)) : null,
    data_criacao: toDateString(extract(invoiceData, "created_at", "createdAt")),
    cliente_nome: (extract(data, "contact.name", "subscriber.name") as string) ?? null,
    cliente_email: (extract(data, "contact.email", "subscriber.email") as string) ?? null,
    cliente_documento: (extract(data, "contact.doc", "subscriber.doc") as string) ?? null,
    produto_nome: (extract(data, "product.name") as string) ?? null,
    link_pagamento: (extract(data, "checkout_url", "invoice.payment_url") as string) ?? null,
    sincronizado_em: new Date().toISOString(),
  };

  const { error } = await adminClient
    .from("faturas_assinatura")
    .upsert(faturaRecord, { onConflict: "plataforma,id_externo_fatura", ignoreDuplicates: false });

  if (error) {
    console.error(`[webhook-guru] Erro upsert fatura: ${error.message}`);
  } else {
    console.log(`[webhook-guru] Fatura ${faturaId} -> ${invoiceStatus}`);
  }

  // Also update linked contract status based on invoice event
  const contractStatus = INVOICE_TO_CONTRACT_STATUS[evento.toLowerCase()];
  if (contractStatus && subscriptionId) {
    await updateContractFromInvoice(adminClient, subscriptionId, contractStatus);
  }
}

// deno-lint-ignore no-explicit-any
async function getLatestInvoiceData(adminClient: any, plataforma: string, idExternoAssinatura: string) {
  try {
    const { data } = await adminClient
      .from("faturas_assinatura")
      .select("link_pagamento, id_externo_fatura, valor, data_vencimento")
      .eq("plataforma", plataforma)
      .eq("id_externo_assinatura", idExternoAssinatura)
      .in("status", ["aberto", "atrasado"])
      .not("link_pagamento", "is", null)
      .order("data_vencimento", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      link: data.link_pagamento,
      faturaId: data.id_externo_fatura,
      valor: data.valor,
      vencimento: data.data_vencimento,
    };
  } catch (e) {
    console.error(`[webhook-guru] Erro ao buscar fatura: ${e}`);
    return null;
  }
}

async function forwardToBilling(adminClient: any, payload: Record<string, unknown>) {
  const BILLING_URL = "https://pomueweeulenslxvsxar.supabase.co/functions/v1/webhook-billing"
  let statusCode = 0
  let respBody = ""
  let sucesso = false
  let erro: string | null = null
  try {
    const resp = await fetch(BILLING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    statusCode = resp.status
    respBody = await resp.text()
    sucesso = resp.ok
    console.log(`[webhook-guru] Forward billing: ${resp.status}`)
  } catch (e) {
    erro = String(e)
    console.error(`[webhook-guru] Forward billing erro: ${e}`)
  }
  await adminClient.from("webhook_forward_logs").insert({
    plataforma: (payload.plataforma as string) || "guru",
    evento: (payload.evento as string) || "unknown",
    id_externo: (payload.id_externo as string) || null,
    cliente_nome: (payload.cliente_nome as string) || null,
    cliente_email: (payload.cliente_email as string) || null,
    payload,
    status_code: statusCode || null,
    resposta: respBody || null,
    sucesso,
    erro,
  }).then(() => {}).catch((e: any) => console.error("[webhook-guru] Erro ao gravar forward log:", e))
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // deno-lint-ignore no-explicit-any
  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    await adminClient.from("webhook_logs").insert({
      plataforma: "guru",
      evento: "parse_error",
      status: "erro",
      mensagem: "Body não é JSON válido",
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookType = (payload.webhook_type ?? "").toLowerCase();
  const evento = (payload.event ?? payload.action ?? (
    webhookType === "transaction" ? `transaction.${(payload.status ?? "created").toLowerCase()}` :
    webhookType === "subscription" ? `subscription.${(payload.last_status ?? payload.status ?? "active").toLowerCase()}` :
    payload.type ?? "unknown"
  )) as string;
  const sub = payload.data ?? payload.subscription ?? payload;
  const idExterno = String(sub.id ?? payload.id ?? "");

  console.log(`[webhook-guru] webhook_type=${webhookType} Evento: ${evento}, ID: ${idExterno}, status=${payload.status ?? payload.last_status ?? "?"}`);

  try {
    // ── Handle transaction webhooks (webhook_type=transaction) ──
    if (webhookType === "transaction") {
      const result = await processTransaction(adminClient, payload);

      await adminClient.from("webhook_logs").insert({
        plataforma: "guru",
        evento,
        id_externo: idExterno,
        payload,
        status: "processado",
        mensagem: `Transação processada: status=${result?.status ?? "?"} valor=${result?.valor ?? 0} subscription=${result?.subscriptionId ?? "N/A"}`,
      });

      return new Response(JSON.stringify({ ok: true, transaction: result?.txnId, status: result?.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Handle event-based webhooks (invoice/charge/payment/transaction events) ──
    const eventoLower = evento.toLowerCase();
    const isInvoiceEvent = (
      eventoLower.startsWith("invoice.") ||
      eventoLower.startsWith("charge.") ||
      eventoLower.startsWith("payment.") ||
      eventoLower.startsWith("transaction.")
    );
    if (isInvoiceEvent) {
      await processInvoice(adminClient, evento, sub);
    }

    // Determine contract status from event
    const statusFromEvent = EVENT_STATUS_MAP[evento.toLowerCase()];
    if (!statusFromEvent) {
      await adminClient.from("webhook_logs").insert({
        plataforma: "guru",
        evento,
        id_externo: idExterno,
        payload,
        status: isInvoiceEvent ? "processado" : "ignorado",
        mensagem: isInvoiceEvent
          ? `Evento de fatura processado: ${evento}`
          : `Evento informativo: ${evento}`,
      });
      return new Response(JSON.stringify({ ok: true, ignored: !isInvoiceEvent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract fields — aligned with real Guru webhook payload structure
    const clienteNome = extract(sub, "subscriber.name", "last_transaction.contact.name", "contact.name", "name") as string | null;
    const clienteEmail = extract(sub, "subscriber.email", "last_transaction.contact.email", "contact.email", "email") as string | null;
    const clienteDoc = extract(sub, "subscriber.doc", "last_transaction.contact.doc", "contact.doc", "document") as string | null;
    const planoNome = extract(sub, "product.name", "name", "product.offer.name") as string | null;

    // Value priority
    const rawAmount = (extract(sub,
      "next_cycle_value",
      "current_invoice.value",
      "last_transaction.payment.total",
      "last_transaction.payment.gross",
      "product.offer.value"
    ) as number) ?? 0;
    const paymentMethod = detectPaymentMethod(sub) ?? (extract(sub, "payment_method") as string | null);

    const valorAssinatura = typeof rawAmount === "number" ? rawAmount : Number(rawAmount) || 0;

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

    let mrr = valorAssinatura;
    if (tipoIntervalo === "year") mrr = valorAssinatura / 12;
    else if (tipoIntervalo === "semi_annual") mrr = valorAssinatura / 6;

    // Fetch existing record to preserve manual fields
    const { data: existing } = await adminClient
      .from("contratos_assinatura")
      .select(MANUAL_FIELDS.join(", "))
      .eq("plataforma", "guru")
      .eq("id_externo", idExterno)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    const record: Record<string, any> = {
      plataforma: "guru",
      id_externo: idExterno,
      cliente_nome: clienteNome,
      cliente_email: clienteEmail,
      cliente_documento: clienteDoc,
      plano_nome: planoNome,
      valor_assinatura: valorAssinatura,
      tipo_intervalo: tipoIntervalo,
      mrr: Math.round(mrr * 100) / 100,
      valor_arr: Math.round(mrr * 12 * 100) / 100,
      forma_pagamento: paymentMethod,
      status: statusFromEvent,
      data_inicio: toDateString(extract(sub, "dates.started_at", "created_at", "start_date")),
      codigo_assinatura: String(sub.subscription_code ?? idExterno),
      ciclo_dias: cicloDias,
      data_proximo_ciclo: toDateString(extract(sub, "dates.next_cycle_at", "next_cycle_at", "dates.cycle_end_date")),
      sincronizado_em: new Date().toISOString(),
      nome_contato: clienteNome,
      email_contato: clienteEmail,
      nome_produto: planoNome,
      nome_assinatura: planoNome,
    };

    if (statusFromEvent === "cancelado") {
      record.data_cancelamento = toDateString(extract(sub, "dates.canceled_at", "cancelled_at", "cancel_date")) ?? new Date().toISOString().slice(0, 10);
    }

    for (const field of MANUAL_FIELDS) {
      record[field] = (existing as unknown as Record<string, unknown>)?.[field] ?? null;
    }

    const { error: upsertError } = await adminClient
      .from("contratos_assinatura")
      .upsert(record, { onConflict: "plataforma,id_externo", ignoreDuplicates: false });

    if (upsertError) {
      throw new Error(`Upsert error: ${upsertError.message}`);
    }

    await adminClient.from("webhook_logs").insert({
      plataforma: "guru",
      evento,
      id_externo: idExterno,
      payload,
      status: "processado",
      mensagem: `Contrato atualizado: status=${statusFromEvent}`,
    });

    console.log(`[webhook-guru] Processado: ${idExterno} -> ${statusFromEvent}`);

    // Forward billing events
    // Correção 14: await adicionado ao forwardToBilling
    const eventoLowerGuru = evento.toLowerCase()
    const isCancelEvent = ["subscription.cancelled", "subscription.canceled", "subscription.expired", "subscription.inactive", "subscription.finished"].includes(eventoLowerGuru);
    const isOverdueEvent = ["subscription.overdue", "subscription.pastdue", "invoice.overdue", "invoice.pastdue", "transaction.overdue"].includes(eventoLowerGuru);
    if (isCancelEvent || isOverdueEvent) {
      const eventoNormalizado = isCancelEvent ? "SUBSCRIPTION_INACTIVATED" : "PAYMENT_OVERDUE"
      const invoiceData = await getLatestInvoiceData(adminClient, "guru", idExterno);
      await forwardToBilling(adminClient, {
        cliente_nome: clienteNome,
        cliente_documento: clienteDoc,
        cliente_email: clienteEmail,
        cliente_telefone: null,
        plataforma: "guru",
        evento: eventoNormalizado,
        id_externo: idExterno,
        plano_nome: planoNome,
        valor_assinatura: valorAssinatura,
        data_vencimento: invoiceData?.vencimento ?? null,
        forma_pagamento: paymentMethod,
        fatura_id: invoiceData?.faturaId ?? null,
        fatura_valor: invoiceData?.valor ?? null,
        fatura_vencimento: invoiceData?.vencimento ?? null,
        fatura_link: invoiceData?.link ?? null,
      }).catch(e => console.error("[webhook-guru] Forward erro:", e))
    }

    return new Response(JSON.stringify({ ok: true, status: statusFromEvent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[webhook-guru] Erro:`, err);
    await adminClient.from("webhook_logs").insert({
      plataforma: "guru",
      evento,
      id_externo: idExterno,
      payload,
      status: "erro",
      mensagem: String(err),
    });
    return new Response(JSON.stringify({ ok: true, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
