'use client';

import { DataCard, pageShell, SourceNote } from '@/components/ig/data-card';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/ig-format';
import { AGENT_MODELS, type AgentModelId, type RoleAgentId } from '@/lib/agent-models';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Loader2, Search, Send, User } from 'lucide-react';
import React, { useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; text: string; agent?: string; model?: string; tools?: string[]; sql?: string[]; tables?: AgentTable[] };
type AgentTable = { title: string; columns: string[]; rows: unknown[][] };
type AgentReply = { agent: string; model: string; text: string; tools: string[]; sql: string[]; tables: AgentTable[]; warnings: { message: string }[] };

const PERSONAS: Record<string, { agent: RoleAgentId; fqn: string; samples: string[] }> = {
  CFO: {
    agent: 'cfo',
    fqn: 'IG_CFO_AGENT',
    samples: [
      "Show revenue by entity and product line for the last 30 days",
      "Break down revenue into spread, commission and financing by entity",
      "Which product lines grew revenue the most month on month?",
      "How much revenue is at risk from clients with high churn probability?",
      "What is client P&L versus IG revenue by asset class?",
      "What is revenue per active trader by entity over the last 30 days?",
      "How do Freetrade's revenue and funded clients compare with IG UK?",
      "What are net deposits and total client balances by entity?",
      "Show the daily revenue trend for the last 90 days",
      "Which 10 markets generated the most revenue in the last 30 days?",
      "What 2026 revenue and EBITDA margin guidance did IG give in its latest trading update?",
    ],
  },
  'Chief Risk Officer': {
    agent: 'cro',
    fqn: 'IG_CRO_AGENT',
    samples: [
      "What is our residual house exposure and VaR by asset class?",
      "Which 10 instruments have the largest unhedged net client exposure?",
      "What is the hedge ratio by asset class?",
      "Which fraud and AML alerts have the highest risk scores, by typology?",
      "What is IG's research view on gold and how exposed are we to it?",
      "Which prime brokers hold the most hedge notional and what share of total hedges is that?",
      "Which instruments carry the highest 1-day 99% VaR?",
      "What share of gross residual exposure comes from the top 5 instruments?",
      "What is client P&L on crypto over the last 30 days, and what is IG's view on Bitcoin?",
      "How many account takeover alerts are open and which entities are most affected?",
      "What principal and climate-related risks does IG disclose in its annual report?",
    ],
  },
  Operations: {
    agent: 'ops',
    fqn: 'IG_OPS_AGENT',
    samples: [
      "Which entity has the most rejected transaction reports and why?",
      "What is the transaction report rejection rate by reporting regime?",
      "What are clients complaining about most regarding withdrawals?",
      "Where do clients drop out of the onboarding funnel, by acquisition channel?",
      "How many open fraud and AML alerts are there by entity?",
      "What are the top 5 reject reasons and how many reports does each affect?",
      "How many transaction reports were submitted late in the last 30 days, by regulator?",
      "What share of clients have KYC pending or failed, by entity?",
      "What are clients saying about platform outages or the app freezing?",
      "Show the daily trend in rejected transaction reports over the last 30 days",
      "What did IG announce about its new organisational model and Jersey holding company?",
    ],
  },
  General: {
    agent: 'general',
    fqn: 'IG_AGENT',
    samples: [
      "Which acquisition channels have the highest churn risk and how much revenue is at risk?",
      "How many funded and active clients do we have by entity, including Freetrade?",
      "What are clients complaining about most, and what is IG's view on gold?",
      "Show revenue by entity and product line for the last 30 days",
      "What is our residual house exposure and VaR by asset class?",
      "Which entity has the most rejected transaction reports and why?",
      "Which next-best-actions are recommended most often for high churn-risk clients?",
      "Which acquisition channels have the best registration-to-funded conversion?",
      "How many fraud alerts are there by typology, with average risk score?",
      "What are IG's research views on the Nasdaq 100 and NVIDIA?",
      "Summarise IG's Q3 2026 trading update and the Underdog acquisition",
    ],
  },
};
type Persona = keyof typeof PERSONAS;

/** Render agent text safely: no HTML injection, only **bold** and line breaks. */
function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-line">
          {para.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
            seg.startsWith('**') && seg.endsWith('**') ? <strong key={j}>{seg.slice(2, -2)}</strong> : <React.Fragment key={j}>{seg}</React.Fragment>,
          )}
        </p>
      ))}
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [persona, setPersona] = useState<Persona>('CFO');
  const [model, setModel] = useState<AgentModelId>('auto');
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (history: Msg[]) =>
      fetchJson<AgentReply>('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: PERSONAS[persona].agent, model, messages: history.map(({ role, text }) => ({ role, text })) }),
      }),
    onSuccess: (r) => {
      setMessages((m) => [...m, { role: 'assistant', text: r.text, agent: r.agent, model: r.model, tools: r.tools, sql: r.sql, tables: r.tables }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
    onError: (e) => setMessages((m) => [...m, { role: 'assistant', text: `Sorry, the agent call failed: ${(e as Error).message}` }]),
  });

  const send = (text: string) => {
    const t = text.trim();
    if (!t || ask.isPending) return;
    const next = [...messages, { role: 'user' as const, text: t }];
    setMessages(next);
    setInput('');
    ask.mutate(next);
  };

  return (
    <main className={pageShell}>
      <PageHeader
        eyebrow="Use case 6"
        title="AI assistant & search"
        description="IG_AGENT is a Cortex Agent that routes questions across four semantic views (Client 360, Trading, Risk, Compliance) and three Cortex Search services (research notes, support chats, IG Group reports & news)."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex min-h-[560px] min-w-0 flex-col lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Sample questions by role">
              {(Object.keys(PERSONAS) as Persona[]).map((p) => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={persona === p}
                  onClick={() => {
                    if (p === persona) return;
                    setPersona(p);
                    setMessages([]); // each role is a separate agent, so start a fresh conversation
                  }}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${persona === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Model
              <select
                aria-label="LLM model"
                value={model}
                onChange={(e) => setModel(e.target.value as AgentModelId)}
                className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground"
              >
                {AGENT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {!messages.length && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sample questions for the {persona === 'General' ? 'general assistant' : persona} · answered by <span className="font-mono">{PERSONAS[persona].fqn}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {PERSONAS[persona].samples.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-left text-xs hover:border-primary hover:text-primary">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-muted' : 'bg-primary/10 text-primary'}`}>
                  {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <RichText text={m.text} />
                  {m.tables?.map((t, ti) => (
                    <div key={ti} className="rounded-lg border">
                      {t.title && <p className="border-b px-3 py-1.5 text-xs font-medium">{t.title}</p>}
                      <Table>
                        <TableHeader>
                          <TableRow>{t.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
                        </TableHeader>
                        <TableBody>
                          {t.rows.slice(0, 15).map((r, ri) => (
                            <TableRow key={ri}>{(r as unknown[]).map((v, vi) => <TableCell key={vi}>{String(v ?? '')}</TableCell>)}</TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                  {!!m.tools?.length && (
                    <div className="flex flex-wrap items-center gap-1">
                      {m.agent && <Badge variant="outline">{m.agent}</Badge>}
                      {m.model && <Badge variant="outline">{m.model}</Badge>}
                      <span className="text-[11px] text-muted-foreground">Tools:</span>
                      {m.tools.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                    </div>
                  )}
                  {!!m.sql?.length && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Generated SQL</summary>
                      {m.sql.map((s, si) => (
                        <pre key={si} className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-[11px]">{s}</pre>
                      ))}
                    </details>
                  )}
                </div>
              </div>
            ))}
            {ask.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {PERSONAS[persona].fqn} ({AGENT_MODELS.find((x) => x.id === model)?.label}) is planning, querying semantic views and searching…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="flex gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about clients, revenue, risk, compliance, research or support…"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" disabled={ask.isPending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        <SearchPanel />
      </div>
    </main>
  );
}

function SearchPanel() {
  const [service, setService] = useState<'research' | 'support' | 'documents'>('research');
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, isFetching } = useQuery({
    queryKey: ['search', service, query],
    enabled: !!query,
    queryFn: () => fetchJson<{ results: Record<string, any>[] }>(`/api/agent?service=${service}&q=${encodeURIComponent(query)}`),
  });
  return (
    <DataCard
      title="Cortex Search"
      description="Hybrid vector + keyword search, no agent"
      error={error}
      actions={
        <select
          aria-label="Search service"
          value={service}
          onChange={(e) => setService(e.target.value as 'research' | 'support' | 'documents')}
          className="h-8 rounded-md border border-input bg-card px-2 text-xs"
        >
          <option value="research">Research notes</option>
          <option value="support">Support chats</option>
          <option value="documents">IG reports & news</option>
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
          placeholder={service === 'research' ? 'e.g. central bank gold buying' : service === 'support' ? 'e.g. withdrawal delays' : 'e.g. revenue guidance'}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!term.trim()}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>
      <div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto">
        {(data?.results ?? []).map((r, i) =>
          service === 'documents' ? (
            <div key={i} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{r.TITLE}</p>
              <p className="text-[11px] text-muted-foreground">{r.DOC_TYPE} · {r.PERIOD} · p.{r.PAGE_NO}</p>
              <p className="mt-1 line-clamp-5 whitespace-pre-line text-xs text-muted-foreground">{r.CHUNK}</p>
            </div>
          ) : service === 'research' ? (
            <div key={i} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{r.TITLE}</p>
              <p className="text-[11px] text-muted-foreground">{r.AUTHOR} · {r.PUBLISHED_DATE} · {r.MARKET}</p>
              <p className="mt-1 line-clamp-5 text-xs text-muted-foreground">{r.BODY}</p>
            </div>
          ) : (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">{r.TOPIC}</Badge>
                <Badge variant={r.OVERALL_SENTIMENT === 'negative' ? 'destructive' : 'outline'}>{r.OVERALL_SENTIMENT}</Badge>
                <Badge variant="outline">{r.ENTITY}</Badge>
              </div>
              <p className="mt-1 line-clamp-5 whitespace-pre-line text-xs text-muted-foreground">{r.TRANSCRIPT}</p>
            </div>
          ),
        )}
        {query && !isFetching && !data?.results.length && <p className="text-xs text-muted-foreground">No results.</p>}
      </div>
      <SourceNote>UNSTRUCTURED.RESEARCH_SEARCH · UNSTRUCTURED.SUPPORT_SEARCH · UNSTRUCTURED.DOCS_SEARCH</SourceNote>
    </DataCard>
  );
}
