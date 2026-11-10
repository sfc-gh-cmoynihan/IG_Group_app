'use client';

import { categoryColor, ChartTooltip, CHART_COLORS, CHART_THEME, formatTick } from '@/components/chart-utils';
import { DataCard, EntityFilter, pageShell, SourceNote } from '@/components/ig/data-card';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson, gbp, int, num, pct, shortDate } from '@/lib/ig-format';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePoundSterling, Target, TrendingDown, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Row = Record<string, any>;
type Data = {
  funnel: Row[]; lifecycle: Row[]; churnByChannel: Row[]; atRisk: Row[]; topics: Row[];
  segments: Row[]; metrics: Row; kpi: Row;
};

export default function ClientsPage() {
  const [entity, setEntity] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const qc = useQueryClient();
  // Start loading a client's drill-down on hover so the sheet opens with data ready.
  const prefetch = (id: string) =>
    qc.prefetchQuery({ queryKey: ['client', id], queryFn: () => fetchJson(`/api/clients/${encodeURIComponent(id)}`) });
  const { data, error, isPending } = useQuery({
    queryKey: ['clients', entity],
    queryFn: () => fetchJson<Data>(`/api/clients${entity ? `?entity=${encodeURIComponent(entity)}` : ''}`),
  });
  const k = data?.kpi ?? {};
  const m = data?.metrics ?? {};

  return (
    <main className={pageShell}>
      <PageHeader
        eyebrow="Use case 1"
        title="Client 360 & retention"
        description="One governed client view joining onboarding, trading, payments, CRM (JSON) and AI-enriched support chats, with a Snowflake ML churn model driving next-best-action."
        actions={<EntityFilter value={entity} onChange={setEntity} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Clients" value={int(k.CLIENTS)} hint={`${pct(k.FUNDING_CONVERSION)} registration → funded`} icon={UserPlus} />
            <StatCard label="Client balances" value={gbp(k.BALANCES)} hint={`Net deposits ${gbp(k.NET_DEPOSITS)}`} icon={BadgePoundSterling} />
            <StatCard label="Revenue at risk" value={gbp(k.REVENUE_AT_RISK)} hint="Active & lapsing clients" icon={TrendingDown} />
            <StatCard
              label="Churn model"
              value={`${pct(num(m.PRECISION) * 100, 0)} precision`}
              hint={`${pct(num(m.RECALL) * 100, 0)} recall · in-sample · base rate ${pct(num(m.BASE_RATE) * 100, 0)}`}
              icon={Target}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DataCard title="Acquisition funnel" description="Registered → funded → traded → active" loading={isPending} error={error}>
          <div className="space-y-3">
            {(data?.funnel ?? []).map((f, i, arr) => {
              const top = num(arr[0]?.N) || 1;
              const w = (num(f.N) / top) * 100;
              return (
                <button
                  key={f.STAGE}
                  type="button"
                  className="block w-full rounded-md p-1 text-left transition hover:bg-muted/60"
                  onClick={() => setDrill({ dim: 'funnel', value: f.STAGE, label: `Funnel · ${f.STAGE}` })}
                >
                  <div className="flex justify-between text-sm">
                    <span>{f.STAGE}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {int(f.N)} {i > 0 && `· ${pct((num(f.N) / num(arr[i - 1].N)) * 100, 0)}`}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-muted">
                    <div className="h-2.5 rounded-full" style={{ width: `${w}%`, background: categoryColor(i) }} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {(data?.lifecycle ?? []).map((l) => (
              <Badge
                key={l.LIFECYCLE_STAGE}
                variant="secondary"
                className="cursor-pointer hover:bg-primary/15"
                onClick={() => setDrill({ dim: 'lifecycle', value: l.LIFECYCLE_STAGE, label: `Lifecycle · ${l.LIFECYCLE_STAGE}` })}
              >
                {l.LIFECYCLE_STAGE}: {int(l.N)}
              </Badge>
            ))}
          </div>
        </DataCard>

        <DataCard className="lg:col-span-2" title="Churn risk by acquisition channel" description="Average model churn probability for active & lapsing clients. Click a bar for the clients." loading={isPending} error={error} empty={!data?.churnByChannel.length}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data?.churnByChannel ?? []).map((r) => ({ c: r.ACQUISITION_CHANNEL, 'Avg churn %': num(r.AVG_CHURN_PCT), 'Revenue at risk': num(r.REVENUE_AT_RISK) }))}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="c" tick={CHART_THEME.tick} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_THEME.tick} axisLine={false} tickLine={false} unit="%" width={44} />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="Avg churn %"
                  radius={[4, 4, 0, 0]}
                  className="cursor-pointer"
                  onClick={(d: { c?: string; payload?: { c?: string } }) => {
                    const c = d?.payload?.c ?? d?.c;
                    if (c) setDrill({ dim: 'channel', value: c, label: `Acquisition channel · ${c}` });
                  }}
                >
                  {(data?.churnByChannel ?? []).map((r, i) => (
                    <Cell key={i} fill={categoryColor(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SourceNote>SNOWFLAKE.ML.CLASSIFICATION model IG_CHURN_MODEL → STRUCTURED.CHURN_SCORES</SourceNote>
        </DataCard>
      </div>

      <DataCard
        title="Highest revenue at risk: retention worklist"
        description="Click a client for the full 360 profile. Next-best-action is derived from model score, complaints, P&L and product holdings."
        loading={isPending}
        error={error}
        empty={!data?.atRisk.length}
        flush
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead numeric>Churn prob.</TableHead>
              <TableHead numeric>Revenue at risk</TableHead>
              <TableHead numeric>Complaints</TableHead>
              <TableHead>Next best action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.atRisk ?? []).map((r) => (
              <TableRow key={r.CLIENT_ID} className="cursor-pointer" onMouseEnter={() => prefetch(r.CLIENT_ID)} onClick={() => setSelected(r.CLIENT_ID)}>
                <TableCell>
                  <div className="font-medium">{r.FULL_NAME}</div>
                  <div className="text-xs text-muted-foreground">{r.CLIENT_ID} · {r.SEGMENT}</div>
                </TableCell>
                <TableCell>{r.ENTITY}</TableCell>
                <TableCell>{r.PRIMARY_PRODUCT}</TableCell>
                <TableCell>{r.ACQUISITION_CHANNEL}</TableCell>
                <TableCell numeric>
                  <Badge variant={num(r.CHURN_PROBABILITY) >= 0.6 ? 'destructive' : 'warning'}>{pct(num(r.CHURN_PROBABILITY) * 100, 0)}</Badge>
                </TableCell>
                <TableCell numeric>{gbp(r.REVENUE_AT_RISK_GBP)}</TableCell>
                <TableCell numeric>{int(r.COMPLAINTS)}</TableCell>
                <TableCell className="max-w-[260px] truncate text-xs">{r.NEXT_BEST_ACTION}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <DataCard className="lg:col-span-2" title="What clients are talking about" description="AI_CLASSIFY topic + intent and AI_SENTIMENT on support conversations" loading={isPending} error={error} flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead numeric>Conversations</TableHead>
                <TableHead numeric>Negative</TableHead>
                <TableHead numeric>Intends to leave</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.topics ?? []).map((t) => (
                <TableRow
                  key={t.TOPIC ?? 'n/a'}
                  className={t.TOPIC ? 'cursor-pointer' : undefined}
                  onClick={() => t.TOPIC && setDrill({ dim: 'topic', value: t.TOPIC, label: `Chat topic · ${t.TOPIC}` })}
                >
                  <TableCell className="font-medium">{t.TOPIC ?? 'Unclassified'}</TableCell>
                  <TableCell numeric>{int(t.N)}</TableCell>
                  <TableCell numeric>{pct((num(t.NEGATIVE) / Math.max(num(t.N), 1)) * 100, 0)}</TableCell>
                  <TableCell numeric>{int(t.INTENDS_TO_LEAVE)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-6 pb-4"><SourceNote>UNSTRUCTURED.CHAT_INSIGHTS_V (Cortex AI functions)</SourceNote></div>
        </DataCard>

        <DataCard title="Marketing audiences" description="Opted-in clients, hashed emails, shared via IG_MARKETING_SEGMENTS_SHARE" loading={isPending} error={error}>
          <div className="space-y-2">
            {(data?.segments ?? []).map((s) => (
              <button
                key={s.AUDIENCE}
                type="button"
                onClick={() => setDrill({ dim: 'audience', value: s.AUDIENCE, label: `Audience · ${s.AUDIENCE}` })}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary/60"
              >
                <span>{s.AUDIENCE}</span>
                <span className="font-semibold tabular-nums">{int(s.CLIENTS)}</span>
              </button>
            ))}
          </div>
          <SourceNote>STRUCTURED.MARKETING_SEGMENTS (secure view) → share / clean room</SourceNote>
        </DataCard>
      </div>

      <SegmentSheet drill={drill} entity={entity} onClose={() => setDrill(null)} onPick={setSelected} onHover={prefetch} />
      <ClientSheet id={selected} onClose={() => setSelected(null)} />
    </main>
  );
}

type Drill = { dim: 'funnel' | 'lifecycle' | 'channel' | 'topic' | 'audience'; value: string; label: string };

/** Clients behind a funnel stage / lifecycle / channel / topic / audience. Click a row for the full 360. */
function SegmentSheet({
  drill,
  entity,
  onClose,
  onPick,
  onHover,
}: {
  drill: Drill | null;
  entity: string;
  onClose: () => void;
  onPick: (id: string) => void;
  onHover: (id: string) => void;
}) {
  const qs = drill ? new URLSearchParams({ dim: drill.dim, value: drill.value, ...(entity ? { entity } : {}) }) : null;
  const { data, isPending, error } = useQuery({
    queryKey: ['clients-list', drill?.dim, drill?.value, entity],
    enabled: !!drill,
    queryFn: () => fetchJson<{ rows: Row[]; summary: Row }>(`/api/clients/list?${qs}`),
  });
  const s = data?.summary ?? {};
  return (
    <Sheet open={!!drill} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{drill?.label}</SheetTitle>
        </SheetHeader>
        {isPending ? (
          <div className="space-y-2 p-4"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-60 w-full" /></div>
        ) : error ? (
          <p className="p-4 text-sm text-destructive">{(error as Error).message}</p>
        ) : (
          <div className="space-y-4 pt-4 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Clients', int(s.N)],
                ['Balances', gbp(s.BALANCES)],
                ['Revenue 180d', gbp(s.REVENUE_180D)],
                ['Revenue at risk', gbp(s.REVENUE_AT_RISK)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">{l}</div>
                  <div className="font-semibold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Top {data?.rows.length ?? 0} by revenue at risk, then 180-day revenue. Click a client for the full profile.</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead numeric>Balance</TableHead>
                  <TableHead numeric>Churn</TableHead>
                  <TableHead numeric>Rev. at risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.rows ?? []).map((r) => (
                  <TableRow key={r.CLIENT_ID} className="cursor-pointer" onMouseEnter={() => onHover(r.CLIENT_ID)} onClick={() => onPick(r.CLIENT_ID)}>
                    <TableCell>
                      <div className="font-medium">{r.FULL_NAME}</div>
                      <div className="text-xs text-muted-foreground">{r.CLIENT_ID} · {r.SEGMENT} · {r.PRIMARY_PRODUCT}</div>
                    </TableCell>
                    <TableCell className="text-xs">{r.ENTITY}</TableCell>
                    <TableCell className="text-xs">{r.LIFECYCLE_STAGE}</TableCell>
                    <TableCell numeric>{gbp(r.BALANCE_GBP)}</TableCell>
                    <TableCell numeric>{r.CHURN_PROBABILITY != null ? pct(num(r.CHURN_PROBABILITY) * 100, 0) : '—'}</TableCell>
                    <TableCell numeric>{gbp(r.REVENUE_AT_RISK_GBP)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ClientSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isPending, error } = useQuery({
    queryKey: ['client', id],
    enabled: !!id,
    queryFn: () => fetchJson<{ profile: Row; accounts: Row[]; trades: Row[]; chats: Row[] }>(`/api/clients/${encodeURIComponent(id!)}`),
  });
  const p = data?.profile ?? {};
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{p.FULL_NAME ?? id}</SheetTitle>
        </SheetHeader>
        {isPending ? (
          <div className="space-y-2 p-4"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-40 w-full" /></div>
        ) : error ? (
          <p className="p-4 text-sm text-destructive">{(error as Error).message}</p>
        ) : (
          <div className="space-y-5 p-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Client ID', p.CLIENT_ID], ['Entity', `${p.ENTITY} · ${p.COUNTRY}`], ['Segment', p.SEGMENT],
                ['Lifecycle', p.LIFECYCLE_STAGE], ['CRM tier', p.CRM_TIER], ['KYC', p.KYC_STATUS],
                ['Signed up', shortDate(p.SIGNUP_DATE)], ['Channel', p.ACQUISITION_CHANNEL],
                ['Balance', gbp(p.BALANCE_GBP)], ['Revenue 180d', gbp(p.REVENUE_180D)],
                ['Client P&L 180d', gbp(p.CLIENT_PNL_180D)], ['Churn', p.CHURN_PROBABILITY != null ? pct(num(p.CHURN_PROBABILITY) * 100, 0) : 'n/a'],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">{l}</div>
                  <div className="font-medium">{v ?? '—'}</div>
                </div>
              ))}
            </div>
            {p.NEXT_BEST_ACTION && (
              <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                <div className="text-xs text-muted-foreground">Next best action</div>
                <div className="font-medium">{p.NEXT_BEST_ACTION}</div>
              </div>
            )}
            <div>
              <p className="mb-1 font-semibold">Accounts</p>
              {(data?.accounts ?? []).map((a) => (
                <div key={a.ACCOUNT_ID} className="flex justify-between border-b py-1 text-xs">
                  <span>{a.PRODUCT_LINE} · {a.ACCOUNT_STATUS}</span><span className="tabular-nums">{gbp(a.CASH_BALANCE_GBP)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 font-semibold">Recent trades</p>
              {(data?.trades ?? []).map((t, i) => (
                <div key={i} className="flex justify-between border-b py-1 text-xs">
                  <span>{shortDate(t.TRADE_TS)} · {t.SIDE} {t.SYMBOL} ({t.PRODUCT_LINE})</span>
                  <span className="tabular-nums">{gbp(t.NOTIONAL_GBP)}</span>
                </div>
              ))}
              {!data?.trades.length && <p className="text-xs text-muted-foreground">No trades in the last 180 days.</p>}
            </div>
            <div>
              <p className="mb-1 font-semibold">Support conversations (AI-enriched)</p>
              {(data?.chats ?? []).map((c, i) => (
                <div key={i} className="mb-2 rounded-md border p-2 text-xs">
                  <div className="mb-1 flex flex-wrap gap-1">
                    <Badge variant="secondary">{c.TOPIC}</Badge>
                    <Badge variant={c.OVERALL_SENTIMENT === 'negative' ? 'destructive' : c.OVERALL_SENTIMENT === 'positive' ? 'success' : 'outline'}>{c.OVERALL_SENTIMENT}</Badge>
                    <Badge variant="outline">{c.CLIENT_INTENT}</Badge>
                  </div>
                  <p className="whitespace-pre-line text-muted-foreground">{c.TRANSCRIPT}</p>
                </div>
              ))}
              {!data?.chats.length && <p className="text-xs text-muted-foreground">No support contacts.</p>}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
