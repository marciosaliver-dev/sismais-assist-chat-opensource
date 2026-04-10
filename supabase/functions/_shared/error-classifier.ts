import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RoutingRule {
  pattern: string;
  squad_name: string;
  github_label: string;
  is_critical: boolean;
  discord_webhook_url: string | null;
  github_assignee: string | null;
  priority: number;
}

export interface ClassifiedError {
  error_hash: string;
  squad_name: string;
  github_label: string;
  github_assignee: string | null;
  discord_webhook_url: string | null;
  severity: string;
  is_duplicate: boolean;
  existing_issue_id: string | null;
  existing_github_issue_number: number | null;
  occurrence_count: number;
}

export function computeErrorHash(edgeFunction: string, errorType: string, errorMessage: string): string {
  const input = `${edgeFunction}:${errorType}:${errorMessage}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function matchRoutingRule(edgeFunction: string, rules: RoutingRule[]): RoutingRule {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (new RegExp(rule.pattern).test(edgeFunction)) {
      return rule;
    }
  }
  return sorted[sorted.length - 1];
}

export function classifySeverity(params: { is_critical: boolean; latency_ms: number | null; recentCount: number }): string {
  if (params.is_critical) return "critical";
  if (params.latency_ms && params.latency_ms > 25000) return "high";
  if (params.recentCount >= 3) return "high";
  return "medium";
}

export async function classifyError(
  supabase: SupabaseClient,
  edgeFunction: string,
  eventType: string,
  errorMessage: string,
  latencyMs: number | null
): Promise<ClassifiedError> {
  const { data: rules } = await supabase
    .from("error_routing_rules")
    .select("pattern, squad_name, github_label, is_critical, discord_webhook_url, github_assignee, priority")
    .order("priority", { ascending: true });

  const rule = matchRoutingRule(edgeFunction, rules || []);
  const errorHash = computeErrorHash(edgeFunction, eventType, errorMessage || "");

  const { data: existing } = await supabase
    .from("error_issues")
    .select("id, github_issue_number, occurrence_count")
    .eq("error_hash", errorHash)
    .neq("status", "resolved")
    .maybeSingle();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("pipeline_metrics")
    .select("id", { count: "exact", head: true })
    .eq("edge_function", edgeFunction)
    .eq("success", false)
    .gte("created_at", oneHourAgo);

  const severity = classifySeverity({
    is_critical: rule.is_critical,
    latency_ms: latencyMs,
    recentCount: recentCount || 0,
  });

  return {
    error_hash: errorHash,
    squad_name: rule.squad_name,
    github_label: rule.github_label,
    github_assignee: rule.github_assignee,
    discord_webhook_url: rule.discord_webhook_url,
    severity,
    is_duplicate: !!existing,
    existing_issue_id: existing?.id || null,
    existing_github_issue_number: existing?.github_issue_number || null,
    occurrence_count: existing ? existing.occurrence_count + 1 : 1,
  };
}
