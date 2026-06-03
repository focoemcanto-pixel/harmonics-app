function buildMusicianMap(list) {
  const map = new Map();

  for (const item of Array.isArray(list) ? list : []) {
    const musicianId = String(item?.musician_id || '').trim();
    if (!musicianId) continue;
    map.set(musicianId, item);
  }

  return map;
}

function normalizeComparableValue(value) {
  return String(value ?? '').trim();
}

function buildComparableScaleSignature(item) {
  return JSON.stringify({
    role: normalizeComparableValue(item?.role),
    status: normalizeComparableValue(item?.status || 'pending'),
    notes: normalizeComparableValue(item?.notes),
  });
}

function hasScaleAssignmentChanged(oldItem, newItem) {
  return buildComparableScaleSignature(oldItem) !== buildComparableScaleSignature(newItem);
}

export function diffEscala(oldList, newList) {
  const oldMap = buildMusicianMap(oldList);
  const newMap = buildMusicianMap(newList);

  const novos = [];
  const mantidos = [];
  const alterados = [];
  const removidos = [];

  for (const [id, item] of newMap.entries()) {
    if (!oldMap.has(id)) {
      novos.push(item);
      continue;
    }

    const previous = oldMap.get(id);
    if (hasScaleAssignmentChanged(previous, item)) {
      alterados.push({
        before: previous,
        after: item,
      });
    }

    mantidos.push(item);
  }

  for (const [id, item] of oldMap.entries()) {
    if (!newMap.has(id)) removidos.push(item);
  }

  return { novos, mantidos, alterados, removidos };
}
