/**
 * Feature Flags — Sismais Helpdesk IA
 *
 * Controla a ativação progressiva de novas funcionalidades.
 * Ativar via variáveis de ambiente no Supabase:
 *   supabase secrets set FF_PROCESSING_LOCK=true
 *
 * Em staging/dev, ativar primeiro para validar.
 * Em produção, ativar após testes confirmados.
 */

export const FLAGS = {
  /**
   * Ativa o semáforo de processamento por conversa (conversation_processing_lock).
   * Previne que múltiplas edge functions processem a mesma conversa simultaneamente.
   * Requer migration 20260306160000_add_processing_lock.sql aplicada.
   */
  USE_PROCESSING_LOCK: Deno.env.get('FF_PROCESSING_LOCK') === 'true',

  /**
   * Desativa automation-executor para trigger message_received.
   * Automações legadas de "message_received" passam a ser ignoradas;
   * flows do flow-engine assumem esse papel de forma coordenada.
   * ATENÇÃO: migrar automações message_received para flows antes de ativar.
   */
  DISABLE_LEGACY_AUTOMATIONS_FOR_MESSAGES: Deno.env.get('FF_DISABLE_LEGACY_AUTO') === 'true',

  /**
   * Faz trigger-flows rodar em modo await (não fire & forget).
   * Permite que process-incoming-message saiba se um flow enviou mensagem
   * e pule o agente IA nesse caso (evita resposta duplicada).
   */
  FLOWS_BLOCK_AGENT: Deno.env.get('FF_FLOWS_BLOCK_AGENT') === 'true',

  /**
   * Ativa o shadow mode do pipeline completo (process-incoming-message).
   * Quando ativo, o webhook envia mensagens para AMBOS os pipelines:
   * - ai-whatsapp-reply (produção, envia resposta ao cliente)
   * - process-incoming-message (shadow, processa mas NÃO envia resposta)
   * Útil para validar o pipeline completo sem impactar o cliente.
   * Pré-requisito: Desativar antes de ativar FF_NEW_PIPELINE.
   */
  SHADOW_PIPELINE: (Deno.env.get('FF_SHADOW_PIPELINE') ?? 'false') === 'true',

  /**
   * Ativa o pipeline completo (process-incoming-message) como pipeline PRINCIPAL.
   * Quando ativo, o webhook chama process-incoming-message em vez de ai-whatsapp-reply.
   * ai-whatsapp-reply passa a ser fallback de emergência.
   * ATENÇÃO: Validar métricas do shadow mode antes de ativar.
   * Pré-requisito: FF_SHADOW_PIPELINE deve ter sido validado com sucesso.
   */
  NEW_PIPELINE: (Deno.env.get('FF_NEW_PIPELINE') ?? 'true') === 'true',

  /**
   * Ativa o debounce assíncrono via banco de dados.
   * Quando ativo, o webhook salva a mensagem e retorna imediatamente.
   * Um check posterior (via pg_notify ou re-invocação) processa o batch.
   * Quando desativado, usa o debounce síncrono de 5s (legado).
   */
  ASYNC_DEBOUNCE: (Deno.env.get('FF_ASYNC_DEBOUNCE') ?? 'true') === 'true',

  /**
   * Tempo máximo (em minutos) que uma conversa pode ficar em handler_type='human'
   * sem resposta humana antes de voltar automaticamente para IA.
   * Default: 0 (desativado). Recomendado: 15-30 minutos.
   */
  HUMAN_TIMEOUT_MINUTES: parseInt(Deno.env.get('FF_HUMAN_TIMEOUT_MINUTES') || '15', 10),

  /**
   * Ativa o workflow-engine unificado como substituto de:
   *   - automation-executor (ai_automations)
   *   - trigger-flows + flow-engine + flow-executor (flow_automations)
   * Quando ativo, process-incoming-message chama workflow-engine
   * em vez dos executores individuais.
   * Pre-requisito: deploy do workflow-engine edge function.
   */
  UNIFIED_WORKFLOW_ENGINE: (Deno.env.get('FF_UNIFIED_WORKFLOW_ENGINE') ?? 'true') === 'true',

  /**
   * Ativa busca híbrida (vector + full-text com RRF) no RAG.
   * Quando desativado, usa apenas busca vetorial (search_knowledge).
   * Requer migration 20260319120000_rag_improvements.sql aplicada.
   */
  RAG_HYBRID_SEARCH: (Deno.env.get('FF_RAG_HYBRID_SEARCH') ?? 'true') === 'true',

  /**
   * Ativa re-ranking LLM dos resultados RAG.
   * Após busca vetorial/híbrida, um LLM leve re-ordena por relevância contextual.
   * Aumenta latência em ~500ms mas melhora precision significativamente.
   */
  RAG_RERANK: Deno.env.get('FF_RAG_RERANK') === 'true',

  /**
   * Ativa chunking semântico (por parágrafos/seções) em vez de fixo por caracteres.
   * Melhora qualidade dos embeddings mas pode gerar chunks de tamanho variável.
   */
  RAG_SEMANTIC_CHUNKING: Deno.env.get('FF_RAG_SEMANTIC_CHUNKING') === 'true',

  /**
   * Ativa tracking de retrieval quality (ratings) no agent-executor.
   * Registra quais documentos RAG foram usados e com que efetividade.
   */
  RAG_QUALITY_TRACKING: (Deno.env.get('FF_RAG_QUALITY_TRACKING') ?? 'true') === 'true',

  /**
   * Ativa a gravação de métricas do pipeline na tabela pipeline_metrics.
   * Fase 1 de analytics: latência, contadores, taxa de erro.
   * Requer migration 20260319120000_pipeline_metrics.sql aplicada.
   * As inserções são fire-and-forget (não impactam latência do pipeline).
   */
  PIPELINE_METRICS: (Deno.env.get('FF_PIPELINE_METRICS') ?? 'true') === 'true',

  /**
   * Ativa o uso de contadores atômicos via RPC (increment_counter).
   * Quando ativado, usa funções SQL em vez de SELECT+UPDATE para contadores.
   * Requer migration 20260319120000_infra_resilience.sql aplicada.
   */
  ATOMIC_COUNTERS: (Deno.env.get('FF_ATOMIC_COUNTERS') ?? 'true') === 'true',

  /**
   * Ativa circuit breaker para chamadas ao OpenRouter.
   * Quando o circuit breaker abre (após N falhas), retorna erro imediato
   * sem tentar chamar o LLM, reduzindo latência em cenários de indisponibilidade.
   */
  CIRCUIT_BREAKER_LLM: Deno.env.get('FF_CIRCUIT_BREAKER_LLM') === 'true',

  /**
   * Ativa logs estruturados (JSON) com correlation ID (x-request-id).
   * Quando ativado, usa createLogger em vez de console.log direto.
   * Propagado entre edge functions via header x-request-id.
   */
  STRUCTURED_LOGGING: (Deno.env.get('FF_STRUCTURED_LOGGING') ?? 'true') === 'true',

  /**
   * Ativa a API publica REST v1 para integradores terceiros.
   * Quando desativado, o endpoint api-v1 retorna 503 Service Unavailable.
   * Requer migration 20260319200000_api_keys_and_webhooks.sql aplicada.
   */
  PUBLIC_API: Deno.env.get('FF_PUBLIC_API') === 'true',

  /**
   * Ativa o canal Meta WhatsApp Business API (Cloud API oficial).
   * Quando ativado, o webhook meta-whatsapp-webhook processa mensagens.
   * Requer: META_WHATSAPP_VERIFY_TOKEN, META_WHATSAPP_APP_SECRET,
   * e pelo menos uma instancia em channel_instances com channel_type='meta_whatsapp'.
   */
  CHANNEL_META_WHATSAPP: Deno.env.get('FF_CHANNEL_META_WHATSAPP') === 'true',

  /**
   * Ativa o canal Instagram Messaging API.
   * Quando ativado, o webhook instagram-webhook processa DMs e story mentions.
   * Requer: INSTAGRAM_VERIFY_TOKEN, META_WHATSAPP_APP_SECRET (mesmo app),
   * e pelo menos uma instancia em channel_instances com channel_type='instagram'.
   */
  CHANNEL_INSTAGRAM: Deno.env.get('FF_CHANNEL_INSTAGRAM') === 'true',

  /**
   * Ativa o roteamento multi-canal unificado.
   * Quando ativado, process-incoming-message usa channel-router para
   * enviar respostas pelo canal correto (em vez de sempre UAZAPI).
   * Pre-requisito: Tabelas channel_instances e channel_messages criadas.
   */
  MULTICHANNEL_ROUTING: Deno.env.get('FF_MULTICHANNEL_ROUTING') === 'true',

  /**
   * Threshold de confidence para escalacao automatica.
   * Se a resposta do agente tiver confidence abaixo deste valor (0-1),
   * a conversa e escalada para humano automaticamente.
   * Default: 0 (desativado). Recomendado: 0.3-0.5.
   */
  CONFIDENCE_THRESHOLD: parseFloat(Deno.env.get('FF_CONFIDENCE_THRESHOLD') || '0.3'),
} as const

export type FeatureFlag = keyof typeof FLAGS
