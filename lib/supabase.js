import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (typeof window !== 'undefined') {
  if (!SUPABASE_URL) {
    console.error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!SUPABASE_ANON_KEY) {
    console.error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
}

function normalizeComparable(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function applyEventTypeFilters(rows, filters) {
  let result = Array.isArray(rows) ? rows : [];

  for (const filter of filters) {
    if (!filter || filter.operator !== 'eq') continue;
    result = result.filter((row) => {
      const rowValue = row?.[filter.column];
      if (typeof rowValue === 'boolean') return rowValue === filter.value;
      return normalizeComparable(rowValue) === normalizeComparable(filter.value);
    });
  }

  return result;
}

function applyEventTypeOrders(rows, orders) {
  const result = [...(Array.isArray(rows) ? rows : [])];

  for (const order of [...orders].reverse()) {
    result.sort((a, b) => {
      const aValue = a?.[order.column];
      const bValue = b?.[order.column];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return order.nullsFirst ? -1 : 1;
      if (bValue === null || bValue === undefined) return order.nullsFirst ? 1 : -1;

      const comparison = String(aValue).localeCompare(String(bValue), 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      });

      return order.ascending === false ? -comparison : comparison;
    });
  }

  return result;
}

function projectEventTypeFields(rows, fields) {
  const rawFields = String(fields || '').trim();
  if (!rawFields || rawFields === '*') return rows;

  const fieldNames = rawFields
    .split(',')
    .map((field) => field.trim().split(/\s+/)[0])
    .map((field) => field.replace(/[^a-zA-Z0-9_]/g, ''))
    .filter(Boolean);

  if (fieldNames.length === 0) return rows;

  return rows.map((row) => {
    const projected = {};
    for (const field of fieldNames) {
      if (Object.prototype.hasOwnProperty.call(row || {}, field)) projected[field] = row[field];
    }
    return projected;
  });
}

function createScopedEventTypesQuery(fields) {
  const filters = [];
  const orders = [];
  let mode = 'many';

  const execute = async () => {
    try {
      const response = await fetch('/api/admin/event-types', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        return {
          data: mode === 'many' ? [] : null,
          error: { message: json?.error || json?.message || 'Erro ao carregar tipos de evento do workspace.' },
        };
      }

      let rows = json.eventTypes || json.data || [];
      rows = applyEventTypeFilters(rows, filters);
      rows = applyEventTypeOrders(rows, orders);
      rows = projectEventTypeFields(rows, fields);

      if (mode === 'single') {
        return {
          data: rows[0] || null,
          error: rows[0] ? null : { message: 'No rows found', code: 'PGRST116' },
        };
      }

      if (mode === 'maybeSingle') {
        return { data: rows[0] || null, error: null };
      }

      return { data: rows, error: null };
    } catch (error) {
      return {
        data: mode === 'many' ? [] : null,
        error: { message: error?.message || 'Erro ao carregar tipos de evento do workspace.' },
      };
    }
  };

  const builder = {
    eq(column, value) {
      filters.push({ operator: 'eq', column, value });
      return builder;
    },
    order(column, options = {}) {
      orders.push({
        column,
        ascending: options?.ascending !== false,
        nullsFirst: options?.nullsFirst === true,
      });
      return builder;
    },
    single() {
      mode = 'single';
      return execute();
    },
    maybeSingle() {
      mode = 'maybeSingle';
      return execute();
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
    catch(reject) {
      return execute().catch(reject);
    },
    finally(onFinally) {
      return execute().finally(onFinally);
    },
  };

  return builder;
}

function createWorkspaceScopedBrowserClient(client) {
  if (!client || typeof window === 'undefined') return client;

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== 'from') return Reflect.get(target, prop, receiver);

      return (tableName) => {
        const originalBuilder = target.from(tableName);

        if (tableName !== 'event_types') return originalBuilder;

        return new Proxy(originalBuilder, {
          get(builderTarget, builderProp, builderReceiver) {
            if (builderProp === 'select') {
              return (fields = '*') => createScopedEventTypesQuery(fields);
            }

            return Reflect.get(builderTarget, builderProp, builderReceiver);
          },
        });
      };
    },
  });
}

// Singleton - create only ONCE
let supabaseInstance = null;

export function getSupabase() {
  if (!supabaseInstance && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseInstance = createWorkspaceScopedBrowserClient(
      createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    );
  }
  return supabaseInstance;
}

// Named export for compatibility
export const supabase = getSupabase();
