# Bloqueios externos (ações que dependem do responsável)

> Estado atualizado em 2026-10-15 (com evidências): `FECHAMENTO_STORAGE_SEGREDOS_ASAAS.md`.
> BE-4 resolvido — o deploy agora é automático (Cloudflare Workers Builds) ao mergear na `main`.

## BE-1 — Remover listagem anônima dos buckets de contratos e comprovantes
- **AÇÃO NECESSÁRIA:** Supabase Dashboard → projeto `harmonics-saas-dev` → Storage → Policies → tabela `objects`: excluir as políticas **"Public read contract pdfs"** e **"Public read access for payment proofs"**.
- **MOTIVO:** `storage.objects` pertence a `supabase_storage_admin`; o acesso SQL disponível (`postgres`) não pode alterar essas políticas.
- **RISCO DE FAZER AGORA:** baixo. Os links públicos já enviados continuam funcionando (a rota `/object/public` não consulta essas políticas) e o servidor usa service role. O que deixa de funcionar é apenas **listar** os arquivos com a chave pública.
- **MOMENTO CORRETO:** imediatamente.

## BE-2 — Tornar os buckets privados (fecha o acesso por URL pública)
- **AÇÃO NECESSÁRIA:** depois do deploy do código desta branch que serve PDFs/comprovantes por endpoint autorizado (ver STATUS), marcar `contract-pdfs` e `payment-proofs` como **Private** no Dashboard.
- **RISCO DE FAZER AGORA:** ALTO — quebraria links já enviados por WhatsApp e telas que usam `pdf_url` direto.
- **MOMENTO CORRETO:** após deploy + validação dos endpoints; aceitar que links antigos diretos do storage deixam de abrir (os novos links passam pelo app).

## BE-3 — Rotacionar o refresh token do Google
- **AÇÃO NECESSÁRIA:** revogar o acesso do app em https://myaccount.google.com/permissions (conta usada para contratos) e refazer a conexão em Configurações → Integrações (fluxo `/api/google/oauth/start`).
- **MOTIVO:** a tabela `google_oauth_credentials` esteve legível com a chave pública; o token deve ser tratado como comprometido.
- **RISCO DE FAZER AGORA:** a geração de contratos via Google para até a reconexão (minutos). A tabela já foi fechada (Fase 0b), então pode ser feito a qualquer momento de baixo movimento.
- **MOMENTO CORRETO:** já liberado (a vulnerabilidade foi fechada antes).

## BE-4 — Deploy do código desta branch
- **AÇÃO NECESSÁRIA:** revisar/mergear a branch e executar `npm run deploy` (Cloudflare Workers). O deploy é manual neste projeto.
- **MOTIVO:** correções de API (rotas sem autenticação, debug) só valem em produção após o deploy.

## BE-5 — Ambiente de staging + Asaas sandbox
- **AÇÃO NECESSÁRIA:** autorizar a criação de um Supabase Branch (tem custo) ou criar um projeto Supabase staging; fornecer `ASAAS_API_KEY` de sandbox e um `ASAAS_WEBHOOK_SECRET`; criar Worker de preview com essas variáveis.
- **MOTIVO:** Cliente Zero, testes A×B e billing ponta a ponta não podem rodar em produção.

## BE-6 — Ativar "Leaked password protection"
- **AÇÃO NECESSÁRIA:** Dashboard → Authentication → Policies/Password → ativar.

## BE-7 — Configurar Asaas (sandbox primeiro)
- **AÇÃO NECESSÁRIA:** no Worker (`wrangler secret put`): `ASAAS_API_KEY` (sandbox), `ASAAS_ENV=sandbox`, `ASAAS_WEBHOOK_SECRET` (valor aleatório forte). No painel Asaas (sandbox) → Integrações → Webhooks: URL `https://<app>/api/webhooks/asaas`, token = o mesmo `ASAAS_WEBHOOK_SECRET`, eventos de Cobrança e de Assinatura, fila ativada.
- **MOTIVO:** sem chave, a tela mostra os planos mas desabilita "Assinar"; sem segredo, o webhook responde 503 (falha fechada, intencional).
- **MOMENTO CORRETO:** depois do deploy (BE-4), em staging; produção (`ASAAS_ENV=production`) só depois do teste completo no sandbox.

## BE-8 — URLs de redirecionamento do Supabase Auth
- **AÇÃO NECESSÁRIA:** Dashboard → Authentication → URL Configuration → Redirect URLs: incluir `https://app.bandaharmonics.com/auth/reset-password` e `https://app.bandaharmonics.com/login`.
- **MOTIVO:** a recuperação de senha agora usa `/auth/reset-password`; se a URL não estiver na lista, o Supabase redireciona para a Site URL.

## BE-9 — CRON_SECRET
- **AÇÃO NECESSÁRIA:** garantir `CRON_SECRET` no Worker e `HARMONICS_CRON_SECRET` no GitHub (mesmo valor). Hoje, se a variável não existir, `/api/automation/cron` aceita chamadas sem segredo.
- **MOMENTO CORRETO:** a qualquer momento (configure os dois lados juntos).

## BE-10 — INTERNAL_API_KEY (opcional)
- Só necessário se algum sistema externo chama `/api/contracts/internal/pdf`, `/api/contracts/html-to-pdf` ou `/api/contracts/archive` sem sessão. Nenhum consumidor foi encontrado no código; rejeições ficam registradas como `[GUARD][REJECTED]` nos logs.
