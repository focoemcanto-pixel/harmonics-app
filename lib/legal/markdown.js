// Parser mínimo para os documentos legais (subconjunto: #/## títulos, parágrafos, listas "- ",
// tabelas "|", **negrito** e [link](url)). Conteúdo é nosso (docs/legal); saída é estrutura, não HTML.
export function parseInline(text) {
  const parts = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) });
    if (match[1]) parts.push({ type: 'strong', value: match[1] });
    else parts.push({ type: 'link', value: match[2], href: match[3] });
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

export function parseMarkdown(markdown) {
  const blocks = [];
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, inline: parseInline(heading[2]) }); i += 1; continue; }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(parseInline(lines[i].slice(2))); i += 1; }
      blocks.push({ type: 'list', items });
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
        if (!cells.every((cell) => /^-+$/.test(cell))) rows.push(cells.map(parseInline));
        i += 1;
      }
      blocks.push({ type: 'table', header: rows[0] || [], rows: rows.slice(1) });
      continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|- |\s*\|)/.test(lines[i])) { paragraph.push(lines[i]); i += 1; }
    blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) });
  }
  return blocks;
}
