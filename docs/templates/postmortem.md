# Postmortem: [Título do Incidente]

**Data do incidente:** YYYY-MM-DD HH:MM — HH:MM (BRT)
**Severidade:** P0 (critical) | P1 (major) | P2 (minor)
**Autor:** [Nome]
**Status:** Draft | Review | Final

---

## Summary

<!-- 2-3 frases: o que aconteceu, impacto, duração -->

## Impact

- **Usuários afetados:** X
- **Duração:** X minutos/horas
- **Receita impactada:** R$ X (se aplicável)
- **SLO impactado:** [qual SLO, quanto do error budget consumiu]

## Timeline (BRT)

| Hora | Evento |
|------|--------|
| HH:MM | Primeiro alerta / report |
| HH:MM | Investigação iniciada |
| HH:MM | Causa identificada |
| HH:MM | Fix aplicado |
| HH:MM | Serviço restaurado |
| HH:MM | Monitoramento confirmou normalidade |

## Root Cause

<!-- Análise técnica: o que causou o incidente. Seja específico. -->

## Detection

<!-- Como descobrimos? Alerta automático? Report de usuário? -->

- Tempo para detectar: X min
- Método: [alerta / report manual / monitoramento]

## Resolution

<!-- O que fizemos para resolver. Passos concretos. -->

## Action Items

<!-- OBRIGATÓRIO: cada item tem owner e deadline -->

| # | Ação | Owner | Deadline | Status |
|---|------|-------|----------|--------|
| 1 | [Ação preventiva] | @nome | YYYY-MM-DD | Pendente |
| 2 | [Melhoria de detecção] | @nome | YYYY-MM-DD | Pendente |
| 3 | [Teste/validação] | @nome | YYYY-MM-DD | Pendente |

## Lessons Learned

### O que funcionou bem

-

### O que poderia ter sido melhor

-

### Onde tivemos sorte

-

## Blameless Note

> Este postmortem foca em causas sistêmicas, não em pessoas. O objetivo é
> melhorar processos e sistemas para que o mesmo tipo de incidente não se repita.
