# E09 — Arquitetura Multi-Canal: UAZAPI + Meta WhatsApp API + Instagram

**Data:** 2026-03-19
**Autor:** Engenheiro Multi-Canal
**Escopo:** Channel adapter pattern, integracao Meta WhatsApp Business API, integracao Instagram Messaging API
**Dependencias:** E16 (CTO Report — pipeline unificado), E04 (arquitetura de agentes)

---

## 1. Visao Geral

### 1.1 Problema
O sistema atualmente suporta apenas WhatsApp via UAZAPI (self-hosted). Clientes precisam de atendimento via WhatsApp Official (Meta API) e Instagram DMs.

### 1.2 Solucao
Implementar **channel adapter pattern** que normaliza mensagens de qualquer canal para um formato unico, permitindo que o pipeline de processamento (message-analyzer -> orchestrator -> agent-executor) funcione independente do canal de origem.

### 1.3 Canais
| Canal | Status | Protocolo | Tipo |
|-------|--------|-----------|------|
| UAZAPI | Existente (producao) | Self-hosted Baileys | WhatsApp nao-oficial |
| Meta WhatsApp Business API | Novo | Cloud API (Graph API v19.0) | WhatsApp oficial |
| Instagram Messaging API | Novo | Graph API v19.0 | Instagram DMs |

---

## 2. Arquitetura

### 2.1 Diagrama

```
                    ┌──────────────┐
                    │   UAZAPI     │
                    │  (existente) │
                    └──────┬───────┘
                           │
    ┌──────────────┐       │       ┌──────────────┐
    │  Meta WA API │       │       │  Instagram   │
    │  (Cloud API) │       │       │  (DMs)       │
    └──────┬───────┘       │       └──────┬───────┘
           │               │              │
           v               v              v
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ meta-wa-     │ │ uazapi-      │ │ instagram-   │
    │ webhook      │ │ webhook      │ │ webhook      │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │               │              │
           v               v              v
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ MetaWhatsApp │ │ Uazapi       │ │ Instagram    │
    │ Adapter      │ │ Adapter      │ │ Adapter      │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │               │              │
           └───────────┬───┴──────────────┘
                       │
                       v
              ┌────────────────┐
              │ NormalizedMsg  │  (formato unico)
              └────────┬───────┘
                       │
                       v
              ┌────────────────┐
              │ Channel Router │
              │  - resolve/    │
              │    create conv │
              │  - save msg    │
              │  - invoke      │
              │    pipeline    │
              └────────┬───────┘
                       │
                       v
              ┌────────────────┐
              │ process-       │
              │ incoming-msg   │  (pipeline existente, inalterado)
              │  -> analyzer   │
              │  -> orchestr.  │
              │  -> agent-exec │
              └────────┬───────┘
                       │
                       v
              ┌────────────────┐
              │ sendViaChannel │  (envia pelo canal correto)
              │  - adapter.    │
              │    sendMessage │
              └────────────────┘
```

### 2.2 Principios de Design

1. **Adapter Pattern**: Interface `ChannelAdapter` com metodos `parseWebhook()`, `sendMessage()`, `getStatus()`, `verifyWebhook()`
2. **Normalizacao**: Todas as mensagens sao convertidas para `NormalizedIncomingMessage` antes de entrar no pipeline
3. **Pipeline inalterado**: `process-incoming-message` nao precisa saber qual canal originou a mensagem
4. **Feature flags**: Cada canal e controlado por flag independente
5. **Backward compatibility**: UAZAPI continua funcionando sem mudancas

---

## 3. Modelo de Dados

### 3.1 Novas Tabelas

#### `channel_instances`
Tabela unificada para todas as instancias de canal.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | Identificador unico |
| channel_type | TEXT | `uazapi`, `meta_whatsapp`, `instagram` |
| display_name | TEXT | Nome amigavel |
| phone_number | TEXT | Telefone (quando aplicavel) |
| is_active | BOOLEAN | Ativa/inativa |
| status | TEXT | `connected`, `disconnected`, `error`, `pending_setup` |
| config | JSONB | Configuracao especifica do canal |
| kanban_board_id | UUID FK | Board Kanban associado |
| test_mode | BOOLEAN | Modo teste |
| test_identifier | TEXT | Identificador para modo teste |
| messages_received_count | BIGINT | Contador de mensagens recebidas |
| messages_sent_count | BIGINT | Contador de mensagens enviadas |
| last_message_at | TIMESTAMPTZ | Ultima mensagem |

**Config JSONB por canal:**

```json
// UAZAPI
{ "api_url": "https://...", "api_token": "..." }

// Meta WhatsApp
{ "phone_number_id": "123", "waba_id": "456", "access_token": "EAA...", "webhook_verify_token": "..." }

// Instagram
{ "ig_user_id": "789", "page_id": "012", "access_token": "EAA...", "username": "@sismais" }
```

#### `channel_messages`
Tabela unificada para mensagens de todos os canais.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | Identificador unico |
| conversation_id | UUID FK | Referencia ai_conversations |
| channel_type | TEXT | Canal de origem |
| channel_instance_id | UUID FK | Instancia do canal |
| external_message_id | TEXT | ID no sistema externo |
| sender_phone | TEXT | Telefone/ID do remetente |
| sender_name | TEXT | Nome do remetente |
| message_type | TEXT | Tipo normalizado |
| text_content | TEXT | Conteudo texto |
| media_url | TEXT | URL da media |
| media_mime_type | TEXT | MIME type |
| from_me | BOOLEAN | Enviada por nos? |
| status | TEXT | sent/delivered/read/failed |
| raw_payload | JSONB | Payload bruto (debug) |

**Dedup:** UNIQUE(external_message_id, channel_type, channel_instance_id)

### 3.2 Campos Novos em Tabelas Existentes

#### `ai_conversations`
- `channel_chat_id TEXT` — ID do chat no canal (complementa `uazapi_chat_id`)
- `channel_instance_id UUID FK` — Referencia `channel_instances` (complementa `whatsapp_instance_id`)
- `communication_channel` — ja existe, passa a ser usado ativamente

#### `ai_messages`
- `channel_type TEXT` — Canal de origem (para rastreabilidade)

### 3.3 Compatibilidade com Tabelas Existentes

As tabelas `uazapi_instances`, `uazapi_chats`, `uazapi_messages` **NAO sao alteradas**. O UAZAPI continua usando suas tabelas proprias. A migracao gradual para `channel_instances` / `channel_messages` sera feita em fases posteriores.

---

## 4. Integracao Meta WhatsApp Business API

### 4.1 Pre-requisitos
1. **Meta Business Account** verificada
2. **WhatsApp Business Account (WABA)** criada no Meta Business Suite
3. **App registrado** no Meta for Developers com permissao `whatsapp_business_messaging`
4. **Phone Number** registrado na WABA
5. **Webhook** configurado apontando para `https://<supabase-url>/functions/v1/meta-whatsapp-webhook`

### 4.2 Variaveis de Ambiente
```
META_WHATSAPP_VERIFY_TOKEN=<token aleatorio para verificacao>
META_WHATSAPP_APP_SECRET=<app secret do Meta App>
```

### 4.3 Fluxo de Mensagens

**Entrada (cliente -> sistema):**
1. Meta envia POST para `meta-whatsapp-webhook`
2. Webhook verifica assinatura HMAC SHA256
3. `MetaWhatsAppAdapter.parseWebhook()` normaliza a mensagem
4. `Channel Router` resolve/cria conversa e invoca `process-incoming-message`
5. Pipeline processa normalmente (analyzer -> orchestrator -> agent-executor)

**Saida (sistema -> cliente):**
1. `process-incoming-message` gera resposta
2. `sendViaChannel()` identifica que `communication_channel = 'meta_whatsapp'`
3. `MetaWhatsAppAdapter.sendMessage()` envia via Graph API
4. Meta entrega ao cliente

### 4.4 Templates HSM
Para mensagens proativas (fora da janela de 24h), e necessario usar templates aprovados pela Meta:

```typescript
adapter.sendMessage(instanceId, {
  recipient: '5577812345678',
  text: '', // Ignorado para templates
  templateName: 'ticket_update',
  templateLanguage: 'pt_BR',
  templateParams: ['#1234', 'Seu ticket foi resolvido'],
})
```

### 4.5 Limitacoes vs UAZAPI
| Feature | UAZAPI | Meta API |
|---------|--------|----------|
| Custo por mensagem | Gratuito (self-hosted) | Pago (conversa-based) |
| Templates HSM | Nao necessario | Obrigatorio fora de 24h |
| Grupos | Suportado | Nao suportado (Cloud API) |
| Media download | Direto | Via Graph API (2 steps) |
| Rate limits | Sem limite | Tier-based (250-100k/dia) |
| Webhook verification | Nenhuma | HMAC SHA256 obrigatorio |

---

## 5. Integracao Instagram Messaging API

### 5.1 Pre-requisitos
1. **Instagram Professional Account** (Business ou Creator)
2. **Facebook Page** conectada ao Instagram
3. **App registrado** com permissao `instagram_manage_messages`
4. **Webhook** configurado para `https://<supabase-url>/functions/v1/instagram-webhook`

### 5.2 Variaveis de Ambiente
```
INSTAGRAM_VERIFY_TOKEN=<token aleatorio>
META_WHATSAPP_APP_SECRET=<mesmo app secret — mesmo app Meta>
```

### 5.3 Fluxo de Mensagens

Identico ao Meta WhatsApp, usando `InstagramAdapter` em vez de `MetaWhatsAppAdapter`.

### 5.4 Tipos Suportados

| Tipo | Receber | Enviar | Notas |
|------|---------|--------|-------|
| Text | Sim | Sim | — |
| Image | Sim | Sim | Via URL |
| Video | Sim | Nao | Apenas receber |
| Audio | Sim | Nao | Apenas receber |
| Story mention | Sim | N/A | Notificacao de mencao |
| Story reply | Sim | N/A | Resposta a story |
| Quick replies | N/A | Sim | Alternativa a botoes |
| Sticker | Sim | Nao | Recebe como imagem |

### 5.5 Limitacoes
- **Janela de 24h**: Assim como Meta WA, mensagens proativas sao limitadas
- **Sem templates**: Instagram nao tem conceito de HSM
- **Rate limits**: 250 mensagens/24h (padrao)
- **Sem grupos**: Apenas DMs 1:1

---

## 6. Arquivos Criados/Modificados

### Novos
| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/_shared/channel-adapter.ts` | Interface ChannelAdapter + tipos normalizados + registry |
| `supabase/functions/_shared/uazapi-adapter.ts` | Adapter para UAZAPI (refatora logica existente) |
| `supabase/functions/_shared/meta-whatsapp-adapter.ts` | Adapter para Meta WhatsApp Business API |
| `supabase/functions/_shared/instagram-adapter.ts` | Adapter para Instagram Messaging API |
| `supabase/functions/_shared/channel-router.ts` | Router unificado (resolve conversa + invoca pipeline) |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Edge function: webhook Meta WhatsApp |
| `supabase/functions/instagram-webhook/index.ts` | Edge function: webhook Instagram |
| `supabase/migrations/20260319210000_multichannel_support.sql` | Migration: tabelas channel_instances, channel_messages, novos campos |

### Modificados
| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/_shared/feature-flags.ts` | +3 flags: CHANNEL_META_WHATSAPP, CHANNEL_INSTAGRAM, MULTICHANNEL_ROUTING |

---

## 7. Feature Flags

| Flag | Env Var | Default | Descricao |
|------|---------|---------|-----------|
| CHANNEL_META_WHATSAPP | `FF_CHANNEL_META_WHATSAPP` | false | Ativa webhook Meta WhatsApp |
| CHANNEL_INSTAGRAM | `FF_CHANNEL_INSTAGRAM` | false | Ativa webhook Instagram |
| MULTICHANNEL_ROUTING | `FF_MULTICHANNEL_ROUTING` | false | Ativa envio de respostas via canal correto |

**Sequencia de ativacao:**
1. Aplicar migration `20260319210000_multichannel_support.sql`
2. Configurar secrets no Supabase
3. Deploy das edge functions
4. Cadastrar instancia na tabela `channel_instances`
5. Configurar webhook no Meta Business Suite
6. Ativar flag `FF_CHANNEL_META_WHATSAPP=true` (ou INSTAGRAM)
7. Testar com mensagem de teste
8. Ativar `FF_MULTICHANNEL_ROUTING=true` para respostas unificadas

---

## 8. Plano de Rollout

### Fase 0 — Pre-requisitos (Semana 1)
- [ ] Aplicar migration de banco de dados
- [ ] Deploy dos adapters e webhooks (desativados por flag)
- [ ] Validar que UAZAPI continua funcionando sem regressao

### Fase 1 — Meta WhatsApp API (Semana 2-3)
- [ ] Criar Meta Business Account e WABA
- [ ] Registrar app e obter access token
- [ ] Cadastrar instancia em `channel_instances`
- [ ] Configurar webhook no Meta Developer Dashboard
- [ ] Ativar `FF_CHANNEL_META_WHATSAPP=true`
- [ ] Testar: mensagem de entrada -> pipeline -> resposta
- [ ] Testar: templates HSM para mensagens proativas
- [ ] Monitorar por 48h

### Fase 2 — Instagram (Semana 3-4)
- [ ] Conectar Instagram Business ao app Meta
- [ ] Cadastrar instancia em `channel_instances`
- [ ] Configurar webhook Instagram
- [ ] Ativar `FF_CHANNEL_INSTAGRAM=true`
- [ ] Testar: DM -> pipeline -> resposta
- [ ] Testar: story mention -> notificacao
- [ ] Monitorar por 48h

### Fase 3 — Roteamento Unificado (Semana 4-5)
- [ ] Ativar `FF_MULTICHANNEL_ROUTING=true`
- [ ] Validar que `process-incoming-message` envia respostas pelo canal correto
- [ ] Refatorar `sendTextViaWhatsApp` para usar `sendViaChannel` (com fallback)
- [ ] Dashboard de canais com metricas por canal

### Fase 4 — Migracao Gradual do UAZAPI (Semana 6+)
- [ ] Criar registros em `channel_instances` para instancias UAZAPI existentes
- [ ] Bridge: `uazapi-webhook` passa a usar `UazapiAdapter` + `Channel Router`
- [ ] Migrar envio de mensagens para usar `sendViaChannel`
- [ ] Deprecar `sendTextViaWhatsApp` inline no `process-incoming-message`

---

## 9. Decisoes de Arquitetura (ADRs)

### ADR-006: Tabela Unificada vs Tabela por Canal

**Opcoes:**
1. Tabela `channel_instances` + `channel_messages` unificadas com JSONB config
2. Tabelas separadas por canal (`meta_wa_instances`, `ig_instances`, etc.)

**Decisao:** Opcao 1. JSONB config e flexivel o suficiente para as diferencas entre canais. Tabela unica simplifica queries de dashboard e evita N+1 joins. O tradeoff e perda de validacao por schema — mitigado com CHECK constraints e documentacao.

### ADR-007: Manter uazapi_* ou Migrar para channel_*

**Opcoes:**
1. Migrar tudo para `channel_instances` / `channel_messages`
2. Manter `uazapi_*` e usar `channel_*` apenas para novos canais

**Decisao:** Opcao 2 por agora. O webhook UAZAPI tem 2061 linhas e acoplamento forte com as tabelas `uazapi_*`. Migrar tudo e arriscado sem testes extensivos. A bridge via `communication_channel` + `channel_chat_id` + `channel_instance_id` permite coexistencia.

### ADR-008: Webhook por Canal vs Webhook Unico

**Opcoes:**
1. Um webhook por canal (`meta-whatsapp-webhook`, `instagram-webhook`)
2. Um webhook unico que detecta o canal pelo payload

**Decisao:** Opcao 1. Cada canal tem formato de payload e verificacao de seguranca diferentes. Webhook separado permite deploy e rollback independente. Meta e Instagram usam mesma assinatura HMAC mas payloads e routing sao distintos.

---

## 10. Estimativa de Custos Meta API

### WhatsApp Business API (conversas)

| Tipo | Custo/conversa (BR) | Descricao |
|------|---------------------|-----------|
| Utility | ~$0.035 (R$0.18) | Notificacoes transacionais |
| Authentication | ~$0.027 (R$0.14) | OTP, login |
| Marketing | ~$0.065 (R$0.33) | Campanhas |
| Service | Gratuito (1000/mes) | Resposta a mensagem do cliente |

**Estimativa mensal (500 conversas de suporte):**
- Service conversations: 500 x $0 = **$0** (dentro do free tier)
- Utility (notificacoes): 200 x $0.035 = **$7/mes**
- Total estimado: **~$7-15/mes**

### Instagram Messaging API
- **Gratuito** (sem custo por mensagem)
- Limite: 250 mensagens/24h (aumentavel com aprovacao)

---

## 11. Resumo

| Item | Detalhe |
|------|---------|
| Canais suportados | UAZAPI (existente) + Meta WhatsApp API + Instagram |
| Padrao de integracao | Channel Adapter Pattern com normalizacao |
| Pipeline de IA | **Inalterado** — funciona independente de canal |
| Backward compatibility | 100% — UAZAPI continua usando tabelas proprias |
| Ativacao | Feature flags por canal (deploy-safe) |
| Migration | 1 arquivo SQL (tabelas + indices + RLS) |
| Edge functions novas | 2 (meta-whatsapp-webhook, instagram-webhook) |
| Shared modules novos | 5 (channel-adapter, uazapi-adapter, meta-whatsapp-adapter, instagram-adapter, channel-router) |

---

*Relatorio gerado em 2026-03-19. Proxima revisao: apos Fase 1 (Semana 3).*
