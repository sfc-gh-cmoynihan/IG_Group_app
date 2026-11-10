'use client';

import { categoryColor, ChartTooltip, CHART_COLORS, CHART_THEME } from '@/components/chart-utils';
import { DataCard, EntityFilter, pageShell, SourceNote } from '@/components/ig/data-card';
import { PageHeader } from '@/components/page-header';
import { CallDrilldown, type DrillType } from '@/components/ig/call-drilldown';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson, int, num, pct } from '@/lib/ig-format';
import { useQuery } from '@tanstack/react-query';
import {
  AlarmClock,
  CheckCircle2,
  Gauge,
  HeartHandshake,
  Headphones,
  PhoneOff,
  Repeat,
  ShieldAlert,
  Smile,
  ThumbsUp,
  Timer,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Row = Record<string, any>;
type Data = {
  kpi: Row;
  prior: Row;
  byChannel: Row[];
  daily: Row[];
  hourly: Row[];
  reasons: Row[];
  teams: Row[];
  agents: Row[];
  entities: Row[];
};

/** 95 -> "1m 35s"; email waits in hours. */
function dur(v: unknown): string {
  if (v === null || v === undefined) return '—';
  const s = Math.round(num(v));
  if (s >= 3600) return `${(s / 3600).toFixed(1)}h`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

/** "vs prior 30d" hint; `better` says which direction is good. */
function delta(cur: unknown, prev: unknown, better: 'up' | 'down', fmt: (n: number) => string) {
  const d = num(cur) - num(prev);
  if (prev === undefined || prev === null) return undefined;
  const good = better === 'up' ? d >= 0 : d <= 0;
  return (
    <span className={good ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
      {d >= 0 ? '▲' : '▼'} {fmt(Math.abs(d))} vs prior 30d
    </span>
  );
}

const CHANNEL_SLA: Record<string, string> = {
  Phone: '20s',
  'Live Chat': '30s',
  WhatsApp: '5m',
  Email: '24h',
};

export default function ContactPage() {
  const [entity, setEntity] = useState('');
  const [drill, setDrill] = useState<DrillType>('abandoned');
  const openDrill = (t: DrillType) => {
    setDrill(t);
    document.getElementById('call-drilldown')?.scrollIntoView({ behavior: 'smooth' });
  };
  const clickable = (t: DrillType, card: React.ReactNode) => (
    <button type="button" onClick={() => openDrill(t)} className="rounded-xl text-left transition hover:ring-2 hover:ring-primary/40" title="Click to drill into calls">
      {card}
    </button>
  );
  const { data, error, isPending } = useQuery({
    queryKey: ['contact', entity],
    queryFn: () => fetchJson<Data>(`/api/contact${entity ? `?entity=${encodeURIComponent(entity)}` : ''}`),
  });
  const k = data?.kpi ?? {};
  const p = data?.prior ?? {};

  return (
    <main className={pageShell}>
      <PageHeader
        eyebrow="Use case 5"
        title="Contact Centre Analytics"
        description="Inbound Phone, Live Chat, WhatsApp and Email contacts — staffed 24 hours from 08:00 Saturday to 22:00 Friday. Service level, efficiency, resolution, customer experience and Consumer Duty vulnerability KPIs."
        actions={<EntityFilter value={entity} onChange={setEntity} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 12 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Contacts (30d)" value={int(k.CONTACTS)} hint={delta(k.CONTACTS, p.CONTACTS, 'down', (n) => int(n))} icon={Headphones} />
            <StatCard label="Service level" value={pct(k.SERVICE_LEVEL_PCT)} hint={delta(k.SERVICE_LEVEL_PCT, p.SERVICE_LEVEL_PCT, 'up', (n) => `${n.toFixed(1)}pp`)} icon={Gauge} />
            {clickable('abandoned', <StatCard label="Abandonment rate" value={pct(k.ABANDON_PCT, 2)} hint={delta(k.ABANDON_PCT, p.ABANDON_PCT, 'down', (n) => `${n.toFixed(2)}pp`)} icon={PhoneOff} />)}
            <StatCard label="Avg speed of answer" value={dur(k.ASA_SEC)} hint="All channels incl. email" icon={AlarmClock} />
            <StatCard label="Avg handle time" value={dur(k.AHT_SEC)} hint="Talk/chat + hold + wrap-up" icon={Timer} />
            <StatCard label="First contact resolution" value={pct(k.FCR_PCT)} hint={delta(k.FCR_PCT, p.FCR_PCT, 'up', (n) => `${n.toFixed(1)}pp`)} icon={CheckCircle2} />
            <StatCard label="Repeat contact (7d)" value={pct(k.REPEAT_PCT)} hint="Same client within 7 days" icon={Repeat} />
            <StatCard label="Transfer rate" value={pct(k.TRANSFER_PCT)} hint="Handed to another team" icon={Users} />
            <StatCard label="CSAT" value={`${num(k.CSAT).toFixed(2)} / 5`} hint={`${pct(k.CSAT_PCT)} satisfied (4–5)`} icon={Smile} />
            <StatCard label="NPS" value={num(k.NPS).toFixed(0)} hint={delta(k.NPS, p.NPS, 'up', (n) => n.toFixed(1))} icon={ThumbsUp} />
            {clickable('redflag', <StatCard label="Complaints logged" value={int(k.COMPLAINTS)} hint="Click for red-flag calls" icon={ShieldAlert} />)}
            {clickable('redflag', <StatCard label="Vulnerability flags" value={int(k.VULNERABLE)} hint={`${int(k.ESCALATED)} wellbeing escalations to compliance`} icon={HeartHandshake} />)}
          </>
        )}
      </div>

      <CallDrilldown entity={entity} type={drill} onTypeChange={setDrill} />

      <DataCard title="Daily contact volume by channel" description="90 days — note the Friday 22:00 → Saturday 08:00 closure" loading={isPending} error={error} empty={!data?.daily.length}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={(data?.daily ?? []).map((r) => ({ d: r.D, Phone: num(r.PHONE), 'Live Chat': num(r.CHAT), WhatsApp: num(r.WHATSAPP), Email: num(r.EMAIL) }))}>
              <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
              <XAxis dataKey="d" tick={CHART_THEME.tick} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={CHART_THEME.tick} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {['Phone', 'Live Chat', 'WhatsApp', 'Email'].map((c, i) => (
                <Area key={c} type="monotone" dataKey={c} stackId="a" stroke={CHART_COLORS[i]} fill={CHART_COLORS[i]} fillOpacity={0.35} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <SourceNote>STRUCTURED.CUSTOMER_CONTACTS</SourceNote>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Intraday arrival pattern" description="Avg contacts per hour (UK time) and live-channel speed of answer" loading={isPending} error={error}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={(data?.hourly ?? []).map((r) => ({ h: `${String(r.H).padStart(2, '0')}:00`, Contacts: num(r.PER_DAY), 'ASA (s)': Math.round(num(r.ASA_SEC)) }))}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="h" tick={CHART_THEME.tick} axisLine={false} tickLine={false} interval={2} />
                <YAxis yAxisId="l" tick={CHART_THEME.tick} axisLine={false} tickLine={false} width={40} />
                <YAxis yAxisId="r" orientation="right" tick={CHART_THEME.tick} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="l" dataKey="Contacts" radius={[3, 3, 0, 0]}>
                  {(data?.hourly ?? []).map((r, i) => <Cell key={r.H} fill={categoryColor(i)} />)}
                </Bar>
                <Line yAxisId="r" dataKey="ASA (s)" stroke={CHART_COLORS[2]} dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </DataCard>

        <DataCard title="Service level & abandonment trend" description="Daily % answered within channel SLA vs % abandoned" loading={isPending} error={error}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={(data?.daily ?? []).map((r) => ({ d: r.D, 'Service level %': num(num(r.SERVICE_LEVEL_PCT).toFixed(1)), 'Abandon %': num(num(r.ABANDON_PCT).toFixed(2)) }))}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="d" tick={CHART_THEME.tick} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis yAxisId="l" tick={CHART_THEME.tick} axisLine={false} tickLine={false} width={36} domain={[0, 100]} />
                <YAxis yAxisId="r" orientation="right" tick={CHART_THEME.tick} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="l" dataKey="Service level %" stroke={CHART_COLORS[1]} dot={false} strokeWidth={2} />
                <Line yAxisId="r" dataKey="Abandon %" stroke={CHART_COLORS[3]} dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </DataCard>
      </div>

      <DataCard title="KPIs by channel" description="90 days. SLA targets: Phone 20s, Live Chat 30s, WhatsApp 5m, Email 24h" loading={isPending} error={error} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead numeric>Contacts</TableHead>
              <TableHead numeric>Service level</TableHead>
              <TableHead numeric>ASA</TableHead>
              <TableHead numeric>AHT</TableHead>
              <TableHead numeric>Abandon</TableHead>
              <TableHead numeric>FCR</TableHead>
              <TableHead numeric>CSAT</TableHead>
              <TableHead numeric>NPS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.byChannel ?? []).map((r) => (
              <TableRow key={r.CHANNEL}>
                <TableCell className="font-medium">
                  {r.CHANNEL} <span className="text-xs text-muted-foreground">SLA {CHANNEL_SLA[r.CHANNEL]}</span>
                </TableCell>
                <TableCell numeric>{int(r.CONTACTS)}</TableCell>
                <TableCell numeric>
                  <Badge variant={num(r.SERVICE_LEVEL_PCT) >= 80 ? 'success' : 'warning'}>{pct(r.SERVICE_LEVEL_PCT)}</Badge>
                </TableCell>
                <TableCell numeric>{dur(r.ASA_SEC)}</TableCell>
                <TableCell numeric>{dur(r.AHT_SEC)}</TableCell>
                <TableCell numeric>{pct(r.ABANDON_PCT, 2)}</TableCell>
                <TableCell numeric>{pct(r.FCR_PCT)}</TableCell>
                <TableCell numeric>{num(r.CSAT).toFixed(2)}</TableCell>
                <TableCell numeric>{num(r.NPS).toFixed(0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>

      <DataCard title="Contact reasons" description="What clients are getting in touch about — and which drivers hurt resolution and satisfaction" loading={isPending} error={error} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reason</TableHead>
              <TableHead numeric>Contacts</TableHead>
              <TableHead numeric>Share</TableHead>
              <TableHead numeric>AHT</TableHead>
              <TableHead numeric>FCR</TableHead>
              <TableHead numeric>Repeat 7d</TableHead>
              <TableHead numeric>CSAT</TableHead>
              <TableHead numeric>Complaints</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const total = (data?.reasons ?? []).reduce((s, r) => s + num(r.CONTACTS), 0) || 1;
              return (data?.reasons ?? []).map((r) => (
                <TableRow key={r.REASON}>
                  <TableCell className="font-medium">{r.REASON}</TableCell>
                  <TableCell numeric>{int(r.CONTACTS)}</TableCell>
                  <TableCell numeric>{pct((100 * num(r.CONTACTS)) / total)}</TableCell>
                  <TableCell numeric>{dur(r.AHT_SEC)}</TableCell>
                  <TableCell numeric>
                    <Badge variant={num(r.FCR_PCT) >= 75 ? 'success' : num(r.FCR_PCT) >= 60 ? 'warning' : 'destructive'}>{pct(r.FCR_PCT)}</Badge>
                  </TableCell>
                  <TableCell numeric>{pct(r.REPEAT_PCT)}</TableCell>
                  <TableCell numeric>{num(r.CSAT).toFixed(2)}</TableCell>
                  <TableCell numeric>{int(r.COMPLAINTS)}</TableCell>
                </TableRow>
              ));
            })()}
          </TableBody>
        </Table>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Team performance" loading={isPending} error={error} flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead numeric>Agents</TableHead>
                <TableHead numeric>Handled</TableHead>
                <TableHead numeric>AHT</TableHead>
                <TableHead numeric>FCR</TableHead>
                <TableHead numeric>Transfer</TableHead>
                <TableHead numeric>CSAT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.teams ?? []).map((r) => (
                <TableRow key={r.TEAM}>
                  <TableCell className="font-medium">{r.TEAM}</TableCell>
                  <TableCell numeric>{int(r.AGENTS)}</TableCell>
                  <TableCell numeric>{int(r.HANDLED)}</TableCell>
                  <TableCell numeric>{dur(r.AHT_SEC)}</TableCell>
                  <TableCell numeric>{pct(r.FCR_PCT)}</TableCell>
                  <TableCell numeric>{pct(r.TRANSFER_PCT)}</TableCell>
                  <TableCell numeric>{num(r.CSAT).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-6 pb-4"><SourceNote>STRUCTURED.CUSTOMER_CONTACTS ⋈ CONTACT_AGENTS</SourceNote></div>
        </DataCard>

        <DataCard title="Top agents by CSAT" loading={isPending} error={error} flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Team</TableHead>
                <TableHead numeric>Handled</TableHead>
                <TableHead numeric>AHT</TableHead>
                <TableHead numeric>FCR</TableHead>
                <TableHead numeric>CSAT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.agents ?? []).map((r) => (
                <TableRow key={r.AGENT_ID}>
                  <TableCell className="font-medium">{r.AGENT_ID}</TableCell>
                  <TableCell className="text-xs">{r.TEAM}</TableCell>
                  <TableCell numeric>{int(r.HANDLED)}</TableCell>
                  <TableCell numeric>{dur(r.AHT_SEC)}</TableCell>
                  <TableCell numeric>{pct(r.FCR_PCT)}</TableCell>
                  <TableCell numeric>{num(r.CSAT).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataCard>
      </div>

      <DataCard title="KPIs by IG entity" description="All entities, 90 days" loading={isPending} error={error} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead numeric>Contacts</TableHead>
              <TableHead numeric>Service level</TableHead>
              <TableHead numeric>Abandon</TableHead>
              <TableHead numeric>FCR</TableHead>
              <TableHead numeric>CSAT</TableHead>
              <TableHead numeric>NPS</TableHead>
              <TableHead numeric>Complaints</TableHead>
              <TableHead numeric>Vulnerable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.entities ?? []).map((r) => (
              <TableRow key={r.ENTITY}>
                <TableCell className="font-medium">{r.ENTITY}</TableCell>
                <TableCell numeric>{int(r.CONTACTS)}</TableCell>
                <TableCell numeric>{pct(r.SERVICE_LEVEL_PCT)}</TableCell>
                <TableCell numeric>{pct(r.ABANDON_PCT, 2)}</TableCell>
                <TableCell numeric>{pct(r.FCR_PCT)}</TableCell>
                <TableCell numeric>{num(r.CSAT).toFixed(2)}</TableCell>
                <TableCell numeric>{num(r.NPS).toFixed(0)}</TableCell>
                <TableCell numeric>{int(r.COMPLAINTS)}</TableCell>
                <TableCell numeric>{int(r.VULNERABLE)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>
    </main>
  );
}
