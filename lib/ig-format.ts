/** IG display formatters (GBP compact notation used across the app). */
import { EMPTY } from '@/lib/format';

export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** GBP 4.2bn / GBP 1.5m / GBP 10.2k / GBP 950 */
export function gbp(v: unknown): string {
  if (v === null || v === undefined || v === '') return EMPTY;
  const n = num(v);
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}£${(a / 1e9).toFixed(2)}bn`;
  if (a >= 1e6) return `${sign}£${(a / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${sign}£${(a / 1e3).toFixed(1)}k`;
  return `${sign}£${a.toFixed(0)}`;
}

export function pct(v: unknown, digits = 1): string {
  if (v === null || v === undefined || v === '') return EMPTY;
  return `${num(v).toFixed(digits)}%`;
}

export function int(v: unknown): string {
  if (v === null || v === undefined || v === '') return EMPTY;
  return Math.round(num(v)).toLocaleString('en-GB');
}

export function shortDate(v: unknown): string {
  if (!v) return EMPTY;
  return String(v).slice(0, 10);
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { error?: string }).error || `Request failed (${r.status})`);
  return body as T;
}
