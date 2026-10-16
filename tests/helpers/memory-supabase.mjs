// Supabase em memória para testes de fluxo (convites/automação).
// Implementa o subconjunto do PostgREST usado pelo app: select com recursos embutidos
// (alias:tabela(colunas) via <tabela_singular>_id), filtros eq/neq/is/in/lt/lte/gt/gte,
// order/limit, insert/update/upsert, single/maybeSingle e constraints únicas.
// Cada update condicional é aplicado de forma síncrona sobre as linhas que casam,
// como um UPDATE ... WHERE do Postgres (a corrida entre duas chamadas é serializada).

const EMBED_FK = { contacts: 'contact_id', events: 'event_id', invites: 'invite_id', workspaces: 'workspace_id' };

function parseEmbeds(columns) {
  const embeds = [];
  const pattern = /(?:([a-zA-Z_]+):)?([a-zA-Z_]+)\(([^()]*)\)/g;
  let match;
  while ((match = pattern.exec(String(columns || '')))) {
    const [, alias, table] = match;
    embeds.push({ alias: alias || table, table });
  }
  return embeds;
}

function compare(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export function createMemorySupabase({ tables = {}, unique = {}, foreignKeys = {} } = {}) {
  const db = {};
  for (const [name, rows] of Object.entries(tables)) db[name] = rows.map((row) => ({ ...row }));
  let sequence = 0;
  const calls = [];

  function rowsOf(table) {
    return (db[table] ||= []);
  }

  function embed(table, row, embeds) {
    if (!embeds.length) return { ...row };
    const out = { ...row };
    for (const { alias, table: target } of embeds) {
      const fk = EMBED_FK[target];
      const related = fk ? rowsOf(target).find((candidate) => String(candidate.id) === String(row[fk])) : null;
      out[alias] = related ? { ...related } : null;
    }
    return out;
  }

  function builder(table) {
    const filters = [];
    let mode = 'select';
    let payload = null;
    let upsertOptions = null;
    let columns = '*';
    let orderBy = null;
    let limitValue = null;

    const matches = (row) =>
      filters.every(([op, column, value]) => {
        const current = row[column];
        switch (op) {
          case 'eq': return current !== null && current !== undefined && String(current) === String(value);
          case 'neq': return current === null || current === undefined || String(current) !== String(value);
          case 'is': return value === null ? current === null || current === undefined : current === value;
          case 'in': return value.map(String).includes(String(current));
          case 'lt': return compare(current, value) === -1;
          case 'lte': { const c = compare(current, value); return c === -1 || c === 0; }
          case 'gt': return compare(current, value) === 1;
          case 'gte': { const c = compare(current, value); return c === 1 || c === 0; }
          case 'not_is': return value === null ? current !== null && current !== undefined : current !== value;
          default: throw new Error(`filtro não suportado no fake: ${op}`);
        }
      });

    const violatesUnique = (candidate, ignore = null) =>
      (unique[table] || []).find((cols) =>
        rowsOf(table).some(
          (existing) => existing !== ignore && cols.every((col) => candidate[col] != null && String(existing[col]) === String(candidate[col]))
        )
      );

    const violatesForeignKey = (candidate) =>
      Object.entries(foreignKeys[table] || {}).find(
        ([column, target]) =>
          candidate[column] != null && !rowsOf(target).some((row) => String(row.id) === String(candidate[column]))
      );

    function execute() {
      calls.push({ table, mode, filters: filters.map((f) => [...f]), payload });
      const embeds = parseEmbeds(columns);
      if (mode === 'insert') {
        const list = Array.isArray(payload) ? payload : [payload];
        const inserted = [];
        for (const item of list) {
          const row = { id: item.id || `${table}-${++sequence}`, created_at: new Date().toISOString(), ...item };
          const conflict = violatesUnique(row);
          if (conflict) return { data: null, error: { code: '23505', message: `duplicate key (${conflict.join(',')})` } };
          const fk = violatesForeignKey(row);
          if (fk) return { data: null, error: { code: '23503', message: `insert or update on table "${table}" violates foreign key constraint "${table}_${fk[0]}_fkey"` } };
          rowsOf(table).push(row);
          inserted.push(row);
        }
        return { data: inserted.map((row) => embed(table, row, embeds)), error: null };
      }
      if (mode === 'upsert') {
        const list = Array.isArray(payload) ? payload : [payload];
        const conflictCols = String(upsertOptions?.onConflict || 'id').split(',').map((c) => c.trim());
        const out = [];
        for (const item of list) {
          const existing = rowsOf(table).find((row) => conflictCols.every((col) => String(row[col]) === String(item[col])));
          if (existing) {
            if (!upsertOptions?.ignoreDuplicates) Object.assign(existing, item);
            out.push(existing);
          } else {
            const row = { id: item.id || `${table}-${++sequence}`, created_at: new Date().toISOString(), ...item };
            rowsOf(table).push(row);
            out.push(row);
          }
        }
        return { data: out.map((row) => embed(table, row, embeds)), error: null };
      }
      let rows = rowsOf(table).filter(matches);
      if (mode === 'update') {
        for (const row of rows) {
          const next = { ...row, ...payload };
          const conflict = violatesUnique(next, row);
          if (conflict) return { data: null, error: { code: '23505', message: `duplicate key (${conflict.join(',')})` } };
        }
        rows.forEach((row) => Object.assign(row, payload, { updated_at: new Date().toISOString() }));
      }
      if (mode === 'delete') {
        db[table] = rowsOf(table).filter((row) => !rows.includes(row));
      }
      if (orderBy) {
        const { column, ascending } = orderBy;
        rows = [...rows].sort((a, b) => (compare(a[column], b[column]) || 0) * (ascending ? 1 : -1));
      }
      if (limitValue !== null) rows = rows.slice(0, limitValue);
      return { data: rows.map((row) => embed(table, row, embeds)), error: null };
    }

    const query = {
      select(cols = '*') { columns = cols; return query; },
      insert(value) { mode = 'insert'; payload = value; return query; },
      update(value) { mode = 'update'; payload = value; return query; },
      upsert(value, options = {}) { mode = 'upsert'; payload = value; upsertOptions = options; return query; },
      delete() { mode = 'delete'; return query; },
      eq(column, value) { filters.push(['eq', column, value]); return query; },
      neq(column, value) { filters.push(['neq', column, value]); return query; },
      is(column, value) { filters.push(['is', column, value]); return query; },
      in(column, values) { filters.push(['in', column, values]); return query; },
      lt(column, value) { filters.push(['lt', column, value]); return query; },
      lte(column, value) { filters.push(['lte', column, value]); return query; },
      gt(column, value) { filters.push(['gt', column, value]); return query; },
      gte(column, value) { filters.push(['gte', column, value]); return query; },
      not(column, operator, value) {
        if (operator !== 'is') throw new Error(`not.${operator} não suportado no fake`);
        filters.push(['not_is', column, value]);
        return query;
      },
      or() { throw new Error('or() não suportado no fake'); },
      order(column, options = {}) { orderBy = { column, ascending: options.ascending !== false }; return query; },
      limit(value) { limitValue = value; return query; },
      async maybeSingle() {
        const { data, error } = execute();
        if (error) return { data: null, error };
        if (data.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
        return { data: data[0] || null, error: null };
      },
      async single() {
        const { data, error } = execute();
        if (error) return { data: null, error };
        if (data.length !== 1) return { data: null, error: { code: 'PGRST116', message: `${data.length} rows` } };
        return { data: data[0], error: null };
      },
      then(resolve, reject) {
        try {
          resolve(execute());
        } catch (error) {
          reject(error);
        }
      },
    };
    return query;
  }

  return {
    db,
    calls,
    from(table) {
      return builder(table);
    },
    auth: { async getUser() { return { data: { user: null }, error: { message: 'no auth in fake' } }; } },
  };
}
