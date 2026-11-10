'use client';

import { DataCard } from '@/components/ig/data-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson, num } from '@/lib/ig-format';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

type Row = Record<string, any>;
export type DrillType = 'abandoned' | 'redflag';

const TITLES: Record<DrillType, string> = {
  abandoned: 'Abandoned calls',
  redflag: 'Red-flag calls',
};

/** Sentiment score (≈ -1..+1) as a coloured badge. */
export function SentimentBadge({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  const v = num(value);
  const variant = v <= -0.2 ? 'destructive' : v < 0.2 ? 'warning' : 'success';
  const label = v <= -0.2 ? 'Negative' : v < 0.2 ? 'Neutral' : 'Positive';
  return <Badge variant={variant}>{label} {v.toFixed(2)}</Badge>;
}

function flags(r: Row) {
  return (
    <div className="flex flex-wrap gap-1">
      {r.ABANDONED && <Badge variant="secondary">Abandoned</Badge>}
      {r.COMPLAINT_LOGGED && <Badge variant="destructive">Complaint</Badge>}
      {r.VULNERABILITY_FLAG && <Badge variant="warning">Vulnerable</Badge>}
      {r.ESCALATED_TO_COMPLIANCE && <Badge variant="destructive">Escalated</Badge>}
    </div>
  );
}

const ts = (v: unknown) => (v ? String(v).replace('T', ' ').slice(0, 16) : '—');

/** Drill-down list of abandoned / red-flag contacts; click a row for the call detail sheet. */
export function CallDrilldown({ entity, type, onTypeChange }: { entity: string; type: DrillType; onTypeChange: (t: DrillType) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const qs = new URLSearchParams({ type, ...(entity ? { entity } : {}) });
  const { data, error, isPending } = useQuery({
    queryKey: ['contact-calls', type, entity],
    queryFn: () => fetchJson<{ rows: Row[] }>(`/api/contact/calls?${qs}`),
  });

  return (
    <div id="call-drilldown" className="scroll-mt-20">
      <DataCard
        title={TITLES[type]}
        description="Most recent 100 in the last 30 days. Red flag = complaint logged, vulnerability flagged or escalated to compliance. Click a call for the AI summary and transcript."
        loading={isPending}
        error={error}
        empty={!data?.rows.length}
        flush
        actions={
          <div className="flex shrink-0 gap-2">
            {(Object.keys(TITLES) as DrillType[]).map((t) => (
              <Button key={t} size="sm" variant={t === type ? 'default' : 'outline'} onClick={() => onTypeChange(t)}>
                {TITLES[t]}
              </Button>
            ))}
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Sentiment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.rows ?? []).map((r) => (
              <TableRow key={r.CONTACT_ID} className="cursor-pointer" onClick={() => setSelected(r.CONTACT_ID)}>
                <TableCell className="whitespace-nowrap text-xs">{ts(r.START_TS)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="font-medium text-primary underline-offset-2 hover:underline">{r.CONTACT_ID}</span>
                  <div className="text-xs text-muted-foreground">{r.CLIENT_ID} · {r.ENTITY}</div>
                </TableCell>
                <TableCell className="text-sm">{r.SUMMARY}</TableCell>
                <TableCell>{flags(r)}</TableCell>
                <TableCell><SentimentBadge value={r.SENTIMENT} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>
      <CallSheet id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function CallSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, error, isPending } = useQuery({
    queryKey: ['contact-call', id],
    queryFn: () => fetchJson<{ call: Row; chat: Row | null; summary: string | null }>(`/api/contact/call?id=${encodeURIComponent(id!)}`),
    enabled: !!id,
    staleTime: Infinity,
  });
  const c = data?.call;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Call {id}</SheetTitle>
          <SheetDescription>{c ? `${c.CHANNEL} · ${c.REASON} · ${ts(c.START_TS)}` : 'Loading…'}</SheetDescription>
        </SheetHeader>
        {error && <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>}
        {isPending ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <p className="text-xs text-muted-foreground">Generating Cortex AI summary…</p>
          </div>
        ) : c ? (
          <div className="mt-6 space-y-6 text-sm">
            <section>
              <h3 className="mb-2 font-semibold">AI summary</h3>
              <p className="whitespace-pre-wrap leading-relaxed">{data?.summary ? String(data.summary).replace(/\*\*|^#+\s*/gm, '') : '—'}</p>
              <p className="mt-1 text-xs text-muted-foreground">AI_COMPLETE (claude-sonnet-4-5)</p>
            </section>
            <section className="flex flex-wrap items-center gap-2">
              <SentimentBadge value={c.SENTIMENT} />
              {flags(c)}
            </section>
            <section className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                ['Client', `${c.CLIENT_ID} (${c.SEGMENT})`],
                ['Entity', `${c.ENTITY} · ${c.COUNTRY}`],
                ['Product', c.PRIMARY_PRODUCT],
                ['Agent / team', c.AGENT_ID ? `${c.AGENT_ID} · ${c.TEAM}` : '—'],
                ['Wait', `${c.WAIT_SEC}s`],
                ['Handle / hold / ACW', c.ABANDONED ? '—' : `${c.HANDLE_SEC}s / ${c.HOLD_SEC}s / ${c.ACW_SEC}s`],
                ['SLA met', c.SLA_MET ? 'Yes' : 'No'],
                ['Resolved first contact', c.RESOLVED_FIRST_CONTACT ? 'Yes' : 'No'],
                ['CSAT / NPS', `${c.CSAT ?? '—'} / ${c.NPS_SCORE ?? '—'}`],
                ['Repeat within 7d', c.REPEAT_7D ? 'Yes' : 'No'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="font-medium">{v ?? '—'}</div>
                </div>
              ))}
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Linked client conversation</h3>
              {data?.chat ? (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {data.chat.CHAT_ID} · {data.chat.CHANNEL} · {ts(data.chat.CHAT_TS)} · {data.chat.TOPIC} · overall sentiment {data.chat.OVERALL_SENTIMENT}
                  </p>
                  <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-xs leading-relaxed">{data.chat.TRANSCRIPT}</pre>
                </>
              ) : (
                <p className="text-muted-foreground">No transcript on file for this client — summary is based on the contact record.</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">UNSTRUCTURED.CHAT_INSIGHTS_V (nearest chat by client)</p>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
