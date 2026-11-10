'use client';

import { DataCard, pageShell, SourceNote } from '@/components/ig/data-card';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchJson } from '@/lib/ig-format';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Leaf, Loader2, Newspaper, Search, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';

type Aspect = { name: string; sentiment: string };
type Doc = {
  DOC_ID: string;
  TITLE: string;
  DOC_TYPE: string;
  PERIOD: string;
  PUBLISHED_DATE: string | null;
  SOURCE_URL: string;
  PAGE_COUNT: number | null;
  SUMMARY: string | null;
  SENTIMENT: string | null;
  ASPECTS: Aspect[];
};
type Hit = { CHUNK_ID: string; DOC_ID: string; TITLE: string; DOC_TYPE: string; PERIOD: string; PUBLISHED_DATE: string; SOURCE_URL: string; PAGE_NO: number | string; CHUNK: string };

const TYPES = ['All', 'Annual Report', 'Quarterly Report', 'ESG Report', 'News'] as const;
type DocType = (typeof TYPES)[number];

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  negative: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
  mixed: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  neutral: 'border-border bg-muted text-muted-foreground',
};

function SentimentBadge({ value, label }: { value?: string | null; label?: string }) {
  const v = (value || 'unknown').toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${SENTIMENT_STYLE[v] ?? SENTIMENT_STYLE.neutral}`}>
      {label ? `${label}: ` : ''}
      {v}
    </span>
  );
}

function DocCard({ d }: { d: Doc }) {
  const [open, setOpen] = useState(false);
  const aspects = d.ASPECTS.filter((a) => a.name !== 'overall' && a.sentiment !== 'unknown');
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{d.DOC_TYPE}</Badge>
        <SentimentBadge value={d.SENTIMENT} label="Sentiment" />
        <span className="text-[11px] text-muted-foreground">
          {d.PERIOD}
          {d.PUBLISHED_DATE && ` · published ${d.PUBLISHED_DATE}`}
          {d.PAGE_COUNT ? ` · ${d.PAGE_COUNT} page${d.PAGE_COUNT > 1 ? 's' : ''}` : ''}
        </span>
      </div>
      <a href={d.SOURCE_URL} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1 text-sm font-semibold hover:text-primary">
        {d.TITLE}
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
      </a>
      {d.SUMMARY ? (
        <>
          <p className={`whitespace-pre-line text-xs leading-relaxed text-muted-foreground ${open ? '' : 'line-clamp-6'}`}>{d.SUMMARY}</p>
          <button onClick={() => setOpen((o) => !o)} className="self-start text-[11px] font-medium text-primary hover:underline">
            {open ? 'Show less' : 'Show full summary'}
          </button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Summary not generated yet.</p>
      )}
      {!!aspects.length && (
        <div className="flex flex-wrap gap-1">
          {aspects.map((a) => (
            <SentimentBadge key={a.name} value={a.sentiment} label={a.name} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function DocumentsPage() {
  const [type, setType] = useState<DocType>('All');
  const { data, error, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => fetchJson<{ docs: Doc[] }>('/api/documents'),
  });
  const docs = data?.docs ?? [];
  const shown = type === 'All' ? docs : docs.filter((d) => d.DOC_TYPE === type);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of docs) c[d.DOC_TYPE] = (c[d.DOC_TYPE] ?? 0) + 1;
    return c;
  }, [docs]);
  const positive = docs.filter((d) => d.SENTIMENT === 'positive').length;

  return (
    <main className={pageShell}>
      <PageHeader
        eyebrow="Documents"
        title="IG Group reports & news"
        description="IG Group's published annual reports, ESG disclosures, quarterly / interim results and news releases — parsed with AI_PARSE_DOCUMENT, summarised with AI_AGG, scored with AI_SENTIMENT and searchable through Cortex Search (also available to every IG agent)."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Documents" value={docs.length || '—'} hint={`${Object.values(counts).length} categories`} icon={FileText} />
        <StatCard label="Annual & quarterly" value={(counts['Annual Report'] ?? 0) + (counts['Quarterly Report'] ?? 0)} hint="Reports, results and trading updates" icon={TrendingUp} />
        <StatCard label="ESG reports" value={counts['ESG Report'] ?? 0} hint="Sustainability disclosures (SASB / GRI)" icon={Leaf} />
        <StatCard label="Positive sentiment" value={docs.length ? `${positive} / ${docs.length}` : '—'} hint="Overall AI_SENTIMENT of each summary" icon={Newspaper} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DataCard
          className="lg:col-span-2"
          title="Library"
          description="AI summary and sentiment per document; aspect sentiment shown where the topic is discussed"
          loading={isLoading}
          error={error}
          empty={!isLoading && !shown.length}
          actions={
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Document type">
              {TYPES.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={type === t}
                  onClick={() => setType(t)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${type === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  {t}
                  {t !== 'All' && counts[t] ? ` (${counts[t]})` : ''}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((d) => (
              <DocCard key={d.DOC_ID} d={d} />
            ))}
          </div>
          <SourceNote>UNSTRUCTURED.IG_DOCUMENTS · IG_DOCS_STAGE · AI_PARSE_DOCUMENT · AI_AGG · AI_SENTIMENT</SourceNote>
        </DataCard>

        <DocSearch />
      </div>
    </main>
  );
}

function DocSearch() {
  const [type, setType] = useState<DocType>('All');
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, isFetching } = useQuery({
    queryKey: ['doc-search', type, query],
    enabled: !!query,
    queryFn: () =>
      fetchJson<{ results: Hit[] }>(`/api/documents?q=${encodeURIComponent(query)}${type === 'All' ? '' : `&type=${encodeURIComponent(type)}`}`),
  });
  return (
    <DataCard
      title="Search documents"
      description="Cortex Search (hybrid vector + keyword) over every page"
      error={error}
      actions={
        <select
          aria-label="Filter search by document type"
          value={type}
          onChange={(e) => setType(e.target.value as DocType)}
          className="h-8 rounded-md border border-input bg-card px-2 text-xs"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'All' ? 'All types' : t}
            </option>
          ))}
        </select>
      }
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(term.trim());
        }}
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. Scope 3 emissions, Underdog, revenue guidance"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!term.trim()}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>
      <div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto">
        {(data?.results ?? []).map((r) => (
          <div key={r.CHUNK_ID} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="secondary">{r.DOC_TYPE}</Badge>
              <span className="text-[11px] text-muted-foreground">
                p.{r.PAGE_NO} · {r.PERIOD}
              </span>
            </div>
            <a href={r.SOURCE_URL} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm font-medium hover:text-primary">
              {r.TITLE}
            </a>
            <p className="mt-1 line-clamp-6 whitespace-pre-line text-xs text-muted-foreground">{r.CHUNK}</p>
          </div>
        ))}
        {query && !isFetching && !data?.results?.length && <p className="text-xs text-muted-foreground">No results.</p>}
      </div>
      <SourceNote>UNSTRUCTURED.DOCS_SEARCH</SourceNote>
    </DataCard>
  );
}
