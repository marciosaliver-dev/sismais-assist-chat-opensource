import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getModelConfig } from "../_shared/get-model-config.ts";
import { callOpenRouterEmbedding } from "../_shared/openrouter-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1000
): Promise<{ result: T; retryCount: number }> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retryCount: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[generate-embedding] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { document_id } = body;
    let { content, title } = body;

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "document_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client early to read config
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Se content não foi enviado no body, buscar do banco
    if (!content) {
      const { data: doc, error: docError } = await supabaseAdmin
        .from("ai_knowledge_base")
        .select("content, title")
        .eq("id", document_id)
        .single();

      if (docError || !doc?.content) {
        return new Response(
          JSON.stringify({ error: `Document ${document_id} not found or has no content` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      content = doc.content;
      title = title || doc.title;
    }

    // Read embedding model from platform config
    const { model: embeddingModel } = await getModelConfig(
      supabaseAdmin,
      "embedding",
      "openai/text-embedding-3-small"
    );
    // Ensure model has provider prefix for OpenRouter
    const openRouterModel = embeddingModel.includes("/") ? embeddingModel : `openai/${embeddingModel}`;
    console.log(`[generate-embedding] Using model: ${openRouterModel}`);

    // Combine title + content for richer semantic embedding
    const textToEmbed = title ? `${title}\n\n${content}` : content;
    const truncatedText = textToEmbed.slice(0, 32000);

    // Call OpenRouter Embeddings API with retry
    const startTime = Date.now();
    let retryCount = 0;
    let embResult;
    let embeddingError: string | null = null;

    try {
      const retried = await retryWithBackoff(() =>
        callOpenRouterEmbedding({
          model: openRouterModel,
          input: truncatedText,
        })
      );
      embResult = retried.result;
      retryCount = retried.retryCount;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      embeddingError = err instanceof Error ? err.message : String(err);

      // Log failure
      await supabaseAdmin.from("kb_sync_log").insert({
        article_id: document_id,
        action: "embed_failed",
        status: "error",
        error_message: embeddingError,
        retry_count: retryCount,
        latency_ms: latencyMs,
      });

      throw err;
    }

    const latencyMs = Date.now() - startTime;
    const embedding = embResult.embedding;

    if (!embedding || embedding.length === 0) {
      const errorMsg = `Invalid embedding: got ${embedding?.length || 0} dimensions`;
      await supabaseAdmin.from("kb_sync_log").insert({
        article_id: document_id,
        action: "embed_failed",
        status: "error",
        error_message: errorMsg,
        retry_count: retryCount,
        latency_ms: latencyMs,
      });
      throw new Error(errorMsg);
    }

    if (embedding.length !== 1536) {
      console.warn(`[generate-embedding] WARNING: model ${openRouterModel} returned ${embedding.length} dimensions, but DB column is vector(1536). This may cause errors.`);
    }

    // Save embedding to database
    const embeddingStr = `[${embedding.join(",")}]`;

    const { error: updateError } = await supabaseAdmin
      .from("ai_knowledge_base")
      .update({ embedding: embeddingStr })
      .eq("id", document_id);

    if (updateError) {
      console.error("Failed to save embedding:", updateError);
      await supabaseAdmin.from("kb_sync_log").insert({
        article_id: document_id,
        action: "embed_failed",
        status: "error",
        error_message: `Failed to save embedding: ${updateError.message}`,
        retry_count: retryCount,
        latency_ms: Date.now() - startTime,
      });
      throw new Error(`Failed to save embedding: ${updateError.message}`);
    }

    const tokensUsed = embResult.tokens_used;
    console.log(`Embedding generated for doc ${document_id} (${tokensUsed} tokens, ${embedding.length} dims, model: ${openRouterModel})`);

    // Log success
    await supabaseAdmin.from("kb_sync_log").insert({
      article_id: document_id,
      action: "embed_created",
      status: "success",
      error_message: null,
      retry_count: retryCount,
      latency_ms: latencyMs,
    });

    return new Response(
      JSON.stringify({ success: true, document_id, tokens_used: tokensUsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-embedding error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
