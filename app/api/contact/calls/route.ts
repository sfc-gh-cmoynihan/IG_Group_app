import { errorResponse, q } from '@/lib/ig-server';
import { S } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const C = `${S}.CUSTOMER_CONTACTS`;

/** Drill-down filters. "redflag" = complaint, vulnerability or compliance escalation. */
const FILTERS: Record<string, string> = {
  abandoned: 'ABANDONED',
  redflag: '(COMPLAINT_LOGGED OR VULNERABILITY_FLAG OR ESCALATED_TO_COMPLIANCE)',
};

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const type = params.get('type') || '';
  const entity = params.get('entity') || '';
  const filter = FILTERS[type];
  if (!filter) return Response.json({ error: 'type must be abandoned or redflag' }, { status: 400 });
  try {
    const rows = await q(
      `SELECT CONTACT_ID, CLIENT_ID, ENTITY, CHANNEL, REASON, START_TS, WAIT_SEC, ABANDONED, AGENT_ID, TEAM,
              COMPLAINT_LOGGED, VULNERABILITY_FLAG, ESCALATED_TO_COMPLIANCE, CSAT, SENTIMENT,
              IFF(ABANDONED,
                  CHANNEL || ' contact about ' || LOWER(REASON) || ' abandoned after ' || WAIT_SEC || 's wait',
                  CHANNEL || ' contact about ' || LOWER(REASON) || ' handled by ' || COALESCE(TEAM, 'unassigned')
                    || IFF(RESOLVED_FIRST_CONTACT, ', resolved', ', not resolved')
                    || IFF(COMPLAINT_LOGGED, '; complaint logged', '')
                    || IFF(VULNERABILITY_FLAG, '; vulnerability flagged', '')
                    || IFF(ESCALATED_TO_COMPLIANCE, '; escalated to compliance', '')) AS SUMMARY
       FROM ${C} WHERE ${filter} ${entity ? 'AND ENTITY = ?' : ''}
         AND CONTACT_DATE >= DATEADD(day, -30, CURRENT_DATE())
       ORDER BY START_TS DESC LIMIT 100`,
      entity ? [entity] : [],
    );
    return Response.json({ rows });
  } catch (e) {
    return errorResponse('contact-calls', e);
  }
}
