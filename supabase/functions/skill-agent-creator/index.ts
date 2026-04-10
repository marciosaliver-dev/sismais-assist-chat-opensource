// DEPRECATED SHIM: esta função foi descontinuada em v2.73.5.
//
// Motivo: funcionalidade já é coberta por `ai-builder` em mode='skill',
// e zero call sites internos foram encontrados no codebase durante o audit
// da Onda 3 da refatoração do módulo de IA.
//
// Consumers externos devem migrar para:
//   supabase.functions.invoke('ai-builder', { body: { mode: 'skill', messages: [...] } })
//
// Remoção definitiva fica para Onda 3B após 14 dias de logs zerados.

import { corsHeaders } from "../_shared/supabase-helpers.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  console.warn(
    "[skill-agent-creator] DEPRECATED — caller should migrate to ai-builder mode='skill'"
  )

  return new Response(
    JSON.stringify({
      error: "gone",
      message:
        "skill-agent-creator foi descontinuada. Use ai-builder com mode='skill'.",
      migration: {
        from: "functions.invoke('skill-agent-creator', { body: { messages } })",
        to: "functions.invoke('ai-builder', { body: { mode: 'skill', messages } })",
      },
    }),
    {
      status: 410, // Gone
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  )
})
