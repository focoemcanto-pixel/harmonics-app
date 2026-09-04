export function renderTemplate(template, context) {
  if (!template) return '';

  const source = String(template);

  // Suporta os dois formatos usados historicamente na Central de Automação:
  // {{variavel}} (UI/templates editáveis) e {variavel} (legado).
  // Processa primeiro chaves duplas para evitar sobrar "{...}" no resultado.
  const withDoubleBraces = source.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return context?.[key] ?? match;
  });

  return withDoubleBraces.replace(/\{(\w+)\}/g, (match, key) => {
    return context?.[key] ?? match;
  });
}
