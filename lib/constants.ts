/** App title — displayed in the nav header and browser tab */
export const APP_TITLE = 'IG Group Intelligence';

/** Path to the logo in /public (used in the header and as favicon) */
export const LOGO_SRC = '/icon.svg';

/** Fully-qualified objects the app reads (all in IG_GROUP_DB). */
export const DB = 'IG_GROUP_DB';
export const S = `${DB}.STRUCTURED`;
export const SEMI = `${DB}.SEMI_STRUCTURED`;
export const U = `${DB}.UNSTRUCTURED`;
export const AGENT_FQN = `${S}.IG_AGENT`;

/** IG legal entities (used for filters). */
export const ENTITIES = [
  'IG UK',
  'IG Europe',
  'IG Australia',
  'IG Singapore',
  'IG Japan',
  'IG Middle East',
  'tastytrade',
  'Freetrade',
] as const;

/**
 * Pages in the header nav and under "Go to" in the ⌘K command palette.
 */
export const NAV_ITEMS: { label: string; href: string; short: string }[] = [
  { label: 'Home · COO dashboard', href: '/', short: 'Home' },
  { label: 'Financials', href: '/overview', short: 'Financials' },
  { label: '1 · Client 360 & Retention', href: '/clients', short: 'Client 360' },
  { label: '2 · Risk, Exposure & Hedging', href: '/risk', short: 'Risk' },
  { label: '3 · Regulatory Reporting', href: '/compliance', short: 'Regulatory' },
  { label: '4 · Fraud & AML Surveillance', href: '/surveillance', short: 'Surveillance' },
  { label: '5 · Contact Centre Analytics', href: '/contact', short: 'Contact Centre Analytics' },
  { label: '6 · AI Assistant & Search', href: '/assistant', short: 'AI Assistant' },
  { label: 'Documents · Reports, ESG & News', href: '/documents', short: 'Documents' },
];
