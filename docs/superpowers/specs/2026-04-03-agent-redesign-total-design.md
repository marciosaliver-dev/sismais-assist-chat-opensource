# Redesign Total — Sistema de Agentes IA v3

**Data:** 2026-04-03
**Status:** Aprovado
**Escopo:** Orquestrador, agentes, prompts, UX de configuração, modelos LLM, resiliência

---

## 1. Contexto e Problema

O sistema atual de agentes IA apresenta falhas críticas:
- Clientes ficam sem resposta (orquestrador retorna `action: "ignore"`)
- Roteamento inconsistente (Lana triagem adiciona latência e ponto de falha)
- Prompts genéricos → respostas fracas, sem saudação, sem padrão
- Agentes não herdam contexto entre transferências → repetem perguntas
- UX de configuração dificulta ajustes rápidos (sem abas, sem assistente)
- Modelos LLM hardcoded, sem fallback, sem tela de gestão

## 2. Decisões de Arquitetura

| Decisão | Direção |
|---------|---------|
| Agente Lana (triagem) | **Eliminar** — orquestrador roteia direto |
| Número de agentes | **6 especialistas** (Lino, Max, Kira, Kitana, Maya, Renan) |
| Roteamento | **Silencioso** — cliente nunca vê "vou te transferir" |
| Fallback | **Obrigatório** — Lino como fallback, nunca "ignore" |
| Contexto | **Herdado** — briefing estruturado entre agentes |
| Prompts | **Elite** — PASA + few-shot + chain-of-thought + persona |
| Modelos | **OpenRouter** com fallback chain e tela de gestão |
| UX | **Abas** dentro do form + aba Assistente IA |

## 3. Arquitetura de Agentes

### 3.1 Agentes (6 especialistas)

| Agente | Especialidade | Cobre |
|--------|--------------|-------|
| **Lino** | Suporte Mais Simples | Dúvidas, erros, como fazer no ERP MS |
| **Max** | Suporte MaxPro | Dúvidas, erros, como fazer no MaxPro |
| **Kira** | Financeiro | Boletos, cobranças, inadimplência, planos |
| **Kitana** | Vendas/SDR | Qualificação, propostas, demos |
| **Maya** | Onboarding | Primeiro acesso, setup, treinamento inicial |
| **Renan** | Retenção | Cancelamentos, recuperação, negociação |

### 3.2 Orquestrador — Roteamento Silencioso com Contexto

```
Mensagem WhatsApp chega
    ↓
Orquestrador analisa:
  - Histórico COMPLETO da conversa (todas as mensagens, todos os agentes)
  - Produto do cliente (MS/MaxPro via Sismais GL)
  - Sentimento e urgência
    ↓
Roteia silenciosamente pro agente certo
    ↓
Agente recebe BRIEFING DE CONTEXTO:
  - Cliente: nome, empresa, produto
  - Agente anterior + resumo do que aconteceu
  - Sentimento atual
  - O que NÃO perguntar novamente
    ↓
Agente responde COM CONTEXTO
    ↓
Se confiança < 0.6 → escala pra humano COM briefing completo
```

### 3.3 Transferência Inteligente com Memória

Na transferência, o orquestrador gera automaticamente um resumo estruturado injetado no system prompt do próximo agente:

```
## Contexto herdado
- **Cliente**: João Silva, empresa XYZ, produto MaxPro
- **Agente anterior**: Kira (Financeiro)
- **O que já foi feito**: Negociou parcelamento do boleto #4521, cliente aceitou 2x
- **Por que transferiu**: Cliente mudou de assunto — precisa de ajuda técnica no módulo fiscal
- **Tom do cliente**: Satisfeito com resolução financeira, agora objetivo e direto
- **NÃO perguntar novamente**: nome, empresa, produto, número do boleto
```

### 3.4 Regras do Orquestrador

1. **NUNCA** retornar `action: "ignore"` → fallback pra Lino
2. **NUNCA** deixar mensagem sem resposta → timeout 15s → "Oi! Já estou verificando, um momento..."
3. **MÁXIMO 2 transfers** por conversa → 3ª → escala pra humano com briefing
4. **SEMPRE** detectar produto antes de rotear suporte (MS → Lino, MaxPro → Max)
5. **FALLBACK** em cascata: modelo principal → fallback 1 → fallback 2 → escala humano
6. **MENSAGEM PERDIDA** = dead letter queue + alerta no dashboard

## 4. Prompts Elite

### 4.1 Estrutura Padrão (todo agente segue)

```
1. IDENTIDADE — quem sou, nome, papel
2. CONTEXTO DO CLIENTE — {injetado automaticamente}
3. CONTEXTO HERDADO — {injetado em transferências}
4. BASE DE CONHECIMENTO (RAG) — {injetado por busca semântica}
5. REGRAS DE COMPORTAMENTO — como respondo, tom, limites
6. SKILLS ATIVAS — {instruções das skills atribuídas}
7. EXEMPLOS (Few-shot) — 3-5 conversas modelo
8. GUARDRAILS — o que NUNCA fazer
9. FORMATO DE RESPOSTA — tamanho, estrutura, emojis
```

### 4.2 Técnicas Aplicadas

| Técnica | O que faz | Impacto |
|---------|-----------|---------|
| **PASA** | Problema → Ação → Solução → Alternativa | Respostas estruturadas, nunca vazio |
| **Few-shot examples** | 3-5 exemplos de conversas reais | Agente aprende padrão de qualidade |
| **Chain-of-thought** | Agente "pensa" antes de responder | Menos alucinação, mais precisão |
| **Persona profunda** | Nome, história, estilo, manias | Consistência de personalidade |
| **Anti-repetição** | "Nunca repita a mesma frase 2x" | Respostas naturais |
| **Escalação clara** | Regras exatas de quando escalar | Menos escalações desnecessárias |
| **Saudação contextual** | Por horário, cliente novo/recorrente, humor | Primeiro contato humanizado |
| **Encerramento ativo** | "Posso ajudar em mais alguma coisa?" | Fecha loops, mede satisfação |

### 4.3 Exemplo — Prompt Elite do Max (MaxPro)

```
Você é Max, especialista técnico do MaxPro ERP da Sismais Tecnologia.

## Quem você é
- Técnico experiente, 10 anos de MaxPro
- Estilo: direto, objetivo, técnico mas acessível
- Usa analogias simples quando o cliente não é técnico
- Sempre confirma se o cliente conseguiu resolver

## Contexto do cliente
{client_context}

## Contexto herdado
{transfer_context}

## Base de conhecimento
{rag_context}

## Como responder
1. ENTENDA: repita o problema em 1 frase pra confirmar
2. DIAGNOSTIQUE: faça no máximo 2 perguntas objetivas
3. RESOLVA: passo a passo numerado, máximo 5 passos
4. CONFIRME: "Conseguiu? Posso ajudar em mais algo?"

## Saudação
- Primeira msg do dia: "Oi {nome}! Aqui é o Max. Como posso te ajudar com o MaxPro?"
- Continuação: sem saudação, vai direto ao ponto
- Cliente já identificado: usa o nome sempre

## Exemplos
<example>
Cliente: "Não consigo emitir nota fiscal"
Max: "Entendi, {nome} — a nota fiscal não está sendo gerada.
Duas perguntas rápidas:
1. Aparece algum erro na tela?
2. É NF-e ou NFS-e?
Com isso já consigo te direcionar pro passo certo."
</example>

<example>
Cliente: "O sistema tá lento"
Max: "Lentidão no MaxPro — vamos resolver.
1. Abre o menu Ferramentas > Monitor
2. Me diz o número que aparece em 'Conexões ativas'
3. Tá lento só pra você ou pra outros usuários também?
Isso me ajuda a saber se é local ou servidor."
</example>

## NUNCA faça
- Nunca invente funcionalidade que não existe
- Nunca dê informação financeira (transferir pra Kira)
- Nunca repita a mesma frase em mensagens consecutivas
- Se não sabe → "Vou verificar com a equipe técnica e te retorno"
- Máximo 3 trocas sem resolver → escala pra humano
```

## 5. Modelos LLM — OpenRouter

### 5.1 Tela de Modelos (`/ai-settings`)

Tela centralizada para gerenciar modelos disponíveis:
- Catálogo OpenRouter com busca
- Modelo padrão do sistema
- Modelo por agente (override na aba "Modelo & RAG")
- Teste rápido (latência + custo + resposta)
- Status em tempo real (operacional/indisponível)
- Custo estimado por 1M tokens

### 5.2 Fallback Chain

```
Modelo principal (ex: gemini-2.0-flash)
    ↓ falhou (timeout, rate limit, erro)
Fallback 1 (ex: gemini-1.5-flash)
    ↓ falhou
Fallback 2 (ex: claude-haiku)
    ↓ falhou
Escala pra humano: "Estamos com dificuldade técnica, um atendente já vai te ajudar"
```

Configurável na tela de modelos: modelo padrão, fallback 1, fallback 2.

## 6. UX — Tela de Configuração de Agentes

### 6.1 Listagem (`/agents`)

Cards por agente com:
- Avatar, nome, especialidade, status ativo/inativo
- Modelo LLM em uso
- Métricas: conversas hoje, taxa de sucesso, confiança média
- Ações: Editar, Testar (playground), Ativar/Desativar

### 6.2 Formulário — Dialog Fullscreen com 5 Abas

```
┌──────────────────────────────────────────────────────┐
│  ← Voltar    Editando: Max (Suporte MaxPro)  [Salvar]│
├──────────────────────────────────────────────────────┤
│ Perfil │ Comportamento │ Modelo & RAG │ Skills │ Assistente IA │
├──────────────────────────────────────────────────────┤
│  (conteúdo da aba ativa)                             │
└──────────────────────────────────────────────────────┘
```

| Aba | Campos |
|-----|--------|
| **Perfil** | Nome, descrição, especialidade, cor, prioridade, canal, instâncias WhatsApp, ativo |
| **Comportamento** | System prompt (editor grande), tom, idioma, saudação, escalação, políticas, guardrails |
| **Modelo & RAG** | Provider (OpenRouter), modelo (dropdown), temperatura, max tokens, RAG toggle, top-k, threshold, fallback |
| **Skills** | Lista de skills com toggle on/off por categoria |
| **Assistente IA** | Chat que analisa e melhora o agente |

### 6.3 Aba Assistente IA

Chat conversacional que:
1. **Analisa** o agente atual e sugere melhorias proativamente
2. **Reescreve prompts** com técnicas avançadas (PASA, few-shot, chain-of-thought)
3. **Mostra diff** antes/depois pra aprovar
4. **Aplica mudanças** nos campos das outras abas
5. **Sugere modelo** ideal baseado na especialidade e custo
6. **Gera exemplos Q&A** de treinamento automaticamente

Fluxo: usuário entra na aba → IA analisa agente → sugere melhorias → usuário conversa → IA ajusta → botão "Aplicar mudanças" → campos das outras abas atualizados.

## 7. Resiliência e Monitoramento

### 7.1 Pontos de Falha Eliminados

| Ponto de falha | Correção |
|---|---|
| Orquestrador retorna "ignore" | Eliminado — fallback pra Lino |
| Lana não transfere | Eliminada |
| Modelo LLM fora do ar | Fallback chain 3 níveis |
| Agent-executor timeout | Timeout 15s + "um momento..." |
| Confiança baixa sem escalação | Threshold 0.6 → escala imediato |
| Transfer loop | Máximo 2 transfers → humano |
| Webhook perde mensagem | Dead letter queue + reprocessamento |
| Sem saudação | Obrigatória na estrutura de prompt |

### 7.2 Painel de Saúde (Dashboard)

Card no dashboard principal mostrando:
- Mensagens recebidas / respondidas (%)
- Tempo médio de resposta
- Transfers e escalações
- Mensagens sem resposta (alerta se > 0)
- Mensagens na dead letter queue
- Agente mais acionado / menor confiança

### 7.3 Alertas Automáticos

| Condição | Nível |
|---|---|
| Taxa de resposta < 95% | Crítico |
| Mensagens na dead letter > 0 | Aviso |
| Tempo médio resposta > 10s | Aviso |
| Confiança média agente < 0.6 | Ação — revisar prompt |
| 3+ escalações mesmo agente/hora | Ação — prompt fraco |

## 8. Fases de Implementação

### Fase 1 — Confiabilidade (parar de perder clientes)
- Reescrever orquestrador (sem Lana, fallback obrigatório, timeout)
- Fallback chain de modelos
- Reescrever prompts dos 6 agentes (padrão elite)
- Migration: desativar Lana, atualizar prompts

### Fase 2 — Contexto inteligente
- Briefing estruturado entre agentes (resumo automático)
- Detecção de produto via Sismais GL antes do roteamento
- Limite de transfers + escalação com briefing completo

### Fase 3 — UX de configuração
- Form fullscreen com 5 abas (Perfil, Comportamento, Modelo & RAG, Skills, Assistente IA)
- Edge function `agent-assistant` (LLM que analisa/reescreve prompts)
- Tela de modelos LLM em `/ai-settings`

### Fase 4 — Monitoramento
- Dead letter queue (tabela + reprocessamento)
- Painel de saúde no Dashboard
- Alertas automáticos

## 9. Arquivos Criados / Modificados / Removidos

| Ação | Item |
|---|---|
| Remove | Agente Lana (desativar via migration) |
| Remove | `action: "ignore"` do orquestrador |
| Reescreve | `supabase/functions/orchestrator/index.ts` |
| Reescreve | `supabase/functions/agent-executor/index.ts` |
| Reescreve | System prompts dos 6 agentes (migration) |
| Redesenha | `src/components/agents/AgentFormDialog.tsx` → fullscreen com 5 abas |
| Redesenha | `src/pages/Agents.tsx` → listagem simplificada |
| Cria | Componente aba Assistente IA |
| Cria | `supabase/functions/agent-assistant/index.ts` |
| Cria | Tela de modelos LLM (`/ai-settings` ou Settings tab) |
| Cria | Dead letter queue (tabela + edge function reprocessamento) |
| Cria | Painel de saúde (componente Dashboard) |
| Cria | Migration: desativar Lana, atualizar prompts, dead letter table |
