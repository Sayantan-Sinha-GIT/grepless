import postgres from 'postgres';

// One pooled client per server instance. Supabase's transaction pooler
// (port 6543) does not support prepared statements, hence `prepare: false`.
const globalForDb = globalThis as unknown as { __sql?: postgres.Sql };

export function db(): postgres.Sql {
  if (!globalForDb.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    globalForDb.__sql = postgres(url, {
      prepare: false,
      max: 4,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: 'require',
    });
  }
  return globalForDb.__sql;
}
