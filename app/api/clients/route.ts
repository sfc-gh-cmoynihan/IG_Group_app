import { errorResponse, q } from '@/lib/ig-server';
import { S } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Client 360 & retention. Optional ?entity= filter (bound, never interpolated).
 * Reads the small per-entity C360_* dynamic tables (sql/06_client360_perf.sql)
 * instead of scanning DT_CLIENT_360, and caches each response for 5 minutes.
 */
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; body: unknown }>();

async function load(entity: string | null) {
  const eb = [entity, entity];
  const ef = `(? IS NULL OR ENTITY = ?)`;
  const [kpiRows, lifecycle, churnByChannel, atRisk, topics, segments, metrics] = await Promise.all([
    q(`SELECT SUM(REGISTERED) AS REGISTERED, SUM(FUNDED) AS FUNDED, SUM(TRADED) AS TRADED, SUM(ACTIVE) AS ACTIVE,
              SUM(BALANCES) AS BALANCES, SUM(NET_DEPOSITS) AS NET_DEPOSITS, SUM(REVENUE_AT_RISK) AS REVENUE_AT_RISK
       FROM ${S}.C360_KPI_BY_ENTITY WHERE ${ef}`, eb),
    q(`SELECT LIFECYCLE_STAGE, SUM(N) AS N FROM ${S}.C360_LIFECYCLE_BY_ENTITY WHERE ${ef} GROUP BY 1 ORDER BY 2 DESC`, eb),
    q(`SELECT ACQUISITION_CHANNEL, SUM(CLIENTS) AS CLIENTS,
              ROUND(100 * SUM(SUM_CHURN_PROB) / NULLIF(SUM(CLIENTS), 0), 1) AS AVG_CHURN_PCT,
              SUM(REVENUE_AT_RISK) AS REVENUE_AT_RISK
       FROM ${S}.C360_CHURN_BY_CHANNEL WHERE ${ef} GROUP BY 1 ORDER BY 3 DESC, 1`, eb),
    q(`SELECT CLIENT_ID, FULL_NAME, ENTITY, SEGMENT, PRIMARY_PRODUCT, ACQUISITION_CHANNEL, LIFECYCLE_STAGE,
              CHURN_PROBABILITY, REVENUE_AT_RISK_GBP, REVENUE_180D, COMPLAINTS, NEXT_BEST_ACTION
       FROM ${S}.C360_AT_RISK_TOP WHERE ${ef} ORDER BY REVENUE_AT_RISK_GBP DESC LIMIT 25`, eb),
    q(`SELECT TOPIC, SUM(N) AS N, SUM(NEGATIVE) AS NEGATIVE, SUM(INTENDS_TO_LEAVE) AS INTENDS_TO_LEAVE
       FROM ${S}.C360_CHAT_TOPICS WHERE ${ef} GROUP BY 1 ORDER BY 2 DESC`, eb),
    q(`SELECT AUDIENCE, SUM(CLIENTS) AS CLIENTS FROM ${S}.C360_SEGMENTS WHERE ${ef} GROUP BY 1 ORDER BY 2 DESC`, eb),
    q(`SELECT N, BASE_RATE, PRECISION, RECALL, ACCURACY FROM ${S}.CHURN_MODEL_METRICS`),
  ]);
  const k = kpiRows[0] ?? {};
  const n = (v: unknown) => Number(v ?? 0);
  const funnel = [
    { STAGE: 'Registered', ORD: 1, N: n(k.REGISTERED) },
    { STAGE: 'Funded', ORD: 2, N: n(k.FUNDED) },
    { STAGE: 'Traded', ORD: 3, N: n(k.TRADED) },
    { STAGE: 'Active (30d)', ORD: 4, N: n(k.ACTIVE) },
  ];
  const kpi = {
    CLIENTS: n(k.REGISTERED),
    FUNDING_CONVERSION: n(k.REGISTERED) ? (100 * n(k.FUNDED)) / n(k.REGISTERED) : null,
    BALANCES: k.BALANCES,
    NET_DEPOSITS: k.NET_DEPOSITS,
    REVENUE_AT_RISK: k.REVENUE_AT_RISK,
  };
  return { funnel, lifecycle, churnByChannel, atRisk, topics, segments, metrics: metrics[0] ?? {}, kpi };
}

export async function GET(req: Request) {
  const entity = new URL(req.url).searchParams.get('entity') || null;
  const key = entity ?? '';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json(hit.body);
  try {
    const body = await load(entity);
    cache.set(key, { at: Date.now(), body });
    return Response.json(body);
  } catch (e) {
    return errorResponse('clients', e);
  }
}
