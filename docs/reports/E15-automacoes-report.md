# E15 — Motor Unificado de Automacoes (Workflow Engine)

**Data:** 2026-03-19
**Autor:** Engenheiro de Automacoes
**Status:** Implementado (feature flag `FF_UNIFIED_WORKFLOW_ENGINE`)

---

## 1. Diagnostico

### 1.1 Problema Central

Existem **dois sistemas de automacao paralelos** que competem entre si:

| Sistema | Tabela | Edge Functions | Frontend |
|---------|--------|---------------|----------|
| **Legado** | `ai_automations` | `automation-executor` | `/automations` + AutomationEditor |
| **Flows** | `flow_automations` | `trigger-flows` + `flow-engine` + `flow-executor` | `/flow-builder` + FlowBuilderCanvas |

O `process-incoming-message` executa **AMBOS** os sistemas em paralelo, controlado por feature flags (`FF_DISABLE_LEGACY_AUTO`, `FF_FLOWS_BLOCK_AGENT`).

### 1.2 Problemas Identificados

1. **Duplicacao de logica**: `automation-executor` e `flow-executor` implementam as mesmas acoes (send_message, assign_agent, add_tag, http_request, etc.) com implementacoes diferentes
2. **3 executores de flow**: `trigger-flows` (busca e despacha), `flow-engine` (executa com recursao), `flow-executor` (executa com loop) — sobreposicao confusa
3. **Envio WhatsApp inconsistente**: `automation-executor` usa `/chat/sendMessage` direto, `flow-engine` usa `uazapi-proxy`, `flow-executor` retorna `{ message_sent }` sem enviar de fato
4. **Conditions limitadas no legado**: apenas `AND` implicito (array de conditions), sem `OR`/`NOT`
5. **Recursao no flow-engine**: usa `executeNode` recursivo que pode causar stack overflow em flows longos
6. **Race condition nos contadores**: `execution_count` incrementado com SELECT + UPDATE separados

### 1.3 O que Funciona Bem

- Flow Builder visual (ReactFlow) com 30+ tipos de nodes
- Templates de automacao na pagina de listagem
- Sistema de trigger_config com filtros por instancia, keywords, status
- Feature flags ja preparadas para migracao gradual
- AI Chat Panel para gerar flows com IA

---

## 2. Arquitetura Unificada

### 2.1 Edge Function: `workflow-engine`

Uma unica edge function que substitui os 4 executores existentes:

```
workflow-engine
├── Modo Trigger:    { trigger_type, conversation_id, data }
│   └── Busca flows E automacoes legadas → executa todos que passam nos filtros
├── Modo Legacy:     { automation_id, trigger_data }
│   └── Executa uma ai_automation especifica (compatibilidade)
└── Modo Flow:       { flow_id, trigger_data, conversation_id }
    └── Executa um flow_automations especifico
```

### 2.2 Melhorias vs Sistema Anterior

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Edge functions | 4 (automation-executor, trigger-flows, flow-engine, flow-executor) | 1 (workflow-engine) |
| Execucao de nodes | Recursiva (stack overflow possivel) | Iterativa com loop while |
| Limite de nodes | Nenhum | MAX_NODES_PER_EXECUTION = 100 |
| Envio WhatsApp | 2 implementacoes diferentes | 1 via uazapi-proxy |
| Conditions legadas | AND-only | AND/OR com logica booleana |
| Logs | Emojis (trigger-flows, flow-engine) | JSON estruturado |
| Jump depth | Verificado apenas no flow-engine | Verificado globalmente (MAX = 5) |

### 2.3 Compatibilidade

- **100% retrocompativel**: aceita os mesmos payloads que os executores antigos
- Pode ser ativado por feature flag `FF_UNIFIED_WORKFLOW_ENGINE`
- `process-incoming-message` pode chamar `workflow-engine` em vez dos executores individuais
- Sistemas antigos continuam funcionando ate migracao completa

---

## 3. Templates de Workflows

7 templates prontos criados em `src/data/workflowTemplates.ts`:

| Template | Trigger | Categoria | Descricao |
|----------|---------|-----------|-----------|
| Auto-resposta Fora do Horario | `message_received` | Atendimento | Verifica horario comercial, envia mensagem automatica fora do expediente |
| Escalacao por SLA | `sla_breached` | Sistema | Adiciona tag, atribui agente humano, notifica cliente |
| Follow-up Pos-Atendimento | `conversation_closed` | Atendimento | Aguarda 30min e envia pesquisa CSAT |
| Triagem Inteligente com IA | `message_received` | Atendimento | IA responde, verifica confianca, escala se baixa |
| Roteamento VIP | `message_received` | Vendas | Detecta tag VIP, prioriza e redireciona |
| Webhook Externo com RAG | `webhook` | Operacional | Recebe webhook, busca RAG, retorna via callback |
| Escalacao por Sentimento Negativo | `message_received` | Atendimento | Detecta sentimento negativo, escala com urgencia |

Cada template gera nodes/edges prontos para o Flow Builder.

---

## 4. Hook Unificado: useWorkflowEngine

```typescript
const { workflows, isLoading, stats, legacy, flow } = useWorkflowEngine()
// workflows: UnifiedWorkflow[] — combina ai_automations + flow_automations
// stats: { total, active, totalExecutions, legacyCount, flowCount }
// legacy: { createAutomation, updateAutomation, deleteAutomation, toggleAutomation }
// flow: { createFlow, updateFlow, deleteFlow, toggleFlow }
```

Permite a pagina de Automacoes apresentar uma visao consolidada enquanto a migracao gradual acontece.

---

## 5. Plano de Migracao

### Fase 1: Coexistencia (atual)
- [x] Criar `workflow-engine` edge function
- [x] Criar feature flag `FF_UNIFIED_WORKFLOW_ENGINE`
- [x] Criar hook unificado `useWorkflowEngine`
- [x] Criar templates de workflows
- [ ] Deploy do `workflow-engine` no Supabase

### Fase 2: Shadow Mode
- [ ] Ativar `FF_UNIFIED_WORKFLOW_ENGINE=true` em staging
- [ ] `process-incoming-message` chama `workflow-engine` em vez de `trigger-flows` + `automation-executor`
- [ ] Monitorar logs e comparar resultados com os executores antigos
- [ ] Validar por 1 semana

### Fase 3: Migracao de Automacoes Legadas
- [ ] Listar `ai_automations` ativas em producao
- [ ] Para cada uma, criar equivalente em `flow_automations` (visual no Flow Builder)
- [ ] Ativar `FF_DISABLE_LEGACY_AUTO=true`
- [ ] Monitorar por 2 semanas

### Fase 4: Limpeza
- [ ] Remover chamadas a `automation-executor`, `trigger-flows`, `flow-engine`, `flow-executor` do `process-incoming-message`
- [ ] Marcar edge functions antigas como deprecated (nao deletar ainda)
- [ ] Atualizar rota `/automations` para usar apenas `useWorkflowEngine`
- [ ] Unificar paginas de listagem (legacy + flows na mesma view)

### Fase 5: Deprecacao
- [ ] Deletar edge functions: `automation-executor`, `trigger-flows`, `flow-engine`, `flow-executor`
- [ ] Migrar dados de `ai_automation_logs` para `flow_executions` (script SQL)
- [ ] Deprecar tabela `ai_automations` (manter read-only por 90 dias)

---

## 6. Arquivos Criados/Modificados

### Criados
- `supabase/functions/workflow-engine/index.ts` — Motor unificado (540 linhas)
- `src/data/workflowTemplates.ts` — 7 templates de workflows prontos
- `src/hooks/useWorkflowEngine.ts` — Hook unificado frontend

### Modificados
- `supabase/functions/_shared/feature-flags.ts` — Adicionada flag `FF_UNIFIED_WORKFLOW_ENGINE`

### Nao Modificados (preservados)
- `supabase/functions/automation-executor/index.ts` — Mantido como fallback
- `supabase/functions/trigger-flows/index.ts` — Mantido como fallback
- `supabase/functions/flow-engine/index.ts` — Mantido como fallback
- `supabase/functions/flow-executor/index.ts` — Mantido como fallback

---

## 7. Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| workflow-engine tem bug que o executor antigo nao tem | Feature flag permite rollback instantaneo |
| Performance inferior com muitos flows + automacoes | Limite MAX_NODES_PER_EXECUTION = 100, logs de timing |
| Delay no edge function excede timeout Supabase (26s) | MAX_DELAY_MS = 25s, delays maiores devem usar scheduler |
| Jump-to-flow cria loop infinito | MAX_JUMP_DEPTH = 5 |
| Contadores de execucao perdem consistencia | Usa RPC atomico com fallback para SELECT+UPDATE |

---

*Relatorio gerado em 2026-03-19.*
