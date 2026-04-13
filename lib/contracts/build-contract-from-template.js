import { getContractTemplate } from './get-contract-template';
import { resolveBlocksVariables, validateResolvedVariables } from './resolve-template-variables';

function evaluateSingleCondition(condition, sourceData) {
  const { field, operator, value } = condition;
  if (!field || !operator) return true;
  const fieldValue = sourceData[field];

  switch (operator) {
    case 'equals': return fieldValue === value;
    case 'notEquals': return fieldValue !== value;
    case 'greaterThan': return parseFloat(fieldValue) > parseFloat(value);
    case 'lessThan': return parseFloat(fieldValue) < parseFloat(value);
    case 'greaterThanOrEqual': return parseFloat(fieldValue) >= parseFloat(value);
    case 'lessThanOrEqual': return parseFloat(fieldValue) <= parseFloat(value);
    case 'contains': return String(fieldValue).includes(String(value));
    case 'notContains': return !String(fieldValue).includes(String(value));
    case 'startsWith': return String(fieldValue).startsWith(String(value));
    case 'endsWith': return String(fieldValue).endsWith(String(value));
    case 'exists': return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'notExists': return !fieldValue || fieldValue === '';
    case 'in': return Array.isArray(value) && value.includes(fieldValue);
    case 'notIn': return Array.isArray(value) && !value.includes(fieldValue);
    default:
      console.warn(`[Contract Builder] Unknown operator: ${operator}`);
      return true;
  }
}

function evaluateBlockConditions(conditions, sourceData) {
  if (!conditions) return true;

  try {
    if (conditions.field && conditions.operator) {
      return evaluateSingleCondition(conditions, sourceData);
    }

    if (Array.isArray(conditions.conditions)) {
      const { conditions: conditionsList, logic } = conditions;
      const results = conditionsList.map((cond) => evaluateSingleCondition(cond, sourceData));

      if (logic === 'OR') {
        return results.some((r) => r === true);
      }
      return results.every((r) => r === true);
    }

    console.warn('[Contract Builder] Invalid conditions format:', conditions);
    return true;
  } catch (error) {
    console.error('[Contract Builder] Error evaluating conditions:', error);
    return true;
  }
}

function filterBlocksByConditions(blocks, sourceData) {
  return blocks.filter((block) => {
    if (!block.conditions_json) return true;
    return evaluateBlockConditions(block.conditions_json, sourceData);
  });
}

export async function buildContractFromTemplate(templateId, sourceData, options = {}) {
  const { strictValidation = false } = options;

  if (!templateId) throw new Error('[Contract Builder] templateId is required');
  if (!sourceData) throw new Error('[Contract Builder] sourceData is required');

  try {
    const { template, blocks, variables } = await getContractTemplate(templateId);
    if (!blocks || blocks.length === 0) throw new Error('[Contract Builder] Template has no blocks');

    const filteredBlocks = filterBlocksByConditions(blocks, sourceData);
    if (filteredBlocks.length === 0) throw new Error('[Contract Builder] No blocks match conditions');

    const resolvedBlocks = resolveBlocksVariables(filteredBlocks, sourceData, variables);

    const contractParts = resolvedBlocks.map((block, index) => {
      let part = '';
      if (block.title && block.title.trim()) {
        part += `${block.title}\n\n`;
      }
      part += block.content;

      switch (block.block_type) {
        case 'header':
          part += '\n\n';
          break;
        case 'footer':
          if (index < resolvedBlocks.length - 1) {
            part += '\n\n';
          }
          break;
        case 'standard':
        default:
          if (index < resolvedBlocks.length - 1) {
            part += '\n\n---\n\n';
          }
          break;
      }
      return part;
    });

    const finalContent = contractParts.join('').trim();
    const validation = validateResolvedVariables(finalContent);

    if (strictValidation && !validation.isValid) {
      throw new Error(
        `[Contract Builder] Missing required variables: ${validation.missingVariables.join(', ')}`
      );
    }

    if (!validation.isValid) {
      console.warn('[Contract Builder] Missing variables:', validation.missingVariables);
    }

    return {
      content: finalContent,
      metadata: {
        templateId: template.id,
        templateName: template.name,
        generatedAt: new Date().toISOString(),
        blocksUsed: resolvedBlocks.length,
        totalBlocks: blocks.length,
        validation,
      },
    };
  } catch (error) {
    console.error('[Contract Builder] Error in buildContractFromTemplate:', error);
    throw error;
  }
}

export async function previewContractFromTemplate(templateId, sourceData) {
  const { content, metadata } = await buildContractFromTemplate(templateId, sourceData);
  return { content, metadata, preview: true };
}
