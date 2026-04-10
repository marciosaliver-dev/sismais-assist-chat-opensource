# Code Review Guide — SisCRM

Baseado nas práticas da Anthropic (multi-agent review) e Google (readability reviews).

## O que SEMPRE revisar (P0 — blocking)

- **Segurança**: RLS policies, SQL injection, XSS, secrets expostos
- **Dados**: Mutações no banco sem validação, perda de dados possível
- **Auth**: Bypass de autenticação, escalação de privilégio
- **Tipos**: Novos `any` sem justificativa, type assertions inseguras
- **Erros**: try-catch que engole erros silenciosamente, crash sem fallback

## O que revisar com atenção (P1 — should fix)

- **Performance**: N+1 queries, re-renders desnecessários, falta de memoization
- **Testes**: Mudança de comportamento sem teste correspondente
- **Edge functions**: CORS headers ausentes, timeout handling, error responses
- **React Query**: invalidação de cache incorreta, stale data
- **Acessibilidade**: Interativos sem aria-label, contraste insuficiente

## O que comentar como sugestão (P2 — nit)

- Nomes de variáveis/funções que poderiam ser mais claros
- Oportunidades de simplificação (mas que funcionam como estão)
- Padrões que diferem do resto do codebase (consistência)
- DRY — código duplicado que poderia ser extraído

## O que NÃO revisar

- Estilo/formatação (Prettier cuida disso)
- Ordem de imports (auto-sort)
- Preferências pessoais que não afetam funcionalidade
- Código gerado automaticamente (`types.ts` do Supabase)

## Convenções de Comentário

```
# Blocking — deve ser corrigido antes de merge
P0: [descrição do problema]

# Deveria corrigir, mas não bloqueia se justificado
P1: [descrição]

# Sugestão, pode ignorar
nit: [descrição]

# Pergunta genuína, não crítica
question: [pergunta]

# Elogio — reforce boas práticas
+1: [o que está bom]
```

## Regras do Processo

1. **PRs < 300 linhas** — se maior, peça para dividir
2. **Review em < 24h** — se não conseguir, reatribua
3. **1 LGTM mínimo** — do CODEOWNER da área modificada
4. **Testes devem passar** — CI verde é pré-requisito
5. **Autor resolve todos os P0** antes de merge
