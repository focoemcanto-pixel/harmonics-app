# Deployment Guide - Cloudflare Workers

## Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler` or use `npx wrangler`)
- Cloudflare account

## Initial Setup

### 1. Login to Wrangler

```bash
npx wrangler login
```

### 2. Configure Secrets

Add sensitive environment variables via CLI:

```bash
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_CLIENT_ID
```

### 3. Update wrangler.toml

Add public environment variables in `[vars]` section:

```toml
[vars]
NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"
```

## Deployment

### Production Deploy

```bash
npm run deploy
```

### Preview Deploy

```bash
npm run deploy:preview
```

### Local Testing

```bash
npm run build:worker
npm run preview:local
```

Then visit http://localhost:8787

## Build Output

After `npm run build:worker`:

```
.open-next/
├── worker.mjs          # Entry point
├── server/             # Server functions (SSR/API)
├── assets/             # Static assets
└── cache/              # Cache handlers
```

## Custom Domain

1. Go to Cloudflare Dashboard
2. Navigate to: Workers & Pages → harmonics-app → Settings → Triggers
3. Add custom domain: `harmonics.yourdomain.com`

## Optional: KV Cache Setup

If using ISR or caching:

```bash
# Create KV namespace
wrangler kv:namespace create "NEXT_CACHE_KV"

# Add returned ID to wrangler.toml:
# [[kv_namespaces]]
# binding = "NEXT_CACHE_KV"
# id = "your-kv-id-here"
```

## Troubleshooting

### Build fails
- Delete `.next`, `.open-next`, `node_modules`
- Run `npm install`
- Run `npm run build:worker`

### Deploy fails
- Check Wrangler is logged in: `wrangler whoami`
- Verify `main = ".open-next/worker.mjs"` exists

### 404 errors
- Ensure `compatibility_flags = ["nodejs_compat"]` is in wrangler.toml
- Check `.open-next/assets` folder exists

## References

- [OpenNext Cloudflare Docs](https://opennext.js.org/cloudflare)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
