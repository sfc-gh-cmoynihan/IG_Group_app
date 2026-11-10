'use client';

import { categoryColor, ChartTooltip, CHART_COLORS, CHART_THEME, formatTick } from '@/components/chart-utils';
import { DataCard, pageShell, SourceNote } from '@/components/ig/data-card';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson, gbp, int, num, pct } from '@/lib/ig-format';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Banknote, CandlestickChart, Clock, ThumbsUp, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, Cell, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

type Row = Record<string, any>;
type Coo = {
  asOf: string;
  trades: Row[];
  settle: Row[];
  cash: Row[];
  custodian: Row[];
  revenue: Row[];
  clients: Row;
  nps: Row;
  products: Row[];
  issues: Row[];
};

const SEV: Record<string, 'destructive' | 'warning' | 'secondary'> = { high: 'destructive', medium: 'warning', low: 'secondary' };

export default function HomePage() {
  const { data, error, isPending } = useQuery({ queryKey: ['coo'], queryFn: () => fetchJson<Coo>('/api/coo') });

  const today = data?.trades.at(-1) ?? {};
  const prev = data?.trades.at(-2) ?? {};
  const outstanding = (data?.settle ?? []).filter((r) => r.STATUS !== 'SETTLED');
  const outN = outstanding.reduce((s, r) => s + num(r.N), 0);
  const outGross = outstanding.reduce((s, r) => s + num(r.GROSS_GBP), 0);
  const failed = (data?.settle ?? []).find((r) => r.STATUS === 'FAILED');
  const cashTotal = (data?.cash ?? []).reduce((s, r) => s + num(r.BALANCE_GBP), 0);
  const houseCash = (data?.cash ?? []).filter((r) => r.ACCOUNT_TYPE === 'House operating').reduce((s, r) => s + num(r.BALANCE_GBP), 0);
  const c = data?.clients ?? {};
  const tradeDelta = num(prev.TRADES) ? (100 * (num(today.TRADES) - num(prev.TRADES))) / num(prev.TRADES) : 0;

  // Custodian x exchange pivot
  const custodians = [...new Set((data?.custodian ?? []).map((r) => r.CUSTODIAN))];
  const exchanges = [...new Set((data?.custodian ?? []).map((r) => r.EXCHANGE))].sort();
  const cell = (cu: string, ex: string) => (data?.custodian ?? []).find((r) => r.CUSTODIAN === cu && r.EXCHANGE === ex);

  // Bank cash chart
  const banks = [...new Set((data?.cash ?? []).map((r) => r.BANK))].map((b) => ({
    bank: b,
    'Client money': num((data?.cash ?? []).find((r) => r.BANK === b && r.ACCOUNT_TYPE !== 'House operating')?.BALANCE_GBP),
    House: num((data?.cash ?? []).find((r) => r.BANK === b && r.ACCOUNT_TYPE === 'House operating')?.BALANCE_GBP),
  }));

  return (
    <main className={pageShell}>
      <PageHeader
        eyebrow="Home · Chief Operating Officer"
        title="Operations at a glance"
        description={`Trading, settlements, cash, clients and open issues across every IG Group company. As of the latest trading day in the data: ${data?.asOf ?? '…'}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Trades today" value={int(today.TRADES)} hint={`${tradeDelta >= 0 ? '▲' : '▼'} ${Math.abs(tradeDelta).toFixed(1)}% vs prior day · ${gbp(today.NOTIONAL)} notional`} icon={CandlestickChart} />
            <StatCard label="Outstanding settlements" value={int(outN)} hint={`${gbp(outGross)} gross · ${int(failed?.N)} failed`} icon={Clock} />
            <StatCard label="Cash in bank" value={gbp(cashTotal)} hint={`${gbp(houseCash)} house · ${gbp(cashTotal - houseCash)} client money`} icon={Banknote} />
            <StatCard label="Revenue today" value={gbp(today.REVENUE)} hint="Spread + commission + financing" icon={ArrowLeftRight} />
            <StatCard label="Customers" value={int(c.FUNDED)} hint={`Funded · ${int(c.REGISTERED)} registered`} icon={Users} />
            <StatCard label="New customers" value={int(c.NEW_30D)} hint={`${int(c.NEW_TODAY)} today · ${int(c.NEW_PRIOR_30D)} prior 30d`} icon={UserPlus} />
            <StatCard label="NPS score" value={num(data?.nps.NPS).toFixed(0)} hint={`${int(data?.nps.RESPONSES)} survey responses, 30d`} icon={ThumbsUp} />
            <StatCard label="Outstanding issues" value={int((data?.issues ?? []).filter((r) => num(r.N) > 0 && r.SEV === 'high').length)} hint={`high-severity areas · ${(data?.issues ?? []).filter((r) => num(r.N) > 0).length} open in total`} icon={Clock} />
          </>
        )}
      </div>

      <DataCard title="Outstanding issues" description="Open items across operations, risk, compliance and client service — click to go to the owning page" loading={isPending} error={error} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead numeric>Count</TableHead>
              <TableHead numeric>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.issues ?? []).map((r) => (
              <TableRow key={r.ISSUE}>
                <TableCell><Badge variant={SEV[r.SEV]}>{r.SEV}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{r.AREA}</TableCell>
                <TableCell className="font-medium">
                  <Link href={r.HREF} className="hover:text-primary hover:underline">{r.ISSUE}</Link>
                </TableCell>
                <TableCell numeric>{int(r.N)}</TableCell>
                <TableCell numeric>{r.VALUE_GBP === null ? '—' : gbp(r.VALUE_GBP)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>

      <DataCard
        title="Net payments to custodians by exchange"
        description="Net settlement flows, last 30 days. Negative = IG pays the custodian, positive = IG receives. Outstanding (pending + failed) shown underneath."
        loading={isPending}
        error={error}
        flush
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Custodian</TableHead>
                {exchanges.map((ex) => <TableHead key={ex} numeric>{ex}</TableHead>)}
                <TableHead numeric>Net total</TableHead>
                <TableHead numeric>Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custodians.map((cu) => {
                const rows = (data?.custodian ?? []).filter((r) => r.CUSTODIAN === cu);
                const net = rows.reduce((s, r) => s + num(r.NET_30D_GBP), 0);
                const out = rows.reduce((s, r) => s + num(r.OUTSTANDING_GBP), 0);
                return (
                  <TableRow key={cu}>
                    <TableCell className="font-medium">{cu}</TableCell>
                    {exchanges.map((ex) => {
                      const v = cell(cu, ex);
                      return (
                        <TableCell key={ex} numeric className={v ? (num(v.NET_30D_GBP) < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400') : 'text-muted-foreground'}>
                          {v ? gbp(v.NET_30D_GBP) : '—'}
                          {v && num(v.OUTSTANDING_N) > 0 && <div className="text-[10px] text-muted-foreground">{int(v.OUTSTANDING_N)} o/s {gbp(v.OUTSTANDING_GBP)}</div>}
                        </TableCell>
                      );
                    })}
                    <TableCell numeric className="font-semibold">{gbp(net)}</TableCell>
                    <TableCell numeric>{gbp(out)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="px-6 pb-4"><SourceNote>STRUCTURED.OPS_SETTLEMENTS (synthetic, derived from HEDGE_TRADES)</SourceNote></div>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="% revenue by company" description="Share of group revenue, last 30 days" loading={isPending} error={error} empty={!data?.revenue.length}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={(data?.revenue ?? []).map((r) => ({ name: r.ENTITY, value: num(num(r.PCT).toFixed(1)) }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}
                  label={({ name, value }) => `${name} ${value}%`} labelLine={false} fontSize={11}>
                  {(data?.revenue ?? []).map((r, i) => <Cell key={r.ENTITY} fill={categoryColor(i)} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {(data?.revenue ?? []).map((r) => (
              <div key={r.ENTITY} className="flex justify-between">
                <span>{r.ENTITY}</span>
                <span className="tabular-nums text-muted-foreground">{gbp(r.REVENUE)} · {pct(r.PCT)}</span>
              </div>
            ))}
          </div>
          <SourceNote>STRUCTURED.DT_DAILY_REVENUE</SourceNote>
        </DataCard>

        <DataCard title="Cash in bank" description="Client money (segregated, ties to CASS recon) and house operating cash by bank" loading={isPending} error={error} empty={!banks.length}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={banks}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="bank" tick={CHART_THEME.tick} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatTick} tick={CHART_THEME.tick} axisLine={false} tickLine={false} width={56} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Client money" stackId="a" fill={CHART_COLORS[0]} />
                <Bar dataKey="House" stackId="a" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SourceNote>STRUCTURED.OPS_BANK_BALANCES (synthetic)</SourceNote>
        </DataCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Top 10 products traded today" description={`By number of client trades on ${data?.asOf ?? ''}`} loading={isPending} error={error} flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Asset class</TableHead>
                <TableHead numeric>Trades</TableHead>
                <TableHead numeric>Notional</TableHead>
                <TableHead numeric>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.products ?? []).map((r, i) => (
                <TableRow key={r.SYMBOL}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.SYMBOL} <span className="text-xs text-muted-foreground">{r.NAME}</span></TableCell>
                  <TableCell className="text-xs">{r.ASSET_CLASS}</TableCell>
                  <TableCell numeric>{int(r.TRADES)}</TableCell>
                  <TableCell numeric>{gbp(r.NOTIONAL)}</TableCell>
                  <TableCell numeric>{gbp(r.REVENUE)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataCard>

        <DataCard title="Trades per day" description="Last 14 trading days, all companies" loading={isPending} error={error} empty={!data?.trades.length}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data?.trades ?? []).map((r) => ({ d: String(r.D).slice(5), Trades: num(r.TRADES) }))}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="d" tick={CHART_THEME.tick} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatTick} tick={CHART_THEME.tick} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Trades" radius={[4, 4, 0, 0]}>
                  {(data?.trades ?? []).map((r, i) => <Cell key={r.D} fill={categoryColor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SourceNote>STRUCTURED.DT_DAILY_REVENUE</SourceNote>
        </DataCard>
      </div>
    </main>
  );
}
