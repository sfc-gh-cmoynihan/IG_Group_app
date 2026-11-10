'use client';

import { ChartTooltip, CHART_COLORS, CHART_THEME, formatTick } from '@/components/chart-utils';
import { DataCard, pageShell, SourceNote } from '@/components/ig/data-card';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRelative } from '@/lib/format';
import { fetchJson, gbp, int, num, pct } from '@/lib/ig-format';
import { useQuery } from '@tanstack/react-query';
import { Gauge, Layers, ShieldHalf, Scale } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Row = Record<string, any>;
type Data = { exposure: Row[]; byClass: Row[]; stress: Row[]; margin: Row[]; hedgeCost: Row[]; kpi: Row; lastRefresh: string | null };

const MARGIN_VARIANT: Record<string, 'destructive' | 'warning' | 'secondary' | 'success'> = {
  'Close-out': 'destructive', 'Margin call': 'warning', Watch: 'secondary', Healthy: 'success',
};

export default function RiskPage() {
  const { data, error, isPending } = useQuery({
    queryKey: ['risk'],
    queryFn: () => fetchJson<Data>('/api/risk'),
    refetchInterval: 60_000,
  });
  const k = data?.kpi ?? {};

  return (
    <main className={pageShell}>
      <PageHeader
        eyebrow="Use case 2"
        title="Risk, exposure & hedging"
        description="IG is the counterparty to client CFD and spread-bet flow. Dynamic tables keep net exposure, hedges and the residual house book near real time (5-minute target lag)."
        actions={
          <Badge variant="outline" className="whitespace-nowrap">
            {data?.lastRefresh ? `Exposure refreshed ${formatRelative(data.lastRefresh)}` : 'Target lag 5 min'}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Gross client exposure" value={gbp(k.GROSS_CLIENT)} hint={`${int(k.POSITIONS)} open positions`} icon={Layers} />
            <StatCard label="Hedge ratio" value={pct(k.HEDGE_RATIO, 0)} hint="|hedge| / |net client|" icon={ShieldHalf} />
            <StatCard label="Residual house exposure" value={gbp(k.GROSS_RESIDUAL)} hint="Gross, after hedging" icon={Scale} />
            <StatCard label="1-day 99% VaR" value={gbp(k.VAR)} hint="Historical, undiversified" icon={Gauge} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Exposure by asset class" description="Net client vs hedge vs residual (GBP)" loading={isPending} error={error} empty={!data?.byClass.length}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data?.byClass ?? []).map((r) => ({ a: r.ASSET_CLASS, 'Net client': num(r.NET_CLIENT), Hedge: num(r.HEDGE), Residual: num(r.RESIDUAL) }))}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="a" tick={CHART_THEME.tick} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatTick} tick={CHART_THEME.tick} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke={CHART_THEME.axis} />
                <Bar dataKey="Net client" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Hedge" fill={CHART_COLORS[3]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Residual" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SourceNote>STRUCTURED.DT_EXPOSURE_BY_INSTRUMENT · HEDGE_POSITIONS</SourceNote>
        </DataCard>

        <DataCard title="Stress scenarios" description="Instantaneous shock P&L on the residual house book vs clients" loading={isPending} error={error} empty={!data?.stress.length}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={(data?.stress ?? []).map((r) => ({ s: r.SCENARIO, 'House P&L': num(r.HOUSE_PNL), 'Client P&L': num(r.CLIENT_PNL) }))}>
                <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
                <XAxis type="number" tickFormatter={formatTick} tick={CHART_THEME.tick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="s" width={130} tick={CHART_THEME.tick} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine x={0} stroke={CHART_THEME.axis} />
                <Bar dataKey="House P&L" radius={[0, 3, 3, 0]}>
                  {(data?.stress ?? []).map((r, i) => <Cell key={i} fill={num(r.HOUSE_PNL) < 0 ? CHART_COLORS[0] : CHART_COLORS[3]} />)}
                </Bar>
                <Bar dataKey="Client P&L" fill={CHART_COLORS[1]} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SourceNote>STRUCTURED.RISK_STRESS_RESULTS (scenario table × live exposure)</SourceNote>
        </DataCard>
      </div>

      <DataCard title="Instrument book" description="Sorted by absolute residual exposure. Positive = IG net long after hedging." loading={isPending} error={error} empty={!data?.exposure.length} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Class</TableHead>
              <TableHead numeric>Positions</TableHead>
              <TableHead numeric>Net client</TableHead>
              <TableHead numeric>Hedge</TableHead>
              <TableHead numeric>Residual</TableHead>
              <TableHead numeric>VaR 99% 1d</TableHead>
              <TableHead>Hedge counterparty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.exposure ?? []).map((r) => (
              <TableRow key={r.SYMBOL}>
                <TableCell className="font-medium">{r.SYMBOL}</TableCell>
                <TableCell>{r.ASSET_CLASS}</TableCell>
                <TableCell numeric>{int(r.OPEN_POSITIONS)}</TableCell>
                <TableCell numeric>{gbp(r.NET_CLIENT_GBP)}</TableCell>
                <TableCell numeric>{gbp(r.HEDGE_GBP)}</TableCell>
                <TableCell numeric className={num(r.RESIDUAL_HOUSE_EXPOSURE_GBP) < 0 ? 'text-destructive' : ''}>{gbp(r.RESIDUAL_HOUSE_EXPOSURE_GBP)}</TableCell>
                <TableCell numeric>{gbp(r.VAR_99_1D_GBP)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.PRIME_BROKER} · {r.HEDGE_VENUE}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Client margin health" description="Accounts with open positions by margin level (ESMA 50% close-out)" loading={isPending} error={error}>
          <div className="space-y-2">
            {(data?.margin ?? []).map((m) => (
              <div key={m.MARGIN_STATUS} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <Badge variant={MARGIN_VARIANT[m.MARGIN_STATUS] ?? 'outline'}>{m.MARGIN_STATUS}</Badge>
                <span className="tabular-nums">{int(m.ACCOUNTS)} accounts · {gbp(m.MARGIN)} margin</span>
              </div>
            ))}
          </div>
          <SourceNote>STRUCTURED.DT_CLIENT_MARGIN_RISK (dynamic table)</SourceNote>
        </DataCard>
        <DataCard title="Hedging cost by broker (30d)" loading={isPending} error={error} flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prime broker</TableHead>
                <TableHead numeric>Hedged notional</TableHead>
                <TableHead numeric>Cost</TableHead>
                <TableHead numeric>Cost (bps)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.hedgeCost ?? []).map((h) => (
                <TableRow key={h.PRIME_BROKER}>
                  <TableCell className="font-medium">{h.PRIME_BROKER}</TableCell>
                  <TableCell numeric>{gbp(h.HEDGED)}</TableCell>
                  <TableCell numeric>{gbp(h.COST)}</TableCell>
                  <TableCell numeric>{(num(h.COST) / Math.max(num(h.HEDGED), 1) * 10000).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataCard>
      </div>
    </main>
  );
}
