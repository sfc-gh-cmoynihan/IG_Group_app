import { errorResponse, q, qLong } from '@/lib/ig-server';
import { S, U } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/** One contact plus the client's nearest chat transcript and a Cortex AI summary. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  try {
    const [call] = await q(`SELECT * FROM ${S}.CUSTOMER_CONTACTS WHERE CONTACT_ID = ?`, [id]);
    if (!call) return Response.json({ error: 'Contact not found' }, { status: 404 });
    const [chat] = await q(
      `SELECT CHAT_ID, CHAT_TS, CHANNEL, TOPIC, CLIENT_INTENT, OVERALL_SENTIMENT, SERVICE_SENTIMENT, TRANSCRIPT
       FROM ${U}.CHAT_INSIGHTS_V WHERE CLIENT_ID = ?
       ORDER BY ABS(DATEDIFF(minute, CHAT_TS, ?::TIMESTAMP_NTZ)) LIMIT 1`,
      [String(call.CLIENT_ID), String(call.START_TS)],
    );
    const facts = JSON.stringify({ ...call, linked_transcript: chat?.TRANSCRIPT ?? null });
    const [ai] = await qLong(
      `SELECT AI_COMPLETE('claude-sonnet-4-5',
         'You are a contact-centre QA analyst at IG Group. In 3-4 sentences summarise this client contact: what happened, ' ||
         'the client sentiment, any Consumer Duty / complaint / vulnerability risk, and a recommended next action. ' ||
         'Sentiment ranges roughly -1 (negative) to +1 (positive). Contact JSON: ' || ?) AS SUMMARY`,
      [facts],
    );
    return Response.json({ call, chat: chat ?? null, summary: ai?.SUMMARY ?? null });
  } catch (e) {
    return errorResponse('contact-call', e);
  }
}
