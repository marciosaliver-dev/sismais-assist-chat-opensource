import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test({
  name: "ticket-solution-classifier - rejeita sem conversation_id",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ticket-solution-classifier`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ resolution_summary: "Problema resolvido" }),
    });
    assertEquals(response.status, 400);
    const result = await response.json();
    assertEquals(result.error, "conversation_id required");
  },
});

Deno.test({
  name: "ticket-solution-classifier - pula se resolution_summary vazio",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ticket-solution-classifier`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        conversation_id: "00000000-0000-0000-0000-000000000000",
        resolution_summary: "  ",
      }),
    });
    assertEquals(response.status, 200);
    const result = await response.json();
    assertEquals(result.skipped, true);
    assertEquals(result.reason, "empty_resolution_summary");
  },
});
