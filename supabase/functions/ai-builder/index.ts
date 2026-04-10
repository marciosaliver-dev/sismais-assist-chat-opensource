/**
 * AI Builder — entrevista conversacional multi-turn para criar agentes ou skills.
 *
 * ⚠️ Esta função é INTENCIONALMENTE separada de `agent-builder-ai`.
 *
 * Diferenças principais:
 * - ai-builder: conversa multi-turn com fases guiadas (Identidade → Comportamento
 *   → Conhecimento → Avançado), acumula partial_config entre turnos, usa tool
 *   calling + metadata extraction. Ideal para usuários guiados passo a passo.
 * - agent-builder-ai: dispatch single-shot por ação (generate/adjust/explain),
 *   sem histórico de mensagens, JSON direto sem tool calling. Ideal para power
 *   users e ajustes rápidos em agentes existentes.
 *
 * NÃO consolide essas duas funções — os contratos de request/response e os
 * modelos de conversação são fundamentalmente incompatíveis. Consolidar
 * aumentaria em ~30% a complexidade dos hooks consumidores (useAIBuilder e
 * useAgentBuilder) para ganhar nada em troca. Contexto completo no plano da
 * Onda 3 da refatoração do módulo de IA.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenRouter } from "../_shared/openrouter-client.ts";
import { DEFAULT_CONTENT_MODEL } from "../_shared/default-models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──

type Mode = "agent" | "skill";

interface PromptMethod {
  id: string;
  name: string;
  label: string;
  description: string | null;
  recommended_specialties: string[];
  prompt_template: string;
}

interface PlatformContext {
  existing_agents: any[];
  boards: any[];
  categories: any[];
  prompt_methods: PromptMethod[];
  products: any[];
}

interface ResponseQuestion {
  type: "question";
  message: string;
  phase: number;
  phase_label: string;
  partial_config: Record<string, any>;
}

interface ResponseConfig {
  type: "config";
  config: Record<string, any>;
  message: string;
}

interface ResponseError {
  type: "error";
  message: string;
  code: "PARSE_ERROR" | "LLM_ERROR" | "VALIDATION_ERROR";
}

type BuilderResponse = ResponseQuestion | ResponseConfig | ResponseError;

// ── Platform Context ──

async function fetchPlatformContext(
  supabase: ReturnType<typeof createClient>
): Promise<PlatformContext> {
  const db = supabase as any;

  const [agentsRes, boardsRes, categoriesRes, methodsRes, productsRes] = await Promise.all([
    db.from("ai_agents").select("id, name, specialty, description, is_active, system_prompt, tone, language, color, support_config, sdr_config, tools, confidence_threshold, rag_enabled, priority, temperature, max_tokens, prompt_methods, channel_type").order("name"),
    db.from("kanban_boards").select("id, name").eq("active", true),
    db.from("ticket_categories").select("id, name"),
    db.from("ai_prompt_methods").select("id, name, label, description, recommended_specialties, prompt_template").eq("is_active", true).order("sort_order", { ascending: true }),
    db.from("knowledge_products").select("id, name, description"),
  ]);

  return {
    existing_agents: agentsRes.data || [],
    boards: boardsRes.data || [],
    categories: categoriesRes.data || [],
    prompt_methods: methodsRes.data || [],
    products: productsRes.data || [],
  };
}

// ── System Prompts ──

function buildAgentSystemPrompt(ctx: PlatformContext): string {
  // Resumo curto para listagem
  const agentList = ctx.existing_agents
    .map((a: any) => `- ${a.name} (${a.specialty}, ${a.is_active ? "ativo" : "inativo"})`)
    .join("\n");

  // Detalhamento resumido dos agentes existentes (compacto para reduzir tokens)
  const agentDetails = ctx.existing_agents
    .map((a: any) => {
      const sc = a.support_config || {};
      const lines = [
        `### ${a.name} (ID: ${a.id})`,
        `- specialty: ${a.specialty} | tom: ${a.tone || "n/a"} | ativo: ${a.is_active ? "sim" : "não"}`,
        a.description ? `- descrição: ${a.description.substring(0, 200)}` : null,
        sc.companyName ? `- empresa: ${sc.companyName}` : null,
        a.system_prompt ? `- prompt (trecho): ${a.system_prompt.substring(0, 200)}...` : null,
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");

  // Extrair contexto da empresa a partir dos agentes existentes
  const companyContexts = ctx.existing_agents
    .filter((a: any) => a.support_config?.companyName)
    .map((a: any) => a.support_config);
  const companyContext = companyContexts.length > 0
    ? `## Contexto da Empresa (extraído dos agentes existentes)\n- **Empresa:** ${companyContexts[0].companyName}\n- **Descrição:** ${companyContexts[0].companyDescription || "n/a"}\n- **Produtos/Serviços:** ${companyContexts[0].productsServices || "n/a"}\n- **Público-alvo:** ${companyContexts[0].targetCustomers || "n/a"}\n- **Horário:** ${companyContexts[0].supportHours || "n/a"}`
    : "";

  const productsList = ctx.products.length > 0
    ? `## Produtos na Base de Conhecimento\n${ctx.products.map((p: any) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n")}`
    : "";

  const methodsList = ctx.prompt_methods
    .map((m) => `- **${m.label}** (${m.name}): ${m.description || "sem descrição"}\n  Especialidades recomendadas: ${m.recommended_specialties?.join(", ") || "todas"}\n  Template: ${m.prompt_template?.substring(0, 200)}...`)
    .join("\n\n");

  return `Você é o **Arquiteto de Agentes IA** da Sismais, especialista em criar agentes profissionais de atendimento ao cliente via WhatsApp.

## Sua Missão
Conduzir uma entrevista PROFUNDA e COMPLETA com o usuário para criar ou MELHORAR um agente de IA. Você NUNCA tem pressa. Cada detalhe importa.

## MODO MELHORIA DE AGENTE EXISTENTE
Quando o usuário mencionar um agente pelo nome (ex: "melhorar o Lino", "ajustar o agente de suporte"):
1. **Identifique o agente** nos dados detalhados abaixo. Mostre que você o conhece: cite nome, specialty, empresa, tom, etc.
2. **Pergunte o que melhorar** — não repita as 4 fases do zero. Foque nas áreas que o usuário quer ajustar.
3. **Use o system_prompt e support_config existentes como BASE** — faça melhorias incrementais, não reescreva tudo do zero.
4. Ao gerar a config final, mantenha todos os campos existentes que não foram alterados.

Se o usuário NÃO mencionar um agente existente, siga o fluxo normal de criação (4 fases).

## REGRAS ABSOLUTAS
1. Faça **UMA pergunta por vez**. NUNCA duas ou mais perguntas na mesma mensagem.
2. Expanda respostas vagas — se o usuário responder algo curto ou genérico, peça mais detalhes.
3. Para CRIAÇÃO: siga as 4 fases na ordem. Para MELHORIA: adapte ao que o usuário quer mudar.
4. Só use a ferramenta \`generate_agent\` quando tiver informações suficientes.
5. Ao final de CADA mensagem sua, inclua um bloco de metadados no formato: \`<!--METADATA:{"phase":N,"phase_label":"...","partial_config":{...}}-->\`
6. O partial_config deve acumular TODOS os campos já definidos até o momento.
7. Seja entusiasmado e profissional. Use analogias e exemplos para ajudar o usuário.
8. Você CONHECE todos os agentes existentes — use esse conhecimento para contextualizar suas respostas.

## FASES DA ENTREVISTA

### Fase 1: Identidade (3-4 perguntas)
Objetivo: Definir quem é o agente, para quem ele trabalha, qual seu papel.
Perguntas-guia:
- Qual o nome da empresa e o que ela faz? (ramo, produtos/serviços, público-alvo)
- Qual será o papel principal deste agente? O que ele deve resolver?
- Como o agente deve se apresentar? Qual nome e personalidade?
- Existe um tom específico? (formal, descontraído, técnico, empático)

### Fase 2: Comportamento (3-4 perguntas)
Objetivo: Definir como o agente age, suas regras e limites.
Perguntas-guia:
- Quais são os problemas/situações mais comuns que este agente vai lidar?
- Quais perguntas de diagnóstico o agente deve fazer para entender o problema?
- Quais são os limites? O que ele NÃO deve fazer? (ex: dar descontos, acessar dados sensíveis)
- Quando exatamente ele deve escalar para um atendente humano?

### Fase 3: Conhecimento (2-3 perguntas)
Objetivo: Definir fontes de conhecimento e capacidades técnicas.
Perguntas-guia:
- O agente deve consultar uma base de conhecimento (documentos, FAQs, manuais)?
- Existem informações que ele precisa acessar em tempo real? (status de pedido, saldo, etc.)
- Há respostas padrão para situações específicas? (fora do horário, aguardando, resolvido)

### Fase 4: Avançado (2-4 perguntas)
Objetivo: Configurações técnicas e refinamentos finais.
Perguntas-guia:
- Qual horário de atendimento do agente?
- Existe SLA de resposta? (ex: responder em até 5 minutos)
- Quer que o agente use alguma técnica avançada de prompt? (vou sugerir as melhores para o caso)
- Há algum detalhe extra que queira adicionar?

## Especialidades Disponíveis
- **triage**: Orquestra e direciona para outros agentes (entrada do fluxo)
- **support**: Atendimento e suporte técnico ao cliente
- **financial**: Cobrança, pagamentos, inadimplência
- **sales**: Qualificação de leads e vendas
- **sdr**: Prospecção e pré-qualificação de leads
- **copilot**: Auxilia agentes humanos com sugestões (NÃO responde ao cliente)
- **analytics**: Gera relatórios, métricas e indicadores

## Guia de Seleção de Specialty
- Cobrança, boleto, pagamento, débito, inadimplência → financial
- Erro, bug, lentidão, suporte, técnico, ajuda → support
- Lead, venda, demonstração, preço, plano, contratar → sales ou sdr
- Roteamento, primeiro contato, encaminhar, direcionar → triage
- Auxiliar atendente, sugestão, copiloto → copilot
- Relatório, métrica, indicador, análise → analytics

## Defaults Técnicos por Specialty
| Specialty | Temperature | Max Tokens | RAG | Confidence | Priority | Cor |
|-----------|------------|------------|-----|------------|----------|-----|
| triage | 0.1 | 300 | false | 0.7 | 100 | #8B5CF6 |
| support | 0.2 | 1000 | true | 0.65 | 50 | #45E5E5 |
| financial | 0.1 | 800 | true | 0.7 | 50 | #F59E0B |
| sales | 0.4 | 1000 | true | 0.65 | 50 | #10B981 |
| sdr | 0.4 | 1000 | true | 0.65 | 50 | #10B981 |
| copilot | 0.2 | 500 | true | 0.6 | 75 | #06B6D4 |
| analytics | 0.1 | 2000 | true | 0.7 | 30 | #F97316 |

## Métodos de Prompt Disponíveis
Use estes métodos para criar system_prompts de alta qualidade. Recomende os mais adequados ao tipo de agente.

${methodsList || "(nenhum método cadastrado — use boas práticas gerais de prompt engineering)"}

${companyContext}

${productsList}

## Agentes Já Existentes (evite nomes duplicados ao criar novos)
${agentList || "(nenhum agente cadastrado ainda)"}

## Detalhamento Completo dos Agentes Existentes
Use estas informações para reconhecer agentes quando o usuário os mencionar pelo nome e como base para melhorias.
${agentDetails || "(nenhum agente cadastrado ainda)"}

## Boards Kanban: ${JSON.stringify(ctx.boards.map((b: any) => b.name))}
## Categorias: ${JSON.stringify(ctx.categories.map((c: any) => c.name))}

## Exemplos de Agentes Bem Configurados

### Exemplo: Agente de Suporte Técnico
Nome: Agente de Suporte Técnico
Specialty: support
System Prompt: "Você é o Agente de Suporte Técnico do helpdesk Sismais. Resolve problemas técnicos dos clientes de forma clara, didática e eficiente. Use sempre a base de conhecimento antes de responder. Como resolver: 1) Entenda o problema com precisão. 2) Consulte a base de conhecimento. 3) Forneça solução passo a passo, numerada e clara. 4) Confirme se foi resolvido. 5) Se não resolver em 2 tentativas, escale para humano. Regras: SEMPRE use RAG. Nunca peça senha. Se urgente, escale imediatamente."
Greeting: "Olá! Sou o assistente de suporte técnico. Descreva o problema e vou te ajudar."

## IMPORTANTE
- Todas as respostas em português brasileiro
- O system_prompt gerado deve ter 300-800 palavras, ser detalhado e usar técnicas de prompt engineering
- Adapte vocabulário ao tipo de negócio do usuário
- SEMPRE inclua o bloco <!--METADATA:...--> ao final de cada mensagem`;
}

function buildSkillSystemPrompt(ctx: PlatformContext): string {
  const agentList = ctx.existing_agents
    .map((a: any) => `- ${a.name} (${a.specialty}, ${a.is_active ? "ativo" : "inativo"})`)
    .join("\n");

  return `Você é o **Arquiteto de Skills** da Sismais, especialista em criar habilidades modulares para agentes de IA.

## Sua Missão
Conduzir uma entrevista para criar uma skill (habilidade) que pode ser atribuída a um ou mais agentes de IA. Skills são módulos de comportamento reutilizáveis.

## REGRAS ABSOLUTAS
1. Faça **UMA pergunta por vez**. NUNCA duas ou mais.
2. Expanda respostas vagas — peça mais detalhes se necessário.
3. Siga as 3 fases na ordem.
4. Só use a ferramenta \`generate_skill\` quando TODAS as fases estiverem completas.
5. Ao final de CADA mensagem, inclua: \`<!--METADATA:{"phase":N,"phase_label":"...","partial_config":{...}}-->\`

## FASES DA ENTREVISTA

### Fase 1: Definição (3 perguntas)
Objetivo: O que é esta skill e qual problema ela resolve.
Perguntas-guia:
- Descreva o que esta skill deve fazer. Qual problema ela resolve?
- Em quais situações/contextos ela deve ser ativada? (palavras-chave, intenções do cliente)
- Qual categoria melhor descreve esta skill? (atendimento, vendas, financeiro, automação, análise)

### Fase 2: Instruções (3 perguntas)
Objetivo: Como a skill deve se comportar.
Perguntas-guia:
- Quais são as instruções passo-a-passo que o agente deve seguir ao usar esta skill?
- Há restrições ou limites? O que a skill NÃO deve fazer?
- A skill precisa acessar ferramentas externas? (consultar API, enviar email, buscar dados)

### Fase 3: Ativação (2 perguntas)
Objetivo: Como e onde a skill será usada.
Perguntas-guia:
- Quais agentes devem ter acesso a esta skill? (ou todos?)
- A skill deve ser ativada automaticamente quando detectada, ou só manualmente?

## Agentes Existentes (para atribuição)
${agentList || "(nenhum agente cadastrado)"}

## Categorias Disponíveis: ${JSON.stringify(ctx.categories.map((c: any) => c.name))}

## IMPORTANTE
- Todas as respostas em português brasileiro
- SEMPRE inclua o bloco <!--METADATA:...--> ao final de cada mensagem`;
}

// ── Tool Definitions ──

function getGenerateAgentTool() {
  return {
    type: "function",
    function: {
      name: "generate_agent",
      description:
        "Generate a complete AI agent configuration. Use ONLY when all 4 phases of the interview are complete and you have enough information.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do agente em português" },
          description: { type: "string", description: "Descrição breve (1-2 frases)" },
          specialty: {
            type: "string",
            enum: ["support", "sales", "sdr", "triage", "financial", "copilot", "analytics"],
          },
          system_prompt: {
            type: "string",
            description: "Prompt de sistema completo (300-800 palavras) com instruções detalhadas",
          },
          tone: {
            type: "string",
            enum: ["professional", "casual", "friendly", "formal"],
          },
          language: { type: "string", enum: ["pt-BR", "en", "es"] },
          color: { type: "string", description: "Cor hex do agente" },
          temperature: { type: "number", description: "0.0-1.0" },
          max_tokens: { type: "number" },
          rag_enabled: { type: "boolean" },
          rag_top_k: { type: "number", description: "3-10" },
          rag_similarity_threshold: { type: "number", description: "0.60-0.85" },
          confidence_threshold: { type: "number", description: "0.5-0.9" },
          priority: { type: "number", description: "0-100" },
          prompt_methods: {
            type: "array",
            items: { type: "string" },
            description: "Nomes dos métodos de prompt engineering utilizados (ex: chain_of_thought, pasa, aida)",
          },
          support_config: {
            type: "object",
            properties: {
              companyName: { type: "string" },
              companyDescription: { type: "string" },
              productsServices: { type: "string" },
              targetCustomers: { type: "string" },
              greeting: { type: "string" },
              diagnosticQuestions: { type: "array", items: { type: "string" } },
              commonIssues: { type: "array", items: { type: "string" } },
              escalationTriggers: { type: "array", items: { type: "string" } },
              escalationMessage: { type: "string" },
              escalationRules: { type: "string" },
              supportHours: { type: "string" },
              slaResponse: { type: "string" },
              standardResponses: {
                type: "object",
                properties: {
                  outOfHours: { type: "string" },
                  waitingCustomer: { type: "string" },
                  resolved: { type: "string" },
                },
              },
            },
          },
        },
        required: [
          "name", "description", "specialty", "system_prompt", "tone",
          "language", "color", "temperature", "max_tokens", "rag_enabled",
          "confidence_threshold", "priority", "prompt_methods", "support_config",
        ],
        additionalProperties: false,
      },
    },
  };
}

function getGenerateSkillTool() {
  return {
    type: "function",
    function: {
      name: "generate_skill",
      description:
        "Generate a complete skill configuration. Use ONLY when all 3 phases of the interview are complete.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome da skill em português" },
          slug: {
            type: "string",
            description: "Identificador único em kebab-case (ex: consultar-saldo)",
          },
          description: { type: "string", description: "Descrição breve da skill" },
          icon: { type: "string", description: "Nome do ícone Material Symbols (ex: support_agent)" },
          color: { type: "string", description: "Cor hex da skill" },
          category: {
            type: "string",
            enum: ["atendimento", "vendas", "financeiro", "automacao", "analise", "outro"],
          },
          prompt_instructions: {
            type: "string",
            description: "Instruções detalhadas de como o agente deve executar esta skill (200-500 palavras)",
          },
          trigger_keywords: {
            type: "array",
            items: { type: "string" },
            description: "Palavras-chave que ativam esta skill",
          },
          trigger_intents: {
            type: "array",
            items: { type: "string" },
            description: "Intenções do usuário que ativam esta skill (ex: consultar_saldo, pedir_boleto)",
          },
          tool_ids: {
            type: "array",
            items: { type: "string" },
            description: "IDs de ferramentas externas que a skill utiliza",
          },
          auto_activate: {
            type: "boolean",
            description: "Se a skill deve ser ativada automaticamente ao detectar trigger",
          },
        },
        required: [
          "name", "slug", "description", "icon", "color", "category",
          "prompt_instructions", "trigger_keywords", "trigger_intents", "auto_activate",
        ],
        additionalProperties: false,
      },
    },
  };
}

// ── Response Parsing ──

const METADATA_REGEX = /<!--METADATA:([\s\S]*?)-->/;

function parseMetadata(content: string): {
  message: string;
  phase: number;
  phase_label: string;
  partial_config: Record<string, any>;
} {
  const match = content.match(METADATA_REGEX);

  if (!match) {
    return {
      message: content.trim(),
      phase: 1,
      phase_label: "Identidade",
      partial_config: {},
    };
  }

  const cleanMessage = content.replace(METADATA_REGEX, "").trim();

  try {
    const metadata = JSON.parse(match[1]);
    return {
      message: cleanMessage,
      phase: metadata.phase ?? 1,
      phase_label: metadata.phase_label ?? "Identidade",
      partial_config: metadata.partial_config ?? {},
    };
  } catch {
    return {
      message: cleanMessage,
      phase: 1,
      phase_label: "Identidade",
      partial_config: {},
    };
  }
}

function buildResponse(data: BuilderResponse, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const mode: Mode = body.mode ?? "agent";
    const messages: any[] = body.messages;
    const isRetrain: boolean = body.retrain === true;
    const existingConfig: Record<string, any> | undefined = body.existing_config;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return buildResponse(
        { type: "error", message: "O campo 'messages' é obrigatório e deve ser um array não vazio.", code: "VALIDATION_ERROR" },
        400
      );
    }

    if (mode !== "agent" && mode !== "skill") {
      return buildResponse(
        { type: "error", message: "O campo 'mode' deve ser 'agent' ou 'skill'.", code: "VALIDATION_ERROR" },
        400
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch platform context
    const ctx = await fetchPlatformContext(supabase);

    // Build system prompt based on mode
    let systemPrompt = mode === "agent"
      ? buildAgentSystemPrompt(ctx)
      : buildSkillSystemPrompt(ctx);

    // Inject existing config context for retrain mode
    if (isRetrain && existingConfig) {
      const retrainContext = `\n\n## MODO RETREINAMENTO ATIVO
Você está melhorando um agente existente. Aqui está a configuração atual completa dele:
\`\`\`json
${JSON.stringify(existingConfig, null, 2)}
\`\`\`
Use esta configuração como BASE. Faça melhorias incrementais conforme o usuário pedir. Ao gerar a config final, mantenha todos os campos que não foram explicitamente alterados.`;
      systemPrompt += retrainContext;
    }

    // Select tool based on mode
    const tool = mode === "agent" ? getGenerateAgentTool() : getGenerateSkillTool();

    console.log(`[ai-builder] mode=${mode} retrain=${isRetrain} systemPromptChars=${systemPrompt.length} messagesCount=${messages.length}`);

    // Call LLM
    const result = await callOpenRouter({
      model: DEFAULT_CONTENT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      tools: [tool],
      tool_choice: "auto",
      temperature: 0.4,
      _logContext: { edgeFunction: "ai-builder" },
    });

    console.log(`[ai-builder] LLM ok. tool_calls=${result.tool_calls?.length || 0} contentChars=${result.content?.length || 0}`);

    const choice = result.raw_choice;

    // Check for tool calls → final config
    if (choice?.message?.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0];
      let config: Record<string, any>;

      try {
        config = JSON.parse(toolCall.function.arguments);
      } catch {
        return buildResponse({
          type: "error",
          message: "Erro ao processar a configuração gerada pela IA. Tente novamente.",
          code: "PARSE_ERROR",
        });
      }

      const summaryMessage = choice.message.content
        || (mode === "agent"
          ? "Pronto! Aqui está a configuração completa do seu agente. Revise os detalhes e confirme a criação."
          : "Pronto! Aqui está a configuração completa da sua skill. Revise e confirme.");

      return buildResponse({
        type: "config",
        config,
        message: summaryMessage,
      });
    }

    // No tool calls → it's a question, parse metadata
    const content = choice?.message?.content || "";

    if (!content) {
      return buildResponse({
        type: "error",
        message: "A IA não retornou uma resposta. Tente reformular sua mensagem.",
        code: "LLM_ERROR",
      });
    }

    const parsed = parseMetadata(content);

    return buildResponse({
      type: "question",
      message: parsed.message,
      phase: parsed.phase,
      phase_label: parsed.phase_label,
      partial_config: parsed.partial_config,
    });
  } catch (error) {
    console.error("[ai-builder] Error:", error, (error as Error)?.stack);

    const message = error instanceof Error ? error.message : "Erro interno desconhecido";
    const isTimeout = message.includes("timeout");

    return buildResponse(
      {
        type: "error",
        message: isTimeout
          ? "A IA demorou muito para responder. Tente novamente."
          : `Erro ao processar: ${message}`,
        code: "LLM_ERROR",
      },
      isTimeout ? 504 : 500
    );
  }
});
