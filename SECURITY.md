# Política de Segurança

## Reportar uma vulnerabilidade

Se você encontrar uma vulnerabilidade de segurança neste projeto,
**NÃO abra uma issue pública**. Entre em contato diretamente pelo site
[sismais.com](https://sismais.com).

---

## Proteções ativas neste projeto

| Proteção | Status |
|----------|--------|
| Pre-commit hook (bloqueia credenciais) | ✅ Ativo |
| `.env` no `.gitignore` | ✅ Ativo |
| `.env.example` documentado | ✅ Presente |
| Zero credenciais hardcoded no código | ✅ Verificado em 10/04/2026 |

---

## Regras de segurança

- **NUNCA** commitar arquivos `.env` ou qualquer variação (`.env.local`, `.env.production`)
- **SEMPRE** usar variáveis de ambiente para credenciais
- O pre-commit hook **bloqueia automaticamente** commits com chaves detectadas
- Se uma chave vazar, rotacione-a **imediatamente** no serviço correspondente

---

## Se uma chave vazar

1. **Rotacione imediatamente** no serviço correspondente (links abaixo)
2. **Remova do histórico git** se necessário (`git filter-branch` ou BFG Repo Cleaner)
3. **Audite os logs** do serviço para verificar acessos não autorizados
4. **Notifique o time**

### Links para rotação rápida

| Serviço | Link |
|---------|------|
| Supabase | Dashboard → Project Settings → API → Regenerate |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| GitHub | [github.com/settings/tokens](https://github.com/settings/tokens) |
| Stripe | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) |

---

## Auditoria de segurança

Este projeto é periodicamente auditado pela **Security Scanner Squad** (ExpxAgents).
Última auditoria: **10/04/2026** — resultado: 🟢 Sem vulnerabilidades críticas.
