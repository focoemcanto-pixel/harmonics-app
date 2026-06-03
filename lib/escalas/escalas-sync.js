function buildMusicianMap(list) {
  const map = new Map();

  for (const item of Array.isArray(list) ? list : []) {
    const musicianId = String(item?.musician_id || '').trim();
    if (!musicianId) continue;
    map.set(musicianId, item);
  }

  return map;
}

export function diffEscala(oldList, newList) {
  const oldMap = buildMusicianMap(oldList);
  const newMap = buildMusicianMap(newList);

  const novos = [];
  const mantidos = [];
  const removidos = [];

  for (const [id, item] of newMap.entries()) {
    if (!oldMap.has(id)) novos.push(item);
    else mantidos.push(item);
  }

  for (const [id, item] of oldMap.entries()) {
    if (!newMap.has(id)) removidos.push(item);
  }

  return { novos, mantidos, removidos };
}
