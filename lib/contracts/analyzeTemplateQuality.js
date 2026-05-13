import { CONTRACT_TAGS, getRequiredContractTags } from '@/lib/contracts/contractTagsRegistry';

function normalizeContent(content) {
  return String(content || '');
}

export function extractContractTags(content = '') {
  const normalized = normalizeContent(content);
  const found = new Set();

  CONTRACT_TAGS.forEach((tag) => {
    if (normalized.includes(tag.tag)) {
      found.add(tag.key);
    }
  });

  return Array.from(found);
}

export function analyzeTemplateQuality(content = '') {
  const normalized = normalizeContent(content);

  const foundTags = extractContractTags(normalized);

  const requiredTags = getRequiredContractTags();

  const missingRequiredTags = requiredTags.filter(
    (tag) => !foundTags.includes(tag.key),
  );

  const duplicatedTags = CONTRACT_TAGS.filter((tag) => {
    const occurrences = normalized.split(tag.tag).length - 1;
    return occurrences > 1;
  }).map((tag) => ({
    key: tag.key,
    tag: tag.tag,
  }));

  const categoryCoverage = {};

  CONTRACT_TAGS.forEach((tag) => {
    if (!categoryCoverage[tag.category]) {
      categoryCoverage[tag.category] = {
        total: 0,
        present: 0,
      };
    }

    categoryCoverage[tag.category].total += 1;

    if (foundTags.includes(tag.key)) {
      categoryCoverage[tag.category].present += 1;
    }
  });

  const recommendations = [];

  if (missingRequiredTags.length > 0) {
    recommendations.push({
      type: 'missing_required_tags',
      severity: 'high',
      title: 'Seu contrato ainda possui campos obrigatórios ausentes.',
      description: 'Adicione tags essenciais para que o fluxo automático funcione corretamente.',
      items: missingRequiredTags.map((tag) => ({
        key: tag.key,
        label: tag.label,
        tag: tag.tag,
      })),
    });
  }

  if (duplicatedTags.length > 0) {
    recommendations.push({
      type: 'duplicated_tags',
      severity: 'medium',
      title: 'Existem tags repetidas no contrato.',
      description: 'Revise se todas as ocorrências são realmente necessárias.',
      items: duplicatedTags,
    });
  }

  const totalRequired = requiredTags.length;
  const presentRequired = totalRequired - missingRequiredTags.length;

  const qualityScore = totalRequired > 0
    ? Math.max(0, Math.round((presentRequired / totalRequired) * 100))
    : 100;

  return {
    qualityScore,
    foundTags,
    missingRequiredTags,
    duplicatedTags,
    categoryCoverage,
    recommendations,
    isReadyForAutomation: missingRequiredTags.length === 0,
  };
}
