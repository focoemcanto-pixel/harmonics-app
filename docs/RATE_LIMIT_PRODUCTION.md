# Rate limit em produção (planejamento)

## Estado atual

O projeto usa rate limit **best-effort em memória de processo**.

- Funciona como proteção leve contra abuso básico.
- É suficiente para reduzir rajadas simples em instâncias únicas.
- Não é persistente entre reinícios.
- Não é compartilhado entre múltiplas instâncias/replicas.

## Rotas atualmente protegidas

- `/api/auth/request-password-reset`
- `/api/admin/usuarios/invite`
- `/api/contracts/public/[token]/sign`

## Recomendação para proteção forte em produção

Migrar o controle de rate limit para armazenamento distribuído/persistente.

Opções sugeridas:

- Cloudflare KV
- Cloudflare Durable Objects
- Upstash (Redis)
- Supabase (estrutura dedicada para counters/janelas)

## Resultado esperado da migração

Com backend persistente/distribuído de rate limit:

- contadores sobrevivem a restart/deploy;
- limites ficam consistentes entre múltiplas instâncias;
- fica possível endurecer políticas anti-abuso com menor risco de bypass.
