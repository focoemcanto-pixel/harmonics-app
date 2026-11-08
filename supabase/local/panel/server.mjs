// Servidor HTTP com os handlers REAIS de /api/ai/* (para a UI no navegador).
import http from 'node:http';

const ROUTES = [
  [/^\/api\/ai\/knowledge\/bootstrap$/, '../../../app/api/ai/knowledge/bootstrap/route.js'],
  [/^\/api\/ai\/knowledge\/([^/]+)$/, '../../../app/api/ai/knowledge/[id]/route.js'],
  [/^\/api\/ai\/knowledge$/, '../../../app/api/ai/knowledge/route.js'],
  [/^\/api\/ai\/service-areas$/, '../../../app/api/ai/service-areas/route.js'],
  [/^\/api\/ai\/learning$/, '../../../app/api/ai/learning/route.js'],
  [/^\/api\/ai\/settings$/, '../../../app/api/ai/settings/route.js'],
];

export async function handle(method, pathname, search, bodyText, headers = {}) {
  for (const [re, file] of ROUTES) {
    const m = re.exec(pathname);
    if (!m) continue;
    const mod = await import(file);
    const request = new Request(`http://local${pathname}${search || ''}`, { method, headers, body: ['GET', 'HEAD'].includes(method) ? undefined : bodyText });
    const response = await mod[method](request, { params: Promise.resolve({ id: m[1] }) });
    return { status: response.status, body: await response.text() };
  }
  return { status: 404, body: '{"ok":false}' };
}

export function startServer(port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    let body = '';
    for await (const chunk of req) body += chunk;
    const out = await handle(req.method, url.pathname, url.search, body, { 'content-type': 'application/json', ...(req.headers['x-test-auth'] ? { 'x-test-auth': req.headers['x-test-auth'] } : {}) });
    res.writeHead(out.status, { 'content-type': 'application/json' });
    res.end(out.body);
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
