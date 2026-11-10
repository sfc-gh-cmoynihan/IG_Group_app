-- =====================================================================
-- IG_GROUP_DB  |  04  Semantic views, Cortex Search services, IG_AGENT
-- Version: v4  |  Date: 2026-11-10
-- v4: documents_search tool (UNSTRUCTURED.DOCS_SEARCH from 07) on IG_AGENT
-- v3: 10 sample questions for IG_AGENT
-- v2: Freetrade entity added to semantic view comments and agent instructions
-- =====================================================================
USE ROLE ACCOUNTADMIN;
USE WAREHOUSE IG_WH;
USE SCHEMA IG_GROUP_DB.STRUCTURED;

-- --------------------------- Client 360 ------------------------------
CREATE OR REPLACE SEMANTIC VIEW CLIENT_360_SV
  TABLES (
    clients AS IG_GROUP_DB.STRUCTURED.DT_CLIENT_360 PRIMARY KEY (CLIENT_ID)
      COMMENT = 'One row per IG Group client across all entities and products',
    churn AS IG_GROUP_DB.STRUCTURED.CHURN_SCORES PRIMARY KEY (CLIENT_ID)
      COMMENT = 'ML churn probability and next-best-action for active/lapsing clients'
  )
  RELATIONSHIPS (churn_to_client AS churn (CLIENT_ID) REFERENCES clients)
  FACTS (
    clients.balance_gbp AS BALANCE_GBP COMMENT = 'Current cash balance across accounts in GBP',
    clients.deposits_gbp AS DEPOSITS_GBP COMMENT = 'Lifetime settled deposits in GBP',
    clients.withdrawals_gbp AS WITHDRAWALS_GBP COMMENT = 'Lifetime settled withdrawals in GBP',
    clients.revenue_180d AS REVENUE_180D COMMENT = 'IG revenue (spread + commission + financing) from the client in last 180 days, GBP',
    clients.client_pnl_180d AS CLIENT_PNL_180D COMMENT = 'Client realised P&L in last 180 days, GBP (negative = client lost)',
    clients.trades_180d AS TRADES_180D COMMENT = 'Number of trades in last 180 days',
    clients.complaints_count AS COMPLAINTS COMMENT = 'Number of formal complaints',
    churn.churn_probability AS CHURN_PROBABILITY COMMENT = 'Model probability the client churns (0-1)',
    churn.revenue_at_risk_gbp AS REVENUE_AT_RISK_GBP COMMENT = 'Revenue 180d x churn probability, GBP'
  )
  DIMENSIONS (
    clients.client_id AS CLIENT_ID,
    clients.full_name AS FULL_NAME,
    clients.entity AS ENTITY COMMENT = 'IG legal entity: IG UK, IG Europe, IG Australia, IG Singapore, IG Japan, IG Middle East, tastytrade, Freetrade',
    clients.country AS COUNTRY,
    clients.segment AS SEGMENT COMMENT = 'Retail, Professional or Institutional',
    clients.acquisition_channel AS ACQUISITION_CHANNEL,
    clients.age_band AS AGE_BAND,
    clients.primary_product AS PRIMARY_PRODUCT COMMENT = 'CFD, SPREAD_BET, SHARE_DEALING, ISA, SIPP, SMART_PORTFOLIO, CRYPTO, OPTIONS_FUTURES (tastytrade), PRIME (institutional)',
    clients.lifecycle_stage AS LIFECYCLE_STAGE COMMENT = 'Registered, Funded, Active (traded in 30d), Lapsing (30-90d), Dormant (>90d)',
    clients.crm_tier AS CRM_TIER,
    clients.kyc_status AS KYC_STATUS,
    clients.signup_date AS SIGNUP_DATE,
    clients.first_funded_date AS FIRST_FUNDED_DATE,
    churn.churn_risk AS CHURN_RISK COMMENT = 'High (>=0.6), Medium (>=0.35), Low',
    churn.next_best_action AS NEXT_BEST_ACTION
  )
  METRICS (
    clients.client_count AS COUNT(clients.client_id) COMMENT = 'Number of clients',
    clients.funded_clients AS COUNT(clients.first_funded_date) COMMENT = 'Clients who have deposited',
    clients.funding_conversion_pct AS 100 * COUNT(clients.first_funded_date) / NULLIF(COUNT(clients.client_id), 0) COMMENT = 'Registration-to-funded conversion %',
    clients.total_revenue_180d AS SUM(clients.revenue_180d),
    clients.total_balance_gbp AS SUM(clients.balance_gbp),
    clients.net_deposits_gbp AS SUM(clients.deposits_gbp) - SUM(clients.withdrawals_gbp),
    churn.avg_churn_probability AS AVG(churn.churn_probability),
    churn.total_revenue_at_risk AS SUM(churn.revenue_at_risk_gbp)
  )
  COMMENT = 'IG Group Client 360: onboarding funnel, value, lifecycle and churn risk';

-- --------------------------- Trading & revenue -----------------------
CREATE OR REPLACE SEMANTIC VIEW TRADING_SV
  TABLES (
    trades AS IG_GROUP_DB.STRUCTURED.TRADES PRIMARY KEY (TRADE_ID) COMMENT = 'Client trades, last 180 days',
    instruments AS IG_GROUP_DB.STRUCTURED.INSTRUMENTS PRIMARY KEY (INSTRUMENT_ID) COMMENT = 'Tradable markets'
  )
  RELATIONSHIPS (trade_instrument AS trades (INSTRUMENT_ID) REFERENCES instruments)
  FACTS (
    trades.notional_gbp AS NOTIONAL_GBP,
    trades.spread_revenue_gbp AS SPREAD_REVENUE_GBP,
    trades.commission_gbp AS COMMISSION_GBP,
    trades.financing_gbp AS FINANCING_GBP COMMENT = 'Overnight funding charged',
    trades.client_pnl_gbp AS CLIENT_PNL_GBP
  )
  DIMENSIONS (
    trades.trade_id AS TRADE_ID,
    trades.client_id AS CLIENT_ID,
    trades.entity AS ENTITY,
    trades.product_line AS PRODUCT_LINE COMMENT = 'CFD, SPREAD_BET, SHARE_DEALING, ISA, SIPP, SMART_PORTFOLIO, CRYPTO, OPTIONS_FUTURES, PRIME',
    trades.side AS SIDE,
    trades.channel AS CHANNEL COMMENT = 'Mobile, Web or API',
    trades.trade_date AS TRADE_TS::DATE COMMENT = 'Trade date',
    instruments.symbol AS SYMBOL,
    instruments.instrument_name AS NAME,
    instruments.asset_class AS ASSET_CLASS COMMENT = 'Index, FX, Commodity, Share, Bond, Crypto'
  )
  METRICS (
    trades.trade_count AS COUNT(trades.trade_id),
    trades.active_traders AS COUNT(DISTINCT trades.client_id),
    trades.total_notional_gbp AS SUM(trades.notional_gbp),
    trades.total_revenue_gbp AS SUM(trades.spread_revenue_gbp + trades.commission_gbp + trades.financing_gbp) COMMENT = 'Spread + commission + financing revenue',
    trades.total_client_pnl_gbp AS SUM(trades.client_pnl_gbp),
    trades.revenue_per_trader_gbp AS SUM(trades.spread_revenue_gbp + trades.commission_gbp + trades.financing_gbp) / NULLIF(COUNT(DISTINCT trades.client_id), 0)
  )
  COMMENT = 'IG Group trading activity and revenue by entity, product, asset class and market';

-- --------------------------- Risk & exposure -------------------------
CREATE OR REPLACE SEMANTIC VIEW RISK_SV
  TABLES (
    exposure AS IG_GROUP_DB.STRUCTURED.DT_EXPOSURE_BY_INSTRUMENT PRIMARY KEY (INSTRUMENT_ID)
      COMMENT = 'Net client exposure, hedge and residual house exposure per instrument',
    var AS IG_GROUP_DB.STRUCTURED.RISK_VAR_BY_INSTRUMENT PRIMARY KEY (INSTRUMENT_ID) COMMENT = '1-day 99% historical VaR on residual book'
  )
  RELATIONSHIPS (var_exposure AS var (INSTRUMENT_ID) REFERENCES exposure)
  FACTS (
    exposure.net_client_gbp AS NET_CLIENT_GBP COMMENT = 'Client long minus short notional (IG is the counterparty)',
    exposure.hedge_gbp AS HEDGE_GBP COMMENT = 'Hedge notional held with external brokers',
    exposure.residual_gbp AS RESIDUAL_HOUSE_EXPOSURE_GBP COMMENT = 'Net client + hedge = unhedged house exposure',
    exposure.margin_gbp AS MARGIN_GBP,
    exposure.open_positions AS OPEN_POSITIONS,
    var.var_99_1d_gbp AS VAR_99_1D_GBP
  )
  DIMENSIONS (
    exposure.symbol AS SYMBOL,
    exposure.asset_class AS ASSET_CLASS,
    exposure.hedge_venue AS HEDGE_VENUE,
    exposure.prime_broker AS PRIME_BROKER
  )
  METRICS (
    exposure.total_net_client_gbp AS SUM(exposure.net_client_gbp),
    exposure.total_hedge_gbp AS SUM(exposure.hedge_gbp),
    exposure.total_residual_gbp AS SUM(exposure.residual_gbp),
    exposure.gross_residual_gbp AS SUM(ABS(exposure.residual_gbp)),
    exposure.hedge_ratio_pct AS 100 * SUM(ABS(exposure.hedge_gbp)) / NULLIF(SUM(ABS(exposure.net_client_gbp)), 0),
    var.total_var_gbp AS SUM(var.var_99_1d_gbp) COMMENT = 'Undiversified sum of instrument VaR'
  )
  COMMENT = 'IG Group market-maker risk: client flow, hedging and VaR';

-- --------------------------- Compliance ------------------------------
CREATE OR REPLACE SEMANTIC VIEW COMPLIANCE_SV
  TABLES (
    reports AS IG_GROUP_DB.STRUCTURED.REG_TRANSACTION_REPORTS PRIMARY KEY (REPORT_ID)
      COMMENT = 'EMIR/MiFIR/ASIC/CFTC transaction reports, last 30 days',
    alerts AS IG_GROUP_DB.STRUCTURED.FRAUD_ALERTS PRIMARY KEY (ALERT_ID) COMMENT = 'Fraud / AML surveillance alerts'
  )
  FACTS (
    alerts.risk_score AS RISK_SCORE,
    alerts.deposits_30d_gbp AS DEP_GBP,
    alerts.withdrawals_30d_gbp AS WD_GBP
  )
  DIMENSIONS (
    reports.entity AS ENTITY,
    reports.regime AS REGIME,
    reports.regulator AS REGULATOR,
    reports.status AS STATUS COMMENT = 'ACCEPTED, REJECTED, LATE, PENDING',
    reports.reject_reason AS REJECT_REASON,
    reports.report_date AS SUBMITTED_TS::DATE,
    alerts.alert_entity AS ENTITY,
    alerts.typology AS TYPOLOGY COMMENT = 'Account takeover, Money mule / AML, Device anomaly',
    alerts.reasons AS REASONS,
    alerts.case_status AS CASE_STATUS,
    alerts.client_id AS CLIENT_ID
  )
  METRICS (
    reports.report_count AS COUNT(reports.report_id),
    reports.rejected_count AS COUNT_IF(reports.status = 'REJECTED'),
    reports.late_count AS COUNT_IF(reports.status = 'LATE'),
    reports.acceptance_rate_pct AS 100 * COUNT_IF(reports.status = 'ACCEPTED') / NULLIF(COUNT(reports.report_id), 0),
    alerts.alert_count AS COUNT(alerts.alert_id),
    alerts.avg_risk_score AS AVG(alerts.risk_score)
  )
  COMMENT = 'IG Group regulatory transaction reporting quality and financial-crime alerts';

-- ===================== Cortex Search services =========================
USE SCHEMA IG_GROUP_DB.UNSTRUCTURED;

CREATE OR REPLACE CORTEX SEARCH SERVICE RESEARCH_SEARCH
  ON BODY ATTRIBUTES MARKET, AUTHOR
  WAREHOUSE = IG_WH TARGET_LAG = '1 day'
  COMMENT = 'IG market insight and research notes'
AS SELECT NOTE_ID, TITLE, MARKET, AUTHOR, PUBLISHED_DATE::STRING AS PUBLISHED_DATE, BODY FROM IG_GROUP_DB.UNSTRUCTURED.RESEARCH_NOTES;

CREATE OR REPLACE CORTEX SEARCH SERVICE SUPPORT_SEARCH
  ON TRANSCRIPT ATTRIBUTES TOPIC, ENTITY, OVERALL_SENTIMENT, CLIENT_INTENT
  WAREHOUSE = IG_WH TARGET_LAG = '1 hour'
  COMMENT = 'Client support conversations enriched with AI topic, intent and sentiment'
AS SELECT CHAT_ID, CLIENT_ID, ENTITY, CHAT_TS::STRING AS CHAT_TS, CHANNEL, TOPIC, CLIENT_INTENT, OVERALL_SENTIMENT, TRANSCRIPT
   FROM IG_GROUP_DB.UNSTRUCTURED.CHAT_INSIGHTS_V;

-- ============================ IG_AGENT ================================
USE SCHEMA IG_GROUP_DB.STRUCTURED;
CREATE OR REPLACE AGENT IG_AGENT
  COMMENT = 'IG Group intelligence assistant (clients, trading, risk, compliance, research, support)'
  FROM SPECIFICATION $$
models:
  orchestration: auto
instructions:
  system: >
    You are the IG Group Intelligence Assistant for IG's leadership, risk, compliance, marketing and client-services teams.
    IG Group is a UK fintech offering leveraged OTC trading (CFDs, spread betting, FX), exchange-traded derivatives via tastytrade
    in the US, share dealing and investing (ISAs, SIPPs, Smart Portfolios, and the Freetrade commission-free investing app),
    spot crypto and institutional prime services. The synthetic client base is calibrated to IG Group published figures
    (as of Nov 2026): ~1.34M funded clients (~730k Freetrade, ~610k organic) and ~820k active clients.
    All data is synthetic demo data held in Snowflake database IG_GROUP_DB.
  orchestration: >
    Route questions: clients, funnel, lifecycle, churn, next-best-action -> client_360;
    trades, volumes, revenue, products, markets -> trading;
    exposure, hedging, VaR, house book -> risk;
    transaction reporting, rejections, fraud or AML alerts -> compliance;
    market views, outlooks, education -> research_search;
    what clients are saying, complaints, support themes -> support_search;
    IG Group's published results, annual reports, ESG / sustainability, guidance, strategy, acquisitions, news -> documents_search.
    For multi-part questions answer the data part first, then add research or support context.
  response: >
    Be concise and professional. Use tables for numbers. Show money as GBP with k/m/bn suffixes.
    State the time window (e.g. last 180 days). When citing research, give author and date.
    Remind users that client P&L figures are synthetic. documents_search holds IG Group's real published documents:
    cite the document title, period and page, and keep reported figures separate from synthetic demo data.
  sample_questions:
    - question: "Which acquisition channels have the highest churn risk and how much revenue is at risk?"
    - question: "How many funded and active clients do we have by entity, including Freetrade?"
    - question: "What are clients complaining about most, and what is IG's view on gold?"
    - question: "Show revenue by entity and product line for the last 30 days"
    - question: "What is our residual house exposure and VaR by asset class?"
    - question: "Which entity has the most rejected transaction reports and why?"
    - question: "Which next-best-actions are recommended most often for high churn-risk clients?"
    - question: "Which acquisition channels have the best registration-to-funded conversion?"
    - question: "How many fraud alerts are there by typology, with average risk score?"
    - question: "What are IG's research views on the Nasdaq 100 and NVIDIA?"
    - question: "Summarise IG's Q3 2026 trading update and the Underdog acquisition"
tools:
  - tool_spec: {type: cortex_analyst_text_to_sql, name: client_360, description: "Client 360 - clients, onboarding funnel, balances, deposits, revenue, lifecycle stage, churn probability and next best action by entity, segment, product, channel"}
  - tool_spec: {type: cortex_analyst_text_to_sql, name: trading, description: "Trades, notional, spread/commission/financing revenue and client P&L by date, entity, product line, asset class and market"}
  - tool_spec: {type: cortex_analyst_text_to_sql, name: risk, description: "Market-maker risk - net client exposure, hedges, residual house exposure, margin and 1-day 99% VaR by instrument and asset class"}
  - tool_spec: {type: cortex_analyst_text_to_sql, name: compliance, description: "Regulatory transaction reports (status, rejections, regimes) and fraud/AML alerts (typology, risk score)"}
  - tool_spec: {type: cortex_search, name: research_search, description: "IG research and market-insight notes by market and analyst"}
  - tool_spec: {type: cortex_search, name: support_search, description: "Client support chat transcripts with AI topic, intent and sentiment"}
  - tool_spec: {type: cortex_search, name: documents_search, description: "IG Group published annual reports, ESG / sustainability disclosures, quarterly and interim results, trading updates and news releases"}
tool_resources:
  client_360: {semantic_view: IG_GROUP_DB.STRUCTURED.CLIENT_360_SV, execution_environment: {type: warehouse, warehouse: IG_WH}}
  trading: {semantic_view: IG_GROUP_DB.STRUCTURED.TRADING_SV, execution_environment: {type: warehouse, warehouse: IG_WH}}
  risk: {semantic_view: IG_GROUP_DB.STRUCTURED.RISK_SV, execution_environment: {type: warehouse, warehouse: IG_WH}}
  compliance: {semantic_view: IG_GROUP_DB.STRUCTURED.COMPLIANCE_SV, execution_environment: {type: warehouse, warehouse: IG_WH}}
  research_search: {search_service: IG_GROUP_DB.UNSTRUCTURED.RESEARCH_SEARCH, max_results: 5, title_column: TITLE, id_column: NOTE_ID}
  support_search: {search_service: IG_GROUP_DB.UNSTRUCTURED.SUPPORT_SEARCH, max_results: 5, title_column: TOPIC, id_column: CHAT_ID}
  documents_search: {search_service: IG_GROUP_DB.UNSTRUCTURED.DOCS_SEARCH, max_results: 6, title_column: TITLE, id_column: CHUNK_ID}
$$;
