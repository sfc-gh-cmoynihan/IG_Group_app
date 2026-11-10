import { errorResponse, q, qLong } from '@/lib/ig-server';
import { S, U } from '@/lib/constants';
import { isAgentModel, isRoleAgent, ROLE_AGENTS } from '@/lib/agent-models';

export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant'; text: string };

/** Agent specs (tools, tool_resources, instructions), cached per agent so model overrides reuse one definition. */
const specCache = new Map<string, { spec: Record<string, any>; at: number }>();
async function agentSpec(fqn: string): Promise<Record<string, any>> {
  const hit = specCache.get(fqn);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.spec;
  const rows = await q(`DESCRIBE AGENT ${fqn}`);
  const raw = rows[0]?.agent_spec ?? rows[0]?.AGENT_SPEC;
  const spec = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, any>);
  // sample_questions is UI metadata, not part of the run request
  if (spec?.instructions) delete spec.instructions.sample_questions;
  specCache.set(fqn, { spec, at: Date.now() });
  return spec;
}

/**
 * POST /api/agent  { messages: [{role, text}], model?: string, agent?: 'general'|'cfo'|'cro'|'ops' }
 * model 'auto' (default) runs the chosen agent object via DATA_AGENT_RUN. Any other allow-listed model
 * runs the same spec inline via AGENT_RUN with models.orchestration overridden.
 * The request body is passed as a bind variable, never interpolated; agent names come from a fixed allow-list.
 */
export async function POST(req: Request) {
  try {
    const { messages, model = 'auto', agent = 'general' } = (await req.json()) as { messages: Msg[]; model?: string; agent?: string };
    if (!Array.isArray(messages) || !messages.length) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }
    if (!isAgentModel(model)) {
      return Response.json({ error: 'unsupported model' }, { status: 400 });
    }
    if (!isRoleAgent(agent)) {
      return Response.json({ error: 'unsupported agent' }, { status: 400 });
    }
    const fqn = `${S}.${ROLE_AGENTS[agent]}`;
    const msgs = messages.slice(-10).map((m) => ({
      role: m.role,
      content: [{ type: 'text', text: String(m.text).slice(0, 4000) }],
    }));
    const rows =
      model === 'auto'
        ? await qLong(`SELECT TRY_PARSE_JSON(SNOWFLAKE.CORTEX.DATA_AGENT_RUN('${fqn}', ?)) AS R`, [
            JSON.stringify({ messages: msgs }),
          ])
        : await qLong(`SELECT TRY_PARSE_JSON(SNOWFLAKE.CORTEX.AGENT_RUN(?)) AS R`, [
            JSON.stringify({ ...(await agentSpec(fqn)), models: { orchestration: model }, messages: msgs }),
          ]);
    const r = (typeof rows[0]?.R === 'string' ? JSON.parse(rows[0].R as string) : rows[0]?.R) as any;
    const content: any[] = r?.content ?? [];
    const text = content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n\n');
    const tools = content
      .filter((c) => c.type === 'tool_use')
      .map((c) => c.tool_use?.name)
      .filter((n: string) => n && n !== 'system_execute_sql');
    const sql = content
      .filter((c) => c.type === 'tool_result')
      .map((c) => c.tool_result?.content?.[0]?.json?.sql)
      .filter(Boolean);
    const tables = content
      .filter((c) => c.type === 'table')
      .map((c) => {
        const rs = c.table?.result_set;
        return {
          title: c.table?.title ?? '',
          columns: (rs?.resultSetMetaData?.rowType ?? []).map((t: any) => t.name),
          rows: (rs?.data ?? []).slice(0, 50),
        };
      });
    const usedModel =
      (r?.metadata?.usage?.tokens_consumed ?? []).find((t: any) => t.model_role === 'orchestration')?.model_name ??
      r?.metadata?.usage?.tokens_consumed?.[0]?.model_name ??
      model;
    return Response.json({
      agent: ROLE_AGENTS[agent],
      model: usedModel,
      text: text || r?.message || 'The agent returned no text response.',
      tools: Array.from(new Set(tools)),
      sql,
      tables,
      warnings: r?.warnings ?? [],
    });
  } catch (e) {
    return errorResponse('agent', e);
  }
}

/** GET /api/agent?q=...&service=research|support|documents — direct Cortex Search for the side panel. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get('q') || '').slice(0, 500);
  const param = url.searchParams.get('service');
  const service = param === 'support' ? 'SUPPORT_SEARCH' : param === 'documents' ? 'DOCS_SEARCH' : 'RESEARCH_SEARCH';
  if (!query) return Response.json({ results: [] });
  const columns =
    service === 'SUPPORT_SEARCH'
      ? ['CHAT_ID', 'ENTITY', 'TOPIC', 'CLIENT_INTENT', 'OVERALL_SENTIMENT', 'CHAT_TS', 'TRANSCRIPT']
      : service === 'DOCS_SEARCH'
        ? ['CHUNK_ID', 'TITLE', 'DOC_TYPE', 'PERIOD', 'PAGE_NO', 'CHUNK']
        : ['NOTE_ID', 'TITLE', 'MARKET', 'AUTHOR', 'PUBLISHED_DATE', 'BODY'];
  try {
    const rows = await q(`SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW('${U}.${service}', ?) AS R`, [
      JSON.stringify({ query, columns, limit: 6 }),
    ]);
    const parsed = JSON.parse(String(rows[0]?.R ?? '{}'));
    return Response.json({ results: parsed.results ?? [] });
  } catch (e) {
    return errorResponse('search', e);
  }
}
