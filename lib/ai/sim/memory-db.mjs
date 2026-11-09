/**
 * Banco EM MEMÓRIA com a interface do cliente Supabase usada pelas ferramentas da IA
 * (select/eq/in/ilike/gte/lte/order/limit/maybeSingle/single/insert/update/upsert/delete/rpc).
 * Usado só na simulação isolada: nada é lido nem gravado no banco real.
 */
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
let counter = 0;
export const memId = () => `00000000-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`;

export function createMemoryDb(seed = {}, { rpc: rpcHandlers = {} } = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = (rows || []).map((r) => ({ ...clone(r) }));
  const writes = [];
  const table = (name) => (tables[name] ||= []);

  function query(name) {
    const filters = [];
    let op = 'select';
    let payload = null;
    let orderBy = null;
    let max = null;
    let returnRows = false;
    const matches = (row) => filters.every((f) => f(row));
    const run = () => {
      const rows = table(name);
      if (op === 'insert' || op === 'upsert') {
        const list = (Array.isArray(payload) ? payload : [payload]).map((r) => ({ id: memId(), created_at: new Date().toISOString(), ...clone(r) }));
        rows.push(...list);
        writes.push({ table: name, op, count: list.length });
        return { data: returnRows ? list : null, error: null };
      }
      if (op === 'update') {
        const hit = rows.filter(matches);
        for (const r of hit) Object.assign(r, clone(payload));
        writes.push({ table: name, op, count: hit.length });
        return { data: returnRows ? hit : null, error: null };
      }
      if (op === 'delete') {
        const keep = rows.filter((r) => !matches(r));
        writes.push({ table: name, op, count: rows.length - keep.length });
        tables[name] = keep;
        return { data: null, error: null };
      }
      let out = rows.filter(matches).map(clone);
      if (orderBy) out.sort((a, b) => (String(a[orderBy.col]) < String(b[orderBy.col]) ? -1 : 1) * (orderBy.asc ? 1 : -1));
      if (max != null) out = out.slice(0, max);
      return { data: out, error: null };
    };
    const q = {
      select() { if (op !== 'select') returnRows = true; return q; },
      eq(c, v) { filters.push((r) => r[c] === v || String(r[c]) === String(v)); return q; },
      neq(c, v) { filters.push((r) => r[c] !== v); return q; },
      in(c, vs) { filters.push((r) => (vs || []).map(String).includes(String(r[c]))); return q; },
      ilike(c, pattern) {
        const re = new RegExp(`^${String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, 'i');
        filters.push((r) => re.test(String(r[c] ?? ''))); return q;
      },
      like(c, pattern) { return q.ilike(c, pattern); },
      gte(c, v) { filters.push((r) => String(r[c] ?? '') >= String(v)); return q; },
      lte(c, v) { filters.push((r) => String(r[c] ?? '') <= String(v)); return q; },
      gt(c, v) { filters.push((r) => String(r[c] ?? '') > String(v)); return q; },
      lt(c, v) { filters.push((r) => String(r[c] ?? '') < String(v)); return q; },
      is(c, v) { filters.push((r) => (r[c] ?? null) === v); return q; },
      order(col, opts = {}) { orderBy = { col, asc: opts.ascending !== false }; return q; },
      limit(n) { max = n; return q; },
      range(a, b) { max = b - a + 1; return q; },
      insert(rows) { op = 'insert'; payload = rows; return q; },
      upsert(rows) { op = 'upsert'; payload = rows; return q; },
      update(row) { op = 'update'; payload = row; return q; },
      delete() { op = 'delete'; return q; },
      async maybeSingle() { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: null }; },
      async single() { const r = run(); const row = Array.isArray(r.data) ? r.data[0] : r.data; return row ? { data: row, error: null } : { data: null, error: { message: 'not_found' } }; },
      then(resolve, reject) { try { resolve(run()); } catch (e) { reject(e); } },
    };
    return q;
  }

  return {
    from: (name) => query(name),
    async rpc(name, args) {
      writes.push({ table: `rpc:${name}`, op: 'rpc', count: 1 });
      if (rpcHandlers[name]) return rpcHandlers[name](args, tables);
      return { data: null, error: null };
    },
    tables,
    writes,
  };
}
