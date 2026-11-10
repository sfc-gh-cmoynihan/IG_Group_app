import { AppHeader } from '@/components/app-header';
import { NavTabs } from '@/components/ig/nav-tabs';
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { APP_TITLE, LOGO_SRC } from '@/lib/constants';
import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';

// Sets the dark class before first paint so dark mode never flashes light.
// Keep in sync with components/theme-provider.tsx (localStorage key "theme").
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export const metadata: Metadata = {
  title: APP_TITLE,
  description:
    'IG Group on Snowflake: Client 360, risk & hedging, regulatory reporting, fraud/AML surveillance and Cortex AI.',
  icons: { icon: LOGO_SRC },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <QueryProvider>
            <div className="sticky top-0 z-40">
              <AppHeader />
              <NavTabs />
            </div>
            {children}
            <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted-foreground sm:px-6 lg:px-8">
              Synthetic demo data in IG_GROUP_DB · Running on Snowflake App Runtime
            </footer>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
