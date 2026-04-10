import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test({
  name: "csat-processor - reconcile-missed retorna processed",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/csat-processor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ action: "reconcile-missed" }),
    });
    assertEquals(response.status, 200);
    const result = await response.json();
    assertEquals(result.success, true);
    assertEquals(typeof result.processed, "number");
  },
});

Deno.test({
  name: "csat-processor - action desconhecida retorna 400",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/csat-processor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ action: "action-que-nao-existe" }),
    });
    assertEquals(response.status, 400);
  },
});
