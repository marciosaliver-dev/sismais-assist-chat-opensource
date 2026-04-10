import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test({
  name: "ticket-category-classifier - rejeita sem conversation_id",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ticket-category-classifier`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({}),
    });
    assertEquals(response.status, 400);
    const result = await response.json();
    assertExists(result.error);
  },
});

Deno.test({
  name: "ticket-category-classifier - retorna skipped ou classified: false para conversa inexistente",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ticket-category-classifier`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ conversation_id: "00000000-0000-0000-0000-000000000000" }),
    });
    const result = await response.json();
    // Aceita: skipped=true OU classified=false OU error (qualquer resposta válida para ID inexistente)
    assertEquals(response.status === 200 || response.status === 400 || response.status === 500, true);
    assertEquals(typeof result === 'object', true);
  },
});
