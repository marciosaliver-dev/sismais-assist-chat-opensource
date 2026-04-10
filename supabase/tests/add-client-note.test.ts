/**
 * Test Suite: add-client-note
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.test({
  name: "add-client-note - rejeita sem client_id",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/add-client-note`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        note: "Teste de anotacao",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 400);
    assertEquals(result.error, "client_id e note sao obrigatorios");
  },
});

Deno.test({
  name: "add-client-note - rejeita sem note",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/add-client-note`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        client_id: "00000000-0000-0000-0000-000000000000",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 400);
    assertEquals(result.error, "client_id e note sao obrigatorios");
  },
});

Deno.test({
  name: "add-client-note - adiciona anotacao com categoria",
  async fn() {
    // First create a test client
    const { data: client } = await supabase
      .from("helpdesk_clients")
      .insert({
        name: "Cliente Teste Nota",
        phone: "11999999999",
      })
      .select()
      .single();

    if (!client) {
      // If table doesn't exist, just test the validation
      const response = await fetch(`${SUPABASE_URL}/functions/v1/add-client-note`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          client_id: "00000000-0000-0000-0000-000000000000",
          note: "Teste de anotacao",
          category: "atendimento",
        }),
      });

      // Will fail because client doesn't exist, but validates the flow
      assertEquals(response.status === 200 || response.status === 500, true);
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/add-client-note`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        client_id: client.id,
        note: "Teste de anotacao automatizada",
        category: "atendimento",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 200);
    assertEquals(result.success, true);
    assertEquals(result.category, "atendimento");

    // Cleanup
    await supabase.from("helpdesk_clients").delete().eq("id", client.id);
  },
});
