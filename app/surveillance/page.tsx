'use client';

import { DataCard, pageShell, SourceNote } from '@/components/ig/data-card';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson, gbp, int, num } from '@/lib/ig-format';
import { useQuery } from '@tanstack/react-query';
import { Bot, Fingerprint, ShieldAlert, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';

type Row = Record<string, any>;
type Data = { alerts: Row[]; byTypology: Row[]; byEntity: Row[]; kpi: Row };

export default function SurveillancePage() {
  const { data, error, isPending } = useQuery({ queryKey: ['surveillance'], queryFn: () => fetchJson<Data>('/api/surveillance') });
  const [typology, setTypology] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const k = data?.kpi ?? {};
  const alerts = useMemo(
    () => (data?.alerts ?? []).filter((a) => !typology || a.TYPOLOGY === typology),
    [data, typology],
  );

  return (
    <main className={pageShell}>
      <PageHeader
        eyebrow="Use case 4"
        title="Fraud, AML & market-abuse surveillance"
        description="Detection rules run across payments, logins/devices and trading in one place. The highest-risk alerts get an analyst triage note written by Cortex AI (AI_COMPLETE)."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Open alerts" value={int(k.ALERTS)} hint={`${int(k.HIGH_RISK)} with risk score ≥ 60`} icon={ShieldAlert} />
            <StatCard label="Mule-pattern withdrawals" value={gbp(k.MULE_WITHDRAWALS)} hint="Last 30 days, money-mule alerts" icon={Wallet} />
            <StatCard label="Account-takeover alerts" value={int((data?.byTypology ?? []).find((t) => t.TYPOLOGY === 'Account takeover')?.N)} hint="Foreign logins + failures + new devices" icon={Fingerprint} />
            <StatCard label="AI-triaged" value={int(k.AI_TRIAGED)} hint="Top alerts summarised by Cortex AI" icon={Bot} />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTypology('')} className={`rounded-full border px-3 py-1 text-xs ${!typology ? 'border-primary bg-primary/10 text-primary' : ''}`}>
          All ({int((data?.alerts ?? []).length)})
        </button>
        {(data?.byTypology ?? []).map((t) => (
          <button
            key={t.TYPOLOGY}
            onClick={() => setTypology(t.TYPOLOGY)}
            className={`rounded-full border px-3 py-1 text-xs ${typology === t.TYPOLOGY ? 'border-primary bg-primary/10 text-primary' : ''}`}
          >
            {t.TYPOLOGY} ({int(t.N)})
          </button>
        ))}
      </div>

      <DataCard title="Alert queue" description="Top 60 by risk score. Click an alert for evidence and AI triage." loading={isPending} error={error} empty={!alerts.length} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alert</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Typology</TableHead>
              <TableHead numeric>Score</TableHead>
              <TableHead>Rules hit</TableHead>
              <TableHead numeric>Deposits 30d</TableHead>
              <TableHead numeric>Withdrawals 30d</TableHead>
              <TableHead>AI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((a) => (
              <TableRow key={a.ALERT_ID} className="cursor-pointer" onClick={() => setSelected(a)}>
                <TableCell className="font-mono text-xs">{a.ALERT_ID}</TableCell>
                <TableCell>
                  <div className="font-medium">{a.FULL_NAME}</div>
                  <div className="text-xs text-muted-foreground">{a.CLIENT_ID} · {a.ENTITY}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={a.TYPOLOGY === 'Money mule / AML' ? 'destructive' : 'warning'}>{a.TYPOLOGY}</Badge>
                </TableCell>
                <TableCell numeric className="font-semibold">{int(a.RISK_SCORE)}</TableCell>
                <TableCell className="max-w-[280px] truncate text-xs">{a.REASONS}</TableCell>
                <TableCell numeric>{gbp(a.DEP_GBP)}</TableCell>
                <TableCell numeric>{gbp(a.WD_GBP)}</TableCell>
                <TableCell>{a.AI_TRIAGE ? <Bot className="h-4 w-4 text-primary" /> : null}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-6 pb-4"><SourceNote>STRUCTURED.FRAUD_ALERTS ← PAYMENTS, LOGIN_EVENTS, TRADES</SourceNote></div>
      </DataCard>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.ALERT_ID} · {selected?.FULL_NAME}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 p-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="destructive">Score {int(selected.RISK_SCORE)}</Badge>
                <Badge variant="secondary">{selected.TYPOLOGY}</Badge>
                <Badge variant="outline">{selected.ENTITY} · {selected.COUNTRY}</Badge>
              </div>
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold"><Bot className="h-3.5 w-3.5" /> Cortex AI triage</p>
                <p className="whitespace-pre-line">{selected.AI_TRIAGE ?? 'Not in the top-40 AI triage batch.'}</p>
              </div>
              <div>
                <p className="mb-1 font-semibold">Rules hit</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {String(selected.REASONS).split('; ').map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Payments 30d', int(selected.N_PAY_30D)], ['Payer countries', int(selected.PAYER_COUNTRIES)],
                  ['Deposits 30d', gbp(selected.DEP_GBP)], ['Withdrawals 30d', gbp(selected.WD_GBP)],
                  ['Failed logins 7d', int(selected.FAILED_7D)], ['IP countries 7d', int(selected.IP_COUNTRIES_7D)],
                  ['Devices 7d', int(selected.DEVICES_7D)], ['Trades 30d', int(selected.TRADES_30D)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-md border px-3 py-2">
                    <div className="text-xs text-muted-foreground">{l}</div>
                    <div className="font-medium tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Pass-through ratio: {num(selected.DEP_GBP) ? `${((num(selected.WD_GBP) / num(selected.DEP_GBP)) * 100).toFixed(0)}%` : 'n/a'}
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
