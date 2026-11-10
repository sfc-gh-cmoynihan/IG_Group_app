import { errorResponse, q } from '@/lib/ig-server';
import { S } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const C = `${S}.CUSTOMER_CONTACTS`;

/** Shared KPI expressions for every grouping. */
const KPIS = `COUNT(*) AS CONTACTS,
  COUNT_IF(NOT ABANDONED) AS HANDLED,
  100 * AVG(ABANDONED::INT) AS ABANDON_PCT,
  100 * AVG(SLA_MET::INT) AS SERVICE_LEVEL_PCT,
  AVG(IFF(ABANDONED, NULL, WAIT_SEC)) AS ASA_SEC,
  AVG(IFF(ABANDONED, NULL, HANDLE_SEC + HOLD_SEC + ACW_SEC)) AS AHT_SEC,
  100 * AVG(IFF(ABANDONED, NULL, RESOLVED_FIRST_CONTACT::INT)) AS FCR_PCT,
  100 * AVG(IFF(ABANDONED, NULL, TRANSFERRED::INT)) AS TRANSFER_PCT,
  100 * AVG(REPEAT_7D::INT) AS REPEAT_PCT,
  AVG(CSAT) AS CSAT,
  100 * COUNT_IF(CSAT >= 4) / NULLIF(COUNT(CSAT), 0) AS CSAT_PCT,
  100 * (COUNT_IF(NPS_SCORE >= 9) - COUNT_IF(NPS_SCORE <= 6)) / NULLIF(COUNT(NPS_SCORE), 0) AS NPS,
  AVG(SENTIMENT) AS SENTIMENT,
  COUNT_IF(COMPLAINT_LOGGED) AS COMPLAINTS,
  COUNT_IF(VULNERABILITY_FLAG) AS VULNERABLE,
  COUNT_IF(ESCALATED_TO_COMPLIANCE) AS ESCALATED`;

export async function GET(req: Request) {
  const entity = new URL(req.url).searchParams.get('entity') || '';
  const where = entity ? 'WHERE ENTITY = ?' : '';
  const b = entity ? [entity] : [];
  try {
    const [kpi, prior, byChannel, daily, hourly, reasons, teams, agents, entities] = await Promise.all([
      q(`SELECT ${KPIS} FROM ${C} ${where ? where + ' AND' : 'WHERE'} CONTACT_DATE >= DATEADD(day, -30, CURRENT_DATE())`, b),
      q(`SELECT ${KPIS} FROM ${C} ${where ? where + ' AND' : 'WHERE'} CONTACT_DATE >= DATEADD(day, -60, CURRENT_DATE())
           AND CONTACT_DATE < DATEADD(day, -30, CURRENT_DATE())`, b),
      q(`SELECT CHANNEL, ${KPIS} FROM ${C} ${where} GROUP BY 1 ORDER BY CONTACTS DESC`, b),
      q(`SELECT TO_CHAR(CONTACT_DATE, 'YYYY-MM-DD') AS D,
                COUNT_IF(CHANNEL = 'Phone') AS PHONE, COUNT_IF(CHANNEL = 'Live Chat') AS CHAT,
                COUNT_IF(CHANNEL = 'WhatsApp') AS WHATSAPP, COUNT_IF(CHANNEL = 'Email') AS EMAIL,
                100 * AVG(SLA_MET::INT) AS SERVICE_LEVEL_PCT, 100 * AVG(ABANDONED::INT) AS ABANDON_PCT
         FROM ${C} ${where} GROUP BY 1 ORDER BY 1`, b),
      q(`SELECT HOUR(START_TS) AS H, COUNT(*) / COUNT(DISTINCT CONTACT_DATE) AS PER_DAY,
                AVG(IFF(ABANDONED OR CHANNEL = 'Email', NULL, WAIT_SEC)) AS ASA_SEC
         FROM ${C} ${where} GROUP BY 1 ORDER BY 1`, b),
      q(`SELECT REASON, ${KPIS} FROM ${C} ${where} GROUP BY 1 ORDER BY CONTACTS DESC`, b),
      q(`SELECT TEAM, COUNT(DISTINCT AGENT_ID) AS AGENTS, ${KPIS} FROM ${C}
         ${where ? where + ' AND' : 'WHERE'} TEAM IS NOT NULL GROUP BY 1 ORDER BY FCR_PCT DESC`, b),
      q(`SELECT AGENT_ID, ANY_VALUE(TEAM) AS TEAM, ${KPIS} FROM ${C}
         ${where ? where + ' AND' : 'WHERE'} AGENT_ID IS NOT NULL GROUP BY 1
         ORDER BY CSAT DESC NULLS LAST LIMIT 10`, b),
      q(`SELECT ENTITY, ${KPIS} FROM ${C} GROUP BY 1 ORDER BY CONTACTS DESC`),
    ]);
    return Response.json({ kpi: kpi[0] ?? {}, prior: prior[0] ?? {}, byChannel, daily, hourly, reasons, teams, agents, entities });
  } catch (e) {
    return errorResponse('contact', e);
  }
}
