// Normaliza HTML colado (Google Docs, Word, páginas web) para a estrutura semântica que o
// contrato usa: títulos, parágrafos, negrito/itálico/sublinhado, listas, separadores, quebras
// de linha e tabelas simples. Descarta fonte, cor, fundo, tamanhos e classes externas.
// O texto é copiado como está: placeholders {{...}} e condicionais {{#X}}...{{/X}} nunca
// são reescritos (eles vivem em nós de texto, que só são concatenados).

const DROP_TAGS = new Set(['script', 'style', 'meta', 'link', 'title', 'head', 'xml', 'template', 'noscript', 'iframe', 'object', 'embed', 'svg', 'img', 'video', 'audio', 'canvas', 'form', 'input', 'button', 'select', 'textarea']);
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'hr', 'section', 'article', 'header', 'footer', 'main', 'aside', 'center', 'address', 'dl', 'dt', 'dd', 'figure', 'figcaption']);
const ALIGNMENTS = new Set(['center', 'right', 'justify']);
const LIST_STYLE_BY_TYPE = { a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' };

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

  // `inheritedAlign`: alinhamento de um contêiner desembrulhado, herdado pelos blocos filhos.
  function walk(node, marks = [], inheritedAlign = null) {
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
      // <caption> (título da tabela) vira parágrafo logo antes dela: o contrato não usa caption.
      const caption = Array.from(node.children).find((child) => child.tagName.toLowerCase() === 'caption');
      if (caption && caption.textContent.trim()) {
        const title = doc.createElement('p');
        const align = alignmentOf(caption);
        if (align) title.setAttribute('style', `text-align: ${align}`);
        out.appendChild(title);
        appendInline(title, caption, marks);
        cleanupBlock(title);
      }
      const table = doc.createElement('table');
      out.appendChild(table);
      node.querySelectorAll('tr').forEach((row) => {
        const tr = doc.createElement('tr');
        table.appendChild(tr);
        row.querySelectorAll('td,th').forEach((cell) => {
          const td = doc.createElement(cell.tagName.toLowerCase());
          const cellAlign = alignmentOf(cell);
          if (cellAlign) td.setAttribute('style', `text-align: ${cellAlign}`);
          ['colspan', 'rowspan'].forEach((name) => {
            const span = Number.parseInt(cell.getAttribute(name), 10);
            if (Number.isInteger(span) && span > 1 && span <= 100) td.setAttribute(name, String(span));
          });
          tr.appendChild(td);
          cell.childNodes.forEach((child) => appendInlineBlock(td, child, marks));
          while (td.lastChild?.nodeName === 'BR') td.lastChild.remove();
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
        const containerAlign = (tag === 'center' ? 'center' : alignmentOf(node)) || inheritedAlign;
        node.childNodes.forEach((child) => walk(child, marks, containerAlign));
        closeBlock();
        return;
      }
      closeBlock();
      const block = doc.createElement(level ? `h${level}` : 'p');
      const align = tag === 'center' ? 'center' : (alignmentOf(node) || inheritedAlign);
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
        const align = alignmentOf(node) || inheritedAlign;
        if (align) block.setAttribute('style', `text-align: ${align}`);
        out.appendChild(block);
        appendInline(block, node, marks);
        cleanupBlock(block);
      } else {
        const containerAlign = (tag === 'center' ? 'center' : alignmentOf(node)) || inheritedAlign;
        node.childNodes.forEach((child) => walk(child, marks, containerAlign));
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
    if ((tag === 'u' || /underline/.test(style['text-decoration'] || '')) && !next.includes('u')) next = [...next, 'u'];
    const containsBlocks = node.querySelector && node.querySelector(Array.from(BLOCK_TAGS).join(','));
    // Wrapper que envolve blocos (Google Docs) não deve deixar tudo em negrito.
    if (containsBlocks && (tag === 'b' || tag === 'strong')) next = marks;
    node.childNodes.forEach((child) => walk(child, next, inheritedAlign));
  }

  // Lista HTML preservando aninhamento: <ul>/<ol> dentro de <li> (ou irmão direto de <li>,
  // como o Google Docs emite) vira sublista do item anterior, em vez de ser achatada.
  function buildList(source, marks) {
    const list = doc.createElement(source.tagName.toLowerCase());
    if (list.tagName === 'OL') {
      // list-style-type do CSS vence o atributo type, como no navegador de origem.
      setOrderedNumbering(list, typeFromListStyle(source) || source.getAttribute('type'), source.getAttribute('start'));
      if (source.hasAttribute('reversed')) list.setAttribute('reversed', '');
    }
    source.childNodes.forEach((child) => {
      if (child.nodeType !== 1) return;
      const childTag = child.tagName.toLowerCase();
      if (childTag === 'li') {
        const li = doc.createElement('li');
        const value = Number.parseInt(child.getAttribute('value'), 10);
        if (list.tagName === 'OL' && Number.isInteger(value) && value > 0) li.setAttribute('value', String(value));
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
      else appendInlineBlock(li, child, marks);
    });
    while (li.lastChild?.nodeName === 'BR') li.lastChild.remove();
  }

  // Conteúdo de célula/item de lista: parágrafos internos viram linhas separadas por <br>,
  // em vez de terem o texto fundido.
  function appendInlineBlock(target, child, marks) {
    const childTag = child.nodeType === 1 ? child.tagName.toLowerCase() : '';
    if (childTag === 'ul' || childTag === 'ol') {
      target.appendChild(buildList(child, marks));
      return;
    }
    const isBlock = child.nodeType === 1 && BLOCK_TAGS.has(child.tagName.toLowerCase()) && child.tagName.toLowerCase() !== 'br';
    if (isBlock && target.textContent.trim() && target.lastChild?.nodeName !== 'BR') target.appendChild(doc.createElement('br'));
    // Word põe o alinhamento no <p> dentro da célula/item; ele passa para a célula/item reconstruído.
    const blockAlign = isBlock ? alignmentOf(child) : null;
    if (blockAlign && !target.getAttribute('style')) target.setAttribute('style', `text-align: ${blockAlign}`);
    appendInline(target, child, marks);
  }

  // Numeração de <ol>: só tipo (1, a, A, i, I) e início positivo, que o PDF também respeita.
  function setOrderedNumbering(list, type, start) {
    if (type && /^[1aAiI]$/.test(type) && type !== '1') {
      list.setAttribute('type', type);
      // O estilo explícito vence o reset de listas do CSS do app, para editor e prévia seguirem o PDF.
      list.setAttribute('style', `list-style-type: ${LIST_STYLE_BY_TYPE[type]}`);
    }
    const n = Number.parseInt(start, 10);
    if (Number.isInteger(n) && n > 1) list.setAttribute('start', String(n));
  }

  // <ol style="list-style-type: lower-alpha"> (ou no atalho list-style) -> type equivalente.
  function typeFromListStyle(source) {
    const style = styleOf(source);
    const value = `${style['list-style-type'] || ''} ${style['list-style'] || ''}`;
    if (/\b(lower-alpha|lower-latin)\b/.test(value)) return 'a';
    if (/\b(upper-alpha|upper-latin)\b/.test(value)) return 'A';
    if (/\blower-roman\b/.test(value)) return 'i';
    if (/\bupper-roman\b/.test(value)) return 'I';
    return null;
  }

  // Marcador do Word ("5.", "e)", "iv.") -> tipo e valor da numeração; null para símbolos.
  // `contextType`: tipo da lista Word em curso no mesmo nível. Resolve marcadores de uma letra
  // que valem nos dois sistemas ("i." numa lista a, b, c… é alfabético; "v." numa lista i, ii… é romano).
  function wordMarkerNumbering(text, contextType = null) {
    // "1.", "a)", "iv." e também a forma jurídica entre parênteses: "(1)", "(a)".
    const match = /^\s*(?:\((\d+|[a-z]+)\)|(\d+|[a-z]+)[.)])/i.exec(text || '');
    if (!match) return null;
    const token = match[1] || match[2];
    if (/^\d+$/.test(token)) return { type: '1', value: Number(token) };
    const romanLetters = /^[ivxlcdm]+$/i.test(token);
    const ambiguous = romanLetters && token.length === 1;
    const preferRoman = ambiguous && contextType ? /^[iI]$/.test(contextType) : /^i$/i.test(token);
    const alphaContext = /^[aA]$/.test(contextType || '');
    if (romanLetters && (token.length > 1 ? !alphaContext : preferRoman)) {
      const values = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
      const digits = token.toLowerCase().split('').map((c) => values[c]);
      const value = digits.reduce((sum, v, i) => sum + (v < (digits[i + 1] || 0) ? -v : v), 0);
      return { type: token === token.toLowerCase() ? 'i' : 'I', value };
    }
    if (token.length === 1) return { type: token === token.toLowerCase() ? 'a' : 'A', value: token.toLowerCase().charCodeAt(0) - 96 };
    // Lista alfabética que passou de "z": "aa.", "ab."… (base 26, como o Word numera).
    if (alphaContext && /^[a-z]+$/i.test(token)) {
      const value = token.toLowerCase().split('').reduce((sum, c) => sum * 26 + (c.charCodeAt(0) - 96), 0);
      return { type: contextType, value };
    }
    return null;
  }

  // Sem lista em curso (seleção que começa no meio de uma lista em "v." ou "i."), o tipo vem dos
  // próximos itens do mesmo nível: "vi." indica romano; uma letra fora dos romanos, alfabético.
  function peekWordListType(node, id, level) {
    let sibling = node.nextElementSibling;
    for (let i = 0; sibling && i < 5 && isWordListParagraph(sibling); i += 1, sibling = sibling.nextElementSibling) {
      const style = String(sibling.getAttribute('style') || '');
      const msoList = /mso-list\s*:\s*(l\d+)?[^;]*?level(\d+)/i.exec(style);
      const siblingId = `${msoList?.[1] || ''}:${/mso-list\s*:[^;]*\b(lfo\d+)/i.exec(style)?.[1] || ''}`;
      if (siblingId !== id || (msoList ? Number(msoList[2]) : 1) !== level) continue;
      const text = Array.from(sibling.querySelectorAll('span')).find(isWordListMarker)?.textContent || '';
      const token = /^\s*(?:\(([a-z]+)\)|([a-z]+)[.)])/i.exec(text);
      const letters = token?.[1] || token?.[2];
      if (!letters) return null;
      const upper = letters === letters.toUpperCase();
      if (/^[ivxlcdm]+$/i.test(letters)) {
        if (letters.length > 1) return upper ? 'I' : 'i';
      } else {
        return upper ? 'A' : 'a';
      }
    }
    return null;
  }

  // Word exporta listas como parágrafos MsoListParagraph com "mso-list: lN levelM" e o
  // marcador (número ou símbolo) num span mso-list:Ignore. Recompõe <ol>/<ul> e os níveis;
  // outra lista (lN) ou outro tipo de marcador no mesmo nível abre uma lista nova.
  let wordStack = [];
  function appendWordListItem(node, marks) {
    const marker = Array.from(node.querySelectorAll('span')).find(isWordListMarker);
    // Numeração composta ("1.1.", "2.3.1"): listas HTML não a representam. O número da cláusula
    // é mantido como texto no início do parágrafo, igual no editor, na prévia e no PDF.
    const compound = /^\s*(\d+(?:\.\d+)+\.?)/.exec(marker?.textContent || '');
    if (compound) {
      const block = doc.createElement('p');
      out.appendChild(block);
      block.appendChild(doc.createTextNode(`${compound[1]} `));
      appendInline(block, node, marks);
      cleanupBlock(block);
      return;
    }
    const style = String(node.getAttribute('style') || '');
    const msoList = /mso-list\s*:\s*(l\d+)?[^;]*?level(\d+)/i.exec(style);
    // lN é a definição da lista; lfoN distingue instâncias (uma lista que reinicia a numeração).
    const id = `${msoList?.[1] || ''}:${/mso-list\s*:[^;]*\b(lfo\d+)/i.exec(style)?.[1] || ''}`;
    const level = msoList ? Number(msoList[2]) : 1;
    const continuing = wordStack.length && wordStack[0].list === out.lastElementChild && wordStack[0].id === id;
    const contextKind = continuing ? wordStack.find((entry) => entry.level === level)?.kind : null;
    const contextType = contextKind?.startsWith('ol:') ? contextKind.slice(3) : peekWordListType(node, id, level);
    const numbering = wordMarkerNumbering(marker?.textContent, contextType);
    const tag = numbering ? 'ol' : 'ul';
    const kind = numbering ? `ol:${numbering.type}` : 'ul';
    const createList = (parent) => {
      const list = doc.createElement(tag);
      if (numbering) setOrderedNumbering(list, numbering.type, numbering.value);
      parent.appendChild(list);
      return { list, level, kind };
    };
    if (!continuing) {
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
    // Sequência pulada ou retomada no Word ("1., 3., 4."): o item recebe o valor explícito.
    if (numbering && top.list.tagName === 'OL') {
      const start = Number(top.list.getAttribute('start') || 1);
      let expected = start;
      Array.from(top.list.children).forEach((item) => {
        if (item.tagName !== 'LI') return;
        expected = item.hasAttribute('value') ? Number(item.getAttribute('value')) + 1 : expected + 1;
      });
      if (numbering.value > 0 && numbering.value !== expected) li.setAttribute('value', String(numbering.value));
    }
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

  // Fragmento só com conteúdo inline (ex.: uma palavra em negrito): é colado no cursor, sem
  // virar parágrafo novo que quebraria a frase em que está sendo inserido.
  const blockSelector = Array.from(BLOCK_TAGS).filter((name) => name !== 'br').join(',');
  const inlineOnly = !doc.body.querySelector(blockSelector);

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
  if (inlineOnly && Array.from(out.children).every((el) => el.tagName === 'P' && !el.getAttribute('style'))) {
    const lines = Array.from(out.children).map((el) => el.innerHTML);
    out.innerHTML = lines.join('<br>');
  }

  const rejoined = out.innerHTML.replace(/\{\{(?:[^{}<]|<[^>]*>)*?\}\}/g, (token) => token.replace(/<[^>]*>/g, ''));
  if (rejoined !== out.innerHTML) out.innerHTML = rejoined;
  return out.innerHTML;
}

const PLACEHOLDER_PATTERN = /\{\{\s*[#/]?\s*[A-Za-z0-9_]+\s*\}\}/g;

/** Lista de placeholders/condicionais na ordem em que aparecem (para conferir que nada se perdeu). */
export function extractContractTokens(value) {
  return String(value || '').match(PLACEHOLDER_PATTERN) || [];
}
