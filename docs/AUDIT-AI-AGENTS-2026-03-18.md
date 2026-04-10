# Auditoria Completa — Sistema de Agentes IA Sismais Helpdesk

**Data:** 2026-03-18
**Escopo:** Varredura completa de configurações, pipeline, pontos de falha e plano de evolução

---

## 1. DIAGNÓSTICO: POR QUE O LINO NÃO ESTÁ RESPONDENDO?

### Causa Raiz Principal: Pipeline Desconectado

O sistema possui **DOIS pipelines de IA paralelos**, e o mais sofisticado **NÃO está conectado** ao webhook:

| Pipeline | Status | Arquivo | Capacidades |
|----------|--------|---------|-------------|
| `ai-whatsapp-reply` | **ATIVO** (usado pelo webhook) | `supabase/functions/ai-whatsapp-reply/index.ts` | Básico: RAG + LLM simples |
| `process-incoming-message` → `orchestrator` → `agent-executor` | **DESCONECTADO** | 3 edge functions separadas | Completo: RAG + Skills + Tools + Confidence + Escalação inteligente |

**O webhook (`uazapi-webhook`) chama `ai-whatsapp-reply` na linha 1496, que é um pipeline simplificado.** O pipeline completo (`process-incoming-message` → `orchestrator` → `agent-executor`) com scoring de confiança, skills, tools e escalação inteligente **nunca é invocado** para mensagens WhatsApp.

### Pontos de Falha Específicos do Lino

#### 1. Mensagens de Mídia (Áudio/Imagem) NUNCA Recebem Resposta IA
**Arquivo:** `uazapi-webhook/index.ts` linhas 1491-1493
```typescript
if (isMediaMessage) {
  console.log(`Media message (${messageType}) — AI reply will be triggered after transcription`);
  // MAS: transcribe-media NÃO chama ai-whatsapp-reply após transcrição!
}
```
- O webhook diz "AI reply será triggered após transcrição" mas `transcribe-media` **apenas atualiza o conteúdo da mensagem** no banco — **não dispara** `ai-whatsapp-reply`
- **Resultado:** Cliente envia áudio → transcrição acontece → ninguém responde

#### 2. Debounce de 5 Segundos Pode Causar Perda
**Arquivo:** `uazapi-webhook/index.ts` linhas 1471-1516
- Espera 5s antes de responder (para agrupar mensagens em burst)
- Se uma nova mensagem chegar durante o debounce, a mensagem atual é descartada
- Se a nova mensagem for mídia (áudio/imagem), cai no bug #1 acima e ninguém responde

#### 3. Test Mode Pode Estar Bloqueando
**Arquivo:** `uazapi-webhook/index.ts` linhas 1451-1461
- Se `test_mode = true` na instância UAZAPI e o telefone não for o `test_phone_number`, a IA é bloqueada silenciosamente

#### 4. Auto-Reply Pode Estar Desabilitado
**Arquivo:** `ai-whatsapp-reply/index.ts` linhas 57-68
- Se `platform_ai_config.feature = 'auto_reply_enabled'` tiver `enabled = false`, toda IA é desabilitada

#### 5. Handler Type Travado em "human"
- Se uma conversa foi escalada para humano, NUNCA volta para IA automaticamente
- Condição na linha 1468 do webhook: `(existingConv?.handler_type || "ai") === "ai"`

#### 6. Orchestrator Pode Não Selecionar o Lino
- O orchestrator usa LLM (Gemini Flash Lite) para decidir qual agente
- Se a descrição do Lino não for clara o suficiente, o LLM pode escolher outro agente
- Se a conversa já tem um agente atribuído, o orchestrator faz **BYPASS** e mantém o agente atual

---

## 2. INVENTÁRIO DE AGENTES CONFIGURADOS

| # | Nome | Specialty | Model | Prioridade | RAG | Confidence | Canal |
|---|------|-----------|-------|-----------|-----|-----------|-------|
| 1 | **LANA** | triage | gemini-2.0-flash-lite-001 | 100 | ✅ | 0.65 | whatsapp |
| 2 | **LINO** | support | gemini-2.0-flash-001 | 80 | ✅ | 0.70 | whatsapp |
| 3 | **MAX** | support | gemini-2.0-flash-001 | 80 | ✅ | 0.70 | whatsapp |
| 4 | **KIRA** | financial | gemini-2.0-flash-001 | 75 | ✅ | 0.70 | whatsapp |
| 5 | **KITANA** | sales | gemini-2.0-flash-001 | 70 | ✅ | 0.65 | whatsapp |
| 6 | **AXEL** | copilot | gemini-2.0-flash-001 | 60 | ✅ | 0.75 | internal |
| 7 | **ORION** | analytics | gemini-2.0-flash-001 | 50 | ✅ | 0.80 | internal |

### Problemas de Configuração Encontrados

1. **LANA (Triagem) tem prioridade 100** — como fallback do `ai-whatsapp-reply` usa o agente de maior prioridade, LANA acaba sendo o fallback padrão em vez de um agente de atendimento
2. **LINO e MAX têm mesma prioridade (80)** — ambiguidade na seleção
3. **Nenhum agente padrão configurado** — `platform_ai_config.feature = 'default_ai_agent_id'` provavelmente não está configurado
4. **Support_config do Lino** tem configuração rica (briefing, troubleshooting, escalation, policies) **mas o pipeline ativo (`ai-whatsapp-reply`) mal usa** — apenas briefing e escalation como JSON bruto

---

## 3. O QUE O PIPELINE ATIVO (`ai-whatsapp-reply`) NÃO FAZ

| Feature | Pipeline Completo (`agent-executor`) | Pipeline Ativo (`ai-whatsapp-reply`) |
|---------|--------------------------------------|--------------------------------------|
| Scoring de confiança | ✅ Multi-sinal (0.1-0.99) | ❌ Não existe |
| Skills modulares | ✅ Carrega por keyword/intent | ❌ Não existe |
| Tools/Function calling | ✅ customer_search, custom tools | ❌ Não existe |
| Escalação inteligente | ✅ Por confiança + markers | ❌ Só quando orchestrator decide "human" |
| Message analysis | ✅ Sentimento, urgência, intent | ❌ Não existe |
| Resumo de conversa | ✅ Sliding window + summary | ⚠️ Parcial (últimas 15 msgs, merge de burst) |
| Suporte a mídia | ✅ Transcrição + processamento | ❌ Áudio/imagem pula a resposta |
| Support config completo | ✅ Templates, troubleshooting, Q&A | ⚠️ Apenas briefing/escalation/policies cru |
| Business hours check | ✅ Verifica horário | ❌ Não existe |
| Processing lock (anti-duplicata) | ✅ Lock distribuído | ❌ Apenas debounce de 5s |
| Logging de custos detalhado | ✅ ticket_ai_logs | ⚠️ Parcial (log_ai_cost) |
| Métricas por agente | ✅ Atualiza success_rate, avg_confidence | ❌ Não atualiza |

---

## 4. ANÁLISE DE MODELOS LLM — CUSTO-BENEFÍCIO

### Modelos Atuais no Sistema

| Uso | Modelo | Custo/1M tokens (in/out) | Velocidade | Multimodal |
|-----|--------|--------------------------|-----------|-----------|
| Agentes (padrão) | Gemini 2.0 Flash | $0.10/$0.40 | Rápido | ✅ Texto+Imagem |
| Triagem (LANA) | Gemini 2.0 Flash Lite | $0.075/$0.30 | Muito rápido | ❌ Só texto |
| Orchestrator | Gemini 2.0 Flash Lite | $0.075/$0.30 | Muito rápido | ❌ Só texto |
| Transcrição | Gemini 2.5 Flash (Lite) | ~$0.15/$0.60 | Rápido | ✅ Áudio+Imagem |
| Embeddings | OpenAI text-embedding | $0.02/1M | N/A | N/A |

### Recomendação de Modelos por Função

| Função | Modelo Recomendado | Justificativa |
|--------|-------------------|---------------|
| **Atendimento principal** (Lino, Max) | **Google Gemini 2.5 Flash** | Melhor custo-benefício, multimodal nativo (texto+áudio+imagem+vídeo), 1M contexto, function calling |
| **Triagem** (LANA) | **Gemini 2.0 Flash Lite** | Decisão rápida, custo mínimo, não precisa de multimodal |
| **Orchestrator** | **Gemini 2.0 Flash Lite** | Decisão simples de roteamento, custo mínimo |
| **Casos complexos / Fallback** | **GPT-4o Mini** ou **Claude Haiku 4.5** | Raciocínio mais profundo quando Gemini tem baixa confiança |
| **Transcrição áudio** | **Gemini 2.5 Flash** | Multimodal nativo, custo baixo |
| **Análise de imagem/vídeo** | **Gemini 2.5 Flash** | Suporte nativo, sem necessidade de pré-processamento |
| **Embeddings** | **OpenAI text-embedding-3-small** | Já em uso, custo excelente |

### Por que Gemini 2.5 Flash para Atendimento?

1. **Custo:** ~$0.15/1M input, $0.60/1M output — 3-5x mais barato que GPT-4o
2. **Multimodal nativo:** Processa texto, áudio, imagem e vídeo sem APIs separadas
3. **Janela de contexto:** 1M tokens — pode carregar histórico completo da conversa
4. **Function calling:** Suporte nativo para tools
5. **Velocidade:** < 1s para primeira token na maioria dos casos
6. **Custo estimado por atendimento:** ~$0.002-0.005 (2-5 milésimos de dólar)

### Alternativa Premium: Para Quando Precisar de Mais Inteligência

| Cenário | Modelo | Custo/atendimento |
|---------|--------|------------------|
| Atendimento padrão | Gemini 2.5 Flash | ~$0.003 |
| Cliente VIP / Caso complexo | GPT-4o Mini | ~$0.008 |
| Escalação técnica profunda | Claude Haiku 4.5 | ~$0.01 |

---

## 5. PLANO COMPLETO — MOTOR DE IA 100% FUNCIONAL

### Visão: Atendimento IA Quase Imperceptível de um Humano

O objetivo é criar um sistema onde o cliente não perceba que está falando com IA. Para isso, precisamos:
- **Entender contexto completo** (texto, áudio, imagem, vídeo)
- **Lembrar do histórico** mesmo em conversas longas
- **Usar tom natural** sem ser robótico
- **Saber quando NÃO saber** e escalar graciosamente
- **Responder rápido** mas sem parecer automático (delay humano)

---

### FASE 1: CORREÇÕES CRÍTICAS (Semana 1) — "Fazer o Lino Responder"

#### 1.1 Unificar Pipeline — Conectar `agent-executor` ao Webhook
**Problema:** `ai-whatsapp-reply` é uma versão simplificada que não usa o pipeline completo.
**Solução:** Refatorar `ai-whatsapp-reply` para chamar `process-incoming-message` (que já chama `orchestrator` → `agent-executor`) em vez de fazer tudo inline.

```
ANTES:  webhook → ai-whatsapp-reply (LLM direto, sem skills/tools/confidence)
DEPOIS: webhook → ai-whatsapp-reply → process-incoming-message → orchestrator → agent-executor
```

**Arquivos a modificar:**
- `supabase/functions/ai-whatsapp-reply/index.ts` — Simplificar para proxy que chama process-incoming-message
- `supabase/functions/process-incoming-message/index.ts` — Aceitar chamadas do ai-whatsapp-reply

#### 1.2 Corrigir Resposta para Mensagens de Mídia
**Problema:** Áudio e imagem nunca recebem resposta IA.
**Solução:** `transcribe-media` deve chamar `ai-whatsapp-reply` após transcrição bem-sucedida.

**Arquivo a modificar:**
- `supabase/functions/transcribe-media/index.ts` — Adicionar invocação de `ai-whatsapp-reply` após transcrição

#### 1.3 Configurar Agente Padrão
**Problema:** Sem `default_ai_agent_id`, fallback vai para LANA (triagem) em vez de agente de atendimento.
**Solução:** Definir LINO como agente padrão ou criar lógica de fallback por specialty.

#### 1.4 Verificar Configurações no Banco
```sql
-- Verificar se Lino está ativo
SELECT id, name, is_active, channel_type, priority, model FROM ai_agents WHERE name LIKE '%Lino%';

-- Verificar se auto-reply está habilitado
SELECT * FROM platform_ai_config WHERE feature IN ('auto_reply_enabled', 'default_ai_agent_id');

-- Verificar se test_mode está ativado
SELECT instance_name, test_mode, test_phone_number FROM uazapi_instances;

-- Verificar conversas travadas em handler_type = 'human'
SELECT COUNT(*), handler_type, status FROM ai_conversations GROUP BY handler_type, status;
```

---

### FASE 2: INTELIGÊNCIA (Semana 2-3) — "Fazer o Lino Entender Tudo"

#### 2.1 Multimodal Nativo — Áudio, Imagem e Vídeo
**Objetivo:** O agente deve entender áudio, imagem e vídeo sem que o cliente precise descrever.

**Arquitetura:**
```
Mensagem de Áudio → Gemini 2.5 Flash (multimodal) → Transcrição + Entendimento
Mensagem de Imagem → Gemini 2.5 Flash (multimodal) → OCR + Descrição + Contexto
Mensagem de Vídeo → Gemini 2.5 Flash (multimodal) → Frames + Descrição
                                    ↓
                    Tudo vira contexto para o agent-executor
```

**Mudanças:**
- `transcribe-media` passa a enviar mídia como input multimodal junto com o histórico da conversa
- Agent-executor recebe `media_context` enriquecido (não apenas transcrição plana)
- Prompt do agente instrui a referenciar o conteúdo da mídia naturalmente

#### 2.2 Memória de Longo Prazo — Histórico Completo
**Objetivo:** O agente deve lembrar de todas as interações anteriores com aquele cliente.

**Arquitetura:**
```
Cliente envia mensagem
    ↓
1. Buscar resumo da conversa atual (já existe: conversation_summary)
2. Buscar resumos de conversas ANTERIORES do mesmo cliente
3. Buscar dados do CRM (helpdesk_clients + contracts + annotations)
4. Montar "ficha do cliente" como contexto
    ↓
Agent-executor recebe contexto completo
```

**Implementação:**
- Nova função `build-client-context` que agrega:
  - Resumo das últimas 5 conversas finalizadas
  - Anotações do helpdesk
  - Contratos e produtos
  - Histórico de tickets (categorias recorrentes, SLA médio)
  - Preferências identificadas
- Cachear por 30 minutos (evitar queries repetidas)

#### 2.3 Skills Ativas no Pipeline
**Objetivo:** Skills configuradas por agente devem ser executadas automaticamente.

**Implementação:**
- Agent-executor já tem lógica de skills — garantir que `ai-whatsapp-reply` unifcado passe por ele
- Criar skills prioritárias:
  - `diagnostico-remoto` — Guia o cliente por checklist de resolução
  - `busca-tutorial` — Busca na knowledge base tutoriais específicos
  - `consulta-financeiro` — Busca status de boleto/pagamento via Sismais Admin
  - `abertura-ticket` — Cria ticket no Kanban automaticamente
  - `agendamento` — Agenda visita técnica

---

### FASE 3: NATURALIDADE (Semana 3-4) — "Parecer Humano"

#### 3.1 Delay Humanizado
**Problema:** Resposta instantânea (<1s) é a marca registrada de um bot.
**Solução:** Adicionar delay proporcional ao tamanho da resposta:
```typescript
const humanDelay = Math.min(
  1500 + (response.length * 15), // ~15ms por caractere
  8000 // máximo 8s
);
await sleep(humanDelay);
```
- Simular "digitando..." via UAZAPI antes de enviar
- Variar delay entre 2-6 segundos para respostas curtas

#### 3.2 Mensagens Segmentadas
**Problema:** IA envia paredes de texto. Humanos enviam múltiplas mensagens curtas.
**Solução:** Quebrar respostas longas em múltiplas mensagens:
```
IA gera: "Olá! Sobre o problema que você relatou no módulo financeiro, vamos resolver isso juntos. Primeiro, acesse Configurações > Financeiro > Contas a Receber..."

Enviado como:
[msg 1] "Olá! Sobre o problema no módulo financeiro 😊"
[delay 1.5s]
[msg 2] "Vamos resolver isso juntos!"
[delay 2s]
[msg 3] "Primeiro, acesse: Configurações > Financeiro > Contas a Receber"
```

#### 3.3 Prompt Engineering Avançado
**Instruções adicionais para system_prompt:**
```
ESTILO DE COMUNICAÇÃO:
- Escreva como se estivesse digitando no WhatsApp, não como um e-mail
- Use frases curtas (máx 2 linhas por parágrafo)
- Use emojis com moderação (máx 2 por mensagem)
- Nunca use linguagem corporativa ("prezado cliente", "informamos que")
- Use "você" e não "o senhor/a senhora"
- Demonstre empatia genuína: "Entendo que isso é frustrante"
- Se não souber algo, diga: "Vou verificar isso pra você, um momento"
- Nunca repita informações que o cliente já deu
- Se o cliente mandar áudio/imagem, referencie: "Vi na imagem que..."
```

#### 3.4 Detecção de Tom e Adaptação
- Se cliente usa linguagem informal → responder informal
- Se cliente usa linguagem formal → responder formal
- Se cliente está irritado → mais empático, menos técnico
- Se cliente é técnico → mais direto, menos explicação básica

---

### FASE 4: ORQUESTRAÇÃO INTELIGENTE (Semana 4-5) — "Multi-Agente Verdadeiro"

#### 4.1 Handoff Transparente entre Agentes
**Problema:** Troca de agente é visível e confusa para o cliente.
**Solução:**
- Handoff silencioso (cliente não precisa saber que trocou de agente)
- Novo agente recebe contexto completo da conversa anterior
- Se necessário informar: "Vou te conectar com nosso especialista em [área]"

#### 4.2 Co-Piloto para Agentes Humanos
**Arquitetura:**
```
Cliente → Agente Humano atende
              ↓
        AXEL (Copiloto) observa a conversa
              ↓
        Sugere respostas em tempo real
        Busca informações na knowledge base
        Alerta sobre SLA prestes a vencer
```

#### 4.3 Cascata de Modelos (Fallback Inteligente)
```
Tentativa 1: Gemini 2.5 Flash (rápido, barato)
    ↓ se confiança < 0.6
Tentativa 2: GPT-4o Mini (mais inteligente)
    ↓ se confiança < 0.5
Tentativa 3: Escalar para humano com contexto completo
```

---

### FASE 5: FEEDBACK E EVOLUÇÃO (Contínuo) — "IA que Aprende"

#### 5.1 Loop de Feedback
- Agente humano pode aprovar/rejeitar respostas da IA
- Respostas aprovadas viram exemplos para few-shot learning
- Respostas rejeitadas viram anti-exemplos

#### 5.2 Knowledge Base Automática
- Quando agente humano resolve um ticket, a solução é automaticamente sugerida para a knowledge base
- Revisão humana antes de publicar
- Embedding automático após aprovação

#### 5.3 Métricas de Qualidade
- CSAT por agente IA vs humano
- Tempo médio de resolução por agente
- Taxa de escalação por agente
- Confiança média por tipo de pergunta

---

## 6. ARQUITETURA PROPOSTA — PIPELINE UNIFICADO

```
WhatsApp (UAZAPI)
    │
    ▼
┌──────────────────────┐
│   uazapi-webhook     │ ← Recebe, deduplica, salva mensagem
│   (entry point)      │ ← Transcribe mídia (fire & forget)
└──────────┬───────────┘
           │
           ▼ (após debounce 3-5s)
┌──────────────────────┐
│  ai-whatsapp-reply   │ ← Proxy leve que chama o pipeline completo
│  (gateway)           │ ← Verifica: auto_reply, test_mode, handler_type
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  message-analyzer    │ ← Sentimento, urgência, intent, embedding
│  (NLP)               │ ← Classifica tipo de demanda
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  build-client-context│ ← Histórico, CRM, contratos, anotações (NOVO)
│  (memória)           │ ← Cache 30min
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   orchestrator       │ ← Seleciona melhor agente (LLM ou bypass)
│   (roteamento)       │ ← Escalação direta se necessário
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   agent-executor     │ ← RAG + Skills + Tools + LLM
│   (execução)         │ ← Confidence scoring
│                      │ ← Cascata de modelos
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   response-sender    │ ← Humaniza delay + segmenta mensagens (NOVO)
│   (entrega)          │ ← Simula "digitando..."
│                      │ ← Retry com backoff exponencial
└──────────┬───────────┘
           │
           ▼
      WhatsApp (cliente)
```

---

## 7. ESTIMATIVA DE CUSTO MENSAL

### Cenário: 500 atendimentos/dia, 10 mensagens/atendimento

| Componente | Modelo | Custo/mês estimado |
|------------|--------|-------------------|
| Agent-executor | Gemini 2.5 Flash | ~$45 |
| Orchestrator | Gemini 2.0 Flash Lite | ~$5 |
| Message-analyzer | Gemini 2.0 Flash Lite | ~$3 |
| Transcrição (30% mídia) | Gemini 2.5 Flash | ~$8 |
| Embeddings | OpenAI text-embedding-3-small | ~$2 |
| RAG search | Supabase (pgvector) | incluído |
| **TOTAL** | | **~$63/mês** |

### Comparativo se Usasse Só GPT-4o

| Componente | Modelo | Custo/mês |
|------------|--------|-----------|
| Tudo via GPT-4o | GPT-4o | ~$375/mês |

**Economia de 83% usando Gemini 2.5 Flash como modelo principal.**

---

## 8. CHECKLIST DE AÇÕES IMEDIATAS

### Prioridade CRÍTICA (Hoje)
- [ ] Verificar `is_active` do Lino no banco de dados
- [ ] Verificar `test_mode` das instâncias UAZAPI
- [ ] Verificar `auto_reply_enabled` na `platform_ai_config`
- [ ] Verificar se há conversas travadas em `handler_type = 'human'`

### Prioridade ALTA (Semana 1)
- [ ] Corrigir `transcribe-media` para chamar `ai-whatsapp-reply` após transcrição
- [ ] Refatorar `ai-whatsapp-reply` para usar pipeline completo
- [ ] Configurar `default_ai_agent_id` como Lino
- [ ] Ajustar prioridades: LANA=100 (triagem), LINO=90 (default support)

### Prioridade MÉDIA (Semana 2-3)
- [ ] Implementar suporte multimodal nativo no agent-executor
- [ ] Criar `build-client-context` para memória de longo prazo
- [ ] Ativar skills no pipeline principal
- [ ] Implementar cascata de modelos (Gemini → GPT-4o Mini → Humano)

### Prioridade NORMAL (Semana 4+)
- [ ] Implementar delay humanizado e mensagens segmentadas
- [ ] Prompt engineering avançado para naturalidade
- [ ] Dashboard de métricas por agente
- [ ] Loop de feedback humano → IA

---

## 9. RECOMENDAÇÃO FINAL

### Modelo Principal: **Google Gemini 2.5 Flash**
- Custo-benefício imbatível (~$0.003/atendimento)
- Multimodal nativo (texto + áudio + imagem + vídeo)
- 1M tokens de contexto
- Function calling nativo
- Velocidade excelente

### Modelo de Escalação: **GPT-4o Mini**
- Para casos onde Gemini tem confiança baixa (<0.6)
- Raciocínio mais profundo
- Custo ainda acessível (~$0.008/atendimento)

### Modelo de Orchestrator: **Gemini 2.0 Flash Lite**
- Decisão rápida e barata
- Não precisa de multimodal para roteamento
- ~$0.0003/decisão

### A chave não é o modelo — é o pipeline.
O sistema já tem 80% do código necessário. O problema é que o pipeline sofisticado (`agent-executor`) **não está conectado** ao fluxo real de mensagens. A Fase 1 (conectar o pipeline) resolve 70% dos problemas imediatamente.
