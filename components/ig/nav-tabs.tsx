'use client';

import { NAV_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Horizontal tab bar under the header — one tab per use case. */
export function NavTabs() {
  const path = usePathname();
  return (
    <nav className="border-b border-border/70 bg-background/60">
      <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-black'
                  : 'border-transparent text-black hover:border-black/30',
              )}
            >
              {item.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
