// No network capability: all mutations and RPCs stay in this request. Domain
// executors can be shared with production without a service-role write path.
export function createSimulationStore(initial = {}) {
  const tables = structuredClone(initial);
  const writes = [];
  let seq = 0;
  function from(table) {
    const filters = [];
    let operation = null, payload = null, count = Infinity, sort = null, one = false;
    const q = {
      select() { return q; },
      eq(k, v) { filters.push((r) => r[k] === v); return q; },
      neq(k, v) { filters.push((r) => r[k] !== v); return q; },
      in(k, v) { filters.push((r) => v.includes(r[k])); return q; },
      is(k, v) { filters.push((r) => (r[k] ?? null) === v); return q; },
      ilike() { return q; },
      order(k, options = {}) { sort = [k, options.ascending !== false]; return q; },
      limit(n) { count = n; return q; },
      insert(value) { operation = 'insert'; payload = value; return q; },
      update(value) { operation = 'update'; payload = value; return q; },
      maybeSingle() { one = true; return q; }, single() { one = true; return q; },
      then(resolve, reject) {
        try {
          tables[table] ||= [];
          let rows = tables[table].filter((r) => filters.every((f) => f(r)));
          if (operation) {
            writes.push({ table, operation });
            if (operation === 'insert') {
              rows = (Array.isArray(payload) ? payload : [payload]).map((r) => ({ id: `simulation-${++seq}`, status: 'pending', ...r }));
              tables[table].push(...rows);
            } else rows.forEach((r) => Object.assign(r, payload));
          }
          if (sort) rows = [...rows].sort((a, b) => String(a[sort[0]]).localeCompare(String(b[sort[0]])) * (sort[1] ? 1 : -1));
          rows = rows.slice(0, count);
          return Promise.resolve({ data: one ? rows[0] || null : rows, error: null }).then(resolve, reject);
        } catch (e) { return Promise.reject(e).then(resolve, reject); }
      },
    };
    return q;
  }
  async function rpc(name) {
    writes.push({ rpc: name, operation: 'simulation' });
    if (name === 'ai_open_closing') return { data: `simulation-closing-${++seq}`, error: null };
    return { data: null, error: { code: 'simulation_rpc_unavailable' } };
  }
  return { from, rpc, tables, writes };
}
