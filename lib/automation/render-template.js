export function renderTemplate(template, context) {
  if (!template) return '';

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return context[key] ?? `{${key}}`;
  });
}
