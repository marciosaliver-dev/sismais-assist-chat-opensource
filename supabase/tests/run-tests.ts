/**
 * Test Runner Script
 * Run: deno run --allow-net --allow-env supabase/tests/run-tests.ts
 * 
 * Or run individual tests:
 * deno test supabase/tests/kanban-create-ticket.test.ts
 * deno test supabase/tests/escalate-to-human.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://pomueweeulenslxvsxar.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Colors for output
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    console.log(yellow(`Running: ${name}`));
    await fn();
    results.push({ name, passed: true });
    console.log(green(`✓ PASSED: ${name}`));
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(red(`✗ FAILED: ${name}`));
    console.log(red(`  Error: ${error}`));
  }
}

async function testKanbanCreateTicket() {
  await runTest("kanban-create-ticket - cria ticket", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/kanban-create-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        title: "Test Ticket " + Date.now(),
        priority: "media",
      }),
    });

    const result = await response.json();
    assertEquals(response.status, 200);
    assertEquals(result.success, true);
    assertExists(result.ticket_id);
  });

  await runTest("kanban-create-ticket - rejeita sem titulo", async () => {
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
    assertEquals(response.status, 400);
  });
}

async function testEscalateToHuman() {
  await runTest("escalate-to-human - rejeita sem conversation_id", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/escalate-to-human`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        reason: "Test",
      }),
    });

    const result = await response.json();
    assertEquals(response.status, 400);
    assertEquals(result.error, "conversation_id obrigatorio");
  });
}

async function testCreateReminder() {
  await runTest("create-reminder - rejeita sem dados", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    assertEquals(response.status, 400);
  });

  await runTest("create-reminder - cria lembrete valido", async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        title: "Test Reminder " + Date.now(),
        due_date: futureDate,
      }),
    });

    const result = await response.json();
    assertEquals(response.status, 200);
    assertEquals(result.success, true);
  });
}

async function testScheduleCallback() {
  await runTest("schedule-callback - rejeita data passada", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/schedule-callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        client_phone: "11999999999",
        scheduled_time: pastDate,
      }),
    });

    const result = await response.json();
    assertEquals(response.status, 400);
  });

  await runTest("schedule-callback - cria callback valido", async () => {
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/schedule-callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        client_phone: "11999999999",
        scheduled_time: futureDate,
        reason: "Test callback",
      }),
    });

    const result = await response.json();
    assertEquals(response.status, 200);
    assertEquals(result.success, true);
  });
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 SISMAIS AI - Edge Functions Test Suite");
  console.log("=".repeat(60) + "\n");

  await testKanbanCreateTicket();
  await testEscalateToHuman();
  await testCreateReminder();
  await testScheduleCallback();

  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST RESULTS");
  console.log("=".repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\nTotal: ${results.length} | ${green("✓ " + passed)} | ${red("✗ " + failed)}`);
  
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${red("✗")} ${r.name}`);
      if (r.error) console.log(`    ${r.error}`);
    });
    Deno.exit(1);
  } else {
    console.log(green("\n🎉 All tests passed!"));
  }
}

main();
