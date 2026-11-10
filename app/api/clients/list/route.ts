import { errorResponse, q } from '@/lib/ig-server';
import { S, U } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Client 360 drill-down: clients behind a funnel stage, lifecycle stage, acquisition channel,
 * chat topic or marketing audience. `dim` is whitelisted; `value` / `entity` are bound.
 */
const FUNNEL: Record<string, string> = {
  Registered: 'TRUE',
  Funded: 'c.FIRST_FUNDED_DATE IS NOT NULL',
  Traded: 'c.FIRST_TRADE_DATE IS NOT NULL',
  'Active (30d)': `c.LIFECYCLE_STAGE = 'Active'`,
};

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const dim = p.get('dim') || '';
  const value = p.get('value') || '';
  const entity = p.get('entity') || null;

  let where: string;
  const binds: (string | null)[] = [];
  switch (dim) {
    case 'funnel':
      if (!FUNNEL[value]) return Response.json({ error: 'Unknown funnel stage' }, { status: 400 });
      where = FUNNEL[value];
      break;
    case 'lifecycle':
      where = 'c.LIFECYCLE_STAGE = ?';
      binds.push(value);
      break;
    case 'channel':
      where = 'c.ACQUISITION_CHANNEL = ? AND s.CLIENT_ID IS NOT NULL';
      binds.push(value);
      break;
    case 'topic':
      where = `c.CLIENT_ID IN (SELECT CLIENT_ID FROM ${U}.CHAT_INSIGHTS_V WHERE TOPIC = ?)`;
      binds.push(value);
      break;
    case 'audience':
      where = `c.CLIENT_ID IN (SELECT CLIENT_ID FROM ${S}.MARKETING_SEGMENTS WHERE AUDIENCE = ?)`;
      binds.push(value);
      break;
    default:
      return Response.json({ error: 'dim must be funnel, lifecycle, channel, topic or audience' }, { status: 400 });
  }
  binds.push(entity, entity);
  const from = `${S}.DT_CLIENT_360 c LEFT JOIN ${S}.CHURN_SCORES s USING (CLIENT_ID)
    WHERE ${where} AND (? IS NULL OR c.ENTITY = ?)`;

  try {
    const [rows, total] = await Promise.all([
      q(`SELECT c.CLIENT_ID, c.FULL_NAME, c.ENTITY, c.SEGMENT, c.PRIMARY_PRODUCT, c.ACQUISITION_CHANNEL, c.LIFECYCLE_STAGE,
                c.BALANCE_GBP, c.REVENUE_180D, c.COMPLAINTS, s.CHURN_PROBABILITY, s.REVENUE_AT_RISK_GBP
         FROM ${from}
         ORDER BY s.REVENUE_AT_RISK_GBP DESC NULLS LAST, c.REVENUE_180D DESC NULLS LAST LIMIT 50`, binds),
      q(`SELECT COUNT(*) AS N, SUM(c.BALANCE_GBP) AS BALANCES, SUM(c.REVENUE_180D) AS REVENUE_180D,
                SUM(s.REVENUE_AT_RISK_GBP) AS REVENUE_AT_RISK
         FROM ${from}`, binds),
    ]);
    return Response.json({ rows, summary: total[0] ?? {} });
  } catch (e) {
    return errorResponse('clients-list', e);
  }
}
