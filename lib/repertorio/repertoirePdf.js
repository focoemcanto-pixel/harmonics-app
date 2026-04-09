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

  return scoreTextQuality(repaired) < scoreTextQuality(utf8) ? repaired : utf8;
}

function toPdfHexUtf16(text) {
  const safe = ensureUtf8Text(text);
  const utf16le = Buffer.from(safe, 'utf16le');
  const utf16be = Buffer.alloc(utf16le.length);

  for (let i = 0; i < utf16le.length; i += 2) {
    utf16be[i] = utf16le[i + 1];
    utf16be[i + 1] = utf16le[i];
  }

  const withBom = Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be]);
  return `<${withBom.toString('hex').toUpperCase()}>`;
}

function wrapText(text, maxChars = 78) {
  const normalized = ensureUtf8Text(text);
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

function buildSummaryBlocks({ event = {}, config = {} } = {}) {
  const blocks = [];

  blocks.push({ type: 'spacer', lines: 4 });
  blocks.push({
    type: 'text',
    text: 'REPERTÓRIO — CERIMONIAL MUSICAL',
    fontSize: 24,
    bold: true,
    align: 'center',
    maxChars: 50,
  });
  blocks.push({ type: 'spacer', lines: 2 });

  pushWrapped(blocks, `👰 ${event.client_name || 'Cliente'}`, {
    fontSize: 16,
    align: 'center',
    maxChars: 56,
  });

  const datePart = event.event_date || '-';
  const timePart = event.event_time || '-';
  pushWrapped(blocks, `📅 ${datePart} às ${timePart}`, {
    fontSize: 14,
    align: 'center',
    maxChars: 56,
  });

  pushWrapped(blocks, `📍 ${event.location_name || '-'}`, {
    fontSize: 14,
    align: 'center',
    maxChars: 56,
  });

  pushWrapped(blocks, `🎻 Formação: ${config?.formation || config?.formation_name || '-'}`, {
    fontSize: 14,
    align: 'center',
    maxChars: 56,
  });

  return blocks;
}

function sortItems(items = []) {
  return Array.isArray(items)
    ? [...items].sort((a, b) => Number(a?.item_order || 0) - Number(b?.item_order || 0))
    : [];
}

function buildCeremonyGroups(items = []) {
  const groups = [];
  let currentGroup = null;

  for (const row of items) {
    const label = ensureUtf8Text(row?.label || row?.moment || row?.who_enters || 'Momento');
    const momentKey = label.toLowerCase();

    if (!currentGroup || currentGroup.key !== momentKey) {
      currentGroup = { key: momentKey, title: label.toUpperCase(), rows: [] };
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

  blocks.push({ type: 'text', text: '💒 CORTEJO', fontSize: 16, bold: true, maxChars: 70 });
  blocks.push({ type: 'spacer', lines: 0.7 });

  if (!cortejoItems.length) {
    blocks.push({ type: 'text', text: 'Sem entradas cadastradas.', fontSize: 12, maxChars: 78 });
  } else {
    cortejoItems.forEach((row, index) => {
      blocks.push({
        type: 'text',
        text: `ENTRADA ${index + 1}`,
        fontSize: 12,
        bold: true,
        maxChars: 78,
      });

      if (row?.who_enters || row?.label) {
        pushWrapped(blocks, row?.who_enters || row?.label, { fontSize: 12, maxChars: 78 });
      }

      pushWrapped(blocks, `🎵 Música: ${row?.song_name || '-'}`, { fontSize: 12, maxChars: 78 });
      if (row?.reference_link) {
        pushWrapped(blocks, `🔗 Referência: ${row.reference_link}`, { fontSize: 11, maxChars: 78 });
      }

      blocks.push({ type: 'spacer', lines: 0.8 });
    });
  }

  blocks.push({ type: 'spacer', lines: 0.9 });
  blocks.push({ type: 'text', text: '🎼 CERIMÔNIA', fontSize: 16, bold: true, maxChars: 70 });
  blocks.push({ type: 'spacer', lines: 0.7 });

  if (!cerimoniaItems.length) {
    blocks.push({ type: 'text', text: 'Sem momentos de cerimônia cadastrados.', fontSize: 12, maxChars: 78 });
  } else {
    for (const group of buildCeremonyGroups(cerimoniaItems)) {
      blocks.push({ type: 'text', text: group.title, fontSize: 12, bold: true, maxChars: 78 });

      for (const row of group.rows) {
        pushWrapped(blocks, `🎵 Música: ${row?.song_name || '-'}`, { fontSize: 12, maxChars: 78 });
        if (row?.reference_link) {
          pushWrapped(blocks, `🔗 Referência: ${row.reference_link}`, { fontSize: 11, maxChars: 78 });
        }
      }

      blocks.push({ type: 'spacer', lines: 0.8 });
    }
  }

  blocks.push({ type: 'spacer', lines: 0.9 });
  blocks.push({ type: 'text', text: '💐 SAÍDA DOS NOIVOS', fontSize: 16, bold: true, maxChars: 70 });
  blocks.push({ type: 'spacer', lines: 0.7 });
  pushWrapped(blocks, `🎵 Música: ${config?.exit_song || '-'}`, { fontSize: 12, maxChars: 78 });
  if (config?.exit_reference) {
    pushWrapped(blocks, `🔗 Referência: ${config.exit_reference}`, { fontSize: 11, maxChars: 78 });
  }

  if (config?.has_reception) {
    blocks.push({ type: 'spacer', lines: 1.1 });
    blocks.push({ type: 'text', text: '🎉 RECEPTIVO', fontSize: 16, bold: true, maxChars: 70 });
    blocks.push({ type: 'spacer', lines: 0.7 });
    pushWrapped(blocks, `Duração: ${config?.reception_duration || '-'}`, { fontSize: 12, maxChars: 78 });
    pushWrapped(blocks, `Gêneros: ${config?.reception_genres || '-'}`, { fontSize: 12, maxChars: 78 });
    pushWrapped(blocks, `Artistas: ${config?.reception_artists || '-'}`, { fontSize: 12, maxChars: 78 });
  }

  if (config?.general_notes) {
    blocks.push({ type: 'spacer', lines: 1.1 });
    blocks.push({ type: 'text', text: 'OBSERVAÇÕES GERAIS', fontSize: 12, bold: true, maxChars: 78 });
    pushWrapped(blocks, config.general_notes, { fontSize: 11, maxChars: 78 });
  }

  blocks.push({ type: 'spacer', lines: 1.4 });
  blocks.push({
    type: 'text',
    text: '💜 Harmonics Cerimonial Musical',
    fontSize: 12,
    bold: true,
    align: 'center',
    maxChars: 62,
  });
  blocks.push({
    type: 'text',
    text: 'A trilha sonora perfeita para o seu momento mais especial',
    fontSize: 10,
    align: 'center',
    maxChars: 62,
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

    const fontSize = Number(block.fontSize || 12);
    const lineHeight = Math.max(14, fontSize * 1.35);

    if (y - lineHeight < bottom) {
      pushPage();
    }

    const text = ensureUtf8Text(block.text || '');
    const approxCharWidth = fontSize * 0.48;
    const maxWidth = pageWidth - left - right;
    const textWidth = Math.min(maxWidth, text.length * approxCharWidth);
    let x = left;

    if (block.align === 'center') {
      x = (pageWidth - textWidth) / 2;
    } else if (block.align === 'right') {
      x = pageWidth - right - textWidth;
    }

    current.push({
      text,
      x: Number(x.toFixed(2)),
      y: toPdfY(y),
      fontSize,
      bold: Boolean(block.bold),
    });

    y -= lineHeight;
  }

  if (current.length) {
    pages.push(current);
  }

  if (!pages.length) {
    pages.push([
      {
        text: 'Repertório sem conteúdo.',
        x: left,
        y: top,
        fontSize: 12,
        bold: false,
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

    const textCommands = ['BT'];

    for (const line of page) {
      textCommands.push(`/${line.bold ? 'F2' : 'F1'} ${line.fontSize} Tf`);
      textCommands.push(`${line.x} ${line.y} Td`);
      textCommands.push(`${toPdfHexUtf16(line.text)} Tj`);
      textCommands.push('1 0 0 1 0 0 Tm');
    }

    textCommands.push('ET');
    const stream = textCommands.join('\n');

    objects.push(
      `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf-8')} >>\nstream\n${stream}\nendstream\nendobj\n`
    );

    objId += 2;
  }

  objects.push('97 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push('98 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

  const header = '%PDF-1.4\n';
  let body = '';

  for (const object of objects) {
    offsets.push(header.length + body.length);
    body += object;
  }

  const xrefStart = header.length + body.length;
  const xrefRows = ['0000000000 65535 f '];

  for (const offset of offsets) {
    xrefRows.push(`${String(offset).padStart(10, '0')} 00000 n `);
  }

  const trailer = `xref\n0 ${objects.length + 1}\n${xrefRows.join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(header + body + trailer, 'utf-8');
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
