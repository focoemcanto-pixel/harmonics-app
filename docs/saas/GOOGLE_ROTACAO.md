# BE-3 — Rotação da credencial Google (2026-10-15)

## Diagnóstico (sem valores de segredo)
| id | user_id | criada | escopo pedido | uso |
|---|---|---|---|---|
| 2 | admin da Harmonics | 09/04 | drive + documents (pedido pelo `/api/google/oauth/start`; o Google não devolveu `scope` no token salvo) | **ativa**: é a escolhida por `loadGoogleCredentialsFromSupabase()` (ativa mais recente) |
| 1 | nulo (fluxo antigo) | 08/04 | drive | órfã: nunca escolhida (a id 2 é mais recente) e buscas por usuário não casam `user_id` nulo. **Desativada em 15/10** (`is_active=false`, `status=revoked_orphan`). |

- Exposição: até a Fase 0 a tabela era legível por `anon` (refresh tokens). O `client_secret` nunca esteve no banco nem no repositório (as ocorrências em `ENV_SETUP.md` são exemplos fictícios), então os refresh tokens sozinhos não geram acesso — a rotação é higiene obrigatória mesmo assim.
- Hoje: RLS ligado, sem policy e sem grant para `anon`/`authenticated`; só o service role lê.
- Início de conexão (`POST /api/google/oauth/start`) só para admin da plataforma autenticado (PR #738, em produção; teste `tests/google-oauth-start.test.mjs`).
- Uso real do Google: **nenhum contrato gerado pelo motor Google desde 25/04/2026**; os 94 pré-contratos dos últimos 180 dias são `contract_mode=internal`; `quotes` vazio. A credencial hoje só é usada, em modo "melhor esforço", para apagar arquivos antigos do Drive ao excluir evento/contrato (falha → só aviso). O motor Google continua alcançável por pré-contrato criado sem modelo (`contract_mode` padrão `docs`) — 0 casos em 180 dias.

## Por que revogar antes de reconectar
No Google a revogação é da **concessão** (conta + app): revogar depois de reconectar derruba também o token novo. Ordem correta: revogar → reconectar logo em seguida. A janela entre os dois passos só afeta o motor Google (sem uso há 6 meses); a geração de contratos atual (motor interno) não depende do Google.

## Procedimento
1. (feito) Desativar a órfã id 1.
2. Dono: https://myaccount.google.com/permissions com a conta Google usada nos contratos → app do Harmonics → **Remover acesso**.
3. Dono, logado como admin em https://app.bandaharmonics.com (qualquer página do painel), no Console do navegador (F12):
   `fetch('/api/google/oauth/start',{method:'POST'}).then(r=>r.json()).then(j=>j.authUrl?location.href=j.authUrl:alert(JSON.stringify(j)))`
   → escolher a mesma conta → permitir Drive e Docs → volta para `/contratos?google_oauth=success`.
4. Verificação (Claude): linha do admin com `updated_at` novo, `status=valid`, `is_active=true`, refresh token diferente do anterior (comparação por hash); limpar tokens revogados (coluna `refresh_token` antiga da id 2 e tokens da id 1); confirmar `anon`/`authenticated` sem acesso.

## Recuperação
- Passo 3 falhou (erro de redirect/estado): repetir o passo 3; conferir `GOOGLE_OAUTH_REDIRECT_URI` = `https://app.bandaharmonics.com/api/google/oauth/callback` cadastrado no Google Cloud (OAuth client) e `GOOGLE_OAUTH_CLIENT_ID/SECRET` no Worker.
- Enquanto não reconectar: contratos continuam pelo motor interno; exclusões só não apagam arquivos antigos do Drive.
- A órfã id 1 teve os tokens apagados em 15/10; não há como reativá-la (reconectar pelo passo 3).

## Status: CONCLUÍDO em 15/10/2026
- Causas encontradas no caminho: env vars `GOOGLE_OAUTH_*` ausentes no Worker (cadastradas como Secret pelo dono) e o callback lendo `getToken()` do googleapis, que no bundle OpenNext/Workers devolve os tokens como string JSON (PR #740: troca do code via `fetch` nativo; redirect final passou para `/contratos`).
- Nova credencial (id 2, admin) gravada às 22:47:38 UTC por POST do callback (edge logs); hash do refresh token `91106fb0` (antes `ec62e81f`); escopo drive + documents (+ openid/email/profile por `include_granted_scopes`); `status=valid`, `is_active=true`; única linha ativa.
- Limpeza: id 2 sem o token revogado nas colunas legadas `refresh_token`/`access_token` (o código só lê `credentials`); id 1 com `credentials`, `refresh_token` e `access_token` nulos e `revoked_at` preenchido. Única linha com tokens: a credencial nova.
- Isolamento: RLS ligado, 0 policies, nenhum grant para `anon`/`authenticated`/`PUBLIC`.
- Pendência conhecida (motor de contratos, fora do BE-3): o gerador Google e o refresh de tokens usam o mesmo gaxios; no Worker as respostas do Drive/Docs provavelmente chegam como texto. Sem impacto hoje (motor interno); corrigir antes de reativar o motor Google.
