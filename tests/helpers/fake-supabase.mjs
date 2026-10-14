// Fake mínimo do client Supabase para testes de autorização: filtra por eq/in e conta chamadas.
export function createFakeSupabase({ tables = {}, users = {} } = {}) {
  const stats = { getUser: 0, from: 0, byTable: {} };

  function builder(table) {
    const filters = [];
    let limitValue = null;
    const run = () => {
      let rows = (tables[table] || []).filter((row) =>
        filters.every(([type, column, value]) =>
          type === 'eq' ? String(row[column]) === String(value) : value.map(String).includes(String(row[column]))
        )
      );
      if (limitValue !== null) rows = rows.slice(0, limitValue);
      return rows;
    };
    const query = {
      select() { return query; },
      eq(column, value) { filters.push(['eq', column, value]); return query; },
      in(column, values) { filters.push(['in', column, values]); return query; },
      order() { return query; },
      limit(value) { limitValue = value; return query; },
      async maybeSingle() { return { data: run()[0] || null, error: null }; },
      async single() { const row = run()[0]; return row ? { data: row, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }; },
      then(resolve) { resolve({ data: run(), error: null }); },
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
