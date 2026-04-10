import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mapeamento de motivos de bloqueio por status
const BLOCK_REASONS: Record<string, string> = {
  'Bloqueado': 'Conta bloqueada por inadimplência. Regularize os pagamentos para reativar o suporte.',
  'Gratuita': 'Plano gratuito não inclui suporte técnico. Faça upgrade para um plano pago.',
  'Gratuito (cancelado da paga / downgrade)': 'Plano foi rebaixado para gratuito. Suporte não disponível.',
  'Cancelado Versão Gratuita (sem uso)': 'Conta cancelada por inatividade.',
  'Cancelado - Cliente': 'Contrato cancelado pelo cliente.',
  'Cancelado - Versão de Teste': 'Período de teste encerrado. Contrate um plano para ter suporte.',
};

const ELIGIBLE_STATUSES = ['Ativo', 'Trial 7 Dias'];

interface LicenseCheckRequest {
  phone?: string;
  cpf_cnpj?: string;
  email?: string;
  client_id?: string; // helpdesk_client uuid para buscar por vinculação
}

interface LicenseResult {
  gl_id: number;
  source_system: string;
  nome: string;
  fantasia: string;
  cpf_cnpj: string;
  email: string;
  telefone1: string;
  celular: string;
  status_pessoa: string;
  sistema_utilizado: string;
  support_eligible: boolean;
  block_reason: string | null;
  synced_at: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Remover código do país 55 se presente
  if (digits.length > 10 && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

// v1 — GL License Check: verifica elegibilidade de suporte por licença
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ version: "v1", status: "ok", ts: Date.now() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: LicenseCheckRequest = await req.json();
    const { phone, cpf_cnpj, email, client_id } = body;

    if (!phone && !cpf_cnpj && !email && !client_id) {
      return new Response(
        JSON.stringify({ error: "Informe pelo menos um: phone, cpf_cnpj, email ou client_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    let licenses: LicenseResult[] = [];

    // Se client_id fornecido, buscar dados do helpdesk_client primeiro
    let searchPhone = phone;
    let searchDoc = cpf_cnpj;
    let searchEmail = email;

    if (client_id) {
      const { data: client } = await supabase
        .from('helpdesk_clients')
        .select('phone, cnpj, cpf, email')
        .eq('id', client_id)
        .single();

      if (client) {
        searchPhone = searchPhone || client.phone;
        searchDoc = searchDoc || client.cnpj || client.cpf;
        searchEmail = searchEmail || client.email;
      }
    }

    // Usar a RPC gl_search_licenses para busca unificada
    const { data, error } = await supabase.rpc('gl_search_licenses', {
      p_phone: searchPhone || null,
      p_cpf_cnpj: searchDoc || null,
      p_email: searchEmail || null,
    });

    if (error) {
      console.error('[gl-license-check] RPC error:', error);
      // Fallback: busca direta na tabela
      const query = supabase.from('gl_client_licenses').select('*');
      const conditions: string[] = [];

      if (searchPhone) {
        const clean = normalizePhone(searchPhone);
        // Busca por telefone usando ilike
        conditions.push(`telefone1.ilike.%${clean}%`);
        conditions.push(`celular.ilike.%${clean}%`);
        conditions.push(`telefone2.ilike.%${clean}%`);
      }
      if (searchDoc) {
        conditions.push(`cpf_cnpj.eq.${searchDoc}`);
      }
      if (searchEmail) {
        conditions.push(`email.ilike.${searchEmail}`);
      }

      if (conditions.length > 0) {
        const { data: fallbackData } = await supabase
          .from('gl_client_licenses')
          .select('*')
          .or(conditions.join(','));

        if (fallbackData) {
          licenses = fallbackData.map((l: any) => ({
            gl_id: l.gl_id,
            source_system: l.source_system,
            nome: l.nome,
            fantasia: l.fantasia,
            cpf_cnpj: l.cpf_cnpj,
            email: l.email,
            telefone1: l.telefone1,
            celular: l.celular,
            status_pessoa: l.status_pessoa,
            sistema_utilizado: l.sistema_utilizado,
            support_eligible: ELIGIBLE_STATUSES.includes(l.status_pessoa),
            block_reason: BLOCK_REASONS[l.status_pessoa] || null,
            synced_at: l.synced_at,
          }));
        }
      }
    } else {
      licenses = data || [];
    }

    // Calcular elegibilidade geral
    const overallEligible = licenses.length === 0
      ? true  // Se não encontrou no GL, permitir (fallback seguro)
      : licenses.some((l) => l.support_eligible);

    const blockReasons = licenses
      .filter((l) => !l.support_eligible && l.block_reason)
      .map((l) => {
        const systemName = l.source_system === 'mais_simples' ? 'Mais Simples' : 'Maxpro';
        return `${systemName}: ${l.block_reason}`;
      });

    // Determinar ação
    let action: string | null = null;
    if (!overallEligible) {
      action = 'transfer_to_human';
    }

    // Resumo por produto
    const statusMaisSimples = licenses.find(l => l.source_system === 'mais_simples')?.status_pessoa || null;
    const statusMaxpro = licenses.find(l => l.source_system === 'maxpro')?.status_pessoa || null;

    const response = {
      found: licenses.length > 0,
      licenses_count: licenses.length,
      licenses: licenses.map((l) => ({
        source: l.source_system,
        gl_id: l.gl_id,
        nome: l.nome,
        fantasia: l.fantasia,
        cpf_cnpj: l.cpf_cnpj,
        status: l.status_pessoa,
        sistema_utilizado: l.sistema_utilizado,
        support_eligible: l.support_eligible,
        block_reason: l.block_reason,
      })),
      overall_eligible: overallEligible,
      block_reasons: blockReasons,
      status_mais_simples: statusMaisSimples,
      status_maxpro: statusMaxpro,
      action,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error('[gl-license-check] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
