// Adaptador mínimo "supabase-js -> Postgres" para homologação local sem PostgREST.
// Cada chamada roda em uma transação com `set local role` + `request.jwt.claims`, como o
// PostgREST faz: role 'service_role' (ignora RLS) ou 'authenticated'/'anon' (RLS real).
// Subconjunto suportado: select (com `alias:tabela(*)` via <alias>_id), eq/neq/is/in/gt/gte/lt/lte,
// order, limit, single/maybeSingle, insert, update, upsert(onConflict, ignoreDuplicates), delete.
// Uso exclusivo em testes contra banco local descartável.

function quoteIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`identificador inválido: ${name}`);
  return `"${name}"`;
}

function parseSelect(columns) {
  const embeds = [];
  const pattern = /(?:([a-zA-Z_]+)\s*:\s*)?([a-zA-Z_]+)\s*\(([^()]*)\)/g;
  const plain = String(columns || '*').replace(pattern, (_, alias, table) => {
    embeds.push({ alias: alias || table, table });
    return '';
  });
  const cols = plain.split(',').map((c) => c.trim()).filter(Boolean);
  return { cols: cols.length ? cols : ['*'], embeds };
}

function pgError(error) {
  return { code: error.code, message: error.message, details: error.detail || null, hint: error.hint || null };
}

export function createPgSupabase({ pool, role = 'service_role', sub = null }) {
  async function run(sql, params) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`set local role ${quoteIdent(role)}`);
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(sub ? { sub, role } : { role }),
      ]);
      const result = await client.query(sql, params);
      await client.query('commit');
      return { rows: result.rows, error: null };
    } catch (error) {
      await client.query('rollback').catch(() => {});
      return { rows: null, error: pgError(error) };
    } finally {
      client.release();
    }
  }

  function builder(table) {
    const filters = [];
    let mode = 'select';
    let payload = null;
    let options = {};
    let columns = '*';
    let order = null;
    let limit = null;
    let returning = false;
    let countOpts = {};

    const where = (params) => {
      if (!filters.length) return '';
      const parts = filters.map(([op, col, value]) => {
        const c = quoteIdent(col);
        if (op === 'is') return value === null ? `${c} is null` : `${c} is ${value ? 'true' : 'false'}`;
        if (op === 'in') { params.push(value); return `${c} = any($${params.length})`; }
        params.push(value);
        const sqlOp = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op];
        return `${c} ${sqlOp} $${params.length}`;
      });
      return ` where ${parts.join(' and ')}`;
    };

    async function embed(rows, embeds) {
      for (const { alias, table: target } of embeds) {
        for (const row of rows) {
          const fk = row[`${alias}_id`];
          if (fk == null) { row[alias] = null; continue; }
          const { rows: related } = await run(`select * from public.${quoteIdent(target)} where id = $1`, [fk]);
          row[alias] = related?.[0] || null;
        }
      }
      return rows;
    }

    async function execute() {
      const params = [];
      const { cols, embeds } = parseSelect(columns);
      const selectList = cols.map((c) => (c === '*' ? '*' : quoteIdent(c))).join(', ');
      let sql;
      if (mode === 'select') {
        // Embeds precisam da FK (<alias>_id) mesmo quando ela não foi pedida: lê tudo e projeta depois.
        sql = `select ${embeds.length ? '*' : selectList} from public.${quoteIdent(table)}${where(params)}`;
        if (order) sql += ` order by ${quoteIdent(order.column)} ${order.ascending ? 'asc' : 'desc'}`;
        if (limit != null) sql += ` limit ${Number(limit)}`;
      } else if (mode === 'insert' || mode === 'upsert') {
        const list = Array.isArray(payload) ? payload : [payload];
        const keys = [...new Set(list.flatMap((r) => Object.keys(r)))];
        const values = list.map((r) => `(${keys.map((k) => { params.push(r[k] === undefined ? null : (typeof r[k] === 'object' && r[k] !== null && !(r[k] instanceof Date) ? JSON.stringify(r[k]) : r[k])); return `$${params.length}`; }).join(', ')})`);
        sql = `insert into public.${quoteIdent(table)} (${keys.map(quoteIdent).join(', ')}) values ${values.join(', ')}`;
        if (mode === 'upsert') {
          const target = String(options.onConflict || 'id').split(',').map((c) => quoteIdent(c.trim())).join(', ');
          sql += options.ignoreDuplicates
            ? ` on conflict (${target}) do nothing`
            : ` on conflict (${target}) do update set ${keys.map((k) => `${quoteIdent(k)} = excluded.${quoteIdent(k)}`).join(', ')}`;
        }
        sql += ` returning ${returning ? selectList : '*'}`;
      } else if (mode === 'update') {
        const sets = Object.entries(payload).map(([k, v]) => { params.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v); return `${quoteIdent(k)} = $${params.length}`; });
        sql = `update public.${quoteIdent(table)} set ${sets.join(', ')}${where(params)} returning ${returning ? selectList : '*'}`;
      } else if (mode === 'delete') {
        sql = `delete from public.${quoteIdent(table)}${where(params)} returning *`;
      }
      const { rows, error } = await run(sql, params);
      if (error) return { data: null, error };
      if (mode === 'select' && countOpts.count) {
        return { data: countOpts.head ? null : rows, count: rows.length, error: null };
      }
      const embedded = await embed(rows, embeds);
      if (!embeds.length || cols.includes('*')) return { data: embedded, error: null };
      const keep = [...cols, ...embeds.map((e) => e.alias)];
      return { data: embedded.map((row) => Object.fromEntries(keep.map((k) => [k, row[k]]))), error: null };
    }

    const query = {
      select(cols = '*', opts = {}) { columns = cols; countOpts = opts; if (mode !== 'select') returning = true; return query; },
      insert(value) { mode = 'insert'; payload = value; return query; },
      upsert(value, opts = {}) { mode = 'upsert'; payload = value; options = opts; return query; },
      update(value) { mode = 'update'; payload = value; return query; },
      delete() { mode = 'delete'; return query; },
      eq(c, v) { filters.push(['eq', c, v]); return query; },
      neq(c, v) { filters.push(['neq', c, v]); return query; },
      is(c, v) { filters.push(['is', c, v]); return query; },
      in(c, v) { filters.push(['in', c, v]); return query; },
      gt(c, v) { filters.push(['gt', c, v]); return query; },
      gte(c, v) { filters.push(['gte', c, v]); return query; },
      lt(c, v) { filters.push(['lt', c, v]); return query; },
      lte(c, v) { filters.push(['lte', c, v]); return query; },
      order(column, opts = {}) { order = { column, ascending: opts.ascending !== false }; return query; },
      limit(n) { limit = n; return query; },
      async maybeSingle() {
        const { data, error } = await execute();
        if (error) return { data: null, error };
        if (data.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
        return { data: data[0] || null, error: null };
      },
      async single() {
        const { data, error } = await execute();
        if (error) return { data: null, error };
        if (data.length !== 1) return { data: null, error: { code: 'PGRST116', message: `${data.length} rows` } };
        return { data: data[0], error: null };
      },
      then(resolve, reject) { execute().then(resolve, reject); },
    };
    return query;
  }

  return { from: builder, rpc: async () => ({ data: null, error: { message: 'rpc não suportado no adaptador local' } }) };
}
