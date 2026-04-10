# E16 — Relatorio Tecnico do CTO
## Sismais Helpdesk IA — Analise Completa do Sistema

**Data:** 2026-03-19
**Autor:** CTO (analise automatizada)
**Branch analisado:** main (1f83c32)
**Escopo:** 60+ edge functions, 50+ paginas React, 106 migrations, pipeline de IA completo

---

## 1. ROADMAP TECNICO — Prioridades por Impacto e Urgencia

### P0 — CRITICO (Semana 1-2)

#### 1.1 Unificar Pipeline de Resposta IA
**Problema:** O webhook (`uazapi-webhook`) invoca `ai-whatsapp-reply` (linha 1490-1509) em vez do pipeline completo `process-incoming-message`. Isso significa que a cadeia `message-analyzer -> orchestrator -> agent-executor` so e usada quando `process-incoming-message` e chamado diretamente, mas o webhook NAO o chama — ele pula direto para `ai-whatsapp-reply`.

**Evidencia concreta:**
- `uazapi-webhook/index.ts` linha 1490: `const aiReplyUrl = .../ai-whatsapp-reply`
- `ai-whatsapp-reply` faz sua propria chamada ao LLM (inline), sem passar pelo orchestrator
- `process-incoming-message` existe e implementa o pipeline completo (analyzer -> orchestrator -> agent-executor -> WhatsApp send), mas NUNCA e chamado pelo webhook

**Impacto:** Agentes IA, RAG, orquestrador, confidence scoring, learning loop — tudo desconectado em producao.

**Solucao:** Substituir a chamada a `ai-whatsapp-reply` no webhook por `process-incoming-message`. O `ai-whatsapp-reply` deve ser deprecado ou mantido apenas como fallback de emergencia.

#### 1.2 Debounce de 5s Bloqueia Edge Function
**Problema:** O debounce de 5 segundos (linha 1472-1474) e implementado com `setTimeout` DENTRO do handler do webhook. Isso bloqueia a edge function por 5s em cada mensagem recebida, consumindo recursos e potencialmente causando timeouts.

**Impacto:** Latencia de 5s em toda resposta + risco de timeout em edge functions (limite Supabase: ~26s total).

**Solucao:** Implementar debounce via banco de dados:
1. Salvar mensagem no DB imediatamente
2. Usar `pg_cron` ou um trigger com delay para processar batch de mensagens
3. Alternativa: usar `pg_notify` + um worker que agrega mensagens por conversa

#### 1.3 Mensagens de Media sem Resposta IA
**Problema:** Para mensagens de audio/imagem, o webhook diz "AI reply will be triggered after transcription" (linha 1493), e o `transcribe-media` de fato tenta chamar `ai-whatsapp-reply` apos transcricao (linhas finais). Porem, essa chamada e fire-and-forget via `fetch()` sem tratamento robusto de erro.

**Evidencia:**
- `transcribe-media/index.ts` faz `fetch(aiReplyUrl, ...)` no final, mas e fire-and-forget
- Se a transcricao falhar, a mensagem fica como `[Audio - transcricao falhou]` sem retry
- Mesmo quando a transcricao funciona, o reply vai para `ai-whatsapp-reply` (pipeline simplificado)

**Solucao:** Apos transcricao, invocar `process-incoming-message` (nao `ai-whatsapp-reply`) com o texto transcrito.

### P1 — ALTO (Semana 2-4)

#### 1.4 Handler Type Travado em "human" sem Retorno
**Problema:** Quando o orchestrator escala para humano (`handler_type = 'human'`), nao ha mecanismo automatico para retornar a IA se nenhum humano atender. O `process-incoming-message` simplesmente retorna `skipped: human_handler`.

**Solucao:**
1. Implementar timeout configuravel (ex: 15min sem resposta humana -> voltar para IA)
2. Usar `check-inactive-conversations` (ja existe) para detectar e reverter
3. Adicionar botao manual no Kanban para "devolver para IA"

#### 1.5 Dois Sistemas de Automacao Conflitantes
**Problema:** Existem dois sistemas paralelos:
- **`ai_automations`** + `automation-executor`: sistema legado com conditions/actions
- **`flow_automations`** + `trigger-flows` + `flow-engine`: sistema novo com visual builder

O `process-incoming-message` executa AMBOS (linhas de automacoes legadas + flows). Feature flags (`FF_DISABLE_LEGACY_AUTO`, `FF_FLOWS_BLOCK_AGENT`) existem mas estao em env vars, possivelmente desativadas.

**Solucao:** Migrar automacoes legadas para flows e ativar `FF_DISABLE_LEGACY_AUTO=true`.

#### 1.6 Confidence Scoring Desconectado
**Problema:** O `agent-executor` retorna `confidence` na resposta, e o `process-incoming-message` recebe esse valor, mas:
- Nao ha threshold configurado para escalar baseado em confidence
- O valor e apenas logado, nao usado para decisao
- O CLAUDE.md menciona `confidence < threshold -> escalate` mas isso nao esta implementado

**Solucao:** Adicionar threshold em `platform_ai_config` e logica de escalacao por baixa confianca no `process-incoming-message`.

### P2 — MEDIO (Semana 4-8)

#### 1.7 Webhook Monolitico (2061 linhas)
O `uazapi-webhook/index.ts` tem 2061 linhas em um unico arquivo. Inclui logica de:
- Parsing de mensagem (200+ linhas)
- Download de media com 4 estrategias + retry (400+ linhas)
- Cripto E2E WhatsApp (50 linhas)
- CSAT handling (150 linhas)
- Bridge ai_conversations/ai_messages (300+ linhas)
- Debounce + trigger IA (50 linhas)

**Solucao:** Extrair para modulos: `parse-webhook.ts`, `media-handler.ts`, `conversation-bridge.ts`, `csat-handler.ts`.

#### 1.8 Incremento de Contadores sem Atomicidade
**Problema:** Contadores como `unread_count` (linha 970-973) e `ai_messages_count`/`human_messages_count` (linhas 1276-1286) sao lidos e escritos em duas operacoes separadas (SELECT + UPDATE), causando race conditions.

**Solucao:** Usar `supabase.rpc()` com funcao SQL atomica: `UPDATE ... SET count = count + 1`.

#### 1.9 Consolidar Envio de Mensagens WhatsApp
Existem pelo menos 3 implementacoes diferentes de envio WhatsApp:
1. `process-incoming-message` tem `sendTextViaWhatsApp()` (funcao local, 80 linhas)
2. `ai-whatsapp-reply` tem sua propria logica de envio
3. `automation-executor` usa endpoint diferente (`/chat/sendMessage` vs `/send/text`)

**Solucao:** Criar `_shared/whatsapp-sender.ts` unico.

### P3 — BAIXO (Semana 8+)

#### 1.10 Remover Dependencias Frontend Desnecessarias
O `package.json` inclui `@anthropic-ai/claude-agent-sdk` e `@anthropic-ai/sdk` como dependencias de FRONTEND. Esses SDKs nao devem estar no bundle client-side — sao ferramentas de desenvolvimento.

#### 1.11 Melhorar Observabilidade
- Logs atuais sao `console.log` com JSON inconsistente (uns usam JSON estruturado, outros strings livres)
- Nao ha correlation ID entre webhook -> process-incoming -> agent-executor
- Usar um `request_id` propagado por toda a cadeia

---

## 2. ADRs — Architecture Decision Records

### ADR-001: Pipeline Unificado vs Dual Pipeline

**Contexto:** Atualmente existem dois caminhos de resposta IA:
- **Caminho A (prod):** webhook -> `ai-whatsapp-reply` (LLM direto, sem orchestrator/RAG)
- **Caminho B (completo):** webhook -> `process-incoming-message` -> `message-analyzer` -> `orchestrator` -> `agent-executor` (com RAG, tools, confidence)

**Opcoes:**
1. **Unificar em Caminho B** — Remover `ai-whatsapp-reply`, webhook chama `process-incoming-message`
2. **Manter dual** — `ai-whatsapp-reply` como fast-path para mensagens simples, `process-incoming-message` para complexas
3. **Substituir ambos por um unico** — Nova edge function que combina o melhor dos dois

**Decisao recomendada:** Opcao 1. O Caminho B ja esta implementado, testado e inclui todas as features (RAG, orquestrador, learning loop). O `ai-whatsapp-reply` duplica logica e cria divergencia. Manter `ai-whatsapp-reply` apenas como fallback desativado.

**Riscos:** Caminho B e ~3-5s mais lento (3 edge function calls em cadeia). Mitigar com o bypass do orchestrator (ja implementado para continuacoes de conversa).

---

### ADR-002: Sistema de Automacoes — Qual Manter?

**Contexto:** Dois sistemas coexistem:
- `ai_automations` + `automation-executor`: Modelo simples (trigger + conditions + actions). 10 tipos de action.
- `flow_automations` + `trigger-flows` + `flow-engine` + `flow-executor`: Modelo visual (nodes/edges). Mais flexivel mas mais complexo.

**Opcoes:**
1. **Manter apenas flows** — Migrar automacoes existentes, deprecar `ai_automations`
2. **Manter apenas legado** — Mais simples, menos features
3. **Manter ambos com separacao clara** — Legado para regras simples, flows para logica complexa

**Decisao recomendada:** Opcao 1. O sistema de flows ja suporta todos os trigger types que o legado suporta, e o visual builder (`/flow-builder`) ja existe. Manter compatibilidade com o flag `FF_DISABLE_LEGACY_AUTO`.

**Plano de migracao:**
1. Listar automacoes ativas em `ai_automations`
2. Recriar cada uma como flow em `flow_automations`
3. Ativar `FF_DISABLE_LEGACY_AUTO=true`
4. Monitorar por 2 semanas
5. Remover tabelas e codigo legado

---

### ADR-003: Modelo LLM — Gemini Flash Lite vs Flash vs 2.5

**Contexto:** O sistema usa modelos configurados via `platform_ai_config` com fallbacks hardcoded:
- `message-analyzer`: `google/gemini-2.0-flash-lite-001` (rapido, barato)
- `orchestrator`: `google/gemini-2.0-flash-lite-001` (decisao de roteamento)
- `agent-executor`: Modelo do agente no DB, fallback `google/gemini-2.0-flash-001`
- `transcribe-media`: `google/gemini-2.5-flash-lite`, fallback chain de 4 modelos

**Analise de custo/performance:**

| Modelo | Input $/1M | Output $/1M | Latencia | Qualidade |
|--------|-----------|------------|----------|-----------|
| gemini-2.0-flash-lite | $0.075 | $0.30 | ~0.5s | Boa para classificacao |
| gemini-2.0-flash | $0.10 | $0.40 | ~1s | Boa para chat |
| gemini-2.5-flash | $0.15 | $0.60 | ~1.5s | Melhor raciocinio |

**Decisao recomendada:**
- **Analyzer + Orchestrator:** Manter Flash Lite (tarefas simples de classificacao, latencia importa)
- **Agent Executor:** Usar Flash 2.0 como padrao, Flash 2.5 para agentes de suporte tecnico que precisam de raciocinio mais sofisticado
- **Transcricao:** Manter Flash 2.5 Lite (multimodal otimizado)

---

### ADR-004: Channel Adapter Pattern para Multi-Canal

**Contexto:** O sistema e atualmente 100% WhatsApp via UAZAPI. O webhook e fortemente acoplado ao formato UAZAPI.

**Opcoes:**
1. **Adapter pattern** — Interface `ChannelAdapter` com metodos `parseIncoming()`, `sendMessage()`, `downloadMedia()`. Implementacoes: `UazapiAdapter`, futuro `TelegramAdapter`, `WebchatAdapter`.
2. **Manter acoplado** — WhatsApp e o unico canal previsto a curto prazo.

**Decisao recomendada:** Opcao 2 por agora, com refactoring gradual. Prioridade atual e estabilizar o pipeline existente. Quando multi-canal for requisito, implementar o adapter.

**Preparacao imediata:**
- Extrair `sendTextViaWhatsApp` para `_shared/whatsapp-sender.ts`
- Abstrair lookup de instancia para `_shared/instance-resolver.ts`
- Usar `communication_channel` no `ai_conversations` (ja existe) para decisao de envio

---

### ADR-005: API Publica — Edge Functions vs Gateway

**Contexto:** Todas as 60+ edge functions sao acessiveis via `https://xxx.supabase.co/functions/v1/nome`. Nao ha gateway, rate limiting ou API keys proprias.

**Opcoes:**
1. **Manter edge functions diretas** — Simples, funciona, autenticacao via Supabase anon/service key
2. **Gateway dedicado** — Kong, Cloudflare Workers ou API Gateway na frente
3. **Supabase API routes** — Usar RLS + postgrest para dados, edge functions apenas para logica

**Decisao recomendada:** Opcao 1 por agora. O sistema nao expoe API publica — todas as chamadas sao internas (frontend -> Supabase, webhook -> edge functions). Se API publica for necessaria, Cloudflare Workers como gateway e a opcao com menor latencia.

---

## 3. PADROES TECNICOS

### 3.1 Pattern de Edge Function

```typescript
// PADRAO OBRIGATORIO para todas as edge functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // 2. Supabase client com service role
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // 3. Parse body com validacao
    const body = await req.json()
    const { required_field } = body
    if (!required_field) {
      return new Response(JSON.stringify({ error: 'required_field is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Logica de negocio

    // 5. Retorno padronizado
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', fn: 'nome-da-funcao', error: msg }))
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Regras:**
- SEMPRE incluir CORS headers
- SEMPRE tratar OPTIONS preflight
- SEMPRE usar try/catch com log estruturado (JSON)
- NUNCA expor detalhes internos de erro ao cliente
- Usar `_shared/` para codigo reutilizado entre functions
- Timeout de LLM: 25s (configurado em `openrouter-client.ts`)
- Para chamadas fire-and-forget: usar `.catch()` e documentar que e intencional

### 3.2 Pattern de Componente React

```tsx
// PADRAO para componentes com dados do Supabase
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface Props {
  itemId: string
}

export function MyComponent({ itemId }: Props) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['items', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single()
      if (error) throw error
      return data
    },
  })

  const mutation = useMutation({
    mutationFn: async (payload: Partial<Item>) => {
      const { error } = await supabase.from('items').update(payload).eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      toast.success('Salvo com sucesso')
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  })

  if (isLoading) return <Spinner />
  // ...
}
```

**Regras:**
- Queries: `useQuery` com `queryKey` consistente
- Mutacoes: `useMutation` com `invalidateQueries` no `onSuccess`
- Toast: `sonner` para feedback
- Loading: componente `<Spinner />`
- Tipos: importar de `@/integrations/supabase/types`
- NUNCA editar `types.ts` manualmente (gerado automaticamente)

### 3.3 Convencoes de Banco de Dados

- **Nomenclatura:** `snake_case` para tabelas e colunas
- **Prefixos de tabela:** `ai_`, `uazapi_`, `helpdesk_`, `kanban_`, `flow_`
- **Timestamps:** Sempre `timestamptz`, campo `created_at` com `default now()`
- **Soft delete:** Usar `deleted_at timestamptz` quando necessario, nunca DELETE fisico em tabelas de negocio
- **JSONB:** Usado para `context`, `metadata`, `extra_config` — documentar schema esperado
- **RLS:** Ativado em todas as tabelas exponiveis. Service role key para edge functions.
- **Migrations:** Arquivo nomeado `YYYYMMDDHHMMSS_descricao.sql`

### 3.4 Estrategia de Feature Flags

**Implementacao atual:** `_shared/feature-flags.ts` le de `Deno.env.get()`.

**Flags existentes:**
| Flag | Env Var | Default | Descricao |
|------|---------|---------|-----------|
| `USE_PROCESSING_LOCK` | `FF_PROCESSING_LOCK` | `false` | Lock de processamento por conversa |
| `DISABLE_LEGACY_AUTOMATIONS` | `FF_DISABLE_LEGACY_AUTO` | `false` | Desativa automacoes legadas |
| `FLOWS_BLOCK_AGENT` | `FF_FLOWS_BLOCK_AGENT` | `false` | Flows bloqueiam resposta do agente |

**Padrao para novas flags:**
1. Definir em `_shared/feature-flags.ts`
2. Documentar com JSDoc (descricao + pre-requisitos)
3. Usar `Deno.env.get('FF_NOME') === 'true'`
4. Logar quando flag afeta comportamento: `console.log(JSON.stringify({ level: 'info', flag: 'FF_NOME', value: true }))`

**Recomendacao futura:** Migrar flags para tabela `platform_ai_config` para permitir toggle via UI sem redeploy.

---

## 4. DEBITOS TECNICOS CRITICOS

### Severidade CRITICA

| # | Debito | Localizacao | Impacto | Esforco |
|---|--------|-------------|---------|---------|
| D1 | Pipeline desconectado (webhook -> ai-whatsapp-reply em vez de process-incoming-message) | `uazapi-webhook/index.ts:1490` | Todos os agentes, RAG, orchestrator inutilizados em prod | 2h |
| D2 | Debounce bloqueante de 5s no webhook | `uazapi-webhook/index.ts:1472-1474` | Latencia, risco de timeout, perda de mensagens | 4h |
| D3 | Race condition em contadores (unread_count, messages_count) | `uazapi-webhook/index.ts:970-973, 1276-1286` | Contadores incorretos | 1h |
| D4 | `ai-whatsapp-reply` reimplementa LLM call sem usar agent system | `ai-whatsapp-reply/index.ts` | Duplicacao de logica, respostas sem contexto de agente | 2h (remover apos D1) |

### Severidade ALTA

| # | Debito | Localizacao | Impacto | Esforco |
|---|--------|-------------|---------|---------|
| D5 | Webhook monolitico (2061 linhas, zero modularizacao) | `uazapi-webhook/index.ts` | Manutencao impossivel, risco de regressao | 8h |
| D6 | 3 implementacoes diferentes de envio WhatsApp | `process-incoming-message`, `ai-whatsapp-reply`, `automation-executor` | Inconsistencia de comportamento | 4h |
| D7 | Confidence scoring nao usado para decisao | `process-incoming-message` recebe mas ignora | Escalacao automatica nao funciona | 2h |
| D8 | Handler_type = 'human' sem timeout/retorno | Nenhum mecanismo de fallback | Conversas ficam travadas para sempre | 4h |
| D9 | Dois sistemas de automacao (ai_automations + flow_automations) | `process-incoming-message` executa ambos | Acoes duplicadas, confusao | 4h (migracao) |
| D10 | `transcribe-media` chama `ai-whatsapp-reply` ao inves do pipeline completo | `transcribe-media/index.ts` (final) | Mesma issue que D1 para mensagens de media | 1h |

### Severidade MEDIA

| # | Debito | Localizacao | Impacto | Esforco |
|---|--------|-------------|---------|---------|
| D11 | SDKs Anthropic no frontend bundle | `package.json` | Bundle size desnecessario | 0.5h |
| D12 | Logs inconsistentes (JSON vs texto livre) | Todas as edge functions | Dificuldade de debug/monitoring | 4h |
| D13 | Sem correlation ID entre edge functions | Toda a cadeia de processamento | Impossivel rastrear uma mensagem end-to-end | 3h |
| D14 | Instance resolution duplicada (webhook vs process-incoming-message) | Ambos fazem lookup independente | Queries desnecessarias ao DB | 2h |
| D15 | Cache de instancia com TTL de 5min pode causar stale data | `process-incoming-message` instanceCache | Instancia desativada continua sendo usada | 1h |
| D16 | `platform_ai_config` usado para guardar board_id (abuse do campo `enabled`) | `uazapi-webhook/index.ts:1060-1068` | Confuso — campo boolean guardando UUID | 1h |

### Severidade BAIXA

| # | Debito | Localizacao | Impacto | Esforco |
|---|--------|-------------|---------|---------|
| D17 | Duplicacao de check poll_update (linhas 140-145 e 229-234) | `uazapi-webhook/index.ts` | Codigo morto | 0.5h |
| D18 | `automation-executor` usa endpoint UAZAPI diferente (`/chat/sendMessage`) | `automation-executor/index.ts` | Pode falhar se instancia usa API v2 | 1h |
| D19 | Emojis nos logs de `trigger-flows` | `trigger-flows/index.ts` | Inconsistencia de formato | 0.5h |

---

## 5. METRICAS DO SISTEMA

### Edge Functions (60 total)
- **Pipeline IA:** 7 funcoes (webhook, process-incoming, analyzer, orchestrator, agent-executor, transcribe-media, ai-whatsapp-reply)
- **Automacoes:** 4 funcoes (automation-executor, trigger-flows, flow-engine, flow-executor)
- **Integracao:** 6 funcoes (uazapi-proxy, sismais-admin-proxy, sismais-client-lookup, sismais-client-auto-link, sync-sismais-admin-clients, import-chat-history)
- **IA auxiliar:** 8 funcoes (rag-search, semantic-search, generate-embedding, copilot-suggest, learning-loop, summarize-conversation, generate-report, generate-agent-system-prompt)
- **Shared modules:** 5 arquivos (openrouter-client, get-model-config, log-ai-cost, feature-flags, brazil-timezone)

### Frontend
- **Paginas:** 50+ em `src/pages/`
- **Componentes:** 28 diretorios em `src/components/`
- **Dependencias:** 37 dependencias de producao

### Banco de Dados
- **Migrations:** 106 aplicadas
- **Tabelas principais:** ~25 (ai_*, uazapi_*, helpdesk_*, kanban_*, flow_*)

---

## 6. SEQUENCIA DE EXECUCAO RECOMENDADA

```
Semana 1:  D1 (pipeline) + D2 (debounce) + D3 (race conditions)
Semana 2:  D10 (transcribe-media) + D7 (confidence) + D8 (human timeout)
Semana 3:  D5 (refactor webhook) + D6 (whatsapp sender unificado)
Semana 4:  D9 (migrar automacoes) + D13 (correlation ID)
Semana 5+: D11-D19 (debitos menores)
```

**Estimativa total:** ~40h de trabalho tecnico para resolver todos os debitos criticos e altos.

---

## 7. RESUMO EXECUTIVO

O Sismais Helpdesk IA tem uma **arquitetura bem desenhada** com pipeline multi-etapa (analyzer -> orchestrator -> agent-executor), RAG, learning loop, e feature flags. O problema central e que **essa arquitetura nao esta sendo usada em producao** — o webhook chama um atalho (`ai-whatsapp-reply`) que bypassa todo o sistema inteligente.

**Corrigir D1 (trocar uma linha de URL no webhook)** desbloqueia imediatamente:
- Orquestrador de agentes
- RAG (busca semantica na knowledge base)
- Confidence scoring
- Learning loop
- Suporte multi-agente com especialidades

E a mudanca de maior impacto com menor esforco de todo o backlog.
