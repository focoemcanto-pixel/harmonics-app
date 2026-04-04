import { resolveStandardVariable } from './variable-mappers';

export function resolveTemplateVariables(text, sourceData, variables = []) {
  if (!text) return '';
  let resolvedText = text;
  const variableRegex = /\{\{([a-z_][a-z0-9_]*)\}\}/gi;

  resolvedText = resolvedText.replace(variableRegex, (match, variableKey) => {
    const variableDef = variables.find((v) => v.variable_key === variableKey);
    const fallback = variableDef?.fallback_value || match;
    const resolved = resolveStandardVariable(variableKey, sourceData, fallback);
    return resolved;
  });

  return resolvedText;
}

export function resolveBlocksVariables(blocks, sourceData, variables = []) {
  if (!Array.isArray(blocks)) {
    console.warn('[Contract Builder] blocks is not an array');
    return [];
  }
  return blocks.map((block) => ({
    ...block,
    content: resolveTemplateVariables(block.content, sourceData, variables),
    title: resolveTemplateVariables(block.title, sourceData, variables),
  }));
}

export function validateResolvedVariables(text) {
  const variableRegex = /\{\{([a-z_][a-z0-9_]*)\}\}/gi;
  const matches = [];
  let match;
  while ((match = variableRegex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return {
    isValid: matches.length === 0,
    missingVariables: [...new Set(matches)],
  };
}
