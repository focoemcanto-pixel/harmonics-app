function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function normalizeSingleLine(value) {
  return String(value ?? '')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

function appendLine(lines, text = '', options = {}) {
  const normalized = normalizeSingleLine(text);
  const maxChars = Number.isFinite(options.maxChars) ? options.maxChars : 92;

  if (!normalized) {
    lines.push('');
    return;
  }

  if (normalized.length <= maxChars) {
    lines.push(normalized);
    return;
  }

  const words = normalized.split(/\s+/);
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      continue;
    }

    if (candidate.length > maxChars) {
      lines.push(candidate.slice(0, maxChars));
      current = candidate.slice(maxChars);
      continue;
    }

    current = candidate;
  }

  if (current) {
    lines.push(current);
  }
}

function buildRepertoireLines({ event = {}, config = {}, items = [] } = {}) {
  const lines = [];

  appendLine(lines, `Repertório • ${event.client_name || 'Cliente'}`);
  appendLine(lines, `Data: ${event.event_date || '-'}  Horário: ${event.event_time || '-'}`);
  appendLine(lines, `Local: ${event.location_name || '-'}`);
  appendLine(lines, '');

  if (config?.has_ante_room) {
    appendLine(lines, 'ANTESSALA');
    appendLine(lines, `Estilo: ${config?.ante_room_style || '-'}`);
    if (config?.ante_room_notes) appendLine(lines, `Obs: ${config.ante_room_notes}`);
    appendLine(lines, '');
  }

  const ordered = Array.isArray(items)
    ? [...items].sort((a, b) => Number(a?.item_order || 0) - Number(b?.item_order || 0))
    : [];

  const sections = [
    { key: 'cortejo', title: 'CORTEJO' },
    { key: 'cerimonia', title: 'CERIMÔNIA' },
    { key: 'saida', title: 'SAÍDA' },
    { key: 'receptivo', title: 'RECEPTIVO' },
  ];

  for (const section of sections) {
    const sectionItems = ordered.filter((item) => String(item?.section || '').toLowerCase() === section.key);

    if (!sectionItems.length && section.key !== 'saida' && section.key !== 'receptivo') {
      continue;
    }

    appendLine(lines, section.title);

    if (section.key === 'saida') {
      appendLine(lines, `Música: ${config?.exit_song || '-'}`);
      if (config?.exit_reference) appendLine(lines, `Referência: ${config.exit_reference}`);
      if (config?.exit_notes) appendLine(lines, `Obs: ${config.exit_notes}`);
      appendLine(lines, '');
      continue;
    }

    if (section.key === 'receptivo') {
      if (!config?.has_reception) {
        appendLine(lines, 'Não incluído neste evento.');
      } else {
        appendLine(lines, `Duração: ${config?.reception_duration || '-'}`);
        appendLine(lines, `Gêneros: ${config?.reception_genres || '-'}`);
        appendLine(lines, `Artistas: ${config?.reception_artists || '-'}`);
        if (config?.reception_notes) appendLine(lines, `Obs: ${config.reception_notes}`);
      }

      appendLine(lines, '');
      continue;
    }

    if (!sectionItems.length) {
      appendLine(lines, 'Sem músicas informadas.');
      appendLine(lines, '');
      continue;
    }

    for (const row of sectionItems) {
      const headline =
        row?.label || row?.who_enters || row?.moment || row?.song_name || 'Item';

      appendLine(lines, `• ${headline}`);
      if (row?.song_name) appendLine(lines, `  Música: ${row.song_name}`);
      if (row?.reference_link) appendLine(lines, `  Referência: ${row.reference_link}`);
      if (row?.notes) appendLine(lines, `  Obs: ${row.notes}`);
    }

    appendLine(lines, '');
  }

  if (config?.desired_songs) {
    appendLine(lines, 'MÚSICAS DESEJADAS');
    appendLine(lines, config.desired_songs);
    appendLine(lines, '');
  }

  if (config?.general_notes) {
    appendLine(lines, 'OBSERVAÇÕES GERAIS');
    appendLine(lines, config.general_notes);
    appendLine(lines, '');
  }

  return lines;
}

function buildPdfFromLines(lines = []) {
  const pageWidth = 595;
  const pageHeight = 842;
  const left = 40;
  const top = 800;
  const lineHeight = 14;
  const maxLinesPerPage = 52;

  const safeLines = Array.isArray(lines) ? lines : [];
  const pages = [];

  for (let i = 0; i < safeLines.length; i += maxLinesPerPage) {
    pages.push(safeLines.slice(i, i + maxLinesPerPage));
  }

  if (pages.length === 0) {
    pages.push(['Repertório sem conteúdo.']);
  }

  const objects = [];
  const offsets = [];

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  let objId = 3;

  for (const pageLines of pages) {
    const contentId = objId + 1;

    objects.push(
      `${objId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 99 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    const textCommands = ['BT', '/F1 11 Tf', `${left} ${top} Td`];

    pageLines.forEach((line, index) => {
      if (index > 0) textCommands.push(`0 -${lineHeight} Td`);
      textCommands.push(`(${escapePdfText(line)}) Tj`);
    });

    textCommands.push('ET');
    const stream = textCommands.join('\n');

    objects.push(
      `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`
    );

    objId += 2;
  }

  const fontObjectId = 99;
  objects.push(`${fontObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

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

  return Buffer.from(header + body + trailer, 'utf8');
}

export function generateRepertoirePdfBuffer(payload = {}) {
  const lines = buildRepertoireLines(payload);
  return buildPdfFromLines(lines);
}
