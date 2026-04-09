import { buildRepertoirePdfHtml } from '@/lib/repertorio/buildRepertoirePdfHtml';

const PDF_OPTIONS = {
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: {
    top: '20mm',
    right: '14mm',
    bottom: '20mm',
    left: '14mm',
  },
};

async function tryImport(moduleName) {
  try {
    return await import(moduleName);
  } catch {
    return null;
  }
}

async function createPlaywrightAdapter() {
  const playwright = await tryImport('playwright');
  if (!playwright?.chromium) return null;

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return {
    async render(html) {
      const context = await browser.newContext({
        locale: 'pt-BR',
        colorScheme: 'light',
      });
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const pdf = await page.pdf(PDF_OPTIONS);
      await context.close();
      return Buffer.from(pdf);
    },
    async close() {
      await browser.close();
    },
  };
}

async function createPuppeteerAdapter() {
  const puppeteer = await tryImport('puppeteer');
  if (!puppeteer?.launch) return null;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return {
    async render(html) {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf(PDF_OPTIONS);
      await page.close();
      return Buffer.from(pdf);
    },
    async close() {
      await browser.close();
    },
  };
}

async function resolveBrowserAdapter() {
  const playwrightAdapter = await createPlaywrightAdapter();
  if (playwrightAdapter) return playwrightAdapter;

  const puppeteerAdapter = await createPuppeteerAdapter();
  if (puppeteerAdapter) return puppeteerAdapter;

  throw new Error(
    'Nenhum motor de navegador headless disponível. Instale "playwright" ou "puppeteer" para habilitar a geração premium do PDF.'
  );
}

export async function generateRepertoirePdfBuffer(payload = {}) {
  const html = buildRepertoirePdfHtml(payload);
  const adapter = await resolveBrowserAdapter();

  try {
    return await adapter.render(html);
  } finally {
    await adapter.close();
  }
}
