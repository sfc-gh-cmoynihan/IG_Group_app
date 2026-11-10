import { errorResponse, q } from '@/lib/ig-server';
import { S, U } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/** Single client profile (Client 360 drill-down). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const [profile, accounts, trades, chats] = await Promise.all([
      q(`SELECT c.*, s.CHURN_PROBABILITY, s.CHURN_RISK, s.NEXT_BEST_ACTION
         FROM ${S}.DT_CLIENT_360 c LEFT JOIN ${S}.CHURN_SCORES s USING (CLIENT_ID) WHERE c.CLIENT_ID = ?`, [id]),
      q(`SELECT a.ACCOUNT_ID, a.PRODUCT_LINE, a.ACCOUNT_STATUS, TO_CHAR(a.OPENED_DATE, 'YYYY-MM-DD') AS OPENED_DATE, b.CASH_BALANCE_GBP, b.MARGIN_USED_GBP
         FROM ${S}.ACCOUNTS a LEFT JOIN ${S}.ACCOUNT_BALANCES b USING (ACCOUNT_ID) WHERE a.CLIENT_ID = ? ORDER BY a.OPENED_DATE`, [id]),
      q(`SELECT t.TRADE_TS, i.SYMBOL, t.PRODUCT_LINE, t.SIDE, t.NOTIONAL_GBP, t.CLIENT_PNL_GBP, t.CHANNEL
         FROM ${S}.TRADES t JOIN ${S}.INSTRUMENTS i USING (INSTRUMENT_ID) WHERE t.CLIENT_ID = ? ORDER BY t.TRADE_TS DESC LIMIT 10`, [id]),
      q(`SELECT CHAT_TS, CHANNEL, TOPIC, CLIENT_INTENT, OVERALL_SENTIMENT, TRANSCRIPT
         FROM ${U}.CHAT_INSIGHTS_V WHERE CLIENT_ID = ? ORDER BY CHAT_TS DESC LIMIT 5`, [id]),
    ]);
    if (!profile.length) return Response.json({ error: 'Client not found' }, { status: 404 });
    return Response.json({ profile: profile[0], accounts, trades, chats });
  } catch (e) {
    return errorResponse('client', e);
  }
}
