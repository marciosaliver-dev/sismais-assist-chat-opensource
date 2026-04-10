// DEPRECATED SHIM: esta função foi descontinuada em v2.73.7.
//
// Motivo: investigação em produção (Onda 4 da refatoração do módulo de IA)
// confirmou dead code:
//   - 0 chamadas em ai_api_logs nos últimos 30 dias
//   - 0 cron jobs que a invocam
//   - 0 call sites no repo (backend e frontend)
//   - ai_training_examples com apenas 1 insert há 2 dias (teste manual)
//   - ai_patterns vazio
//
// As RPCs que essa função orquestrava (collect_training_example,
// register_interaction_pattern, generate_fine_tuning_dataset,
// analyze_agent_performance_for_adjustments) permanecem no banco e
// podem ser invocadas diretamente caso necessário no futuro.
//
// Se algum consumer externo começar a receber HTTP 410, reativar:
// 1. Restaurar arquivo via git history (commit anterior ao da Onda 4B)
// 2. Redeploy: `npx supabase functions deploy fine-tuning-loop --project-ref pomueweeulenslxvsxar`
//
// Remoção definitiva via Supabase Dashboard fica para Onda 4C manual,
// após 14 dias de logs confirmarem zero chamadas mesmo após este shim.

import { corsHeaders } from "../_shared/supabase-helpers.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  console.warn(
    "[fine-tuning-loop] DEPRECATED — confirmed dead code in Onda 4 audit"
  )

  return new Response(
    JSON.stringify({
      error: "gone",
      message:
        "fine-tuning-loop foi descontinuada após auditoria confirmar zero uso em 30 dias. As RPCs do banco permanecem disponíveis para uso direto.",
      alternative: {
        description:
          "Chame as RPCs diretamente via Supabase client se necessário.",
        rpcs: [
          "collect_training_example",
          "register_interaction_pattern",
          "generate_fine_tuning_dataset",
          "analyze_agent_performance_for_adjustments",
        ],
      },
    }),
    {
      status: 410, // Gone
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  )
})
