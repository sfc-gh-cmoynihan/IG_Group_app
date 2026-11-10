# IG Group Intelligence (Snowflake App Runtime)

A Next.js app running on Snowflake App Runtime (SAR) that demonstrates five priority Snowflake use cases for IG Group, backed by **synthetic** data in `IG_GROUP_DB`.

| Tab | Use case | Main Snowflake objects |
|---|---|---|
| Overview | Group KPIs, revenue, entities | `STRUCTURED.DT_DAILY_REVENUE`, `DT_CLIENT_360` |
| Client 360 | Conversion & retention | `DT_CLIENT_360` (dynamic table), `IG_CHURN_MODEL` (`SNOWFLAKE.ML.CLASSIFICATION`), `CHURN_SCORES`, `MARKETING_SEGMENTS` + share `IG_MARKETING_SEGMENTS_SHARE`, `UNSTRUCTURED.CHAT_INSIGHTS_V` (AI_CLASSIFY / AI_SENTIMENT) |
| Risk | Exposure, hedging, VaR, stress | `DT_EXPOSURE_BY_INSTRUMENT`, `DT_CLIENT_MARGIN_RISK` (5-min dynamic tables), `RISK_VAR_BY_INSTRUMENT`, `RISK_STRESS_RESULTS`, `HEDGE_*` |
| Regulatory | EMIR/MiFIR/ASIC/CFTC reporting, CASS, Consumer Duty | `REG_TRANSACTION_REPORTS`, `REG_REPORTING_SUMMARY`, `CLIENT_MONEY_RECON_V`, `CONSUMER_DUTY_OUTCOMES` |
| Surveillance | Fraud / AML | `FRAUD_ALERTS` (rules over `PAYMENTS`, `LOGIN_EVENTS`, `TRADES`) + AI_COMPLETE triage |
| AI Assistant | Agent + search | `STRUCTURED.IG_AGENT` (4 semantic views: `CLIENT_360_SV`, `TRADING_SV`, `RISK_SV`, `COMPLIANCE_SV`) and Cortex Search `UNSTRUCTURED.RESEARCH_SEARCH`, `SUPPORT_SEARCH` |

## Data model

`IG_GROUP_DB` has three schemas:

- **STRUCTURED**: entities, instruments (indices, FX, commodities, shares, bonds, crypto), 6k clients, accounts across CFD / spread bet / share dealing / ISA / SIPP / Smart Portfolio / crypto / tastytrade options & futures / prime, ~314k trades, positions, balances, hedges, payments, logins, transaction reports, CASS recon.
- **SEMI_STRUCTURED**: JSON app events (`APP_EVENTS`, typed view `APP_EVENTS_V`), CRM profiles, KYC vendor responses, raw price ticks.
- **UNSTRUCTURED**: support chats, complaints, AI-written research notes, plus `CHAT_INSIGHTS` AI enrichment.

Rebuild everything in order with the scripts in `sql/` (run with `snow sql --enable-templating NONE -f <file>`):

1. `01_platform_structured.sql`: warehouse `IG_WH`, database, schemas, structured seed data
2. `02_semi_unstructured.sql`: JSON and text data
3. `03_analytics_ml_ai.sql`: dynamic tables, VaR/stress, churn model, fraud alerts, AI enrichment, share
4. `04_semantic_search_agent.sql`: semantic views, Cortex Search services, `IG_AGENT`

Note: in this account the churn model's `SHOW_EVALUATION_METRICS` / `SHOW_FEATURE_IMPORTANCE` methods error, so `CHURN_MODEL_METRICS` is computed in SQL from in-sample predictions and `CHURN_DRIVERS` gives churn rate by driver.

## Code layout

- `app/<tab>/page.tsx`: one client page per use case (React Query + Recharts + shadcn/ui)
- `app/api/*/route.ts`: one API route per page; all SQL runs server-side via `lib/ig-server.ts` → `lib/snowflake.ts`. User input (entity filter, client id, search text, chat messages) is always passed as bind variables.
- `app/api/agent`: `POST` runs `IG_AGENT` via `SNOWFLAKE.CORTEX.DATA_AGENT_RUN`; `GET` queries Cortex Search directly with `SEARCH_PREVIEW`.
- All queries run with owner's rights (the app service identity).

## Run locally

```bash
npm install
SNOWFLAKE_CONNECTION_NAME=aws_uswest_pat SNOWFLAKE_DEFAULT_CONNECTION_NAME=aws_uswest_pat npm run dev
```

Use `npm run dev` or `npm run start` for local preview, never `node .next/standalone/server.js` (it doesn't serve static assets).

Tests: `npm test`. If your shell exports `SNOWFLAKE_CONNECTION_NAME` / `SNOWFLAKE_DEFAULT_CONNECTION_NAME`, unset them for the test run, because one template test asserts on default-connection resolution.

## Deploy

The deployment manifest is `app.yml` (`version: 2`) targeting `IG_GROUP_DB.STRUCTURED`, warehouse `IG_WH`:

```bash
uvx --from snowflake-cli snow app validate -c aws_uswest_pat
uvx --from snowflake-cli snow app deploy --verbose -c aws_uswest_pat
```

The installed `snow` 3.29 is too old for SAR; `uvx --from snowflake-cli` runs the latest CLI. The builder runs `npm ci`, `next build` (standalone) and copies static assets. `sql/`, `slides/` and `architecture/` are excluded from upload via `ignore:`.
