export function getCompletedMilestoneKeys(experience = {}) {
  return (experience.milestones || [])
    .filter((milestone) => milestone.completed)
    .map((milestone) => milestone.key);
}

export function diffCompletedMilestones(previousKeys = [], nextExperience = {}) {
  const previous = new Set(previousKeys || []);
  return (nextExperience.milestones || []).filter(
    (milestone) => milestone.completed && !previous.has(milestone.key),
  );
}

export function buildMilestoneToastMessage(milestone) {
  if (!milestone) return null;
  return `🎉 ${milestone.title}: ${milestone.reward}`;
}

export function buildReadinessToastMessage(readiness) {
  if (!readiness) return null;

  const messages = {
    operational: '✨ Seu contrato já possui uma estrutura operacional básica.',
    automated: '🚀 Seu contrato já está pronto para automação comercial.',
    premium: '🏆 Seu contrato chegou ao nível premium de operação.',
  };

  return messages[readiness.key] || null;
}
