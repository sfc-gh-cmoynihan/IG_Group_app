import { errorResponse, q } from '@/lib/ig-server';
import { S, U } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/** COO home: everything is "as of" the latest trading day in the data. */
export async function GET() {
  try {
    const [asof] = await q(`SELECT TO_CHAR(MAX(TRADE_DATE), 'YYYY-MM-DD') AS D FROM ${S}.DT_DAILY_REVENUE`);
    const d = String(asof.D);
    const [trades, settle, cash, custodian, revenue, clients, nps, products, issues] = await Promise.all([
      q(`SELECT TO_CHAR(TRADE_DATE, 'YYYY-MM-DD') AS D, SUM(TRADES) AS TRADES, SUM(NOTIONAL_GBP) AS NOTIONAL, SUM(TOTAL_REVENUE_GBP) AS REVENUE
         FROM ${S}.DT_DAILY_REVENUE WHERE TRADE_DATE > DATEADD(day, -14, ?::DATE) GROUP BY 1 ORDER BY 1`, [d]),
      q(`SELECT STATUS, COUNT(*) AS N, SUM(NET_AMOUNT_GBP) AS NET_GBP, SUM(ABS(NET_AMOUNT_GBP)) AS GROSS_GBP
         FROM ${S}.OPS_SETTLEMENTS GROUP BY 1`),
      q(`SELECT BANK, ACCOUNT_TYPE, SUM(BALANCE_GBP) AS BALANCE_GBP FROM ${S}.OPS_BANK_BALANCES GROUP BY 1, 2 ORDER BY 1, 2`),
      q(`SELECT CUSTODIAN, EXCHANGE, SUM(NET_AMOUNT_GBP) AS NET_30D_GBP,
                SUM(IFF(STATUS <> 'SETTLED', NET_AMOUNT_GBP, 0)) AS OUTSTANDING_GBP,
                COUNT_IF(STATUS <> 'SETTLED') AS OUTSTANDING_N
         FROM ${S}.OPS_SETTLEMENTS WHERE SETTLE_DATE > DATEADD(day, -30, ?::DATE)
         GROUP BY 1, 2 ORDER BY 1, 2`, [d]),
      q(`SELECT ENTITY, SUM(TOTAL_REVENUE_GBP) AS REVENUE,
                100 * RATIO_TO_REPORT(SUM(TOTAL_REVENUE_GBP)) OVER () AS PCT
         FROM ${S}.DT_DAILY_REVENUE WHERE TRADE_DATE > DATEADD(day, -30, ?::DATE) GROUP BY 1 ORDER BY 2 DESC`, [d]),
      q(`SELECT COUNT_IF(FIRST_FUNDED_DATE IS NOT NULL) AS FUNDED, COUNT(*) AS REGISTERED,
                COUNT_IF(SIGNUP_DATE = ?::DATE) AS NEW_TODAY,
                COUNT_IF(SIGNUP_DATE > DATEADD(day, -30, ?::DATE)) AS NEW_30D,
                COUNT_IF(SIGNUP_DATE > DATEADD(day, -60, ?::DATE) AND SIGNUP_DATE <= DATEADD(day, -30, ?::DATE)) AS NEW_PRIOR_30D
         FROM ${S}.CLIENTS`, [d, d, d, d]),
      q(`SELECT 100 * (COUNT_IF(NPS_SCORE >= 9) - COUNT_IF(NPS_SCORE <= 6)) / NULLIF(COUNT(NPS_SCORE), 0) AS NPS,
                COUNT(NPS_SCORE) AS RESPONSES
         FROM ${S}.CUSTOMER_CONTACTS WHERE CONTACT_DATE > DATEADD(day, -30, ?::DATE)`, [d]),
      q(`SELECT i.SYMBOL, i.NAME, i.ASSET_CLASS, COUNT(*) AS TRADES, SUM(t.NOTIONAL_GBP) AS NOTIONAL,
                SUM(t.SPREAD_REVENUE_GBP + t.COMMISSION_GBP + t.FINANCING_GBP) AS REVENUE
         FROM ${S}.TRADES t JOIN ${S}.INSTRUMENTS i USING (INSTRUMENT_ID)
         WHERE t.TRADE_TS >= ?::DATE AND t.TRADE_TS < DATEADD(day, 1, ?::DATE)
         GROUP BY 1, 2, 3 ORDER BY TRADES DESC LIMIT 10`, [d, d]),
      q(`SELECT 'Settlements' AS AREA, 'Failed settlements' AS ISSUE, COUNT(*) AS N, SUM(ABS(NET_AMOUNT_GBP)) AS VALUE_GBP, 'high' AS SEV, '/' AS HREF FROM ${S}.OPS_SETTLEMENTS WHERE STATUS = 'FAILED'
         UNION ALL SELECT 'Client money', 'CASS reconciliation shortfalls (latest)', COUNT(*), -SUM(DIFFERENCE_GBP), 'high', '/compliance'
           FROM ${S}.CLIENT_MONEY_RECON_V WHERE RECON_STATUS = 'SHORTFALL' AND RECON_DATE = (SELECT MAX(RECON_DATE) FROM ${S}.CLIENT_MONEY_RECON_V)
         UNION ALL SELECT 'Risk', 'Accounts at close-out', COUNT(*), SUM(MARGIN_USED_GBP), 'high', '/risk' FROM ${S}.DT_CLIENT_MARGIN_RISK WHERE MARGIN_STATUS = 'Close-out'
         UNION ALL SELECT 'Risk', 'Accounts on margin call', COUNT(*), SUM(MARGIN_USED_GBP), 'medium', '/risk' FROM ${S}.DT_CLIENT_MARGIN_RISK WHERE MARGIN_STATUS = 'Margin call'
         UNION ALL SELECT 'Regulatory', 'Rejected transaction reports (7d)', COUNT(*), NULL, 'high', '/compliance' FROM ${S}.REG_TRANSACTION_REPORTS WHERE STATUS = 'REJECTED' AND TRADE_TS > DATEADD(day, -7, ?::DATE)
         UNION ALL SELECT 'Regulatory', 'Late / pending transaction reports (7d)', COUNT(*), NULL, 'medium', '/compliance' FROM ${S}.REG_TRANSACTION_REPORTS WHERE STATUS IN ('LATE', 'PENDING') AND TRADE_TS > DATEADD(day, -7, ?::DATE)
         UNION ALL SELECT 'Financial crime', 'Open fraud / AML alerts', COUNT(*), NULL, 'medium', '/surveillance' FROM ${S}.FRAUD_ALERTS WHERE CASE_STATUS = 'Open'
         UNION ALL SELECT 'Clients', 'Open complaints', COUNT(*), NULL, 'medium', '/contact' FROM ${U}.COMPLAINTS WHERE STATUS = 'Open'
         UNION ALL SELECT 'Payments', 'Pending client payments', COUNT(*), SUM(AMOUNT_GBP), 'low', '/' FROM ${S}.PAYMENTS WHERE STATUS = 'Pending' AND PAYMENT_TS > DATEADD(day, -7, ?::DATE)
         UNION ALL SELECT 'Settlements', 'Pending settlements', COUNT(*), SUM(ABS(NET_AMOUNT_GBP)), 'low', '/' FROM ${S}.OPS_SETTLEMENTS WHERE STATUS = 'PENDING'`,
        [d, d, d]),
    ]);
    return Response.json({ asOf: d, trades, settle, cash, custodian, revenue, clients: clients[0] ?? {}, nps: nps[0] ?? {}, products, issues });
  } catch (e) {
    return errorResponse('coo', e);
  }
}
