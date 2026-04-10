# Mapa Real do Sistema — Gerado em 2026-03-07

Este documento descreve como o sistema Sismais Helpdesk IA funciona **de verdade**, baseado na leitura direta do código-fonte. Nada aqui é inventado.

---

## Pipeline Real de Processamento de Mensagens

### Passo a Passo

```
1. WhatsApp (cliente envia mensagem)
        ↓
2. UAZAPI (webhook)
        ↓
3. uazapi-webhook/index.ts
   → Recebe payload do UAZAPI
   → Salva mensagem em uazapi_messages
   → Dispara process-incoming-message
        ↓
4. process-incoming-message/index.ts
   → Verifica se conversa já existe em ai_conversations
   → Se conversa existente com agent_id = 'human', não processa (está com humano)
   → Se conversa existente com agent_id fixo, vai direto ao agent-executor (bypass do orquestrador)
   → Se nova conversa ou sem agente fixo → chama orchestrator
        ↓
5. orchestrator/index.ts (DECIDE QUAL AGENTE RESPONDE)
   → Busca agentes ativos: SELECT * FROM ai_agents WHERE is_active = true
   → Usa LLM para decidir qual agente é mais adequado
   → O LLM lê: name, description, specialty de cada agente
   → Retorna: agent_id escolhido
   ⚠️ ATENÇÃO: a tabela ai_routing_rules existe mas NÃO é consultada aqui
        ↓
6. agent-executor/index.ts (GERA A RESPOSTA)
   → Carrega configuração do agente (system_prompt, model, temperature, etc.)
   → Se rag_enabled = true: busca artigos similares em ai_knowledge_base
     → Usa rag_similarity_threshold (padrão: 0.75)
     → Busca rag_top_k artigos mais relevantes (padrão: 5)
   → Monta contexto: system_prompt + artigos RAG + histórico de conversa
   → Chama LLM (OpenRouter → Gemini 2.0 Flash)
   → Calcula confidence score da resposta
   → Se confidence < confidence_threshold (padrão: 0.70): escala para humano
        ↓
7. Resposta enviada via UAZAPI ao cliente
```

---

## Como o Orquestrador Decide Qual Agente Responde

**Mecanismo real:** O orquestrador usa um LLM (não regras manuais) para ler a mensagem do cliente e os metadados de cada agente ativo, e decide qual agente deve responder.

O LLM avalia:
- `name` — nome do agente
- `description` — descrição do agente (o campo mais importante!)
- `specialty` — especialidade (triage, support, financial, sales, copilot, analytics)

**Para melhorar o roteamento:** Escreva descrições claras e detalhadas em cada agente, explicando exatamente que tipo de perguntas ele deve responder.

**Fallback:** Se o LLM não conseguir decidir com segurança, o sistema usa o agente com menor `priority` (número menor = prioridade maior).

**Otimização de conversa contínua:** Se uma conversa já está atribuída a um agente, o mesmo agente continua respondendo sem passar pelo orquestrador (exceto em casos de escalação explícita).

---

## Tabela ai_routing_rules — Status Atual

A tabela `ai_routing_rules` existe no banco de dados com os seguintes campos:
- `agent_id` — referência ao agente
- `keywords` — palavras-chave
- `intent_patterns` — padrões de intenção
- `sentiment_filter` — filtro de sentimento
- `priority` — prioridade
- `keywords_operator` — AND ou OR
- `business_hours_only` — somente em horário comercial
- `min_confidence` — confiança mínima

**⚠️ IMPORTANTE:** Embora esta tabela exista e seja editável via UI, o orquestrador atual **NÃO consulta** esta tabela para tomar decisões de roteamento. O roteamento é feito por LLM baseado nos metadados dos agentes.

Estas regras podem ser utilizadas em versões futuras do orquestrador ou para fins de auditoria.

---

## Quando a IA Escala para um Humano

O agente-executor escala a conversa para um agente humano quando:

1. **Confidence threshold:** A confiança da resposta gerada fica abaixo de `confidence_threshold` do agente (padrão: 0.70)
2. **Pedido explícito:** O cliente menciona "falar com humano", "atendente", "pessoa"
3. **Sentimento crítico:** Frustração extrema detectada pelo analisador de mensagens
4. **Múltiplas trocas de agente:** 3 ou mais roteamentos diferentes na mesma conversa

---

## Sistema RAG (Base de Conhecimento)

**Como funciona:**
1. Ao criar artigo em `ai_knowledge_base`, o sistema gera um embedding (OpenAI text-embedding-3-small)
2. Quando o agente responde, busca artigos por similaridade de cosseno
3. O threshold de similaridade é `rag_similarity_threshold` (padrão: 0.75)
4. Busca os `rag_top_k` artigos mais relevantes (padrão: 5)
5. Injeta os artigos no contexto antes da resposta do LLM

**Silent failure:** Se `rag_similarity_threshold` estiver muito alto (ex: 0.95), provavelmente nenhum artigo será encontrado e a IA responderá sem consultar a base de conhecimento — sem nenhum aviso ou erro visível.

---

## Automações vs Flow Builder — Conflito Potencial

O sistema tem **dois mecanismos de automação** que podem conflitar:

| | ai_automations (legacy) | flow_automations (Flow Builder) |
|---|---|---|
| Trigger | `trigger_type` | `trigger_type` |
| Ação | JSON actions array | Nodes/Edges visuais |
| UI | Página /automations | Página /flow-builder |

**Risco:** Se ambos tiverem `is_active = true` e o mesmo `trigger_type`, **ambos podem disparar** para o mesmo evento, resultando em mensagens duplicadas para o cliente.

**Solução:** Escolha UM mecanismo para cada trigger. Use Flow Builder para novos fluxos (mais poderoso) e desative automações legadas equivalentes.

---

## Campos Críticos de ai_agents

| Campo | Tipo | Padrão | Impacto |
|-------|------|--------|---------|
| `name` | string | — | Usado pelo orquestrador para identificar o agente |
| `description` | string\|null | null | **CRÍTICO** — Principal fator de decisão do orquestrador LLM |
| `specialty` | string | — | Categoria: triage, support, financial, sales, copilot, analytics |
| `system_prompt` | string | — | Instruções de comportamento da IA |
| `is_active` | boolean | false | Agente só é considerado pelo orquestrador se true |
| `priority` | number | null | Ordem de preferência em caso de empate (menor = maior prioridade) |
| `confidence_threshold` | number | 0.70 | Abaixo disso, escala para humano |
| `rag_enabled` | boolean | false | Ativa busca na base de conhecimento |
| `rag_similarity_threshold` | number | 0.75 | Threshold de similaridade para RAG |
| `rag_top_k` | number | 5 | Quantidade de artigos retornados pelo RAG |
| `model` | string | — | Modelo LLM (ex: google/gemini-2.0-flash) |
| `temperature` | number | — | Criatividade das respostas (0=determinístico, 1=criativo) |

---

## Comportamentos Indefinidos / Atenção

- [ ] Se não houver NENHUM agente ativo, o processamento falha silenciosamente
- [ ] Se `system_prompt` estiver vazio, o LLM usará apenas o contexto da mensagem
- [ ] Se `rag_similarity_threshold = 0`, retorna todos os artigos indiscriminadamente
- [ ] Se dois agentes tiverem o mesmo `priority`, o desempate não está garantido
- [ ] `ai_routing_rules` pode ser confundida como "regras de roteamento ativas" quando na verdade não afeta o comportamento atual

---

## O que Está Incompleto ou Com Comportamento a Verificar

- [ ] `ai_routing_rules` — existe no schema e na UI mas não é processada pelo orchestrator atual
- [ ] Agentes do tipo `copilot` e `analytics` — lógica de backend diferente, verificar implementação
- [ ] SLA tracking — função de edge existe mas UI está pendente
- [ ] `learning_enabled` em ai_agents — campo existe, implementação no agente-executor a verificar
- [ ] `avg_confidence` e `avg_csat` em ai_agents — calculados automaticamente ou manualmente?
