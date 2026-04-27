# Deployment Guide (Cloudflare Workers + OpenNext)

Este projeto utiliza **Next.js com OpenNext** para deploy em **Cloudflare Workers**, integrações com **Supabase** (auth/database), **Resend** (e-mail transacional) e serviço de contratos em **Render**.

## 1) Pré-requisitos

- Node.js 18+
- npm
- Conta Cloudflare com acesso a Workers
- Wrangler CLI (`npx wrangler ...` já funciona sem instalação global)

## 2) Variáveis de ambiente

Antes de qualquer deploy, configure as variáveis obrigatórias do projeto (ver `ENV_SETUP.md`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `APP_BASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`
- `CONTRACT_TEMPLATE_DOC_ID`
- `CONTRACTS_DRIVE_FOLDER_ID`
- `NEXT_PUBLIC_CONTRACT_SERVICE_URL`

### Segredos (Wrangler)

Use `wrangler secret put` para chaves sensíveis (exemplos):

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npx wrangler secret put GOOGLE_OAUTH_REFRESH_TOKEN
```

### Variáveis públicas (`wrangler.toml`)

Defina em `[vars]` as variáveis que podem ir no bundle/runtime público do Worker, por exemplo:

```toml
[vars]
NEXT_PUBLIC_SUPABASE_URL = "https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY = "sua_anon_key"
NEXT_PUBLIC_APP_URL = "https://app.bandaharmonics.com"
APP_BASE_URL = "https://app.bandaharmonics.com"
NEXT_PUBLIC_CONTRACT_SERVICE_URL = "https://harmonics-contract-service.onrender.com"
```

## 3) Fluxo de deploy

### Build OpenNext

```bash
npm run build:worker
```

### Deploy produção

```bash
npm run deploy
```

### Deploy preview

```bash
npm run deploy:preview
```

### Preview local (Worker)

```bash
npm run build:worker
npm run preview:local
```

Abrir: `http://localhost:8787`

## 4) Integrações críticas

### Supabase

- Auth + dados administrativos dependem de `SUPABASE_SERVICE_ROLE_KEY`.
- Fluxos de login, reset de senha e APIs admin dependem de conexão ativa com o projeto.

### Resend

- Fluxo de recuperação de senha depende de `RESEND_API_KEY` e `RESEND_FROM_EMAIL`.
- O domínio/sender do `from` precisa estar validado no painel do Resend.

### Serviço de contratos (Render)

- Geração/assinatura de contratos depende de `NEXT_PUBLIC_CONTRACT_SERVICE_URL`.
- Serviço precisa estar online e respondendo antes do deploy ir para produção.

## 5) Checklist de deploy

- [ ] Todas envs configuradas
- [ ] Domínio verificado no Resend
- [ ] SUPABASE_SERVICE_ROLE_KEY configurado
- [ ] CONTRACT SERVICE online
- [ ] Build rodando sem erro
- [ ] Login funcionando
- [ ] Reset password funcionando

## 6) Troubleshooting

### Build falha

1. Limpar artefatos:
   - `.next/`
   - `.open-next/`
2. Reinstalar dependências: `npm install`
3. Reexecutar: `npm run build:worker`

### Deploy falha no Worker

- Verificar autenticação Cloudflare: `npx wrangler whoami`
- Conferir se o build gerou `.open-next/worker.mjs`
- Revisar variáveis e secrets por ambiente

### Erros em APIs após deploy

- Conferir logs de runtime do Worker
- Validar presença das envs obrigatórias
- Confirmar disponibilidade do Supabase, Resend e serviço de contratos

## Referências

- OpenNext for Cloudflare: https://opennext.js.org/cloudflare
- Cloudflare Workers + Wrangler: https://developers.cloudflare.com/workers/wrangler/
- Resend Docs: https://resend.com/docs
- Supabase Docs: https://supabase.com/docs
