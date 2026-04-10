/**
 * Test Suite: escalate-to-human
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.test({
  name: "escalate-to-human - rejeita sem conversation_id",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/escalate-to-human`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        reason: "Teste de escalacao",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 400);
    assertEquals(result.error, "conversation_id obrigatorio");
  },
});

Deno.test({
  name: "escalate-to-human - rejeita conversa inexistente",
  async fn() {
    const fakeUuid = "00000000-0000-0000-0000-000000000000";
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/escalate-to-human`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        conversation_id: fakeUuid,
        reason: "Teste de escalacao",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 404);
    assertEquals(result.error, "Conversa nao encontrada");
  },
});

Deno.test({
  name: "escalate-to-human - escala conversa existente",
  async fn() {
    // First create a test conversation
    const { data: conv } = await supabase
      .from("ai_conversations")
      .insert({
        customer_phone: "11999999999",
        status: "em_atendimento",
        handler_type: "ai",
      })
      .select()
      .single();

    if (!conv) {
      throw new Error("Failed to create test conversation");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/escalate-to-human`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        conversation_id: conv.id,
        reason: "Cliente solicitou atendimento humano",
        priority: "high",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 200);
    assertEquals(result.success, true);
    assertEquals(result.conversation_id, conv.id);
    assertEquals(result.status, "aguardando");

    // Verify conversation was updated
    const { data: updated } = await supabase
      .from("ai_conversations")
      .select("handler_type, status, escalation_reason")
      .eq("id", conv.id)
      .single();

    assertEquals(updated?.handler_type, "human");
    assertEquals(updated?.status, "aguardando");
    assertEquals(updated?.escalation_reason, "Cliente solicitou atendimento humano");

    // Cleanup
    await supabase.from("ai_conversations").delete().eq("id", conv.id);
  },
});
