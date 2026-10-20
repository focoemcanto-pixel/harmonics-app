// <ol type="a|A|i|I"> perde o marcador no app: o reset de listas do CSS vence o atributo, e
// seletores [type] não distinguem maiúsculas de minúsculas. Este ajuste (só de exibição, no
// editor e nas prévias) acrescenta o list-style-type equivalente, como o PDF já mostra pelo type.
const LIST_STYLE_BY_TYPE = { a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' };

export function withOrderedListMarkers(html) {
  return String(html || '').replace(/<ol\b([^>]*)>/gi, (tag, attrs) => {
    const type = /\stype\s*=\s*(["']?)([aAiI])\1(?=[\s>/]|$)/.exec(attrs)?.[2];
    if (!type) return tag;
    const styleMatch = /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(attrs);
    if (styleMatch && /list-style(-type)?\s*:/i.test(styleMatch[2])) return tag;
    const rule = `list-style-type: ${LIST_STYLE_BY_TYPE[type]}`;
    if (!styleMatch) return `<ol${attrs} style="${rule}">`;
    const [whole, quote, value] = styleMatch;
    const merged = `${value.trim().replace(/;?\s*$/, '')}${value.trim() ? '; ' : ''}${rule}`;
    return `<ol${attrs.replace(whole, ` style=${quote}${merged}${quote}`)}>`;
  });
}
