import { errorResponse, q } from '@/lib/ig-server';
import { U } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const DOC_TYPES = ['ESG Report', 'Annual Report', 'Quarterly Report', 'News'] as const;
const SEARCH_COLUMNS = ['CHUNK_ID', 'DOC_ID', 'TITLE', 'DOC_TYPE', 'PERIOD', 'PUBLISHED_DATE', 'SOURCE_URL', 'PAGE_NO', 'CHUNK'];

/**
 * GET /api/documents                     -> document register with AI summary + sentiment
 * GET /api/documents?q=...&type=...      -> Cortex Search (DOCS_SEARCH) over document chunks
 * The search request is passed as a bind variable; type comes from a fixed allow-list.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get('q') || '').trim().slice(0, 500);
  const type = url.searchParams.get('type') || '';
  try {
    if (query) {
      const body: Record<string, unknown> = { query, columns: SEARCH_COLUMNS, limit: 10 };
      if ((DOC_TYPES as readonly string[]).includes(type)) body.filter = { '@eq': { DOC_TYPE: type } };
      const rows = await q(`SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW('${U}.DOCS_SEARCH', ?) AS R`, [JSON.stringify(body)]);
      const parsed = JSON.parse(String(rows[0]?.R ?? '{}'));
      return Response.json({ results: parsed.results ?? [] });
    }
    const docs = await q(`SELECT DOC_ID, TITLE, DOC_TYPE, PERIOD, TO_CHAR(PUBLISHED_DATE, 'YYYY-MM-DD') AS PUBLISHED_DATE,
                                 SOURCE_URL, PAGE_COUNT, SUMMARY, SENTIMENT, SENTIMENT_ASPECTS:categories AS ASPECTS
                          FROM ${U}.IG_DOCUMENTS ORDER BY PUBLISHED_DATE DESC NULLS LAST, DOC_ID`);
    return Response.json({
      docs: docs.map((d) => ({ ...d, ASPECTS: typeof d.ASPECTS === 'string' ? JSON.parse(d.ASPECTS) : (d.ASPECTS ?? []) })),
    });
  } catch (e) {
    return errorResponse('documents', e);
  }
}
