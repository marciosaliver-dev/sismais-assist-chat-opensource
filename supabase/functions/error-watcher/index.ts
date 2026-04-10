import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classifyError } from "../_shared/error-classifier.ts";
import {
  buildIssueTitle,
  buildIssueBody,
  createGitHubIssue,
  addGitHubIssueComment,
} from "../_shared/github-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const githubToken = Deno.env.get("GITHUB_PAT_ERROR_WATCHER")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Payload from Supabase Database Webhook (INSERT on pipeline_metrics)
    const payload = await req.json();
    const record = payload.record || payload;

    const {
      edge_function,
      event_type,
      error_message,
      request_id,
      latency_ms,
      success,
    } = record;

    // Only process errors
    if (success !== false) {
      return new Response(JSON.stringify({ skipped: true, reason: "not an error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Classify the error
    const classified = await classifyError(
      supabase,
      edge_function,
      event_type || "unknown",
      error_message || "No error message",
      latency_ms || null
    );

    if (classified.is_duplicate) {
      // Update occurrence count and comment on existing issue
      await supabase
        .from("error_issues")
        .update({ occurrence_count: classified.occurrence_count })
        .eq("id", classified.existing_issue_id);

      await addGitHubIssueComment(
        githubToken,
        classified.existing_github_issue_number!,
        `🔄 Nova ocorrencia detectada (#${classified.occurrence_count})\n\n- **Severidade atual:** ${classified.severity}\n- **Request ID:** ${request_id || "N/A"}\n- **Latencia:** ${latency_ms ? latency_ms + "ms" : "N/A"}\n- **Timestamp:** ${new Date().toISOString()}`
      );

      console.log(JSON.stringify({
        level: "info",
        msg: "duplicate_error_updated",
        issue_number: classified.existing_github_issue_number,
        occurrence_count: classified.occurrence_count,
      }));

      return new Response(JSON.stringify({
        action: "updated_existing",
        issue_number: classified.existing_github_issue_number,
        occurrence_count: classified.occurrence_count,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new GitHub Issue
    const title = buildIssueTitle(edge_function, error_message || "Unknown error");
    const body = buildIssueBody({
      edge_function,
      event_type: event_type || "unknown",
      error_message: error_message || "No error message",
      severity: classified.severity,
      squad_name: classified.squad_name,
      request_id: request_id || null,
      latency_ms: latency_ms || null,
      occurrence_count: 1,
    });

    const labels = ["bug", "auto-detected", classified.github_label, `severity:${classified.severity}`];
    const issue = await createGitHubIssue(githubToken, title, body, labels, classified.github_assignee);

    // Save to error_issues table
    await supabase.from("error_issues").insert({
      error_hash: classified.error_hash,
      github_issue_number: issue.number,
      github_url: issue.html_url,
      edge_function,
      error_message: error_message || null,
      squad_name: classified.squad_name,
      severity: classified.severity,
    });

    // Send Discord notification
    if (classified.discord_webhook_url) {
      await sendDiscordNotification(classified.discord_webhook_url, {
        edge_function,
        severity: classified.severity,
        squad_name: classified.squad_name,
        occurrence_count: 1,
        github_url: issue.html_url,
      });
    }

    // Fallback: use default Discord webhook if no squad-specific one
    const defaultDiscordWebhook = Deno.env.get("DISCORD_WEBHOOK_ERRORS");
    if (!classified.discord_webhook_url && defaultDiscordWebhook) {
      await sendDiscordNotification(defaultDiscordWebhook, {
        edge_function,
        severity: classified.severity,
        squad_name: classified.squad_name,
        occurrence_count: 1,
        github_url: issue.html_url,
      });
    }

    console.log(JSON.stringify({
      level: "info",
      msg: "new_error_issue_created",
      issue_number: issue.number,
      squad: classified.squad_name,
      severity: classified.severity,
    }));

    return new Response(JSON.stringify({
      action: "created_issue",
      issue_number: issue.number,
      github_url: issue.html_url,
      squad: classified.squad_name,
      severity: classified.severity,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(JSON.stringify({
      level: "error",
      msg: "error_watcher_failed",
      error: err instanceof Error ? err.message : String(err),
    }));
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface DiscordParams {
  edge_function: string;
  severity: string;
  squad_name: string;
  occurrence_count: number;
  github_url: string;
}

async function sendDiscordNotification(webhookUrl: string, params: DiscordParams): Promise<void> {
  const colorMap: Record<string, number> = {
    critical: 0xff0000,
    high: 0xff6600,
    medium: 0xffcc00,
  };

  const embed = {
    title: `🔴 Erro Detectado — ${params.edge_function}`,
    color: colorMap[params.severity] || 0xffcc00,
    fields: [
      { name: "Severidade", value: params.severity, inline: true },
      { name: "Squad", value: params.squad_name, inline: true },
      { name: "Ocorrencias", value: String(params.occurrence_count), inline: true },
      { name: "GitHub Issue", value: params.github_url },
    ],
    footer: { text: "Acao: Squad deve corrigir e abrir PR para aprovacao." },
    timestamp: new Date().toISOString(),
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch((e) => console.error("Discord webhook failed:", e));
}
