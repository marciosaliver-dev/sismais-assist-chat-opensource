# E03 — Relatorio de Auditoria de Seguranca e Compliance LGPD

## Sismais Helpdesk IA

**Data:** 2026-03-19
**Autor:** Analista de Seguranca (auditoria automatizada)
**Branch analisado:** main (1f83c32)
**Escopo:** 74 edge functions, 106+ migrations, pipeline completo, frontend React

---

## RESUMO EXECUTIVO

A auditoria identificou **8 vulnerabilidades de severidade alta**, **12 de severidade media** e **6 de severidade baixa**. Os problemas mais criticos sao: (1) CORS wildcard em todas as edge functions, (2) ausencia de autenticacao em endpoints sensiveis como `register-user`, `whatsapp-send-message` e `generate-embedding`, (3) PII (dados pessoais) sendo logada em texto plano nos logs de edge functions, e (4) tabela `user_roles` sem RLS visivel nas migrations.

---

## 1. VULNERABILIDADES ENCONTRADAS

### 1.1 SEVERIDADE ALTA

#### V-001: CORS Wildcard em Todas as Edge Functions
**Localizacao:** Todas as 74 edge functions
**Descricao:** Toda edge function usa `Access-Control-Allow-Origin: *`, permitindo que qualquer dominio faca requests cross-origin. Isso facilita ataques CSRF e abuso de endpoints.
**Impacto:** Um atacante pode criar uma pagina maliciosa que faca requests autenticados (via cookies/tokens do browser) para as edge functions.
**Correcao recomendada:** Restringir CORS para o dominio de producao:
```typescript
const ALLOWED_ORIGINS = [
  'https://sismais-assist-chat.lovable.app',
  'https://seu-dominio.com.br'
];
const origin = req.headers.get('Origin') || '';
const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
```
**Status:** PENDENTE — requer mudanca coordenada em todas as functions.

#### V-002: Edge Functions Sem Autenticacao
**Localizacao:** Multiplas edge functions
**Descricao:** As seguintes edge functions aceitam requests sem verificar JWT/Bearer token:
- `register-user` — cria usuarios no Supabase Auth (abuso para criar contas em massa)
- `whatsapp-send-message` — envia mensagens WhatsApp sem auth (abuso critico)
- `generate-embedding` — consome API OpenAI sem auth (custo financeiro)
- `webhook-sender` — dispara webhooks outgoing sem auth
- `automation-executor` — executa automacoes sem auth
- `flow-engine`, `flow-executor` — executam flows sem auth
- `calculate-health-scores` — acessa dados de clientes sem auth
- `check-inactive-conversations` — modifica conversas sem auth
- `extract-conversation-knowledge` — acessa conteudo de conversas sem auth
- `customer-360` — endpoint que retorna dados completos de cliente sem auth

**Impacto:** Qualquer pessoa com a URL do Supabase pode invocar essas funcoes. O `register-user` permite criacao massiva de contas. O `whatsapp-send-message` permite envio de spam via WhatsApp da empresa.
**Correcao recomendada:** Adicionar verificacao de JWT em todas as functions que nao sao webhooks:
```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
}
```
**Nota:** Apenas `copilot-suggest`, `create-system-user` e `approve-user` verificam auth corretamente.
**Status:** PENDENTE

#### V-003: Tabela `user_roles` Sem RLS Visivel
**Localizacao:** Migrations
**Descricao:** A tabela `user_roles` e usada para controle de acesso (role, is_approved), mas nao aparece com `ENABLE ROW LEVEL SECURITY` em nenhuma migration analisada. Se RLS nao esta ativo, qualquer usuario autenticado com a anon key pode ler/escrever nessa tabela, escalando seu proprio role para `admin`.
**Impacto:** CRITICO — escalacao de privilegios. Um usuario pode se auto-aprovar e mudar seu role para admin.
**Correcao recomendada:** Criar migration com RLS + policies restritivas:
```sql
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_role" ON user_roles FOR SELECT USING (auth.uid() = user_id);
-- Somente service_role pode INSERT/UPDATE/DELETE
```
**Status:** PENDENTE

#### V-004: PII em Logs de Edge Functions
**Localizacao:** Multiplas edge functions
**Descricao:** Dados pessoais sao logados em texto plano:
- `enrich-contact`: loga telefone (`cleanPhone`)
- `ai-whatsapp-reply`: loga telefone do cliente (`customerPhone`)
- `sismais-client-auto-link`: loga telefone, documento (CPF/CNPJ), email, nome do cliente
- `process-incoming-message`: loga documento e email
- `sincronizar-guru`: loga nome do cliente, valor de assinatura
- `uazapi-webhook`: loga payload completo do webhook (contem mensagens do usuario)
- `whatsapp-webhook`: `console.log("Webhook received:", JSON.stringify(payload, null, 2))` — loga TODO o payload
- `whatsapp-send`: `console.log("Sending to Uazapi:", url, JSON.stringify(body))` — loga mensagens enviadas

**Impacto:** Violacao direta da LGPD (Art. 46 — medidas de seguranca). Logs do Supabase ficam acessiveis no dashboard e podem ser exportados. Dados pessoais em logs nao tem controle de acesso adequado nem retencao definida.
**Correcao recomendada:** Criar funcao de sanitizacao:
```typescript
function sanitizeForLog(data: any): any {
  const sensitive = ['phone', 'email', 'documento', 'cpf', 'cnpj', 'content'];
  // mascarar campos sensiveis
}
```
**Status:** PENDENTE

#### V-005: `register-user` Sem Rate Limiting
**Localizacao:** `supabase/functions/register-user/index.ts`
**Descricao:** Endpoint publico de criacao de usuarios sem nenhum rate limiting. Aceita qualquer request POST com name/email/password. Senha minima de apenas 6 caracteres.
**Impacto:** Permite brute force de criacao de contas, enumeracao de emails (resposta diferente para email existente vs novo), e criacao de contas com senhas fracas.
**Correcao recomendada:**
1. Rate limit: max 5 registros por IP por hora
2. CAPTCHA ou proof-of-work
3. Senha minima: 8 caracteres com complexidade
4. Nao diferenciar erro de "email ja existe" vs generico
**Status:** PENDENTE

#### V-006: Webhook Endpoints Sem Verificacao de Origem
**Localizacao:** `uazapi-webhook`, `whatsapp-webhook`, `whatsapp-meta-webhook`, `webhook-billing`, `webhook-guru`, `webhook-sismais-admin`
**Descricao:** Os webhooks aceitam requests de qualquer origem. Nao ha verificacao de signature/HMAC, IP whitelist, ou token de autenticacao nos headers.
**Impacto:** Um atacante pode forjar webhooks falsos para injetar mensagens, manipular conversas, ou triggar automacoes maliciosas.
**Correcao recomendada:** Implementar verificacao de HMAC signature para cada provedor de webhook, ou usar tokens secretos no path/header.
**Status:** PENDENTE — `webhook-receiver` usa token no path (correto), mas os demais nao.

#### V-007: Supabase Anon Key Hardcoded no Frontend
**Localizacao:** `src/integrations/supabase/client.ts:6`
**Descricao:** A anon key esta hardcoded no arquivo (JWT com role=anon, ref=pomueweeulenslxvsxar). Embora a anon key seja considerada "publica" pelo Supabase, ela so e segura se RLS estiver corretamente configurado em TODAS as tabelas.
**Impacto:** Combinado com V-003 (user_roles sem RLS), permite escalacao de privilegios. Qualquer pessoa pode usar esta key para acessar a API Supabase diretamente.
**Correcao recomendada:** Mover para variavel de ambiente `VITE_SUPABASE_PUBLISHABLE_KEY` (ja mencionada no .env mas nao usada no client.ts). Garantir RLS em todas as tabelas.
**Status:** PENDENTE

#### V-008: `whatsapp-send-message` — Envio Sem Auth
**Localizacao:** `supabase/functions/whatsapp-send-message/index.ts`
**Descricao:** Permite enviar mensagens WhatsApp para qualquer numero sem autenticacao. Aceita `to` (telefone) e `message` como parametros.
**Impacto:** CRITICO — pode ser usado para spam, phishing ou assedio via WhatsApp da empresa. Pode resultar em banimento do numero WhatsApp Business.
**Correcao recomendada:** Exigir JWT valido + verificar role do usuario (minimo `suporte`).
**Status:** PENDENTE

---

### 1.2 SEVERIDADE MEDIA

#### V-009: Sem Rate Limiting Global
**Descricao:** Nenhuma edge function implementa rate limiting. Qualquer endpoint pode receber milhares de requests por segundo.
**Correcao:** Implementar rate limiting via Supabase (tabela de rate limits) ou header-based em endpoints publicos.

#### V-010: CORS Allow-Headers Muito Permissivo
**Descricao:** Headers como `x-supabase-client-platform`, `x-supabase-client-runtime` sao permitidos mas nao validados, aumentando superficie de ataque.

#### V-011: Erros Internos Expostos ao Cliente
**Localizacao:** Maioria das edge functions
**Descricao:** Mensagens de erro do banco ou de APIs externas sao retornadas diretamente: `error: msg` onde `msg` vem de `error.message`. Isso pode vazar informacoes internas (nomes de tabela, estrutura do banco).
**Correcao:** Retornar mensagens genericas para o cliente e logar detalhes internamente.

#### V-012: `process-incoming-message` Loga Dados de Identificacao
**Localizacao:** `supabase/functions/process-incoming-message/index.ts:252`
**Descricao:** Loga CPF/CNPJ e email: `"Found identification data — documento: ${documento}, email: ${email}"`.

#### V-013: Service Role Key Usado em Todos os Endpoints
**Descricao:** Toda edge function usa `SUPABASE_SERVICE_ROLE_KEY` que bypassa RLS. Isso anula a protecao de RLS se houver qualquer vulnerabilidade de injecao.
**Correcao:** Para endpoints que atendem usuarios autenticados, usar o JWT do usuario para criar o client Supabase, preservando RLS.

#### V-014: Sem Validacao de Content-Type
**Descricao:** Nenhuma edge function valida se `Content-Type: application/json` esta presente antes de chamar `req.json()`. Pode causar erros inesperados.

#### V-015: Webhook Payload Logging Completo
**Localizacao:** `uazapi-webhook/index.ts:22-23`, `whatsapp-webhook/index.ts:109`
**Descricao:** Payloads de webhook sao logados integralmente, incluindo conteudo de mensagens do usuario (potencialmente dados sensiveis, medicos, financeiros).

#### V-016: Sem Validacao de Input em Campos de Texto Livre
**Descricao:** Campos como `message`, `content`, `name` nao sao sanitizados contra XSS antes de serem salvos no banco. Embora XSS via API seja menos critico, se esses dados forem renderizados no frontend sem sanitizacao, ha risco.

#### V-017: Enumeracao de Emails via `register-user`
**Localizacao:** `supabase/functions/register-user/index.ts:53-54`
**Descricao:** Resposta diferencia "email ja cadastrado" (HTTP 409) de erro generico (HTTP 400), permitindo enumeracao de emails.

#### V-018: Frontend Auth Depende Apenas de Client-Side Check
**Localizacao:** `src/contexts/AuthContext.tsx`
**Descricao:** A verificacao de role e `is_approved` e feita no frontend via query a `user_roles`. Se RLS nao proteger essa tabela, um usuario pode manipular seu role via Supabase client direto.

#### V-019: `kanban_stages` e Tabelas de Configuracao Sem RLS Restritiva
**Descricao:** Muitas tabelas de configuracao tem policies `FOR ALL USING (true)`, permitindo que qualquer usuario autenticado modifique configuracoes do sistema.

#### V-020: `uazapi_instances` Armazena `api_token` Sem Criptografia
**Descricao:** Tokens de API do UAZAPI sao armazenados em texto plano na tabela `uazapi_instances`. Se o banco for comprometido, todos os tokens ficam expostos.

---

### 1.3 SEVERIDADE BAIXA

#### V-021: Dependencias Antropic SDK no Frontend Bundle
**Localizacao:** `package.json`
**Descricao:** `@anthropic-ai/claude-agent-sdk` e `@anthropic-ai/sdk` no bundle frontend.

#### V-022: Sem Headers de Seguranca no Frontend
**Descricao:** Nao ha configuracao de `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` no frontend.

#### V-023: Supabase URL Hardcoded
**Localizacao:** `src/integrations/supabase/client.ts:5`
**Descricao:** URL do Supabase hardcoded. Deveria usar `import.meta.env.VITE_SUPABASE_URL`.

#### V-024: Senha Minima de 6 Caracteres
**Localizacao:** `register-user/index.ts:24`
**Descricao:** OWASP recomenda minimo de 8 caracteres.

#### V-025: Sem Logout em Todas as Abas
**Descricao:** `AuthContext` usa `signOut()` mas nao ha listener para invalidar sessao em outras abas/dispositivos.

#### V-026: Sem Audit Trail de Acoes Administrativas
**Descricao:** Acoes como aprovar/rejeitar usuarios, criar agentes, modificar automacoes nao sao auditadas em tabela dedicada.

---

## 2. CHECKLIST LGPD

| Requisito LGPD | Status | Observacao |
|---|---|---|
| **Art. 7 — Base legal para tratamento** | PARCIAL | Nao ha registro de consentimento explicito dos contatos WhatsApp |
| **Art. 8 — Consentimento** | NAO IMPLEMENTADO | Nao ha mecanismo de opt-in antes do tratamento de dados |
| **Art. 9 — Direito a informacao** | NAO IMPLEMENTADO | Nao ha politica de privacidade acessivel via WhatsApp |
| **Art. 15 — Direito ao esquecimento** | PARCIAL | Existe `conversation_deletion_logs` mas nao ha endpoint para o titular solicitar exclusao |
| **Art. 18 — Portabilidade** | NAO IMPLEMENTADO | Nao ha endpoint para exportar dados do titular |
| **Art. 18 — Acesso aos dados** | NAO IMPLEMENTADO | Titular nao tem como consultar quais dados sao armazenados |
| **Art. 37 — Relatorio de impacto (RIPD)** | NAO IMPLEMENTADO | Nao ha RIPD documentado |
| **Art. 41 — DPO (Encarregado)** | DESCONHECIDO | Nao encontrado no codigo |
| **Art. 46 — Medidas de seguranca** | PARCIAL | RLS existe na maioria das tabelas, mas PII em logs e endpoints sem auth comprometem |
| **Art. 48 — Notificacao de incidentes** | NAO IMPLEMENTADO | Nao ha mecanismo de notificacao de breach |
| **Art. 50 — Boas praticas** | PARCIAL | Existe controle de roles mas faltam audit trails |

### Dados Pessoais Tratados (Mapeamento)

| Dado | Tabela | Finalidade | Retencao |
|---|---|---|---|
| Telefone | `uazapi_chats`, `ai_conversations` | Comunicacao WhatsApp | Indefinida |
| Nome | `uazapi_chats`, `helpdesk_clients` | Identificacao | Indefinida |
| Email | `helpdesk_clients`, `human_agents` | Comunicacao | Indefinida |
| CPF/CNPJ | `helpdesk_clients` (documento) | Vinculacao Sismais Admin | Indefinida |
| Conteudo de mensagens | `uazapi_messages`, `ai_messages` | Atendimento + treino IA | Indefinida |
| Historico de atendimento | `ai_conversations` | Suporte | Indefinida |
| Embeddings de conversas | `ai_knowledge_base` | RAG / IA | Indefinida |

**Problema critico:** Nenhuma tabela tem politica de retencao definida. Dados pessoais ficam armazenados indefinidamente.

---

## 3. AUDITORIA RLS — TABELAS SEM RLS

Baseado na analise das migrations, as seguintes tabelas NAO possuem `ENABLE ROW LEVEL SECURITY` em nenhuma migration:

1. **`user_roles`** — CRITICO (controle de acesso)
2. **`kanban_stages`** — criada em migration separada, RLS nao encontrado na criacao original (nota: pode ter sido adicionado em migration posterior via `kanban_stage_automations`)

**Nota:** A maioria das tabelas tem RLS habilitado. Porem, muitas policies usam `USING (true)` ou `WITH CHECK (true)`, o que efetivamente permite acesso irrestrito a usuarios autenticados.

---

## 4. AUDITORIA DE CORS

**Resultado:** TODAS as 74 edge functions usam `Access-Control-Allow-Origin: *`.

Funcoes criticas que deveriam ter CORS restrito:
- `register-user` (criacao de conta)
- `approve-user` / `reject-user` (admin)
- `whatsapp-send-message` (envio de mensagens)
- `create-system-user` (admin)
- `list-system-users` (admin)

---

## 5. AUDITORIA DE SECRETS

| Verificacao | Status |
|---|---|
| Secrets hardcoded no codigo | OK — nenhum secret encontrado |
| Anon key no frontend | ATENCAO — hardcoded em `client.ts` (esperado, mas depende de RLS) |
| Service role key no frontend | OK — nao encontrado |
| `.env` no gitignore | VERIFICAR — nao auditado |
| API keys em env vars (edge functions) | OK — usam `Deno.env.get()` |

---

## 6. RECOMENDACOES POR PRIORIDADE

### Prioridade 1 — Corrigir esta semana
1. **Habilitar RLS na tabela `user_roles`** com policy restritiva (V-003)
2. **Adicionar auth em `whatsapp-send-message`** (V-008)
3. **Adicionar auth em `register-user`** ou implementar rate limiting + CAPTCHA (V-005)
4. **Remover logging de PII** em `whatsapp-webhook`, `uazapi-webhook`, `sismais-client-auto-link` (V-004)

### Prioridade 2 — Proximas 2 semanas
5. **Adicionar auth em todas as edge functions** que nao sao webhooks (V-002)
6. **Implementar verificacao de origem** nos webhooks (V-006)
7. **Restringir CORS** para dominio de producao (V-001)
8. **Usar JWT do usuario** em vez de service role key para endpoints autenticados (V-013)

### Prioridade 3 — Proximo mes
9. **Implementar rate limiting** global (V-009)
10. **Politica de retencao de dados** — LGPD (checklist)
11. **Endpoint de direito ao esquecimento** — LGPD Art. 15
12. **Endpoint de portabilidade** — LGPD Art. 18
13. **Criptografar tokens UAZAPI** no banco (V-020)
14. **Adicionar headers de seguranca** no frontend (V-022)

---

## 7. CORRECOES IMPLEMENTADAS

Nenhuma correcao foi implementada nesta iteracao (auditoria apenas). As correcoes requerem:
1. Acesso a branch de desenvolvimento para commits
2. Teste em ambiente de staging antes de deploy
3. Coordenacao com equipe para nao quebrar integracao com UAZAPI

---

## 8. SCORE DE SEGURANCA

| Area | Score | Nota |
|---|---|---|
| Autenticacao | 3/10 | Apenas 3 de ~74 functions verificam auth |
| Autorizacao (RLS) | 7/10 | Maioria das tabelas tem RLS, mas policies sao permissivas |
| CORS | 1/10 | Wildcard em todos os endpoints |
| Logging/PII | 2/10 | PII logada extensivamente |
| Input Validation | 5/10 | Validacao basica existe, mas sem sanitizacao |
| Secrets Management | 8/10 | Usa env vars, nenhum secret hardcoded |
| LGPD Compliance | 2/10 | Faltam consentimento, retencao, portabilidade, esquecimento |
| **GERAL** | **4/10** | **Risco alto — correcoes urgentes necessarias** |
