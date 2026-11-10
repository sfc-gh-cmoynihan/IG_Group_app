/**
 * Server-side helpers shared by the IG API routes.
 */
import { querySnowflake, querySnowflakeLongRunning } from '@/lib/snowflake';

type Row = Record<string, unknown>;

/** Normalise driver values (Date → ISO string) so JSON responses are stable. */
function normalise(rows: Record<string, any>[]): Row[] {
  return rows.map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) out[k] = v instanceof Date ? v.toISOString() : v;
    return out;
  });
}

export async function q(sql: string, binds: (string | number | boolean | null)[] = []): Promise<Row[]> {
  return normalise(await querySnowflake(sql, binds.length ? { binds } : {}));
}

export async function qLong(sql: string, binds: (string | number | boolean | null)[] = []): Promise<Row[]> {
  return normalise(await querySnowflakeLongRunning(sql, binds.length ? { binds } : {}));
}

export function errorResponse(scope: string, e: unknown) {
  console.error(new Date().toISOString(), `[${scope}]`, e);
  return Response.json({ error: e instanceof Error ? e.message : `Failed to load ${scope}` }, { status: 500 });
}
