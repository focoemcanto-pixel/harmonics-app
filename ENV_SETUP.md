# ENV Setup

Este guia centraliza as variáveis de ambiente usadas para rodar e fazer deploy do Harmonics com consistência em **local**, **preview** e **produção**.

> Recomendação: manter os mesmos nomes de variáveis em todos os ambientes e mudar apenas os valores.

## Variáveis obrigatórias

### Supabase

#### `NEXT_PUBLIC_SUPABASE_URL`
- **O que é:** URL do projeto Supabase usada no frontend e backend.
- **Onde pegar:** Supabase Dashboard → Project Settings → API → **Project URL**.
- **Obrigatória:** Sim.
- **Exemplo real:** `https://abcxyzcompany.supabase.co`

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **O que é:** chave pública (anon) do Supabase para operações client-safe.
- **Onde pegar:** Supabase Dashboard → Project Settings → API → **anon public**.
- **Obrigatória:** Sim.
- **Exemplo real:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon_example_key`

#### `SUPABASE_SERVICE_ROLE_KEY`
- **O que é:** chave privilegiada do Supabase para rotas server/admin.
- **Onde pegar:** Supabase Dashboard → Project Settings → API → **service_role**.
- **Obrigatória:** Sim.
- **Exemplo real:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role_example`
- **Segurança:** **NUNCA** expor no frontend. Configurar somente em segredo de servidor.

### App

#### `NEXT_PUBLIC_APP_URL`
- **O que é:** URL pública principal usada em links no cliente e backend.
- **Onde pegar:** domínio público do app no ambiente atual.
- **Obrigatória:** Sim.
- **Exemplo real:** `https://app.bandaharmonics.com`

#### `APP_BASE_URL`
- **O que é:** fallback server-side para montar links absolutos (ex.: recovery link).
- **Onde pegar:** domínio canônico do app em produção.
- **Obrigatória:** Sim (recomendado mesmo com `NEXT_PUBLIC_APP_URL`).
- **Exemplo real:** `https://app.bandaharmonics.com`

### Email (Resend)

#### `RESEND_API_KEY`
- **O que é:** chave de API para envio de e-mails transacionais.
- **Onde pegar:** [resend.com](https://resend.com) → API Keys.
- **Obrigatória:** Sim para fluxos de e-mail (convites e reset de senha).
- **Exemplo real:** `re_xxxxxxxxxxxxxxxxxxxxx`

#### `RESEND_FROM_EMAIL`
- **O que é:** remetente validado no Resend.
- **Onde pegar:** Resend → Domains / Senders configurados.
- **Obrigatória:** Sim.
- **Exemplo real:** `Harmonics <convites@bandaharmonics.com>`

### Contratos (Google + serviço Render)

#### `GOOGLE_OAUTH_CLIENT_ID`
- **O que é:** client id OAuth para integração com Google Docs/Drive.
- **Onde pegar:** Google Cloud Console → APIs & Services → Credentials.
- **Obrigatória:** Sim (fluxo de contratos Google).
- **Exemplo real:** `123456789012-abcdefghijklmnop.apps.googleusercontent.com`

#### `GOOGLE_OAUTH_CLIENT_SECRET`
- **O que é:** client secret OAuth correspondente ao client id.
- **Onde pegar:** Google Cloud Console → APIs & Services → Credentials.
- **Obrigatória:** Sim.
- **Exemplo real:** `GOCSPX-abcdefghijklmnopqrstuv`

#### `GOOGLE_OAUTH_REFRESH_TOKEN`
- **O que é:** refresh token com consentimento para operar Docs/Drive sem login manual contínuo.
- **Onde pegar:** gerado no fluxo OAuth autorizado para a conta de contratos.
- **Obrigatória:** Sim para geração automática.
- **Exemplo real:** `1//0gExampleRefreshTokenValue`

#### `CONTRACT_TEMPLATE_DOC_ID`
- **O que é:** ID do Google Doc template base do contrato.
- **Onde pegar:** URL do documento no Google Docs (`/document/d/<DOC_ID>/edit`).
- **Obrigatória:** Sim.
- **Exemplo real:** `1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890`

#### `CONTRACTS_DRIVE_FOLDER_ID`
- **O que é:** pasta raiz do Google Drive onde contratos gerados serão organizados.
- **Onde pegar:** URL da pasta no Google Drive (`/folders/<FOLDER_ID>`).
- **Obrigatória:** Sim.
- **Exemplo real:** `0BxxYyyZzzContractsFolderId`

#### `NEXT_PUBLIC_CONTRACT_SERVICE_URL`
- **O que é:** URL do serviço de contratos (Render) consumido pelo app.
- **Onde pegar:** painel do Render (URL pública do serviço).
- **Obrigatória:** Sim para geração/assinatura com pipeline server-side.
- **Exemplo real:** `https://harmonics-contract-service.onrender.com`

---

## Checklist rápido por ambiente

- **Local:** preencher `.env.local` com as mesmas chaves do `.env.example`.
- **Preview:** configurar no provider de deploy (Cloudflare Workers secrets/vars).
- **Produção:** repetir todas as chaves, com domínio e credenciais finais.

## Boas práticas

- Não commitar `.env.local`.
- Rotacionar `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` em caso de vazamento.
- Manter domínios de `NEXT_PUBLIC_APP_URL` e `APP_BASE_URL` consistentes com ambiente.
