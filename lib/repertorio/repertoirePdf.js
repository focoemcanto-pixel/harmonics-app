function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function displayValue(value, fallback = 'Não informado') {
  const normalized = normalizeWhitespace(value);
  return normalized ? escapeHtml(normalized) : fallback;
}

function formatDate(dateString) {
  const normalized = normalizeWhitespace(dateString);
  if (!normalized) return 'Data não definida';

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(normalized);

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function sortItems(items = []) {
  return Array.isArray(items)
    ? [...items].sort((a, b) => Number(a?.item_order || 0) - Number(b?.item_order || 0))
    : [];
}

function groupCeremonyItems(items = []) {
  const groups = [];
  for (const row of items) {
    const label = normalizeWhitespace(row?.label || row?.moment || row?.who_enters || 'Momento musical');
    const key = label.toLowerCase();
    const current = groups[groups.length - 1];

    if (!current || current.key !== key) {
      groups.push({ key, label: escapeHtml(label), rows: [row] });
      continue;
    }

    current.rows.push(row);
  }

  return groups;
}

function buildSongEntry(item, indexLabel) {
  const title = displayValue(item?.song_name);
  const reference = normalizeWhitespace(item?.reference_link);
  const whoEnters = normalizeWhitespace(item?.who_enters || item?.label || item?.moment);

  return `
    <article class="song-card">
      ${indexLabel ? `<p class="eyebrow">${escapeHtml(indexLabel)}</p>` : ''}
      ${whoEnters ? `<p class="song-meta">${escapeHtml(whoEnters)}</p>` : ''}
      <p class="song-name">🎵 Música: <strong>${title}</strong></p>
      ${reference ? `<p class="song-ref">🔗 Referência: ${escapeHtml(reference)}</p>` : ''}
    </article>
  `;
}

function buildSection({ title, icon, subtitle, contentHtml }) {
  return `
    <section class="section-block">
      <header class="section-header">
        <h2>${icon} ${escapeHtml(title)}</h2>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </header>
      <div class="section-content">${contentHtml}</div>
    </section>
  `;
}

export function generateRepertoirePdfHtml(payload = {}) {
  const event = payload?.event || {};
  const config = payload?.config || {};
  const ordered = sortItems(payload?.items || []);

  const cortejoItems = ordered.filter((item) => String(item?.section || '').toLowerCase() === 'cortejo');
  const cerimoniaItems = ordered.filter((item) => String(item?.section || '').toLowerCase() === 'cerimonia');

  const cover = `
    <section class="cover">
      <p class="cover-kicker">Harmonics Cerimonial Musical</p>
      <h1>Repertório do Evento</h1>
      <p class="cover-subtitle">Planejamento musical completo para cerimônia e recepção.</p>
      <div class="summary-grid">
        <article>
          <h3>Cliente</h3>
          <p>${displayValue(event?.client_name)}</p>
        </article>
        <article>
          <h3>Data & Horário</h3>
          <p>${formatDate(event?.event_date)} · ${displayValue(event?.event_time, 'Horário não definido')}</p>
        </article>
        <article>
          <h3>Local</h3>
          <p>${displayValue(event?.location_name)}</p>
        </article>
        <article>
          <h3>Formação</h3>
          <p>${displayValue(config?.formation || config?.formation_name)}</p>
        </article>
      </div>
    </section>
  `;

  const cortejoHtml = cortejoItems.length
    ? cortejoItems.map((row, idx) => buildSongEntry(row, `Entrada ${idx + 1}`)).join('')
    : '<p class="empty-state">Nenhuma entrada de cortejo cadastrada.</p>';

  const ceremonyGroups = groupCeremonyItems(cerimoniaItems);
  const cerimoniaHtml = ceremonyGroups.length
    ? ceremonyGroups
        .map(
          (group) => `
            <section class="group-block">
              <h3>${group.label}</h3>
              ${group.rows.map((row) => buildSongEntry(row)).join('')}
            </section>
          `
        )
        .join('')
    : '<p class="empty-state">Nenhum momento de cerimônia cadastrado.</p>';

  const saidaHtml = buildSongEntry(
    {
      song_name: config?.exit_song,
      reference_link: config?.exit_reference,
      who_enters: 'Encerramento da cerimônia',
    },
    null
  );

  const receptivoHtml = config?.has_reception
    ? `
      <article class="song-card">
        <p class="song-name">🎵 Música: <strong>Seleção personalizada para receptivo</strong></p>
        <p class="song-meta">Duração: ${displayValue(config?.reception_duration)}</p>
        <p class="song-meta">Gêneros: ${displayValue(config?.reception_genres)}</p>
        <p class="song-meta">Artistas: ${displayValue(config?.reception_artists)}</p>
      </article>
    `
    : '<p class="empty-state">Receptivo não habilitado para este evento.</p>';

  const notesHtml = normalizeWhitespace(config?.general_notes)
    ? `
      <section class="section-block notes">
        <header class="section-header">
          <h2>📝 Observações Gerais</h2>
        </header>
        <div class="section-content">
          <p>${escapeHtml(normalizeWhitespace(config.general_notes))}</p>
        </div>
      </section>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          :root {
            --text: #1f2937;
            --muted: #6b7280;
            --surface: #ffffff;
            --surface-soft: #f9fafb;
            --border: #e5e7eb;
            --brand: #7c3aed;
            --brand-soft: #ede9fe;
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            color: var(--text);
            background: #f3f4f6;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
              'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
            line-height: 1.5;
          }

          main {
            max-width: 900px;
            margin: 0 auto;
            padding: 28px 24px 64px;
          }

          .cover,
          .section-block {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 26px;
            margin-bottom: 18px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
          }

          .cover-kicker {
            display: inline-block;
            margin: 0;
            padding: 4px 10px;
            border-radius: 999px;
            background: var(--brand-soft);
            color: var(--brand);
            font-weight: 600;
            font-size: 12px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          h1 {
            margin: 14px 0 8px;
            font-size: 34px;
            line-height: 1.1;
          }

          .cover-subtitle {
            margin: 0 0 20px;
            color: var(--muted);
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .summary-grid article {
            background: var(--surface-soft);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 12px;
          }

          .summary-grid h3 {
            margin: 0 0 4px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--muted);
          }

          .summary-grid p { margin: 0; font-size: 15px; font-weight: 600; }

          .section-header h2 {
            margin: 0;
            font-size: 24px;
          }

          .section-header p {
            margin: 6px 0 0;
            color: var(--muted);
            font-size: 14px;
          }

          .section-content { margin-top: 16px; }

          .song-card {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 12px 14px;
            margin-bottom: 10px;
            background: var(--surface-soft);
          }

          .eyebrow {
            margin: 0 0 6px;
            color: var(--brand);
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .song-name { margin: 0; font-size: 15px; }
          .song-meta,
          .song-ref {
            margin: 4px 0 0;
            color: var(--muted);
            font-size: 13px;
            word-break: break-word;
          }

          .group-block h3 {
            margin: 0 0 10px;
            font-size: 16px;
            color: var(--brand);
          }

          .group-block { margin-bottom: 14px; }

          .empty-state {
            margin: 0;
            padding: 12px;
            border: 1px dashed var(--border);
            border-radius: 12px;
            background: #fff;
            color: var(--muted);
          }

          .footer {
            text-align: center;
            color: var(--muted);
            margin-top: 18px;
            font-size: 12px;
          }

          @media print {
            body {
              background: #ffffff;
            }

            main {
              padding: 12mm;
            }

            .cover,
            .section-block {
              box-shadow: none;
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <main>
          ${cover}
          ${buildSection({ title: 'Cortejo', icon: '💒', subtitle: 'Entradas e trilhas do cortejo', contentHtml: cortejoHtml })}
          ${buildSection({ title: 'Cerimônia', icon: '🎼', subtitle: 'Momentos principais da celebração', contentHtml: cerimoniaHtml })}
          ${buildSection({ title: 'Saída', icon: '💐', subtitle: 'Canção de encerramento dos noivos', contentHtml: saidaHtml })}
          ${buildSection({ title: 'Receptivo', icon: '🎉', subtitle: 'Ambientação musical da recepção', contentHtml: receptivoHtml })}
          ${notesHtml}
          <footer class="footer">💜 Harmonics · Cerimonial Musical</footer>
        </main>
      </body>
    </html>
  `;
}

export async function generateRepertoirePdfBuffer(payload = {}) {
  const html = generateRepertoirePdfHtml(payload);
  const puppeteerModule = await import('puppeteer');
  const puppeteer = puppeteerModule.default || puppeteerModule;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '10mm',
        bottom: '14mm',
        left: '10mm',
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
