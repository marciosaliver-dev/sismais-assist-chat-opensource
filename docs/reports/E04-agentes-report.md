# E04 — Estrategia de Agentes IA: Arquitetura de Selecao e Routing

**Data:** 2026-03-19
**Autor:** Estrategista de Agentes IA
**Escopo:** Redesenho da camada de selecao, routing e orquestracao de agentes IA
**Dependencias:** E16 (CTO Report — pipeline unificado), E17 (CPO Report — visao de produto)

---

## 1. Diagnostico da Arquitetura Atual

### 1.1 Agentes Existentes

| Nome | Specialty | Modelo | Prioridade | Confidence | Papel Real |
|------|-----------|--------|-----------|-----------|------------|
| LANA | triage | Gemini 2.0 Flash Lite | 100 | 0.65 | Triagem inicial |
| LINO | support | Gemini 2.0 Flash | 80 | 0.70 | Suporte tecnico |
| MAX | support | Gemini 2.0 Flash | 80 | 0.70 | Suporte tecnico (duplicado?) |
| KIRA | financial | Gemini 2.0 Flash | 75 | 0.70 | Cobranca/financeiro |
| KITANA | sales | Gemini 2.0 Flash | 70 | 0.65 | Vendas/SDR |
| AXEL | copilot | Gemini 2.0 Flash | 60 | 0.75 | Copiloto humano |
| ORION | analytics | Gemini 2.0 Flash | 50 | 0.80 | Analitico |

### 1.2 Problemas Identificados

**P1 — Pipeline desconectado em producao (CRITICO)**
O webhook chama `ai-whatsapp-reply` diretamente, bypassando o orchestrator e todo o pipeline `message-analyzer -> orchestrator -> agent-executor`. Isso significa que NENHUM dos 7 agentes esta sendo usado em producao via WhatsApp. (Ref: E16, D1)

**P2 — Agente de triagem (LANA) e redundante com o orchestrator**
O orchestrator ja decide qual agente atende. Ter um agente de triagem como primeiro passo adiciona latencia (~2-3s) sem valor claro. O orchestrator faz o routing via LLM — a triagem deveria ser parte dele, nao um agente separado.

**P3 — Dois agentes de suporte identicos (LINO e MAX)**
Ambos tem specialty=`support`, mesma prioridade (80), mesmo modelo, mesmo threshold. Nao ha criterio de diferenciacao. O orchestrator vai escolher arbitrariamente entre os dois.

**P4 — Copilot e Analytics nao sao agentes de atendimento**
AXEL (copilot) e ORION (analytics) estao na mesma lista de agentes que atendem clientes, mas seu canal e `internal`. O orchestrator ja filtra `channel_type === 'internal'`, mas a confusao conceitual permanece.

**P5 — Thresholds de confianca nao sao usados para decisao**
O agent-executor calcula confidence com 6 sinais, mas o `process-incoming-message` nao usa esse valor para decidir escalacao. O threshold so e usado dentro do proprio agent-executor (Ref: E16, D7).

**P6 — Bypass do orchestrator e agressivo demais**
O orchestrator pula a chamada LLM quando a conversa ja tem um agente e nao ha "sinais de re-roteamento". Isso e bom para performance, mas impede deteccao de mudanca de tema sutil (ex: cliente comeca falando de suporte e depois pergunta sobre financeiro).

**P7 — Fallback para agente de maior prioridade e perigoso**
Quando o LLM decide que nenhum agente serve (`agent_id` vazio), o orchestrator faz fallback para o agente de maior prioridade (LANA, triagem). Isso pode criar loops onde LANA atende sem saber o que fazer.

---

## 2. Nova Arquitetura Proposta

### 2.1 Principios

1. **Menos agentes, mais especializados** — Consolidar duplicatas, separar agentes internos
2. **Routing hibrido** — Regras deterministas para casos obvios, LLM para ambiguidade
3. **Triagem embutida** — Eliminar agente de triagem, integrar no orchestrator
4. **Escalacao por confianca** — Thresholds efetivos com fallback chains
5. **Agentes internos separados** — Copilot e Analytics fora do pool de atendimento

### 2.2 Nova Matriz de Agentes

#### Agentes de Atendimento (customer-facing)

| Nome | Specialty | Modelo Recomendado | Threshold | Papel |
|------|-----------|-------------------|-----------|-------|
| **LINO** | `support` | Gemini 2.0 Flash | 0.70 | Suporte tecnico geral — problemas de sistema, erros, duvidas operacionais |
| **KIRA** | `financial` | Gemini 2.0 Flash | 0.75 | Cobranca, boletos, faturas, pagamentos, inadimplencia |
| **KITANA** | `sales` | Gemini 2.0 Flash | 0.65 | Qualificacao de leads, upsell, renovacao de contratos |
| **NOVA** | `onboarding` | Gemini 2.0 Flash | 0.70 | **NOVO** — Primeiro contato, boas-vindas, setup inicial, orientacao de uso |

#### Agentes Internos (agent-facing)

| Nome | Specialty | Modelo Recomendado | Threshold | Papel |
|------|-----------|-------------------|-----------|-------|
| **AXEL** | `copilot` | Gemini 2.5 Flash | 0.75 | Sugere respostas ao agente humano em tempo real |
| **ORION** | `analytics` | Gemini 2.5 Flash | 0.80 | Gera relatorios e metricas sob demanda |

#### Agentes Removidos/Consolidados

| Nome | Acao | Justificativa |
|------|------|---------------|
| **LANA** (triage) | **REMOVER** | Funcao absorvida pelo orchestrator. Triagem nao e um "atendimento", e uma decisao de routing. |
| **MAX** (support) | **CONSOLIDAR com LINO** | Duplicata sem diferenciacao. Se no futuro houver necessidade de N1/N2, criar especialidades distintas (ex: `support_basic` vs `support_advanced`). |

### 2.3 Novo Agente: NOVA (Onboarding)

**Justificativa:** Lacuna identificada nos relatorios E16/E17. Nenhum agente trata primeiro contato, boas-vindas ou orientacao de uso. Clientes novos caem no suporte tecnico e recebem respostas genericas.

**Escopo:**
- Boas-vindas a novos clientes
- Orientacao sobre funcionalidades do sistema
- Ajuda no setup inicial
- Perguntas basicas ("como funciona X?")
- Encaminhamento para suporte se problema tecnico, para financeiro se questao de cobranca

**Trigger de ativacao:**
- Primeira mensagem de um contato sem historico
- Intent detectado: `getting_started`, `how_to`, `first_access`, `onboarding`
- Cliente com contrato recente (< 30 dias)

---

## 3. Novo Design de Routing/Orquestracao

### 3.1 Pipeline Proposto

```
WhatsApp -> uazapi-webhook -> process-incoming-message
                                      |
                              [1] message-analyzer (LLM Lite)
                                      |
                                      v
                              [2] REGRAS DETERMINISTICAS
                                  |         |         |
                              match?     match?    no match
                                |           |         |
                              agent      human       v
                                               [3] orchestrator (LLM Lite)
                                                      |
                                                      v
                                               [4] agent-executor (LLM Flash)
                                                      |
                                              confidence check
                                              |              |
                                          >= threshold    < threshold
                                              |              |
                                          responde      escala p/ humano
```

### 3.2 Camada de Regras Deterministicas (Nova — Pre-Orchestrator)

Antes de chamar o LLM do orchestrator, aplicar regras simples que resolvem 30-40% dos casos sem custo de LLM:

```
REGRA 1: intent === 'want_human'           -> handler_type = 'human'
REGRA 2: intent === 'billing_question'     -> KIRA (financial)
         OR intent === 'invoice_question'
         OR intent === 'payment'
REGRA 3: intent === 'purchase'             -> KITANA (sales)
         OR intent === 'pricing'
REGRA 4: intent === 'getting_started'      -> NOVA (onboarding)
         OR intent === 'how_to'
         OR (primeiro contato + sem historico)
REGRA 5: conversa ativa + mesmo tema       -> manter agente atual (bypass existente)
REGRA 6: sentiment=negative + urgency=critical -> handler_type = 'human'

DEFAULT: Chamar orchestrator LLM para decisao
```

**Beneficios:**
- Economia de ~$0.0001/mensagem por call LLM evitado
- Latencia reduzida em ~500ms-1s para casos deterministas
- Previsibilidade — regras sao auditaveis e testáveis

### 3.3 Orchestrator LLM Refinado

Para os casos que chegam ao LLM, simplificar o prompt:

- Remover agentes internos da lista (copilot, analytics)
- Adicionar contexto do cliente (produto assinado, tempo de contrato, historico recente)
- Retornar **fallback_agent_id** alem do agent_id principal (para fallback chain)
- **Nunca** retornar agent_id vazio — sempre indicar o melhor candidato, mesmo com baixa certeza

### 3.4 Bypass Inteligente Refinado

O bypass atual verifica apenas `needsRerouting` (sinais negativos). Adicionar:

```
RE-ROUTE se:
- suggested_category do analyzer != specialty do agente atual
- Mais de 5 mensagens sem resolucao no mesmo agente
- Cliente mencionou palavras-chave de outra especialidade
```

---

## 4. Thresholds de Confianca por Tipo de Agente

### 4.1 Tabela de Thresholds

| Agente | Threshold Minimo | Acao se Abaixo | Justificativa |
|--------|-----------------|----------------|---------------|
| LINO (support) | 0.70 | Escalar para humano | Suporte tecnico exige precisao — resposta errada causa frustacao |
| KIRA (financial) | 0.75 | Escalar para humano | Dados financeiros exigem alta confianca — erro pode ter impacto legal |
| KITANA (sales) | 0.60 | Manter mas sinalizar | Vendas tolera mais ambiguidade — melhor responder do que nao responder |
| NOVA (onboarding) | 0.65 | Manter mas sinalizar | Onboarding e informacional — erro e menos grave |

### 4.2 Sistema de Escalacao Multi-Nivel

```
Nivel 1: confidence >= threshold           -> Responder normalmente
Nivel 2: confidence >= threshold - 0.10    -> Responder + sinalizar para supervisor
Nivel 3: confidence < threshold - 0.10     -> Escalar para humano
Nivel 4: [ESCALATE] detectado             -> Escalar imediato (independente de confidence)
```

**Exemplo para KIRA (threshold 0.75):**
- >= 0.75: Responde normalmente
- 0.65 - 0.74: Responde mas cria item na fila de supervisao
- < 0.65: Escala para humano
- [ESCALATE]: Escala imediato

---

## 5. Handoff Inteligente Entre Agentes

### 5.1 Handoff IA -> IA (Troca de Agente)

```
Trigger: orchestrator decide trocar de agente
Processo:
1. Gerar resumo da conversa ate o momento (via summarize-conversation)
2. Injetar resumo no system prompt do novo agente
3. Incrementar agent_switches_count
4. Se switches >= 3: escalar para humano (ja implementado)
```

### 5.2 Handoff IA -> Humano (Escalacao)

```
Trigger: confidence abaixo do threshold, [ESCALATE], ou intent=want_human
Processo:
1. Gerar resumo automatico da conversa
2. Classificar urgencia (para priorizar na fila humana)
3. Mover para Kanban com metadata:
   - Motivo da escalacao
   - Ultimo agente IA
   - Confidence score
   - Historico resumido
4. Enviar mensagem de transicao ao cliente:
   "Vou transferir voce para um atendente. Em instantes alguem vai te atender."
5. Se fora do horario: informar previsao de atendimento
```

### 5.3 Handoff Humano -> IA (Retorno)

```
Trigger: Agente humano marca como "devolver para IA" OU timeout de 15min sem resposta humana
Processo:
1. Retomar com o ultimo agente IA que atendeu
2. Injetar contexto: "O atendente humano informou: [notas do agente]"
3. Resetar handler_type = 'ai'
```

### 5.4 Fallback Chain

```
Agente primario falha (timeout, erro, credits)
  -> Retry 1x com mesmo agente
  -> Se falhar: tentar agente de mesma specialty (se houver)
  -> Se falhar: tentar LINO (suporte geral, fallback universal)
  -> Se falhar: escalar para humano com mensagem automatica
```

---

## 6. Recomendacoes de Modelos LLM por Funcao

### 6.1 Matriz de Modelos

| Funcao | Modelo Recomendado | Custo (Input/Output per 1M) | Justificativa |
|--------|-------------------|---------------------------|---------------|
| **message-analyzer** | Gemini 2.0 Flash Lite | $0.075 / $0.30 | Classificacao simples, latencia critica |
| **orchestrator** | Gemini 2.0 Flash Lite | $0.075 / $0.30 | Routing e classificacao, nao gera texto longo |
| **agent-executor (support, financial, onboarding)** | Gemini 2.0 Flash | $0.10 / $0.40 | Bom equilibrio custo/qualidade para chat |
| **agent-executor (sales)** | Gemini 2.0 Flash | $0.10 / $0.40 | Vendas precisa de fluencia, nao raciocinio profundo |
| **copilot (AXEL)** | Gemini 2.5 Flash | $0.15 / $0.60 | Precisa de raciocinio mais sofisticado para sugerir respostas |
| **analytics (ORION)** | Gemini 2.5 Flash | $0.15 / $0.60 | Analise de dados exige raciocinio mais profundo |
| **summarize-conversation** | Gemini 2.0 Flash Lite | $0.075 / $0.30 | Resumo e tarefa de extracao, nao criacao |
| **transcribe-media** | Gemini 2.5 Flash Lite | Multimodal pricing | Otimizado para audio/imagem |

### 6.2 Estimativa de Custo por Conversa

Conversa media: 8 mensagens do cliente, 8 respostas do agente.

| Etapa | Calls | Custo Estimado |
|-------|-------|---------------|
| message-analyzer (8x) | 8 | $0.0024 |
| orchestrator (1x + 1 bypass) | 1 | $0.0003 |
| agent-executor (8x) | 8 | $0.0064 |
| embedding (8x) | 8 | $0.0002 |
| **Total por conversa** | — | **~$0.009** |

Com regras deterministicas substituindo 40% dos calls do orchestrator:
- Economia: ~$0.0001/conversa (marginal, mas acumula)
- Ganho real: latencia reduzida

### 6.3 Quando Migrar para Modelos Mais Caros

- Se taxa de resolucao autonoma < 30%: considerar Flash 2.5 para agent-executor
- Se CSAT < 3.5/5.0: considerar modelos com melhor qualidade de texto
- Se falsos positivos de escalacao > 10%: considerar melhor modelo no orchestrator

---

## 7. Metricas de Sucesso por Agente

### 7.1 Metricas Universais (todos os agentes)

| Metrica | Descricao | Meta Fase 1 | Meta Fase 2 |
|---------|-----------|-------------|-------------|
| **Taxa de Resolucao Autonoma** | Conversas resolvidas sem humano / total | >= 30% | >= 50% |
| **Tempo Medio de Resolucao** | Tempo entre primeira mensagem e resolucao | < 5 min | < 3 min |
| **Confidence Media** | Score medio das respostas | >= 0.72 | >= 0.78 |
| **Taxa de Escalacao** | % de conversas escaladas para humano | < 40% | < 25% |
| **Escalacao Correta** | Escalacoes que realmente precisavam de humano | >= 85% | >= 92% |
| **CSAT** | Satisfacao do cliente (1-5) | >= 3.8 | >= 4.2 |
| **Custo por Resolucao** | Custo total de LLM por conversa resolvida | < $0.02 | < $0.015 |

### 7.2 Metricas Especificas por Agente

| Agente | Metrica Especifica | Meta |
|--------|-------------------|------|
| LINO (support) | First Contact Resolution (FCR) — resolver na 1a interacao | >= 45% |
| LINO (support) | Uso de RAG — % respostas com documentos da base | >= 60% |
| KIRA (financial) | Acuracia de dados financeiros — dados corretos verificados | >= 95% |
| KIRA (financial) | Taxa de customer_search executado | >= 70% (quando relevante) |
| KITANA (sales) | Taxa de qualificacao — leads qualificados vs total | >= 20% |
| KITANA (sales) | Encaminhamento para humano de vendas | >= 30% |
| NOVA (onboarding) | Completion rate — % de clientes que completam orientacao | >= 60% |
| NOVA (onboarding) | Redirecionamento correto — encaminha para agente certo quando necessario | >= 90% |

### 7.3 Metricas do Orchestrator

| Metrica | Descricao | Meta |
|---------|-----------|------|
| **Acuracia de routing** | Agente escolhido == agente ideal (avaliado por supervisor) | >= 85% |
| **Bypass rate** | % de mensagens que usam bypass (sem LLM call) | >= 60% |
| **Latencia do orchestrator** | Tempo total do orchestrator (com ou sem LLM) | < 1.5s (bypass), < 3s (LLM) |
| **Re-routing rate** | % de conversas que trocam de agente | < 15% |

---

## 8. Plano de Migracao

### Fase 0 — Pre-Requisito (Semana 1-2)
**Dependencia critica: Resolver D1 do E16 — conectar pipeline em producao.**

- [ ] Trocar `ai-whatsapp-reply` por `process-incoming-message` no webhook
- [ ] Validar pipeline completo: analyzer -> orchestrator -> agent-executor -> WhatsApp
- [ ] Monitorar por 48h com logs detalhados

### Fase 1 — Consolidacao (Semana 2-3)

- [ ] Desativar LANA (triage) — `is_active = false`
- [ ] Desativar MAX (support) — consolidar com LINO
- [ ] Atualizar thresholds de confianca conforme tabela da secao 4
- [ ] Implementar escalacao efetiva por confidence no `process-incoming-message`
- [ ] Separar agentes internos (AXEL, ORION) com `channel_type = 'internal'`

### Fase 2 — Regras Deterministicas (Semana 3-4)

- [ ] Implementar camada de regras pre-orchestrator no `process-incoming-message`
- [ ] Mapear intents do analyzer para agentes (tabela de routing)
- [ ] Adicionar metricas de bypass rate e acuracia
- [ ] Refinar bypass inteligente com deteccao de mudanca de tema

### Fase 3 — Novo Agente NOVA (Semana 4-5)

- [ ] Criar agente NOVA no banco (`ai_agents`)
- [ ] Escrever system prompt focado em onboarding
- [ ] Popular base de conhecimento com guias de uso
- [ ] Adicionar regra deterministica para primeiro contato
- [ ] Testar no Playground antes de ativar

### Fase 4 — Handoff e Fallback (Semana 5-6)

- [ ] Implementar fallback chain (agente -> retry -> alternativo -> humano)
- [ ] Implementar timeout de handler_type='human' (15min -> retorno para IA)
- [ ] Integrar resumo automatico no handoff IA->humano
- [ ] Adicionar botao "devolver para IA" no Kanban

### Fase 5 — Metricas e Refinamento (Semana 6-8)

- [ ] Dashboard de metricas por agente (resolucao, confidence, CSAT, custo)
- [ ] A/B testing de system prompts
- [ ] Refinar thresholds baseado em dados reais
- [ ] Avaliar necessidade de agentes adicionais baseado em intents nao cobertos

---

## 9. Diagrama da Arquitetura Proposta

```
                          ┌─────────────────────────────────┐
                          │         WhatsApp (UAZAPI)        │
                          └──────────────┬──────────────────┘
                                         │
                                         v
                          ┌─────────────────────────────────┐
                          │       uazapi-webhook             │
                          │  (parse, media, save message)    │
                          └──────────────┬──────────────────┘
                                         │
                                         v
                          ┌─────────────────────────────────┐
                          │    process-incoming-message       │
                          └──────────────┬──────────────────┘
                                         │
                              ┌──────────┴──────────┐
                              v                     v
                    ┌──────────────────┐   ┌──────────────────┐
                    │ message-analyzer  │   │   Flows/Auto     │
                    │ (Flash Lite)      │   │  (automacoes)    │
                    │ intent, sentiment │   └──────────────────┘
                    │ urgency, embedding│
                    └────────┬─────────┘
                             │
                             v
                    ┌──────────────────────────────────────┐
                    │     CAMADA DE REGRAS DETERMINISTICAS   │
                    │                                        │
                    │  intent=want_human     -> HUMANO       │
                    │  intent=billing        -> KIRA          │
                    │  intent=purchase       -> KITANA        │
                    │  intent=getting_started -> NOVA         │
                    │  conversa ativa+tema   -> MANTER AGENTE │
                    │  critical+negative     -> HUMANO        │
                    │  DEFAULT               -> ORCHESTRATOR   │
                    └───────┬──────────────┬────────────────┘
                            │              │
                     match found      no match
                            │              │
                            v              v
                    ┌──────────┐  ┌──────────────────┐
                    │  AGENTE   │  │   orchestrator    │
                    │ (direto)  │  │   (Flash Lite)    │
                    └─────┬────┘  │  LLM routing      │
                          │       └────────┬──────────┘
                          │                │
                          v                v
                    ┌──────────────────────────────────┐
                    │        agent-executor              │
                    │   (Flash / Flash 2.5)              │
                    │   RAG + Skills + Tools             │
                    │   Confidence scoring               │
                    └────────────┬──────────────────────┘
                                 │
                        ┌────────┴────────┐
                        v                 v
                  >= threshold      < threshold
                        │                 │
                  ┌─────┴─────┐    ┌──────┴──────┐
                  │ Responder  │    │  Escalar     │
                  │ via WA     │    │  para humano │
                  └───────────┘    │  (Kanban)    │
                                   └─────────────┘

  ╔═══════════════════════════════════════════════════╗
  ║  AGENTES DE ATENDIMENTO          AGENTES INTERNOS ║
  ║  ┌──────┐ ┌──────┐ ┌───────┐   ┌──────┐ ┌──────┐║
  ║  │ LINO │ │ KIRA │ │KITANA │   │ AXEL │ │ORION │║
  ║  │support│ │financ│ │ sales │   │copilot│ │analyt│║
  ║  └──────┘ └──────┘ └───────┘   └──────┘ └──────┘║
  ║  ┌──────┐                                         ║
  ║  │ NOVA │                                         ║
  ║  │onbrd │                                         ║
  ║  └──────┘                                         ║
  ╚═══════════════════════════════════════════════════╝
```

---

## 10. Recomendacoes Adicionais

### 10.1 Agentes Futuros a Considerar (pos-Fase 5)

| Agente | Specialty | Trigger | Justificativa |
|--------|-----------|---------|---------------|
| **Agente de Retencao** | `retention` | Contrato proximo do vencimento, pedido de cancelamento | Prevenir churn proativamente (ref: E17, secao 5.2) |
| **Agente de Pos-Venda** | `post_sales` | 30-60 dias apos venda, follow-up de satisfacao | Manter relacionamento, identificar upsell |
| **Agente CSAT** | `survey` | Apos resolucao de ticket | Coletar satisfacao de forma conversacional |

### 10.2 Monitoramento e Observabilidade

- Implementar `correlation_id` propagado em toda a cadeia (ref: E16, D13)
- Dashboard de routing: visualizar fluxo de mensagens por agente em tempo real
- Alertas quando taxa de escalacao > 50% em janela de 1h
- Log estruturado de todas as decisoes de routing (regra vs LLM)

### 10.3 Seguranca e Guardrails

- **Deteccao de PII**: message-analyzer deve detectar CPF, cartao de credito e mascarar antes de enviar ao LLM (ref: E17, secao 5.8)
- **Rate limiting por conversa**: max 30 mensagens/hora por conversa antes de forcar escalacao
- **Blocklist de conteudo**: nao responder a conteudo ofensivo, ilegal ou fora do escopo
- **Audit trail**: toda decisao de routing deve ser rastreavel (ja implementado parcialmente via `ticket_ai_logs`)

---

## 11. Resumo Executivo

### O que muda

| Antes | Depois |
|-------|--------|
| 7 agentes (2 duplicados, 1 redundante) | 6 agentes (4 atendimento, 2 internos) |
| Triagem como agente separado | Triagem embutida no orchestrator + regras |
| 100% routing via LLM | Hibrido: ~40% regras + ~60% LLM |
| Confidence calculado mas ignorado | Escalacao efetiva por confidence multi-nivel |
| Fallback: agente de maior prioridade | Fallback chain: retry -> alternativo -> humano |
| Sem agente de onboarding | NOVA atende primeiros contatos |
| Pipeline desconectado em prod | Pipeline unificado (pre-requisito D1) |

### Impacto Esperado

- **Latencia media**: -30% (regras deterministicas + eliminacao de triagem)
- **Custo LLM por conversa**: -15% (menos calls ao orchestrator)
- **Taxa de resolucao autonoma**: 30% -> 45% (agentes mais focados + onboarding)
- **Escalacoes desnecessarias**: -20% (thresholds calibrados + fallback chain)

### Dependencia Critica

**Nada neste plano funciona sem resolver D1 (conectar pipeline em producao).** Essa e a primeira e mais importante acao.

---

*Relatorio gerado em 2026-03-19. Proxima revisao: apos Fase 2 (Semana 4).*
