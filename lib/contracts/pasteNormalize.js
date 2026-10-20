// Normaliza HTML colado (Google Docs, Word, páginas web) para a estrutura semântica que o
// contrato usa: títulos, parágrafos, negrito/itálico/sublinhado, listas, separadores, quebras
// de linha e tabelas simples. Descarta fonte, cor, fundo, tamanhos e classes externas.
// O texto é copiado como está: placeholders {{...}} e condicionais {{#X}}...{{/X}} nunca
// são reescritos (eles vivem em nós de texto, que só são concatenados).

const DROP_TAGS = new Set(['script', 'style', 'meta', 'link', 'title', 'head', 'xml', 'template', 'noscript', 'iframe', 'object', 'embed', 'svg', 'img', 'video', 'audio', 'canvas', 'form', 'input', 'button', 'select', 'textarea']);
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'hr', 'section', 'article', 'header', 'footer', 'main', 'aside', 'center', 'address', 'dl', 'dt', 'dd', 'figure', 'figcaption']);
const ALIGNMENTS = new Set(['center', 'right', 'justify']);

function styleOf(el) {
  const map = {};
  String(el.getAttribute?.('style') || '').split(';').forEach((part) => {
    const index = part.indexOf(':');
    if (index < 0) return;
    map[part.slice(0, index).trim().toLowerCase()] = part.slice(index + 1).trim().toLowerCase();
  });
  return map;
}

function isBoldWeight(value) {
  if (!value) return null;
  if (value === 'bold' || value === 'bolder') return true;
  if (value === 'normal' || value === 'lighter') return false;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n >= 600 : null;
}

function alignmentOf(el) {
  const style = styleOf(el);
  const value = style['text-align'] || String(el.getAttribute?.('align') || '').toLowerCase();
  return ALIGNMENTS.has(value) ? value : null;
}

function headingLevelOf(el) {
  const tag = el.tagName.toLowerCase();
  const cls = String(el.getAttribute?.('class') || '');
  if (tag === 'h1' || /\bMsoTitle\b/.test(cls)) return 1;
  if (tag === 'h2' || /\bMsoHeading1\b|\bMsoSubtitle\b/i.test(cls) || /heading\s*1/i.test(cls)) return 2;
  if (/^h[3-6]$/.test(tag) || /\bMsoHeading[2-6]\b/i.test(cls)) return 3;
  return 0;
}

function isWordListParagraph(el) {
  return el.tagName?.toLowerCase() === 'p' && /\bMsoListParagraph/i.test(String(el.getAttribute('class') || ''));
}

function isWordListMarker(node) {
  return node.nodeType === 1 && /mso-list\s*:\s*ignore/i.test(String(node.getAttribute('style') || ''));
}

/**
 * Converte HTML colado em HTML limpo do contrato.
 * @param {string} html
 * @param {{ parse?: (html: string) => Document }} [options] parser opcional (testes)
 */
export function normalizePastedContractHtml(html, options = {}) {
  const source = String(html || '');
  if (!source.trim()) return '';
  const parse = options.parse || ((value) => new DOMParser().parseFromString(value, 'text/html'));
  const doc = parse(source);
  const out = doc.createElement('div');

  // Pilha de blocos: o bloco atual recebe o conteúdo inline.
  let currentBlock = null;
  const ensureBlock = () => {
    if (!currentBlock) {
      currentBlock = doc.createElement('p');
      out.appendChild(currentBlock);
    }
    return currentBlock;
  };
  const closeBlock = () => {
    currentBlock = null;
  };

  function appendInline(target, node, marks) {
    if (node.nodeType === 3) {
      const text = node.nodeValue;
      if (!text) return;
      let parent = target;
      for (const mark of marks) {
        const wrapper = doc.createElement(mark);
        parent.appendChild(wrapper);
        parent = wrapper;
      }
      parent.appendChild(doc.createTextNode(text));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (DROP_TAGS.has(tag) || tag.includes(':') || isWordListMarker(node)) return;
    if (tag === 'br') {
      target.appendChild(doc.createElement('br'));
      return;
    }
    const style = styleOf(node);
    let next = marks;
    const weight = isBoldWeight(style['font-weight']);
    const bold = (tag === 'b' || tag === 'strong') ? weight !== false : weight === true;
    if (bold && !next.includes('strong')) next = [...next, 'strong'];
    if (weight === false && (tag === 'b' || tag === 'strong')) next = next.filter((m) => m !== 'strong');
    const italic = tag === 'i' || tag === 'em' || style['font-style'] === 'italic';
    if (italic && !next.includes('em')) next = [...next, 'em'];
    const underline = tag === 'u' || /underline/.test(style['text-decoration'] || '');
    if (underline && !next.includes('u')) next = [...next, 'u'];
    node.childNodes.forEach((child) => appendInline(target, child, next));
  }

  function walk(node, marks = []) {
    if (node.nodeType === 3) {
      if (!node.nodeValue || (!currentBlock && !node.nodeValue.trim())) return;
      appendInline(ensureBlock(), node, marks);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (DROP_TAGS.has(tag) || tag.includes(':')) return;

    if (tag === 'hr') {
      closeBlock();
      out.appendChild(doc.createElement('hr'));
      return;
    }
    if (tag === 'br') {
      // <br> solto entre blocos (Google Docs) vira espaçamento; dentro de parágrafo, quebra de linha.
      if (currentBlock) currentBlock.appendChild(doc.createElement('br'));
      else out.appendChild(doc.createElement('p')).appendChild(doc.createElement('br'));
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      closeBlock();
      out.appendChild(buildList(node, marks));
      closeBlock();
      return;
    }

    if (tag === 'table') {
      closeBlock();
      const table = doc.createElement('table');
      out.appendChild(table);
      node.querySelectorAll('tr').forEach((row) => {
        const tr = doc.createElement('tr');
        table.appendChild(tr);
        row.querySelectorAll('td,th').forEach((cell) => {
          const td = doc.createElement(cell.tagName.toLowerCase());
          tr.appendChild(td);
          appendInline(td, cell, marks);
        });
      });
      closeBlock();
      return;
    }

    if (isWordListParagraph(node)) {
      closeBlock();
      appendWordListItem(node, marks);
      return;
    }

    const level = headingLevelOf(node);
    if (level || tag === 'p' || tag === 'li' || tag === 'blockquote' || tag === 'pre' || tag === 'center' || tag === 'address' || tag === 'dt' || tag === 'dd' || tag === 'figcaption') {
      // Bloco que contém outros blocos (ex.: <div><p>..</p></div>, <b> do Google Docs) é desembrulhado.
      const hasBlockChild = Array.from(node.children).some((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()) && child.tagName.toLowerCase() !== 'br');
      if (hasBlockChild && !level) {
        closeBlock();
        node.childNodes.forEach((child) => walk(child, marks));
        closeBlock();
        return;
      }
      closeBlock();
      const block = doc.createElement(level ? `h${level}` : 'p');
      const align = tag === 'center' ? 'center' : alignmentOf(node);
      if (align) block.setAttribute('style', `text-align: ${align}`);
      out.appendChild(block);
      // Títulos não carregam negrito do documento de origem (o estilo do título já é forte).
      appendInline(block, node, level ? [] : marks);
      if (level) block.querySelectorAll('strong').forEach((s) => s.replaceWith(...s.childNodes));
      cleanupBlock(block);
      closeBlock();
      return;
    }

    if (BLOCK_TAGS.has(tag)) {
      // div/section/etc.: contêiner. Se só tem inline, vira parágrafo; senão desembrulha.
      const hasBlockChild = Array.from(node.children).some((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()));
      closeBlock();
      if (!hasBlockChild) {
        const block = doc.createElement('p');
        const align = alignmentOf(node);
        if (align) block.setAttribute('style', `text-align: ${align}`);
        out.appendChild(block);
        appendInline(block, node, marks);
        cleanupBlock(block);
      } else {
        node.childNodes.forEach((child) => walk(child, marks));
      }
      closeBlock();
      return;
    }

    // Inline fora de bloco (ex.: <b> wrapper do Google Docs, <span>): mantém marcas e continua.
    const style = styleOf(node);
    let next = marks;
    const weight = isBoldWeight(style['font-weight']);
    if ((tag === 'b' || tag === 'strong') && weight !== false) next = next.includes('strong') ? next : [...next, 'strong'];
    else if (weight === true && !next.includes('strong')) next = [...next, 'strong'];
    if ((tag === 'i' || tag === 'em' || style['font-style'] === 'italic') && !next.includes('em')) next = [...next, 'em'];
    const containsBlocks = node.querySelector && node.querySelector(Array.from(BLOCK_TAGS).join(','));
    // Wrapper que envolve blocos (Google Docs) não deve deixar tudo em negrito.
    if (containsBlocks && (tag === 'b' || tag === 'strong')) next = marks;
    node.childNodes.forEach((child) => walk(child, next));
  }

  // Lista HTML preservando aninhamento: <ul>/<ol> dentro de <li> (ou irmão direto de <li>,
  // como o Google Docs emite) vira sublista do item anterior, em vez de ser achatada.
  function buildList(source, marks) {
    const list = doc.createElement(source.tagName.toLowerCase());
    if (list.tagName === 'OL') setOrderedNumbering(list, source.getAttribute('type'), source.getAttribute('start'));
    source.childNodes.forEach((child) => {
      if (child.nodeType !== 1) return;
      const childTag = child.tagName.toLowerCase();
      if (childTag === 'li') {
        const li = doc.createElement('li');
        list.appendChild(li);
        appendListItem(li, child, marks);
        cleanupBlock(li);
      } else if (childTag === 'ul' || childTag === 'ol') {
        (list.lastElementChild || list).appendChild(buildList(child, marks));
      }
    });
    return list;
  }

  function appendListItem(li, source, marks) {
    source.childNodes.forEach((child) => {
      const childTag = child.nodeType === 1 ? child.tagName.toLowerCase() : '';
      if (childTag === 'ul' || childTag === 'ol') li.appendChild(buildList(child, marks));
      else if (child.nodeType === 1 && child.querySelector?.('ul,ol') && !DROP_TAGS.has(childTag)) appendListItem(li, child, marks);
      else appendInline(li, child, marks);
    });
  }

  // Numeração de <ol>: só tipo (1, a, A, i, I) e início positivo, que o PDF também respeita.
  function setOrderedNumbering(list, type, start) {
    if (type && /^[1aAiI]$/.test(type) && type !== '1') list.setAttribute('type', type);
    const n = Number.parseInt(start, 10);
    if (Number.isInteger(n) && n > 1) list.setAttribute('start', String(n));
  }

  // Marcador do Word ("5.", "e)", "iv.") -> tipo e valor da numeração; null para símbolos.
  function wordMarkerNumbering(text) {
    const match = /^\s*(\d+|[a-z]+)[.)]/i.exec(text || '');
    if (!match) return null;
    const token = match[1];
    if (/^\d+$/.test(token)) return { type: '1', value: Number(token) };
    if (/^[ivxlcdm]+$/i.test(token) && (token.length > 1 || /^i$/i.test(token))) {
      const values = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
      const digits = token.toLowerCase().split('').map((c) => values[c]);
      const value = digits.reduce((sum, v, i) => sum + (v < (digits[i + 1] || 0) ? -v : v), 0);
      return { type: token === token.toLowerCase() ? 'i' : 'I', value };
    }
    if (token.length === 1) return { type: token === token.toLowerCase() ? 'a' : 'A', value: token.toLowerCase().charCodeAt(0) - 96 };
    return null;
  }

  // Word exporta listas como parágrafos MsoListParagraph com "mso-list: lN levelM" e o
  // marcador (número ou símbolo) num span mso-list:Ignore. Recompõe <ol>/<ul> e os níveis;
  // outra lista (lN) ou outro tipo de marcador no mesmo nível abre uma lista nova.
  let wordStack = [];
  function appendWordListItem(node, marks) {
    const marker = Array.from(node.querySelectorAll('span')).find(isWordListMarker);
    const numbering = wordMarkerNumbering(marker?.textContent);
    const tag = numbering ? 'ol' : 'ul';
    const kind = numbering ? `ol:${numbering.type}` : 'ul';
    const msoList = /mso-list\s*:\s*(l\d+)?[^;]*?level(\d+)/i.exec(String(node.getAttribute('style') || ''));
    const id = msoList?.[1] || '';
    const level = msoList ? Number(msoList[2]) : 1;
    const createList = (parent) => {
      const list = doc.createElement(tag);
      if (numbering) setOrderedNumbering(list, numbering.type, numbering.value);
      parent.appendChild(list);
      return { list, level, kind };
    };
    if (!wordStack.length || wordStack[0].list !== out.lastElementChild || wordStack[0].id !== id) {
      wordStack = [{ ...createList(out), id }];
    }
    while (wordStack.length > 1 && wordStack[wordStack.length - 1].level > level) wordStack.pop();
    let top = wordStack[wordStack.length - 1];
    if (level > top.level) {
      top = createList(top.list.lastElementChild || top.list);
      wordStack.push(top);
    } else if (top.kind !== kind) {
      if (wordStack.length === 1) {
        wordStack = [{ ...createList(out), id }];
      } else {
        const parent = wordStack[wordStack.length - 2];
        wordStack[wordStack.length - 1] = createList(parent.list.lastElementChild || parent.list);
      }
      top = wordStack[wordStack.length - 1];
    }
    const li = doc.createElement('li');
    top.list.appendChild(li);
    appendInline(li, node, marks);
    cleanupBlock(li);
  }

  function cleanupBlock(block) {
    // Junta marcas adjacentes iguais e remove marcas vazias.
    block.querySelectorAll('strong,em,u').forEach((el) => {
      if (!el.textContent && !el.querySelector('br')) el.remove();
    });
    let changed = true;
    while (changed) {
      changed = false;
      block.querySelectorAll('strong + strong, em + em, u + u').forEach((el) => {
        const prev = el.previousSibling;
        if (prev && prev.nodeType === 1 && prev.tagName === el.tagName) {
          while (el.firstChild) prev.appendChild(el.firstChild);
          el.remove();
          changed = true;
        }
      });
    }
  }

  doc.body.childNodes.forEach((child) => walk(child));

  // Remove blocos vazios em sequência (mantém um respiro) e espaços de borda.
  const isEmptyBlock = (el) => el && /^(P|H1|H2|H3)$/.test(el.tagName) && !el.textContent.replace(/ /g, ' ').trim();
  Array.from(out.children).forEach((el) => {
    if (isEmptyBlock(el)) {
      if (/^H/.test(el.tagName)) { el.remove(); return; }
      el.innerHTML = '<br>';
      if (isEmptyBlock(el.previousElementSibling) || !el.previousElementSibling) el.remove();
    }
  });
  while (isEmptyBlock(out.lastElementChild)) out.lastElementChild.remove();

  // Placeholder dividido por formatação na origem (ex.: "{{" normal + "NOME}}" em negrito)
  // é recomposto sem marcas internas, para nunca quebrar {{...}} nem {{#X}}/{{/X}}.
  const rejoined = out.innerHTML.replace(/\{\{(?:[^{}<]|<[^>]*>)*?\}\}/g, (token) => token.replace(/<[^>]*>/g, ''));
  if (rejoined !== out.innerHTML) out.innerHTML = rejoined;
  return out.innerHTML;
}

const PLACEHOLDER_PATTERN = /\{\{\s*[#/]?\s*[A-Za-z0-9_]+\s*\}\}/g;

/** Lista de placeholders/condicionais na ordem em que aparecem (para conferir que nada se perdeu). */
export function extractContractTokens(value) {
  return String(value || '').match(PLACEHOLDER_PATTERN) || [];
}
