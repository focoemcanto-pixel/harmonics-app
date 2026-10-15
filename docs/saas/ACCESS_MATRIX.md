# Matriz de acesso — tabelas que estavam sem RLS (revalidada em 2026-10-14)

| Tabela | Dados | workspace_id? | Quem lê | Quem escreve | Camada | RLS antes | Política aplicada (Fase 0) | Consumidores em risco |
|---|---|---|---|---|---|---|---|---|
| google_oauth_credentials | refresh/access token Google | não | `lib/contracts/googleCredentials.js` | callback OAuth | servidor (service role) | OFF, anon ALL | RLS on, sem políticas, revoke anon/auth | nenhum (só service role) |
| workspace_settings | config de todos os tenants | sim | libs de workspace/automação/contratos | bootstrap, onboarding | servidor | OFF, anon ALL | RLS on, revoke anon/auth | nenhum |
| client_reviews | avaliações de clientes | não | `/cliente/[token]/review` (SSR service role), automação | `/api/client/review` | servidor | OFF | RLS on, revoke anon/auth | nenhum |
| users, roles, assignments, event_role_slots | legado single-tenant | não | ninguém no código atual | ninguém | — | OFF | RLS on, revoke anon/auth | nenhum |
| suggestion_* (7) + 5 backups | catálogo de sugestões | parcial | APIs `/api/suggestions/*`, `/api/cliente/sugestoes` | APIs admin | servidor | OFF | RLS on, revoke anon/auth | nenhum |
| suggestion_songs_ranked (view) | ranking | — | ninguém | — | — | SECURITY DEFINER, anon ALL | revoke anon/auth | nenhum |
| pricing_settings | preços (global, slug `default`) | **não** (Fase 1) | `/eventos` (browser, admin) e portal (SSR) | `/eventos` (browser, admin) | browser + servidor | OFF | SELECT authenticated; escrita só `current_user_is_admin()`; anon revogado | SaaS não grava mais o preço da Harmonics (intencional) |
| scale_templates / scale_template_items | templates de escala (globais) | **não** (Fase 1) | `EventoEscalaTab` (admin e membro delegado), `/templates-escala` | `/templates-escala` (admin) | browser + servidor | OFF | idem pricing | idem |
| workspace_plans | catálogo de planos | não (global por desenho) | `/settings/billing` (SSR sessão), billing | ninguém (seed) | servidor/SSR | OFF, anon ALL | SELECT público; escrita só service role | nenhum |

Notas:
- `/contrato/[token]` usa o client anônimo no browser, mas apenas sobre tabelas que já tinham RLS (comportamento inalterado).
- Portais públicos (`/cliente/[token]`, `/verify/[token]`) leem no servidor com service role.
- `finance_cost_defaults` já tinha RLS sem políticas antes desta fase: o salvamento de custos padrão pelo browser em `/eventos` **já falhava** em produção (bug pré-existente, tratado na Fase 1).
