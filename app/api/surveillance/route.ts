import { errorResponse, q } from '@/lib/ig-server';
import { S } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [alerts, byTypology, byEntity, kpi] = await Promise.all([
      q(`SELECT ALERT_ID, CLIENT_ID, FULL_NAME, ENTITY, COUNTRY, TYPOLOGY, RISK_SCORE, REASONS,
                N_PAY_30D, DEP_GBP, WD_GBP, PAYER_COUNTRIES, FAILED_7D, IP_COUNTRIES_7D, DEVICES_7D, TRADES_30D,
                CASE_STATUS, AI_TRIAGE
         FROM ${S}.FRAUD_ALERTS ORDER BY RISK_SCORE DESC LIMIT 60`),
      q(`SELECT TYPOLOGY, COUNT(*) AS N, AVG(RISK_SCORE) AS AVG_SCORE FROM ${S}.FRAUD_ALERTS GROUP BY 1 ORDER BY 2 DESC`),
      q(`SELECT ENTITY, COUNT(*) AS N FROM ${S}.FRAUD_ALERTS GROUP BY 1 ORDER BY 2 DESC`),
      q(`SELECT COUNT(*) AS ALERTS, COUNT_IF(RISK_SCORE >= 60) AS HIGH_RISK,
                SUM(IFF(TYPOLOGY = 'Money mule / AML', WD_GBP, 0)) AS MULE_WITHDRAWALS,
                COUNT(AI_TRIAGE) AS AI_TRIAGED
         FROM ${S}.FRAUD_ALERTS`),
    ]);
    return Response.json({ alerts, byTypology, byEntity, kpi: kpi[0] ?? {} });
  } catch (e) {
    return errorResponse('surveillance', e);
  }
}
