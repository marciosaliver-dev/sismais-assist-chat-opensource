/**
 * Test Suite: kanban-create-ticket
 * Run: npx supabase functions serve --env-file .env.local
 * Then: deno test supabase/tests/kanban-create-ticket.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.test({
  name: "kanban-create-ticket - cria ticket com dados minimos",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/kanban-create-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        title: "Test Ticket - " + new Date().toISOString(),
        priority: "media",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 200, "Status deve ser 200");
    assertEquals(result.success, true, "Success deve ser true");
    assertExists(result.ticket_id, "ticket_id deve existir");
    assertExists(result.ticket_number, "ticket_number deve existir");
    
    // Cleanup
    if (result.ticket_id) {
      await supabase.from("kanban_cards").delete().eq("id", result.ticket_id);
    }
  },
});

Deno.test({
  name: "kanban-create-ticket - rejeita sem titulo",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/kanban-create-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        priority: "alta",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 400, "Status deve ser 400");
    assertEquals(result.error, "title obrigatorio", "Erro deve indicar titulo obrigatorio");
  },
});

Deno.test({
  name: "kanban-create-ticket - cria com todas as propriedades",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/kanban-create-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        title: "Test Ticket Completo",
        description: "Descricao do ticket de teste",
        priority: "alta",
        board_slug: "suporte",
        stage: "novo",
        tags: ["teste", "automacao"],
        customer_phone: "11999999999",
        customer_name: "Cliente Teste",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 200, "Status deve ser 200");
    assertEquals(result.success, true, "Success deve ser true");
    assertEquals(result.title, "Test Ticket Completo");
    assertEquals(result.priority, "alta");
    
    // Cleanup
    if (result.ticket_id) {
      await supabase.from("kanban_cards").delete().eq("id", result.ticket_id);
    }
  },
});

Deno.test({
  name: "kanban-create-ticket - priority critica mapeia para alta",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/kanban-create-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        title: "Test Prioridade Critica",
        priority: "critica",
      }),
    });

    const result = await response.json();
    
    assertEquals(response.status, 200, "Status deve ser 200");
    // Prioridade critica deve ser mapeada para alta na criacao
    assertEquals(result.priority, "alta", "Critica deve ser mapeada para alta");
    
    // Cleanup
    if (result.ticket_id) {
      await supabase.from("kanban_cards").delete().eq("id", result.ticket_id);
    }
  },
});
