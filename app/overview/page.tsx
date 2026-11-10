'use client';

import { categoryColor, ChartTooltip, CHART_COLORS, CHART_THEME, formatTick, getYAxisWidth } from '@/components/chart-utils';
import { DataCard, pageShell, SourceNote } from '@/components/ig/data-card';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson, gbp, int, num, pct } from '@/lib/ig-format';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BadgePoundSterling,
  Bot,
  FileCheck2,
  ShieldAlert,
  TrendingDown,
  Users,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Row = Record<string, any>;
type Overview = { kpi: Row; revenue: Row[]; byProduct: Row[]; entities: Row[] };

const USE_CASES = [
  { href: '/clients', n: 1, title: 'Client 360 & retention', icon: Users,
    text: 'Unified client view across IG, tastytrade and regions; ML churn scores, next-best-action, AI on support chats, marketing segments via data sharing.' },
  { href: '/risk', n: 2, title: 'Risk, exposure & hedging', icon: Scale,
    text: 'Dynamic tables refresh net client exposure every 5 minutes; residual house book, hedge ratio, 99% VaR and stress scenarios.' },
  { href: '/compliance', n: 3, title: 'Regulatory reporting', icon: FileCheck2,
    text: 'EMIR/MiFIR, ASIC and CFTC transaction reporting quality, CASS client-money reconciliation and Consumer Duty outcomes.' },
  { href: '/surveillance', n: 4, title: 'Fraud & AML surveillance', icon: ShieldAlert,
    text: 'Rules across payments, logins and trading flag mule and account-takeover patterns; Cortex AI writes analyst triage notes.' },
  { href: '/contact', n: 5, title: 'Contact centre analytics', icon: Activity,
    text: 'Service level, abandonment, FCR, CSAT and NPS across Phone, Chat, WhatsApp and Email, with drill-down into red-flag calls and AI summaries.' },
  { href: '/assistant', n: 6, title: 'AI assistant & search', icon: Bot,
    text: 'IG_AGENT answers in natural language over four semantic views plus Cortex Search on research notes and support chats.' },
];

export default function OverviewPage() {
  const { data, error, isPending } = useQuery({ queryKey: ['overview'], queryFn: () => fetchJson<Overview>('/api/overview') });
  const k = data?.kpi ?? {};

  return (
    <main className={pageShell}>
      <PageHeader
        eyebrow="IG Group · Snowflake AI Data Cloud"
        title="Group intelligence overview"
        description="Six priority use cases on one governed platform: structured trading data, semi-structured events and CRM, and unstructured client conversations. Synthetic client base calibrated to IG Group published figures (as of Nov 2026): ~1.34M funded clients incl. ~730k Freetrade, ~820k active."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Funded clients" value={int(k.FUNDED_CLIENTS)} hint={`${int(k.FREETRADE_FUNDED)} Freetrade · ${int(k.ACTIVE_CLIENTS)} active (30d)`} icon={Users} />
            <StatCard label="Revenue (30d)" value={gbp(k.REVENUE_30D)} hint="Spread + commission + financing" icon={BadgePoundSterling} />
            <StatCard label="Revenue at risk" value={gbp(k.REVENUE_AT_RISK)} hint="Churn probability × 180d revenue" icon={TrendingDown} />
            <StatCard label="Residual house exposure" value={gbp(k.GROSS_RESIDUAL_GBP)} hint={`1-day 99% VaR ${gbp(k.VAR_GBP)}`} icon={Scale} />
            <StatCard label="Report acceptance" value={pct(k.REPORT_ACCEPTANCE_PCT, 2)} hint="Transaction reports, last 30 days" icon={FileCheck2} />
            <StatCard label="Open fraud / AML alerts" value={int(k.OPEN_ALERTS)} hint="Rules + AI triage" icon={ShieldAlert} />
            <StatCard label="Open complaints" value={int(k.OPEN_COMPLAINTS)} hint="From support conversations" icon={Activity} />
            <StatCard label="IG_AGENT" value="6 tools" hint="4 semantic views · 2 search services" icon={Bot} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DataCard
          className="lg:col-span-2"
          title="Daily revenue, last 90 days"
          description="All entities and products"
          loading={isPending}
          error={error}
          empty={!data?.revenue.length}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(data?.revenue ?? []).map((r) => ({ d: r.D, Revenue: num(r.REVENUE) }))}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="d" tick={CHART_THEME.tick} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis width={getYAxisWidth(data?.revenue ?? [], 'REVENUE')} tickFormatter={formatTick} tick={CHART_THEME.tick} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Revenue" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <SourceNote>IG_GROUP_DB.STRUCTURED.DT_DAILY_REVENUE (dynamic table)</SourceNote>
        </DataCard>

        <DataCard title="Revenue by product (30d)" loading={isPending} error={error} empty={!data?.byProduct.length}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={(data?.byProduct ?? []).map((r) => ({ p: r.PRODUCT_LINE, Revenue: num(r.REVENUE) }))}>
                <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
                <XAxis type="number" tickFormatter={formatTick} tick={CHART_THEME.tick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="p" width={120} tick={CHART_THEME.tick} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Revenue" radius={[0, 4, 4, 0]}>
                  {(data?.byProduct ?? []).map((r, i) => <Cell key={r.PRODUCT_LINE} fill={categoryColor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DataCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((u) => (
          <Link key={u.href} href={u.href} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/60">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <u.icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Use case {u.n}</span>
            </div>
            <p className="mt-3 text-sm font-semibold group-hover:text-primary">{u.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{u.text}</p>
          </Link>
        ))}
      </div>

      <DataCard title="Legal entities" description="Clients, revenue and balances by regulated entity" loading={isPending} error={error} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>Regulator</TableHead>
              <TableHead>Region</TableHead>
              <TableHead numeric>Clients</TableHead>
              <TableHead numeric>Revenue 180d</TableHead>
              <TableHead numeric>Client balances</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.entities ?? []).map((r) => (
              <TableRow key={r.ENTITY}>
                <TableCell className="font-medium">{r.ENTITY}</TableCell>
                <TableCell>{r.REGULATOR}</TableCell>
                <TableCell>{r.REGION}</TableCell>
                <TableCell numeric>{int(r.CLIENTS)}</TableCell>
                <TableCell numeric>{gbp(r.REVENUE_180D)}</TableCell>
                <TableCell numeric>{gbp(r.BALANCES)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>
    </main>
  );
}
