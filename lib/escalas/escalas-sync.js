export function diffEscala(oldList, newList) {
  const oldMap = new Map(oldList.map((i) => [String(i.musician_id), i]));
  const newMap = new Map(newList.map((i) => [String(i.musician_id), i]));

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
