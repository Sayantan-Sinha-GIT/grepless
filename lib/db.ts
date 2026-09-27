import postgres from 'postgres';

// One pooled client per server instance. Supabase's transaction pooler
// (port 6543) does not support prepared statements, hence `prepare: false`.
// Connections are recycled regularly: a pooler hiccup can leave half-open
// sockets that would otherwise make every later query wait forever.
const globalForDb = globalThis as unknown as { __sql?: postgres.Sql };

export function db(): postgres.Sql {
  if (!globalForDb.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    globalForDb.__sql = postgres(url, {
      prepare: false,
      max: 4,
      idle_timeout: 20,
      max_lifetime: 60 * 5,
      connect_timeout: 10,
      keep_alive: 15,
      ssl: 'require',
    });
  }
  return globalForDb.__sql;
}

/** Resolves to `fallback` if `promise` takes longer than `ms` (for page data that must not block rendering). */
export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label = 'query'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[db] ${label} took longer than ${ms} ms, rendering without it`);
      resolve(fallback);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } catch (err) {
    console.error(`[db] ${label} failed`, err);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
