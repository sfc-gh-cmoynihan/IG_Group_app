'use client';

import { EmptyState } from '@/components/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ENTITIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type React from 'react';

/** Card wrapper that handles loading / error / empty states consistently. */
export function DataCard({
  title,
  description,
  loading,
  error,
  empty,
  children,
  className,
  flush,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  children?: React.ReactNode;
  className?: string;
  flush?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className={cn(flush && 'p-0')}>
        {loading ? (
          <div className={cn('space-y-2', flush && 'p-6 pt-0')}>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className={cn(flush && 'p-6 pt-0')}>
            <EmptyState
              variant="error"
              title="Couldn't load this data"
              description={error instanceof Error ? error.message : String(error)}
            />
          </div>
        ) : empty ? (
          <div className={cn(flush && 'p-6 pt-0')}>
            <EmptyState title="No rows" description="The query returned no data." />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function EntityFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      aria-label="Filter by IG entity"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">All entities</option>
      {ENTITIES.map((e) => (
        <option key={e} value={e}>
          {e}
        </option>
      ))}
    </select>
  );
}

/** Small "Powered by" chip listing the Snowflake objects behind a card. */
export function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[11px] text-muted-foreground">Source: {children}</p>;
}

export const pageShell = 'mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8';
