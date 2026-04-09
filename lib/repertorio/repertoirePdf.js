function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTextQuality(text) {
  const source = String(text || '');
  const replacement = (source.match(/�/g) || []).length;
  const mojibake = (source.match(/Ã.|Â./g) || []).length;
  return replacement * 5 + mojibake;
}

function ensureUtf8Text(value) {
  const raw = normalizeWhitespace(value);
  if (!raw) return '';

  const utf8 = Buffer.from(raw, 'utf-8').toString('utf-8');
  const repaired = Buffer.from(raw, 'latin1').toString('utf-8');
  const chosen = scoreTextQuality(repaired) < scoreTextQuality(utf8) ? repaired : utf8;

  return chosen
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[…]/g, '...')
    .replace(/[—–]/g, '-')
    .replace(/[•]/g, '-');
}

function toPdfSafeText(value) {
  return ensureUtf8Text(value)
    .replace(/[🪑🎉💐🎼💒🎵🔗📝📍📅🎻👰💜]/gu, '')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function toPdfStringLiteral(text) {
  const safe = toPdfSafeText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

  return `(${safe})`;
}

function wrapText(text, maxChars = 78) {
  const normalized = toPdfSafeText(text);
  if (!normalized) return [''];
  if (normalized.length <= maxChars) return [normalized];

  const words = normalized.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      continue;
    }
    current = candidate;
  }

  if (current) lines.push(current);
  return lines;
}

function pushWrapped(blocks, text, style = {}) {
  for (const line of wrapText(text, style.maxChars || 78)) {
    blocks.push({ type: 'text', text: line, ...style });
  }
}

function hasValue(value) {
  return Boolean(normalizeWhitespace(value));
}

function sectionHasContent(rows = []) {
  return Array.isArray(rows) && rows.length > 0;
}

function buildSummaryBlocks({ event = {}, config = {} } = {}) {
  const blocks = [];

  blocks.push({ type: 'spacer', lines: 5.8 });
  blocks.push({ type: 'text', text: 'Harmonics', fontSize: 34, bold: true, align: 'center', maxChars: 30 });
  blocks.push({ type: 'spacer', lines: 0.5 });
  blocks.push({
    type: 'text',
    text: 'REPERTÓRIO - CERIMONIAL MUSICAL',
    fontSize: 12,
    align: 'center',
    tracking: 0.5,
    maxChars: 52,
  });

  blocks.push({ type: 'spacer', lines: 1.9 });
  blocks.push({ type: 'rule', color: '0.78 0.70 0.86', thickness: 1.1, horizontalPadding: 165 });
  blocks.push({ type: 'spacer', lines: 1.7 });

  pushWrapped(blocks, `Cliente: ${event.client_name || 'Cliente'}`, {
    fontSize: 16,
    align: 'center',
    bold: true,
    maxChars: 60,
  });

  const datePart = event.event_date || '-';
  const timePart = event.event_time || '-';
  pushWrapped(blocks, `Data e horário: ${datePart} às ${timePart}`, {
    fontSize: 13,
    align: 'center',
    maxChars: 62,
  });

  pushWrapped(blocks, `Local: ${event.location_name || '-'}`, {
    fontSize: 13,
    align: 'center',
    maxChars: 62,
  });

  if (hasValue(config?.formation || config?.formation_name)) {
    pushWrapped(blocks, `Formação: ${config?.formation || config?.formation_name}`, {
      fontSize: 13,
      align: 'center',
      maxChars: 62,
    });
  }

  blocks.push({ type: 'spacer', lines: 2.4 });
  blocks.push({
    type: 'text',
    text: 'Documento preparado com carinho para o seu grande momento',
    fontSize: 10.5,
    align: 'center',
    color: '0.46 0.42 0.52',
    maxChars: 70,
  });

  return blocks;
}

function sortItems(items = []) {
  return Array.isArray(items)
    ? [...items].sort((a, b) => Number(a?.item_order || 0) - Number(b?.item_order || 0))
    : [];
}

function addSectionTitle(blocks, title) {
  blocks.push({ type: 'spacer', lines: 1.1 });
  blocks.push({ type: 'rule', color: '0.88 0.84 0.92', thickness: 0.8 });
  blocks.push({ type: 'spacer', lines: 0.7 });
  blocks.push({ type: 'text', text: title, fontSize: 18, bold: true, maxChars: 72 });
  blocks.push({ type: 'spacer', lines: 0.35 });
}

function addItemBlock(blocks, {
  heading,
  moment,
  song,
  reference,
  notes,
  hideSong = false,
}) {
  if (heading) {
    pushWrapped(blocks, heading, { fontSize: 13.5, bold: true, maxChars: 74 });
  }

  if (moment) {
    pushWrapped(blocks, moment, { fontSize: 12.5, maxChars: 78 });
  }

  if (song) {
    pushWrapped(blocks, `Música: ${song}`, { fontSize: 12, bold: true, maxChars: 80 });
  } else if (!hideSong) {
    pushWrapped(blocks, 'Música: a definir', { fontSize: 11.5, color: '0.42 0.42 0.42', maxChars: 80 });
  }

  if (reference) {
    pushWrapped(blocks, `Referência: ${reference}`, { fontSize: 10.5, color: '0.34 0.34 0.34', maxChars: 82 });
  }

  if (notes) {
    pushWrapped(blocks, `Observações: ${notes}`, {
      fontSize: 10.5,
      color: '0.38 0.36 0.44',
      italic: true,
      maxChars: 82,
    });
  }

  blocks.push({ type: 'spacer', lines: 0.9 });
}

function buildCeremonyGroups(items = []) {
  const groups = [];
  let currentGroup = null;

  for (const row of items) {
    const label = toPdfSafeText(row?.label || row?.moment || row?.who_enters || 'Momento');
    const momentKey = label.toLowerCase();

    if (!currentGroup || currentGroup.key !== momentKey) {
      currentGroup = { key: momentKey, title: label, rows: [] };
      groups.push(currentGroup);
    }

    currentGroup.rows.push(row);
  }

  return groups;
}

function buildContentBlocks({ config = {}, items = [] } = {}) {
  const blocks = [];
  const ordered = sortItems(items);

  const cortejoItems = ordered.filter((item) => String(item?.section || '').toLowerCase() === 'cortejo');
  const cerimoniaItems = ordered.filter((item) => String(item?.section || '').toLowerCase() === 'cerimonia');
  const saidaItems = ordered.filter((item) => String(item?.section || '').toLowerCase() === 'saida');
  const receptivoItems = ordered.filter((item) => String(item?.section || '').toLowerCase() === 'receptivo');
  const antessalaItems = ordered.filter((item) => String(item?.section || '').toLowerCase() === 'antessala');

  if (sectionHasContent(cortejoItems)) {
    addSectionTitle(blocks, 'CORTEJO');
    cortejoItems.forEach((row, index) => {
      addItemBlock(blocks, {
        heading: `ENTRADA ${index + 1}`,
        moment: row?.who_enters || row?.label || row?.moment,
        song: row?.song_name,
        reference: row?.reference_link,
        notes: row?.notes,
      });
    });
  }

  if (sectionHasContent(cerimoniaItems)) {
    addSectionTitle(blocks, 'CERIMÔNIA');

    for (const group of buildCeremonyGroups(cerimoniaItems)) {
      addItemBlock(blocks, {
        heading: group.title,
        moment: null,
        song: null,
        hideSong: true,
      });

      for (const row of group.rows) {
        addItemBlock(blocks, {
          heading: null,
          moment: row?.moment || row?.label,
          song: row?.song_name,
          reference: row?.reference_link,
          notes: row?.notes,
        });
      }
    }
  }

  const hasExitConfig = hasValue(config?.exit_song) || hasValue(config?.exit_reference) || hasValue(config?.exit_notes);
  if (sectionHasContent(saidaItems) || hasExitConfig) {
    addSectionTitle(blocks, 'SAÍDA DOS NOIVOS');

    if (sectionHasContent(saidaItems)) {
      saidaItems.forEach((row, index) => {
        addItemBlock(blocks, {
          heading: `MOMENTO ${index + 1}`,
          moment: row?.moment || row?.label || row?.who_enters,
          song: row?.song_name,
          reference: row?.reference_link,
          notes: row?.notes,
        });
      });
    } else {
      addItemBlock(blocks, {
        heading: 'MOMENTO PRINCIPAL',
        song: config?.exit_song,
        reference: config?.exit_reference,
        notes: config?.exit_notes,
      });
    }
  }

  const hasReceptivoConfig =
    config?.has_reception &&
    (hasValue(config?.reception_duration) ||
      hasValue(config?.reception_genres) ||
      hasValue(config?.reception_artists) ||
      hasValue(config?.reception_notes));

  if (sectionHasContent(receptivoItems) || hasReceptivoConfig) {
    addSectionTitle(blocks, 'RECEPTIVO');

    if (sectionHasContent(receptivoItems)) {
      receptivoItems.forEach((row, index) => {
        addItemBlock(blocks, {
          heading: `BLOCO ${index + 1}`,
          moment: row?.label || row?.moment,
          song: row?.song_name,
          reference: row?.reference_link,
          notes: row?.notes,
        });
      });
    }

    if (hasReceptivoConfig) {
      addItemBlock(blocks, {
        heading: 'Diretrizes do receptivo',
        moment: [
          hasValue(config?.reception_duration) ? `Duração: ${config.reception_duration}` : '',
          hasValue(config?.reception_genres) ? `Gêneros: ${config.reception_genres}` : '',
          hasValue(config?.reception_artists) ? `Artistas: ${config.reception_artists}` : '',
        ]
          .filter(Boolean)
          .join('  |  '),
        notes: config?.reception_notes,
      });
    }
  }

  const hasAntessalaConfig =
    config?.has_ante_room &&
    (hasValue(config?.ante_room_style) || hasValue(config?.ante_room_notes));

  if (sectionHasContent(antessalaItems) || hasAntessalaConfig) {
    addSectionTitle(blocks, 'ANTESSALA');

    if (sectionHasContent(antessalaItems)) {
      antessalaItems.forEach((row, index) => {
        addItemBlock(blocks, {
          heading: `BLOCO ${index + 1}`,
          moment: row?.label || row?.moment || row?.genres || row?.artists,
          song: row?.song_name,
          reference: row?.reference_link,
          notes: row?.notes,
        });
      });
    }

    if (hasAntessalaConfig) {
      addItemBlock(blocks, {
        heading: 'Diretrizes da antessala',
        moment: config?.ante_room_style ? `Estilo: ${config.ante_room_style}` : '',
        notes: config?.ante_room_notes,
      });
    }
  }

  if (hasValue(config?.general_notes)) {
    addSectionTitle(blocks, 'OBSERVAÇÕES GERAIS');
    pushWrapped(blocks, config.general_notes, { fontSize: 11, color: '0.34 0.34 0.34', italic: true, maxChars: 84 });
    blocks.push({ type: 'spacer', lines: 0.6 });
  }

  blocks.push({ type: 'spacer', lines: 1.4 });
  blocks.push({ type: 'rule', color: '0.84 0.76 0.91', thickness: 0.9, horizontalPadding: 100 });
  blocks.push({ type: 'spacer', lines: 1.1 });
  blocks.push({
    type: 'text',
    text: 'Harmonics Cerimonial Musical',
    fontSize: 12,
    bold: true,
    align: 'center',
    color: '0.32 0.23 0.46',
    maxChars: 62,
  });
  blocks.push({
    type: 'text',
    text: 'A trilha sonora perfeita para o seu momento mais especial',
    fontSize: 10,
    align: 'center',
    color: '0.40 0.35 0.49',
    maxChars: 72,
  });

  return blocks;
}

function toPdfY(y) {
  return Number(y.toFixed(2));
}

function buildPagesFromBlocks(blocks = [], options = {}) {
  const pageWidth = 595;
  const pageHeight = 842;
  const left = 52;
  const right = 52;
  const top = 790;
  const bottom = 58;
  const baseLineHeight = options.baseLineHeight || 16;

  const pages = [];
  let current = [];
  let y = top;

  const pushPage = () => {
    pages.push(current);
    current = [];
    y = top;
  };

  for (const block of blocks) {
    if (block.type === 'spacer') {
      y -= baseLineHeight * Number(block.lines || 1);
      continue;
    }

    if (block.type === 'rule') {
      const thickness = Number(block.thickness || 0.8);
      const minY = bottom + thickness * 3;
      if (y < minY) {
        pushPage();
      }

      const hPadding = Number(block.horizontalPadding || 0);
      current.push({
        type: 'rule',
        x1: Number((left + hPadding).toFixed(2)),
        x2: Number((pageWidth - right - hPadding).toFixed(2)),
        y: toPdfY(y),
        thickness,
        color: block.color || '0.85 0.85 0.85',
      });

      y -= baseLineHeight * 0.6;
      continue;
    }

    const fontSize = Number(block.fontSize || 12);
    const lineHeight = Math.max(14, fontSize * 1.35);

    if (y - lineHeight < bottom) {
      pushPage();
    }

    const text = toPdfSafeText(block.text || '');
    const approxCharWidth = fontSize * 0.47;
    const maxWidth = pageWidth - left - right;
    const textWidth = Math.min(maxWidth, text.length * approxCharWidth);
    let x = left;

    if (block.align === 'center') {
      x = (pageWidth - textWidth) / 2;
    } else if (block.align === 'right') {
      x = pageWidth - right - textWidth;
    }

    current.push({
      type: 'text',
      text,
      x: Number(x.toFixed(2)),
      y: toPdfY(y),
      fontSize,
      bold: Boolean(block.bold),
      color: block.color || '0 0 0',
    });

    y -= lineHeight;
  }

  if (current.length) {
    pages.push(current);
  }

  if (!pages.length) {
    pages.push([
      {
        type: 'text',
        text: 'Repertório sem conteúdo.',
        x: left,
        y: top,
        fontSize: 12,
        bold: false,
        color: '0 0 0',
      },
    ]);
  }

  return { pageWidth, pageHeight, pages };
}

function buildPdfFromPages({ pageWidth, pageHeight, pages }) {
  const objects = [];
  const offsets = [];

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  let objId = 3;

  for (const page of pages) {
    const contentId = objId + 1;

    objects.push(
      `${objId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 97 0 R /F2 98 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    const commands = [];

    for (const entry of page) {
      if (entry.type === 'rule') {
        commands.push(`q ${entry.color} RG ${entry.thickness} w ${entry.x1} ${entry.y} m ${entry.x2} ${entry.y} l S Q`);
        continue;
      }

      commands.push('BT');
      commands.push(`${entry.color || '0 0 0'} rg`);
      commands.push(`/${entry.bold ? 'F2' : 'F1'} ${entry.fontSize} Tf`);
      commands.push(`1 0 0 1 ${entry.x} ${entry.y} Tm`);
      commands.push(`${toPdfStringLiteral(entry.text)} Tj`);
      commands.push('ET');
    }

    const stream = commands.join('\n');

    objects.push(
      `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream\nendobj\n`
    );

    objId += 2;
  }

  objects.push('97 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push('98 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');

  const header = '%PDF-1.4\n';
  let body = '';

  for (const object of objects) {
    offsets.push(Buffer.byteLength(header + body, 'latin1'));
    body += object;
  }

  const xrefStart = Buffer.byteLength(header + body, 'latin1');
  const xrefRows = ['0000000000 65535 f '];

  for (const offset of offsets) {
    xrefRows.push(`${String(offset).padStart(10, '0')} 00000 n `);
  }

  const trailer = `xref\n0 ${objects.length + 1}\n${xrefRows.join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(header + body + trailer, 'latin1');
}

export function generateRepertoirePdfBuffer(payload = {}) {
  const summaryBlocks = buildSummaryBlocks(payload);
  const contentBlocks = buildContentBlocks(payload);

  const firstPage = buildPagesFromBlocks(summaryBlocks);
  const detailsPages = buildPagesFromBlocks(contentBlocks);

  return buildPdfFromPages({
    pageWidth: firstPage.pageWidth,
    pageHeight: firstPage.pageHeight,
    pages: [...firstPage.pages, ...detailsPages.pages],
  });
}
