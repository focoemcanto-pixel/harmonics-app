function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeSingleLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function hasValue(value) {
  return sanitizeSingleLine(value).length > 0;
}

function normalizeItemTitle(item = {}) {
  return sanitizeSingleLine(item?.label || item?.who_enters || item?.moment || item?.song_name || 'Momento musical');
}

function buildInfoRow(label, value, icon = '') {
  if (!hasValue(value)) return '';

  return `
    <div class="info-row">
      <span class="info-label">${escapeHtml(label)}</span>
      <span class="info-value">${icon ? `${icon} ` : ''}${escapeHtml(value)}</span>
    </div>
  `;
}

function buildCard({ badge, title, songName, referenceLink, notes }) {
  const safeSongName = hasValue(songName) ? sanitizeSingleLine(songName) : '—';
  return `
    <article class="music-card">
      <div class="music-card__badge">${escapeHtml(badge || 'Momento')}</div>
      <h3 class="music-card__title">${escapeHtml(title || 'Momento musical')}</h3>
      <p class="music-card__line"><strong>🎵 Música:</strong> ${escapeHtml(safeSongName)}</p>
      ${hasValue(referenceLink) ? `<p class="music-card__line music-card__line--secondary"><strong>🔗 Referência:</strong> ${escapeHtml(referenceLink)}</p>` : ''}
      ${hasValue(notes) ? `<p class="music-card__line music-card__line--notes"><strong>📝 Observações:</strong> ${escapeHtml(notes)}</p>` : ''}
    </article>
  `;
}

function mapSectionItems(items = [], sectionKey, badgeLabel) {
  return items
    .filter((item) => sanitizeSingleLine(item?.section).toLowerCase() === sectionKey)
    .map((item, index) => ({
      badge: badgeLabel(index),
      title: normalizeItemTitle(item),
      songName: item?.song_name,
      referenceLink: item?.reference_link,
      notes: item?.notes,
    }));
}

function buildSection({ title, subtitle, cards }) {
  if (!Array.isArray(cards) || cards.length === 0) return '';

  return `
    <section class="section-block">
      <div class="section-head">
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <div class="card-grid">
        ${cards.map((card) => buildCard(card)).join('')}
      </div>
    </section>
  `;
}

export function buildRepertoirePdfHtml({ event = {}, config = {}, items = [] } = {}) {
  const sortedItems = Array.isArray(items)
    ? [...items].sort((a, b) => Number(a?.item_order || 0) - Number(b?.item_order || 0))
    : [];

  const cortejoCards = mapSectionItems(sortedItems, 'cortejo', (index) => `Entrada ${index + 1}`);
  const cerimoniaCards = mapSectionItems(sortedItems, 'cerimonia', () => 'Momento');

  const rawSaidaCards = mapSectionItems(sortedItems, 'saida', () => 'Saída');
  const configSaidaCard = hasValue(config?.exit_song) || hasValue(config?.exit_reference) || hasValue(config?.exit_notes)
    ? [{
      badge: 'Saída',
      title: 'Encerramento',
      songName: config?.exit_song,
      referenceLink: config?.exit_reference,
      notes: config?.exit_notes,
    }]
    : [];
  const saidaCards = rawSaidaCards.length > 0 ? rawSaidaCards : configSaidaCard;

  const antessalaCards = config?.has_ante_room
    ? [{
      badge: 'Antessala',
      title: sanitizeSingleLine(config?.ante_room_style) || 'Ambientação da antessala',
      songName: sanitizeSingleLine(config?.ante_room_style) || null,
      notes: config?.ante_room_notes,
    }]
    : [];

  const rawReceptivoCards = mapSectionItems(sortedItems, 'receptivo', (index) => `Receptivo ${index + 1}`);
  const hasReceptivoConfig = Boolean(config?.has_reception) || hasValue(config?.reception_duration) || hasValue(config?.reception_genres) || hasValue(config?.reception_artists) || hasValue(config?.reception_notes);
  const receptivoConfigNotes = [
    hasValue(config?.reception_duration) ? `Duração prevista: ${sanitizeSingleLine(config.reception_duration)}` : null,
    hasValue(config?.reception_genres) ? `Gêneros: ${sanitizeSingleLine(config.reception_genres)}` : null,
    hasValue(config?.reception_artists) ? `Referências artísticas: ${sanitizeSingleLine(config.reception_artists)}` : null,
    hasValue(config?.reception_notes) ? sanitizeSingleLine(config.reception_notes) : null,
  ].filter(Boolean).join(' • ');
  const receptivoCards = rawReceptivoCards.length > 0
    ? rawReceptivoCards
    : hasReceptivoConfig
      ? [{
        badge: 'Receptivo',
        title: 'Ambientação do receptivo',
        songName: config?.reception_genres || 'Seleção personalizada',
        notes: receptivoConfigNotes,
      }]
      : [];

  const sectionsHtml = [
    buildSection({ title: 'CORTEJO', subtitle: 'Entradas e momentos de condução da cerimônia.', cards: cortejoCards }),
    buildSection({ title: 'CERIMÔNIA', subtitle: 'Momentos musicais durante o rito principal.', cards: cerimoniaCards }),
    buildSection({ title: 'SAÍDA DOS NOIVOS', subtitle: 'Trilha para o encerramento oficial.', cards: saidaCards }),
    buildSection({ title: 'ANTESSALA', subtitle: 'Ambientação musical de recepção inicial.', cards: antessalaCards }),
    buildSection({ title: 'RECEPTIVO', subtitle: 'Atmosfera para recepção e celebração.', cards: receptivoCards }),
  ].join('');

  const observacoes = [
    hasValue(config?.desired_songs) ? `🎼 Músicas desejadas: ${sanitizeSingleLine(config.desired_songs)}` : null,
    hasValue(config?.general_notes) ? `📝 Observações gerais: ${sanitizeSingleLine(config.general_notes)}` : null,
  ].filter(Boolean).join('\n\n');

  return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Repertório Harmonics</title>
    <style>
      :root {
        --violet-900: #4c1d95;
        --violet-700: #6d28d9;
        --violet-600: #7c3aed;
        --violet-100: #f3e8ff;
        --slate-900: #0f172a;
        --slate-700: #334155;
        --slate-500: #64748b;
        --slate-200: #e2e8f0;
        --slate-100: #f1f5f9;
        --white: #ffffff;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        color: var(--slate-900);
        background: var(--white);
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji";
      }

      .page {
        width: 100%;
      }

      .cover {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 34px;
        padding: 42px 34px;
      }

      .brand {
        text-align: center;
      }

      .brand h1 {
        margin: 0;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-size: 20px;
        color: var(--violet-900);
      }

      .brand p {
        margin: 8px 0 0;
        font-size: 11px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--slate-500);
      }

      .cover-title {
        margin: 0;
        text-align: center;
        font-size: 44px;
        font-weight: 800;
        color: var(--slate-900);
      }

      .summary-card {
        max-width: 100%;
        border-radius: 20px;
        border: 1px solid #ddd6fe;
        background: linear-gradient(165deg, #fcfaff 0%, #f8fafc 100%);
        box-shadow: 0 20px 50px rgba(76, 29, 149, 0.08);
        padding: 30px;
      }

      .summary-card h2 {
        margin: 0 0 20px;
        font-size: 22px;
        color: var(--violet-900);
      }

      .summary-grid {
        display: grid;
        gap: 12px;
      }

      .info-row {
        display: grid;
        grid-template-columns: minmax(100px, 130px) 1fr;
        gap: 8px;
        align-items: baseline;
      }

      .info-label {
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--slate-500);
        font-weight: 700;
      }

      .info-value {
        font-size: 14px;
        line-height: 1.5;
        color: var(--slate-900);
      }

      .cover-note {
        text-align: center;
        margin: 0;
        font-size: 14px;
        line-height: 1.65;
        color: var(--slate-700);
        max-width: 720px;
        align-self: center;
      }

      .content-page {
        page-break-before: always;
        padding-top: 8px;
      }

      .content-head {
        margin-bottom: 24px;
        border-bottom: 1px solid var(--slate-200);
        padding-bottom: 16px;
      }

      .content-head h2 {
        margin: 0;
        font-size: 30px;
        color: var(--violet-900);
      }

      .content-head p {
        margin: 8px 0 0;
        color: var(--slate-500);
        font-size: 14px;
      }

      .section-block {
        margin-top: 28px;
      }

      .section-head {
        margin-bottom: 14px;
      }

      .section-head h2 {
        margin: 0;
        font-size: 15px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--slate-700);
      }

      .section-head p {
        margin: 7px 0 0;
        font-size: 13px;
        color: var(--slate-500);
      }

      .card-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .music-card {
        border: 1px solid var(--slate-200);
        border-radius: 16px;
        background: var(--white);
        padding: 16px 18px;
        box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .music-card__badge {
        display: inline-block;
        background: var(--violet-100);
        color: var(--violet-700);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .music-card__title {
        margin: 12px 0 6px;
        font-size: 18px;
        color: var(--slate-900);
      }

      .music-card__line {
        margin: 6px 0 0;
        color: var(--slate-700);
        font-size: 13px;
        line-height: 1.55;
      }

      .music-card__line--secondary,
      .music-card__line--notes {
        color: var(--slate-500);
      }

      .notes-block {
        margin-top: 26px;
        border: 1px dashed #cbd5e1;
        background: #f8fafc;
        border-radius: 14px;
        padding: 16px;
        white-space: pre-line;
        font-size: 13px;
        color: var(--slate-700);
        line-height: 1.65;
      }

      .document-footer {
        margin-top: 34px;
        text-align: center;
        border-top: 1px solid var(--slate-200);
        padding-top: 14px;
        color: var(--slate-500);
        font-size: 12px;
      }

      .document-footer strong {
        display: block;
        color: var(--violet-700);
        font-size: 13px;
      }

      @media print {
        .cover { min-height: auto; }
      }
    </style>
  </head>
  <body>
    <main class="page cover">
      <header class="brand">
        <h1>Harmonics</h1>
        <p>Cerimonial Musical</p>
      </header>

      <h2 class="cover-title">🎵 Repertório</h2>

      <section class="summary-card">
        <h2>Resumo do evento</h2>
        <div class="summary-grid">
          ${buildInfoRow('Cliente', sanitizeSingleLine(event?.client_name) || '—', '💐')}
          ${buildInfoRow('Data', sanitizeSingleLine(event?.event_date) || '—', '📅')}
          ${buildInfoRow('Horário', sanitizeSingleLine(event?.event_time) || '—', '⏰')}
          ${buildInfoRow('Local', sanitizeSingleLine(event?.location_name) || '—', '💒')}
          ${hasValue(config?.formation) ? buildInfoRow('Formação', sanitizeSingleLine(config.formation), '🎼') : ''}
        </div>
      </section>

      <p class="cover-note">Este documento reúne a organização musical do seu evento com curadoria Harmonics, estruturando entradas, momentos e encerramento com clareza, elegância e sensibilidade artística.</p>
    </main>

    <main class="page content-page">
      <header class="content-head">
        <h2>Estrutura musical do evento</h2>
        <p>Sequência de execução para cerimônia, recepção e momentos especiais.</p>
      </header>

      ${sectionsHtml || '<p style="color:#64748b">Nenhum item de repertório foi informado até o momento.</p>'}

      ${observacoes ? `<section class="notes-block">${escapeHtml(observacoes)}</section>` : ''}

      <footer class="document-footer">
        <strong>💜 Harmonics Cerimonial Musical</strong>
        A trilha sonora perfeita para o seu momento mais especial.
      </footer>
    </main>
  </body>
</html>
  `;
}
