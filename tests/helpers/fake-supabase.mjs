// Fake mínimo do client Supabase para testes de autorização: filtra por eq/in e conta chamadas.
export function createFakeSupabase({ tables = {}, users = {}, unique = {} } = {}) {
  const stats = { getUser: 0, from: 0, byTable: {}, inserts: {} };
  let sequence = 0;

  function builder(table) {
    const filters = [];
    let limitValue = null;
    const run = () => {
      let rows = (tables[table] || []).filter((row) =>
        filters.every(([type, column, value]) => {
          if (type === 'eq') return String(row[column]) === String(value);
          if (type === 'gte') return String(row[column]) >= String(value);
          return value.map(String).includes(String(row[column]));
        })
      );
      if (limitValue !== null) rows = rows.slice(0, limitValue);
      return rows;
    };
    let pendingInsert = null;
    let wantCount = false;
    let pendingUpdate = null;
    const applyWrite = () => {
      if (pendingInsert) {
        const rows = (tables[table] ||= []);
        const row = { id: pendingInsert.id || `${table}-${++sequence}`, ...pendingInsert };
        for (const column of unique[table] || []) {
          if (row[column] != null && rows.some((existing) => String(existing[column]) === String(row[column]))) {
            pendingInsert = null;
            return { error: { code: '23505', message: `duplicate ${column}` } };
          }
        }
        rows.push(row);
        stats.inserts[table] = (stats.inserts[table] || 0) + 1;
        pendingInsert = null;
        return { row };
      }
      if (pendingUpdate) {
        const matched = run();
        matched.forEach((row) => Object.assign(row, pendingUpdate));
        pendingUpdate = null;
        return { row: matched[0] };
      }
      return null;
    };
    const query = {
      insert(payload) { pendingInsert = Array.isArray(payload) ? payload[0] : payload; return query; },
      update(payload) { pendingUpdate = payload; return query; },
      select(_columns, options = {}) { wantCount = Boolean(options?.count); return query; },
      gte(column, value) { filters.push(['gte', column, value]); return query; },
      eq(column, value) { filters.push(['eq', column, value]); return query; },
      in(column, values) { filters.push(['in', column, values]); return query; },
      order() { return query; },
      limit(value) { limitValue = value; return query; },
      async maybeSingle() {
        const write = applyWrite();
        if (write?.error) return { data: null, error: write.error };
        if (write) return { data: write.row || null, error: null };
        return { data: run()[0] || null, error: null };
      },
      async single() {
        const write = applyWrite();
        if (write?.error) return { data: null, error: write.error };
        const row = write ? write.row : run()[0];
        return row ? { data: row, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      },
      then(resolve) {
        const write = applyWrite();
        if (write?.error) return resolve({ data: null, error: write.error });
        if (wantCount && !write) return resolve({ data: null, count: run().length, error: null });
        resolve({ data: write ? (write.row ? [write.row] : []) : run(), error: null });
      },
    };
    return query;
  }

  return {
    stats,
    auth: {
      async getUser(token) {
        stats.getUser += 1;
        const user = users[token] || null;
        return { data: { user }, error: user ? null : { message: 'invalid token' } };
      },
    },
    from(table) {
      stats.from += 1;
      stats.byTable[table] = (stats.byTable[table] || 0) + 1;
      return builder(table);
    },
  };
}
