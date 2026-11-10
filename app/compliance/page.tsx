'use client';

import { ChartTooltip, CHART_COLORS, CHART_THEME } from '@/components/chart-utils';
import { DataCard, pageShell, SourceNote } from '@/components/ig/data-card';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson, gbp, int, num, pct } from '@/lib/ig-format';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, FileCheck2, FileX2, Landmark } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Row = Record<string, any>;
type Data = { byEntity: Row[]; daily: Row[]; rejects: Row[]; cass: Row[]; duty: Row[]; kpi: Row };

export default function CompliancePage() {
  const { data, error, isPending } = useQuery({ queryKey: ['compliance'], queryFn: () => fetchJson<Data>('/api/compliance') });
  const k = data?.kpi ?? {};

  return (
    <main className={pageShell}>
      <PageHeader
        eyebrow="Use case 3"
        title="Regulatory reporting & compliance"
        description="One auditable data layer for transaction reporting (UK/EU EMIR & MiFIR, ASIC, MAS, CFTC), CASS 7 client-money reconciliation and FCA Consumer Duty outcome monitoring."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Transaction reports (30d)" value={int(k.REPORTS)} hint={`${pct(k.ACCEPTANCE_PCT, 2)} accepted`} icon={FileCheck2} />
            <StatCard label="Rejected" value={int(k.REJECTED)} hint="Needs correction & resubmission" icon={FileX2} />
            <StatCard label="Late" value={int(k.LATE)} hint="Submitted after T+1" icon={AlarmClock} />
            <StatCard label="CASS breaks (30d)" value={int(k.CASS_BREAKS_30D)} hint="Entity-days with shortfall" icon={Landmark} />
          </>
        )}
      </div>

      <DataCard title="Daily reporting quality" description="Rejected and late reports by submission date" loading={isPending} error={error} empty={!data?.daily.length}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={(data?.daily ?? []).map((r) => ({ d: r.D, Rejected: num(r.REJECTED), Late: num(r.LATE) }))}>
              <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
              <XAxis dataKey="d" tick={CHART_THEME.tick} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={CHART_THEME.tick} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Rejected" stackId="a" fill={CHART_COLORS[0]} />
              <Bar dataKey="Late" stackId="a" fill={CHART_COLORS[2]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SourceNote>STRUCTURED.REG_TRANSACTION_REPORTS → REG_REPORTING_SUMMARY</SourceNote>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Reporting by entity & regime" loading={isPending} error={error} flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Regime</TableHead>
                <TableHead numeric>Reports</TableHead>
                <TableHead numeric>Rejected</TableHead>
                <TableHead numeric>Late</TableHead>
                <TableHead numeric>Accepted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.byEntity ?? []).map((r) => (
                <TableRow key={r.ENTITY}>
                  <TableCell className="font-medium">{r.ENTITY}</TableCell>
                  <TableCell className="text-xs">{r.REGIME} <span className="text-muted-foreground">({r.REGULATOR})</span></TableCell>
                  <TableCell numeric>{int(r.REPORTS)}</TableCell>
                  <TableCell numeric>{int(r.REJECTED)}</TableCell>
                  <TableCell numeric>{int(r.LATE)}</TableCell>
                  <TableCell numeric>
                    <Badge variant={num(r.ACCEPTANCE_PCT) >= 96 ? 'success' : 'warning'}>{pct(r.ACCEPTANCE_PCT, 2)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataCard>

        <DataCard title="Top rejection reasons" loading={isPending} error={error} flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead numeric>Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rejects ?? []).slice(0, 12).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.REJECT_REASON}</TableCell>
                  <TableCell>{r.ENTITY}</TableCell>
                  <TableCell numeric>{int(r.N)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="CASS 7 client-money reconciliation (90 days)" description="Resource vs requirement per entity per day" loading={isPending} error={error} flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead numeric>Shortfall days</TableHead>
                <TableHead numeric>Worst difference</TableHead>
                <TableHead>Latest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.cass ?? []).map((r) => (
                <TableRow key={r.ENTITY}>
                  <TableCell className="font-medium">{r.ENTITY}</TableCell>
                  <TableCell numeric>{int(r.SHORTFALL_DAYS)} / {int(r.DAYS)}</TableCell>
                  <TableCell numeric className={num(r.WORST_DIFFERENCE) < 0 ? 'text-destructive' : ''}>{gbp(r.WORST_DIFFERENCE)}</TableCell>
                  <TableCell>
                    <Badge variant={r.LATEST_STATUS === 'OK' ? 'success' : 'destructive'}>{r.LATEST_STATUS} {gbp(r.LATEST_DIFFERENCE)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-6 pb-4"><SourceNote>STRUCTURED.CLIENT_MONEY_RECON_V</SourceNote></div>
        </DataCard>

        <DataCard title="Consumer Duty outcomes (retail)" description="Share of active retail clients losing money, complaints and NPS" loading={isPending} error={error} flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Product</TableHead>
                <TableHead numeric>Clients</TableHead>
                <TableHead numeric>% losing</TableHead>
                <TableHead numeric>Complaints /1k</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.duty ?? []).slice(0, 12).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.ENTITY}</TableCell>
                  <TableCell>{r.PRIMARY_PRODUCT}</TableCell>
                  <TableCell numeric>{int(r.CLIENTS)}</TableCell>
                  <TableCell numeric>{pct(r.PCT_LOSING, 0)}</TableCell>
                  <TableCell numeric>{num(r.COMPLAINTS_PER_1000).toFixed(0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-6 pb-4"><SourceNote>STRUCTURED.CONSUMER_DUTY_OUTCOMES</SourceNote></div>
        </DataCard>
      </div>
    </main>
  );
}
