// Smoke test (Playwright) contra um build rodando: npx next start -p 3100, depois
// SMOKE_BASE_URL=http://localhost:3100 node tests/e2e/smoke.mjs. Não usa banco nem sessão:
// valida proteção de APIs, PWA, Maps sob demanda, recuperação de senha e layout 360px.
import { chromium } from 'playwright';
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3100';
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

// API (sem sessão)
const api = async (method, path, opts = {}) => (await fetch(BASE + path, { method, ...opts })).status;
check('PATCH /api/automation/rules/:id sem sessão → 401', (await api('PATCH', '/api/automation/rules/x', { body: '{}' })) === 401);
check('PATCH /api/automation/channels/:id sem sessão → 401', (await api('PATCH', '/api/automation/channels/x', { body: '{}' })) === 401);
check('POST /api/contracts/internal/pdf sem sessão → 401', (await api('POST', '/api/contracts/internal/pdf', { body: '{}' })) === 401);
check('POST /api/contracts/archive sem sessão → 401', (await api('POST', '/api/contracts/archive', { body: '{}' })) === 401);
check('POST /api/google/oauth/force-reauth sem sessão → 401', (await api('POST', '/api/google/oauth/force-reauth', { body: '{}' })) === 401);
check('POST /api/whatsapp/send-invite sem sessão → 401', (await api('POST', '/api/whatsapp/send-invite', { body: '{}' })) === 401);
check('GET /api/debug/full → 404', (await api('GET', '/api/debug/full')) === 404);
check('POST /api/webhooks/asaas sem segredo configurado → 503', (await api('POST', '/api/webhooks/asaas', { body: '{}' })) === 503);
check('POST /api/billing/subscribe sem sessão → 401', (await api('POST', '/api/billing/subscribe', { body: '{}' })) === 401);
check('GET /api/settings/pricing sem sessão → 401', (await api('GET', '/api/settings/pricing')) === 401);

// Login: PWA, idioma, Maps
const mapsRequests = [];
page.on('request', (req) => { if (req.url().includes('maps.googleapis.com')) mapsRequests.push(req.url()); });
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
check('html lang=pt-BR', (await page.getAttribute('html', 'lang')) === 'pt-BR');
check('manifest linkado', Boolean(await page.$('link[rel="manifest"][href="/site.webmanifest"]')));
check('theme-color', (await page.getAttribute('meta[name="theme-color"]', 'content')) === '#0f172a');
check('Google Maps NÃO carrega no login', mapsRequests.length === 0, `${mapsRequests.length} requests`);
const overflowLogin = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('login 360px sem scroll horizontal', overflowLogin <= 0, `overflow=${overflowLogin}px`);
const fontSizes = await page.$$eval('input', (els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
check('inputs do login ≥16px (sem zoom iOS)', fontSizes.every((size) => size >= 16), JSON.stringify(fontSizes));
const sw = await page.evaluate(async () => (await fetch('/sw.js')).status);
check('service worker servido', sw === 200);
const manifest = await page.evaluate(async () => (await fetch('/site.webmanifest')).json());
check('manifest com start_url/scope/display', manifest.start_url && manifest.scope === '/' && manifest.display === 'standalone');

// Recuperação de senha: link antigo é encaminhado
await page.goto(BASE + '/login?reset=done#access_token=fake&refresh_token=fake&type=recovery', { waitUntil: 'domcontentloaded' });
await page.waitForURL(/\/auth\/reset-password/, { timeout: 8000 }).catch(() => null);
check('link antigo de recuperação → /auth/reset-password', page.url().includes('/auth/reset-password'), page.url().replace(BASE, ''));

// Telas antigas de billing redirecionam
const r1 = await page.goto(BASE + '/assinar', { waitUntil: 'domcontentloaded' });
check('/assinar → /settings/billing', page.url().includes('/settings/billing') || page.url().includes('/login'), page.url().replace(BASE, ''));

// Signup e onboarding no mobile
for (const path of ['/signup', '/workspace/new', '/auth/reset-password']) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${path} 360px sem scroll horizontal`, overflow <= 0, `overflow=${overflow}px`);
}

// Rota admin sem sessão: middleware leva ao login (sem tela branca)
await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
check('/dashboard sem sessão → /login?next=', page.url().includes('/login'), page.url().replace(BASE, ''));


await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} PASS`);
