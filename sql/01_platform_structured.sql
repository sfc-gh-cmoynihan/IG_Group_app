-- =====================================================================
-- IG_GROUP_DB  |  01  Platform + STRUCTURED schema (synthetic data)
-- Version: v2  |  Date: 2026-11-05
-- v2: full-volume client base calibrated to IG Group published figures (as of Nov 2026):
--     ~1.34M funded clients (~730k Freetrade + ~610k organic IG / tastytrade), ~820k active (traded in 30d).
--     Adds Freetrade entity; trades generated per account (tens of millions of rows).
-- Lines of business modelled:
--   OTC leveraged (CFD, SPREAD_BET), exchange-traded (OPTIONS_FUTURES / tastytrade),
--   investing (SHARE_DEALING, ISA, SIPP, SMART_PORTFOLIO; Freetrade), CRYPTO, institutional (PRIME)
-- =====================================================================
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS IG_WH
  WAREHOUSE_SIZE = 'SMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'IG Group demo warehouse (app, AI, dynamic tables)';
USE WAREHOUSE IG_WH;
ALTER WAREHOUSE IG_WH SET WAREHOUSE_SIZE = 'XLARGE';   -- full-volume seeding; reset to SMALL at end of 03

CREATE DATABASE IF NOT EXISTS IG_GROUP_DB COMMENT = 'IG Group demo: trading, risk, compliance, AI';
CREATE SCHEMA IF NOT EXISTS IG_GROUP_DB.STRUCTURED      COMMENT = 'Relational trading, client, risk and regulatory data';
CREATE SCHEMA IF NOT EXISTS IG_GROUP_DB.SEMI_STRUCTURED COMMENT = 'JSON events, CRM, KYC and raw price ticks';
CREATE SCHEMA IF NOT EXISTS IG_GROUP_DB.UNSTRUCTURED    COMMENT = 'Support chats, complaints and research text';
USE SCHEMA IG_GROUP_DB.STRUCTURED;

-- ---------------------------------------------------------------------
-- Reference: legal entities
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE ENTITIES (ENTITY STRING, REGULATOR STRING, REGION STRING, BASE_CCY STRING, REPORTING_REGIME STRING) AS
SELECT * FROM VALUES
 ('IG UK',          'FCA',   'UK & Ireland', 'GBP', 'UK EMIR / UK MiFIR'),
 ('IG Europe',      'BaFin', 'Europe',       'EUR', 'EMIR / MiFIR'),
 ('IG Australia',   'ASIC',  'APAC',         'AUD', 'ASIC DTR'),
 ('IG Singapore',   'MAS',   'APAC',         'SGD', 'MAS OTC'),
 ('IG Japan',       'JFSA',  'APAC',         'JPY', 'JFSA'),
 ('IG Middle East', 'DFSA',  'Middle East',  'USD', 'DFSA'),
 ('tastytrade',     'CFTC/SEC', 'US',        'USD', 'CFTC / FINRA CAT'),
 ('Freetrade',      'FCA',   'UK & Ireland', 'GBP', 'UK MiFIR');

-- ---------------------------------------------------------------------
-- Instruments
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE INSTRUMENTS (
  INSTRUMENT_ID STRING, SYMBOL STRING, NAME STRING, ASSET_CLASS STRING,
  BASE_PRICE FLOAT, DAILY_VOL FLOAT, SPREAD_BPS FLOAT, RETAIL_MAX_LEVERAGE INT,
  PRODUCTS STRING, HEDGE_VENUE STRING) AS
SELECT * FROM VALUES
 ('I001','UK100','FTSE 100','Index',8250,0.009,1.2,20,'CFD|SPREAD_BET|PRIME','ICE Futures'),
 ('I002','US500','S&P 500','Index',5900,0.010,0.8,20,'CFD|SPREAD_BET|PRIME|OPTIONS_FUTURES','CME'),
 ('I003','US TECH 100','Nasdaq 100','Index',20800,0.013,1.0,20,'CFD|SPREAD_BET|PRIME|OPTIONS_FUTURES','CME'),
 ('I004','WALL ST','Dow Jones 30','Index',43500,0.009,1.0,20,'CFD|SPREAD_BET|PRIME','CBOT'),
 ('I005','GERMANY 40','DAX 40','Index',19400,0.011,1.0,20,'CFD|SPREAD_BET|PRIME','Eurex'),
 ('I006','AUSTRALIA 200','ASX 200','Index',8300,0.008,1.5,20,'CFD|SPREAD_BET','ASX 24'),
 ('I007','JAPAN 225','Nikkei 225','Index',39000,0.013,1.5,20,'CFD|SPREAD_BET','OSE'),
 ('I008','HONG KONG HS50','Hang Seng','Index',20500,0.015,2.0,20,'CFD|SPREAD_BET','HKFE'),
 ('I010','EUR/USD','Euro / US Dollar','FX',1.08,0.005,0.6,30,'CFD|SPREAD_BET|PRIME','LMAX'),
 ('I011','GBP/USD','Sterling / US Dollar','FX',1.28,0.006,0.9,30,'CFD|SPREAD_BET|PRIME','LMAX'),
 ('I012','USD/JPY','US Dollar / Yen','FX',152,0.006,0.7,30,'CFD|SPREAD_BET|PRIME','LMAX'),
 ('I013','AUD/USD','Aussie / US Dollar','FX',0.66,0.007,0.6,30,'CFD|SPREAD_BET','LMAX'),
 ('I014','EUR/GBP','Euro / Sterling','FX',0.84,0.004,0.9,30,'CFD|SPREAD_BET','LMAX'),
 ('I015','USD/CHF','US Dollar / Swiss Franc','FX',0.88,0.005,1.5,30,'CFD|SPREAD_BET','LMAX'),
 ('I020','GOLD','Spot Gold','Commodity',2650,0.010,3.0,20,'CFD|SPREAD_BET|PRIME|OPTIONS_FUTURES','COMEX'),
 ('I021','SILVER','Spot Silver','Commodity',31,0.017,4.0,10,'CFD|SPREAD_BET|OPTIONS_FUTURES','COMEX'),
 ('I022','OIL - BRENT','Brent Crude','Commodity',74,0.020,3.0,10,'CFD|SPREAD_BET|PRIME','ICE Futures'),
 ('I023','OIL - US CRUDE','WTI Crude','Commodity',70,0.021,3.0,10,'CFD|SPREAD_BET|OPTIONS_FUTURES','NYMEX'),
 ('I024','NATURAL GAS','Henry Hub Gas','Commodity',3.1,0.035,8.0,10,'CFD|SPREAD_BET|OPTIONS_FUTURES','NYMEX'),
 ('I030','AAPL','Apple Inc','Share',228,0.016,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP|OPTIONS_FUTURES','Nasdaq'),
 ('I031','MSFT','Microsoft Corp','Share',420,0.015,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP|OPTIONS_FUTURES','Nasdaq'),
 ('I032','NVDA','NVIDIA Corp','Share',138,0.030,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP|OPTIONS_FUTURES','Nasdaq'),
 ('I033','TSLA','Tesla Inc','Share',250,0.035,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP|OPTIONS_FUTURES','Nasdaq'),
 ('I034','AMZN','Amazon.com Inc','Share',200,0.019,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP|OPTIONS_FUTURES','Nasdaq'),
 ('I035','SPY','SPDR S&P 500 ETF','Share',590,0.010,5,5,'SHARE_DEALING|ISA|SIPP|SMART_PORTFOLIO|OPTIONS_FUTURES','NYSE Arca'),
 ('I036','QQQ','Invesco QQQ ETF','Share',505,0.013,5,5,'SHARE_DEALING|ISA|SIPP|SMART_PORTFOLIO|OPTIONS_FUTURES','Nasdaq'),
 ('I037','SHEL','Shell plc','Share',26,0.013,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP','LSE'),
 ('I038','AZN','AstraZeneca plc','Share',105,0.012,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP','LSE'),
 ('I039','HSBA','HSBC Holdings plc','Share',7.2,0.012,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP','LSE'),
 ('I040','BARC','Barclays plc','Share',2.6,0.017,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP','LSE'),
 ('I041','VWRL','Vanguard FTSE All-World ETF','Share',112,0.008,5,5,'SHARE_DEALING|ISA|SIPP|SMART_PORTFOLIO','LSE'),
 ('I042','IGG','IG Group Holdings plc','Share',9.5,0.014,10,5,'CFD|SPREAD_BET|SHARE_DEALING|ISA|SIPP','LSE'),
 ('I043','VUKE','Vanguard FTSE 100 ETF','Share',38,0.008,5,5,'SHARE_DEALING|ISA|SIPP|SMART_PORTFOLIO','LSE'),
 ('I044','IGLT','iShares UK Gilts ETF','Bond',11.8,0.004,5,5,'SHARE_DEALING|ISA|SIPP|SMART_PORTFOLIO','LSE'),
 ('I050','BTC/USD','Bitcoin','Crypto',68000,0.035,50,2,'CFD|SPREAD_BET|CRYPTO','Coinbase Prime'),
 ('I051','ETH/USD','Ether','Crypto',2600,0.042,60,2,'CFD|SPREAD_BET|CRYPTO','Coinbase Prime'),
 ('I052','SOL/USD','Solana','Crypto',160,0.055,80,2,'CRYPTO','Coinbase Prime'),
 ('I053','XRP/USD','Ripple','Crypto',0.55,0.050,80,2,'CRYPTO','Coinbase Prime'),
 ('I060','UK GILT','Long Gilt Future','Bond',96,0.005,2,5,'CFD|SPREAD_BET|PRIME','ICE Futures'),
 ('I061','US 10Y T-NOTE','US 10Y T-Note Future','Bond',110,0.004,2,5,'CFD|SPREAD_BET|PRIME|OPTIONS_FUTURES','CBOT');

-- product -> eligible instrument lookup (for random instrument picks)
CREATE OR REPLACE TABLE PRODUCT_INSTRUMENTS AS
SELECT p.VALUE::STRING AS PRODUCT_LINE, i.INSTRUMENT_ID,
       ROW_NUMBER() OVER (PARTITION BY p.VALUE::STRING ORDER BY i.INSTRUMENT_ID) AS RN,
       COUNT(*)    OVER (PARTITION BY p.VALUE::STRING) AS CNT
FROM INSTRUMENTS i, LATERAL FLATTEN(SPLIT(i.PRODUCTS,'|')) p;

-- ---------------------------------------------------------------------
-- Daily market prices (180 days random walk)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE MARKET_PRICES AS
WITH d AS (SELECT DATEADD(day, -SEQ4(), CURRENT_DATE()) AS PRICE_DATE FROM TABLE(GENERATOR(ROWCOUNT => 180))),
r AS (SELECT i.INSTRUMENT_ID, d.PRICE_DATE, i.BASE_PRICE, i.DAILY_VOL,
             NORMAL(0, 1, RANDOM()) * i.DAILY_VOL AS RET
      FROM INSTRUMENTS i CROSS JOIN d)
SELECT INSTRUMENT_ID, PRICE_DATE,
       ROUND(BASE_PRICE * EXP(SUM(RET) OVER (PARTITION BY INSTRUMENT_ID ORDER BY PRICE_DATE ROWS UNBOUNDED PRECEDING)), 5) AS CLOSE_PRICE,
       RET AS LOG_RETURN
FROM r;

-- ---------------------------------------------------------------------
-- Clients (random seeds materialised first so derived columns stay consistent)
--   N < 912,000  -> Freetrade (80% funded  => ~730k funded)
--   N >= 912,000 -> organic IG / tastytrade (838k registered => ~610k funded)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TEMPORARY TABLE _CLIENT_SEED AS
SELECT SEQ4() AS N,
       SEQ4() < 912000 AS IS_FT,
       UNIFORM(1, 100, RANDOM()) AS R_ENTITY,
       UNIFORM(1, 100, RANDOM()) AS R_SEG,
       UNIFORM(1, 100, RANDOM()) AS R_FUND,
       UNIFORM(1, 100, RANDOM()) AS R_TRADE,
       UNIFORM(1, 100, RANDOM()) AS R_CHURN,
       UNIFORM(1, 100, RANDOM()) AS R_PROD,
       UNIFORM(1, 10000, RANDOM()) AS R_FRAUD,
       UNIFORM(0, 29, RANDOM())  AS R_FN,
       UNIFORM(0, 29, RANDOM())  AS R_LN,
       UNIFORM(0, 6, RANDOM())   AS R_CHAN,
       UNIFORM(0, 4, RANDOM())   AS R_AGE,
       UNIFORM(0, 1095, RANDOM()) AS SIGNUP_AGO,
       UNIFORM(0, 14, RANDOM())  AS FUND_LAG,
       UNIFORM(0, 7, RANDOM())   AS TRADE_LAG,
       UNIFORM(31, 175, RANDOM()) AS CHURN_AGO,   -- churned clients never count as active (30d)
       UNIFORM(0, 4, RANDOM())   AS R_CTRY
FROM TABLE(GENERATOR(ROWCOUNT => 1750000));

CREATE OR REPLACE TABLE CLIENTS AS
WITH b AS (
  SELECT s.*,
    CASE WHEN IS_FT THEN 'Freetrade'
         WHEN R_ENTITY <= 36 THEN 'IG UK' WHEN R_ENTITY <= 50 THEN 'IG Europe' WHEN R_ENTITY <= 60 THEN 'IG Australia'
         WHEN R_ENTITY <= 66 THEN 'IG Singapore' WHEN R_ENTITY <= 70 THEN 'IG Japan' WHEN R_ENTITY <= 74 THEN 'IG Middle East'
         ELSE 'tastytrade' END AS ENTITY,
    CASE WHEN IS_FT OR R_SEG <= 85 THEN 'Retail' WHEN R_SEG <= 97 THEN 'Professional' ELSE 'Institutional' END AS SEGMENT,
    ARRAY_CONSTRUCT('Paid Search','Affiliate','Organic','Referral','Social','TV & Brand','Partner')[R_CHAN]::STRING AS ACQUISITION_CHANNEL,
    ARRAY_CONSTRUCT('18-24','25-34','35-44','45-54','55+')[R_AGE]::STRING AS AGE_BAND,
    IFF(IS_FT, 80, 68) AS FUND_PCT
  FROM _CLIENT_SEED s)
SELECT
  'C' || LPAD(N + 100001, 7, '0') AS CLIENT_ID,
  ARRAY_CONSTRUCT('James','Oliver','Emma','Sophie','Liam','Mia','Noah','Ava','Lucas','Chloe','Hiroshi','Yuki','Wei','Mei','Lars',
                  'Ingrid','Pierre','Camille','Hans','Greta','Aisha','Omar','Raj','Priya','Jack','Grace','Tom','Lily','Sean','Aoife')[R_FN]::STRING
  || ' ' ||
  ARRAY_CONSTRUCT('Smith','Jones','Taylor','Brown','Williams','Wilson','Murphy','Kelly','Tanaka','Sato','Chen','Wang','Müller','Schmidt',
                  'Dubois','Martin','Rossi','Garcia','Lopez','Nguyen','Khan','Patel','Singh','Anderson','Clarke','Walsh','Byrne','Evans','Hughes','Lee')[R_LN]::STRING AS FULL_NAME,
  LOWER('client' || (N + 100001) || '@example.com') AS EMAIL,
  ENTITY,
  CASE ENTITY
    WHEN 'IG UK'          THEN ARRAY_CONSTRUCT('United Kingdom','United Kingdom','United Kingdom','Ireland','United Kingdom')[R_CTRY]
    WHEN 'IG Europe'      THEN ARRAY_CONSTRUCT('Germany','France','Spain','Italy','Netherlands')[R_CTRY]
    WHEN 'IG Australia'   THEN ARRAY_CONSTRUCT('Australia','Australia','Australia','New Zealand','Australia')[R_CTRY]
    WHEN 'IG Singapore'   THEN ARRAY_CONSTRUCT('Singapore','Singapore','Singapore','Singapore','Singapore')[R_CTRY]
    WHEN 'IG Japan'       THEN ARRAY_CONSTRUCT('Japan','Japan','Japan','Japan','Japan')[R_CTRY]
    WHEN 'IG Middle East' THEN ARRAY_CONSTRUCT('United Arab Emirates','United Arab Emirates','Saudi Arabia','Qatar','Bahrain')[R_CTRY]
    WHEN 'Freetrade'      THEN ARRAY_CONSTRUCT('United Kingdom','United Kingdom','United Kingdom','United Kingdom','United Kingdom')[R_CTRY]
    ELSE ARRAY_CONSTRUCT('United States','United States','United States','United States','United States')[R_CTRY]
  END::STRING AS COUNTRY,
  SEGMENT,
  ACQUISITION_CHANNEL,
  AGE_BAND,
  CASE
    WHEN SEGMENT = 'Institutional' THEN 'PRIME'
    WHEN ENTITY = 'Freetrade' THEN CASE WHEN R_PROD <= 60 THEN 'SHARE_DEALING' WHEN R_PROD <= 90 THEN 'ISA' ELSE 'SIPP' END
    WHEN ENTITY = 'tastytrade' THEN IFF(R_PROD <= 75, 'OPTIONS_FUTURES', 'SHARE_DEALING')
    WHEN ENTITY = 'IG UK' THEN CASE WHEN R_PROD <= 40 THEN 'SPREAD_BET' WHEN R_PROD <= 68 THEN 'CFD'
                                    WHEN R_PROD <= 85 THEN 'SHARE_DEALING' WHEN R_PROD <= 93 THEN 'SMART_PORTFOLIO' ELSE 'CRYPTO' END
    ELSE IFF(R_PROD <= 75, 'CFD', 'SHARE_DEALING')
  END AS PRIMARY_PRODUCT,
  DATEADD(day, -SIGNUP_AGO, CURRENT_DATE()) AS SIGNUP_DATE,
  IFF(R_FUND <= FUND_PCT OR SEGMENT <> 'Retail', DATEADD(day, LEAST(FUND_LAG, SIGNUP_AGO), DATEADD(day, -SIGNUP_AGO, CURRENT_DATE())), NULL) AS FIRST_FUNDED_DATE,
  IFF((R_FUND <= FUND_PCT OR SEGMENT <> 'Retail') AND R_TRADE <= 92,
      DATEADD(day, LEAST(FUND_LAG + TRADE_LAG, SIGNUP_AGO), DATEADD(day, -SIGNUP_AGO, CURRENT_DATE())), NULL) AS FIRST_TRADE_DATE,
  -- churn more likely for affiliate/social acquired, young, retail clients (base tuned for ~820k active)
  IFF((R_FUND <= FUND_PCT OR SEGMENT <> 'Retail') AND R_TRADE <= 92 AND
      R_CHURN <= 26 + IFF(ACQUISITION_CHANNEL IN ('Affiliate','Social'), 22, 0) + IFF(AGE_BAND = '18-24', 12, 0)
                    - IFF(SEGMENT <> 'Retail', 15, 0),
      DATEADD(day, -LEAST(CHURN_AGO, SIGNUP_AGO), CURRENT_DATE()), NULL) AS LAST_ACTIVE_CUTOFF,
  CASE WHEN R_FRAUD <= 15 THEN 'MULE' WHEN R_FRAUD <= 25 THEN 'ATO' ELSE NULL END AS _FRAUD_PATTERN,  -- hidden seed (0.25%)
  IFF(R_FUND <= 95, 'Verified', IFF(R_FUND <= 98, 'Pending', 'Failed')) AS KYC_STATUS,
  ARRAY_CONSTRUCT('Low','Medium','High')[UNIFORM(0, 2, RANDOM())]::STRING AS RISK_APPETITE
FROM b;

-- ---------------------------------------------------------------------
-- Accounts: primary product + optional extras
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE ACCOUNTS AS
WITH extras AS (
  SELECT * FROM VALUES
    ('CFD','IG UK|IG Europe|IG Australia|IG Singapore|IG Japan|IG Middle East',0.20),
    ('SPREAD_BET','IG UK',0.25),
    ('SHARE_DEALING','IG UK|IG Europe|IG Australia|IG Singapore|tastytrade|Freetrade',0.18),
    ('ISA','IG UK|Freetrade',0.15),
    ('SIPP','IG UK|Freetrade',0.05),
    ('SMART_PORTFOLIO','IG UK',0.06),
    ('CRYPTO','IG UK|tastytrade|IG Australia',0.12),
    ('OPTIONS_FUTURES','tastytrade',0.10)
  AS t(PRODUCT_LINE, ENTITIES, PROB)),
pairs AS (
  SELECT CLIENT_ID, PRIMARY_PRODUCT AS PRODUCT_LINE, TRUE AS IS_PRIMARY FROM CLIENTS
  UNION ALL
  SELECT c.CLIENT_ID, e.PRODUCT_LINE, FALSE
  FROM CLIENTS c JOIN extras e
    ON ARRAY_CONTAINS(c.ENTITY::VARIANT, SPLIT(e.ENTITIES, '|'))
   AND e.PRODUCT_LINE <> c.PRIMARY_PRODUCT
   AND c.SEGMENT <> 'Institutional'
  WHERE UNIFORM(0::FLOAT, 1::FLOAT, RANDOM()) < e.PROB)
SELECT 'A' || LPAD(ROW_NUMBER() OVER (ORDER BY p.CLIENT_ID, p.IS_PRIMARY DESC, p.PRODUCT_LINE), 8, '0') AS ACCOUNT_ID,
       p.CLIENT_ID, p.PRODUCT_LINE, p.IS_PRIMARY,
       en.BASE_CCY AS ACCOUNT_CCY,
       DATEADD(day, IFF(p.IS_PRIMARY, 0, UNIFORM(0, 120, RANDOM())), c.SIGNUP_DATE) AS OPENED_DATE,
       IFF(c.LAST_ACTIVE_CUTOFF IS NOT NULL AND UNIFORM(1,100,RANDOM()) <= 40, 'Closed', 'Open') AS ACCOUNT_STATUS
FROM pairs p JOIN CLIENTS c USING (CLIENT_ID) JOIN ENTITIES en ON en.ENTITY = c.ENTITY;

-- ---------------------------------------------------------------------
-- Trades (last 180 days). Each tradable account gets a heavy-tailed trade count by product;
-- every non-churned client gets at least one trade in the last 30 days on its primary account.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TEMPORARY TABLE _TRADABLE AS
SELECT a.ACCOUNT_ID, a.CLIENT_ID, a.PRODUCT_LINE, a.IS_PRIMARY, c.SEGMENT, c.ENTITY, c.LAST_ACTIVE_CUTOFF,
       GREATEST(c.FIRST_TRADE_DATE, DATEADD(day, -179, CURRENT_DATE())) AS WIN_START,
       COALESCE(c.LAST_ACTIVE_CUTOFF, CURRENT_DATE()) AS WIN_END,
       LEAST(500, 1 + FLOOR(EXP(NORMAL(0, 1, RANDOM()) +
         CASE a.PRODUCT_LINE WHEN 'PRIME' THEN 4.5 WHEN 'OPTIONS_FUTURES' THEN 3.3 WHEN 'CFD' THEN 3.1
                             WHEN 'SPREAD_BET' THEN 3.1 WHEN 'CRYPTO' THEN 2.0 WHEN 'SHARE_DEALING' THEN 1.4 ELSE 0.7 END))) AS N_TRADES
FROM ACCOUNTS a JOIN CLIENTS c USING (CLIENT_ID)
WHERE c.FIRST_TRADE_DATE IS NOT NULL
  AND COALESCE(c.LAST_ACTIVE_CUTOFF, CURRENT_DATE()) >= GREATEST(c.FIRST_TRADE_DATE, DATEADD(day, -179, CURRENT_DATE()));

CREATE OR REPLACE TEMPORARY TABLE _TRADE_SEED AS
SELECT t.ACCOUNT_ID, t.CLIENT_ID, t.PRODUCT_LINE, t.SEGMENT, t.ENTITY, t.LAST_ACTIVE_CUTOFF, g.K AS N,
       UNIFORM(0::FLOAT, 1::FLOAT, RANDOM()) AS U_INST,
       IFF(g.K = 0 AND t.IS_PRIMARY AND t.LAST_ACTIVE_CUTOFF IS NULL,
           DATEADD(day, -FLOOR(UNIFORM(0::FLOAT, 1::FLOAT, RANDOM()) * (LEAST(29, DATEDIFF(day, t.WIN_START, t.WIN_END)) + 1)), t.WIN_END),
           DATEADD(day,  FLOOR(UNIFORM(0::FLOAT, 1::FLOAT, RANDOM()) * (DATEDIFF(day, t.WIN_START, t.WIN_END) + 1)), t.WIN_START)) AS TRADE_DATE,
       UNIFORM(0, 86399, RANDOM()) AS SECS,
       UNIFORM(1, 100, RANDOM()) AS R_SIDE,
       UNIFORM(1, 100, RANDOM()) AS R_CHAN,
       NORMAL(0, 1, RANDOM()) AS Z_SIZE,
       NORMAL(0, 1, RANDOM()) AS Z_PNL,
       NORMAL(0, 1, RANDOM()) AS Z_PX,
       UNIFORM(0, 10, RANDOM()) AS HOLD_DAYS
FROM _TRADABLE t
JOIN (SELECT SEQ4() AS K FROM TABLE(GENERATOR(ROWCOUNT => 500))) g ON g.K < t.N_TRADES;

CREATE OR REPLACE TABLE TRADES AS
WITH t AS (
  SELECT s.*, DATEADD(second, s.SECS, s.TRADE_DATE)::TIMESTAMP_NTZ AS TRADE_TS
  FROM _TRADE_SEED s),
ti AS (
  SELECT t.*, pi.INSTRUMENT_ID
  FROM t JOIN PRODUCT_INSTRUMENTS pi
    ON pi.PRODUCT_LINE = t.PRODUCT_LINE AND pi.RN = 1 + FLOOR(t.U_INST * pi.CNT)),
priced AS (
  SELECT ti.*, i.ASSET_CLASS, i.SPREAD_BPS, i.RETAIL_MAX_LEVERAGE, mp.CLOSE_PRICE,
         ROUND(LEAST(EXP(8.2 + 1.1 * ti.Z_SIZE), 400000)
               * CASE ti.SEGMENT WHEN 'Institutional' THEN 60 WHEN 'Professional' THEN 6 ELSE 1 END
               * CASE ti.PRODUCT_LINE WHEN 'SMART_PORTFOLIO' THEN 0.6 WHEN 'ISA' THEN 0.7 WHEN 'SIPP' THEN 0.9 ELSE 1 END, 2) AS NOTIONAL_GBP
  FROM ti
  JOIN INSTRUMENTS i ON i.INSTRUMENT_ID = ti.INSTRUMENT_ID
  JOIN MARKET_PRICES mp ON mp.INSTRUMENT_ID = ti.INSTRUMENT_ID AND mp.PRICE_DATE = ti.TRADE_TS::DATE)
SELECT
  'T' || LPAD(ROW_NUMBER() OVER (ORDER BY TRADE_TS, ACCOUNT_ID, N), 9, '0') AS TRADE_ID,
  ACCOUNT_ID, CLIENT_ID, INSTRUMENT_ID, PRODUCT_LINE, ENTITY, TRADE_TS,
  IFF(R_SIDE <= 58, 'BUY', 'SELL') AS SIDE,
  ROUND(CLOSE_PRICE * (1 + 0.001 * Z_PX), 5) AS PRICE,
  ROUND(NOTIONAL_GBP / NULLIF(CLOSE_PRICE, 0), 4) AS QUANTITY,
  NOTIONAL_GBP,
  CASE WHEN PRODUCT_LINE IN ('CFD','SPREAD_BET')
       THEN IFF(SEGMENT = 'Retail', RETAIL_MAX_LEVERAGE, RETAIL_MAX_LEVERAGE * 5)
       WHEN PRODUCT_LINE = 'PRIME' THEN 50 WHEN PRODUCT_LINE = 'OPTIONS_FUTURES' THEN 10 ELSE 1 END AS LEVERAGE,
  ROUND(NOTIONAL_GBP * SPREAD_BPS / 10000 * IFF(PRODUCT_LINE IN ('CFD','SPREAD_BET','CRYPTO','PRIME'), 1, 0.2), 2) AS SPREAD_REVENUE_GBP,
  ROUND(CASE WHEN PRODUCT_LINE IN ('SHARE_DEALING','ISA','SIPP') THEN IFF(ENTITY IN ('tastytrade','Freetrade'), 0, 3)
             WHEN PRODUCT_LINE = 'OPTIONS_FUTURES' THEN 1 + NOTIONAL_GBP * 0.00005
             WHEN PRODUCT_LINE = 'SMART_PORTFOLIO' THEN NOTIONAL_GBP * 0.0005
             WHEN PRODUCT_LINE = 'PRIME' THEN NOTIONAL_GBP * 0.00002 ELSE 0 END, 2) AS COMMISSION_GBP,
  ROUND(IFF(PRODUCT_LINE IN ('CFD','SPREAD_BET','PRIME'), NOTIONAL_GBP * 0.00022 * HOLD_DAYS, 0), 2) AS FINANCING_GBP,
  ROUND(NOTIONAL_GBP * (0.02 * Z_PNL - IFF(LAST_ACTIVE_CUTOFF IS NOT NULL, 0.009, 0.002)), 2) AS CLIENT_PNL_GBP,
  CASE WHEN R_CHAN <= 62 THEN 'Mobile' WHEN R_CHAN <= 92 THEN 'Web' ELSE 'API' END AS CHANNEL,
  HOLD_DAYS
FROM priced;

-- ---------------------------------------------------------------------
-- Open positions (subset of last 10 days of leveraged/derivative trades)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE POSITIONS AS
WITH latest AS (
  SELECT INSTRUMENT_ID, CLOSE_PRICE FROM MARKET_PRICES QUALIFY ROW_NUMBER() OVER (PARTITION BY INSTRUMENT_ID ORDER BY PRICE_DATE DESC) = 1)
SELECT
  'P' || SUBSTR(t.TRADE_ID, 2) AS POSITION_ID, t.ACCOUNT_ID, t.CLIENT_ID, t.INSTRUMENT_ID, t.PRODUCT_LINE, t.ENTITY,
  IFF(t.SIDE = 'BUY', 'LONG', 'SHORT') AS DIRECTION,
  t.QUANTITY, t.PRICE AS OPEN_PRICE, l.CLOSE_PRICE AS CURRENT_PRICE,
  ROUND(t.QUANTITY * l.CLOSE_PRICE, 2) AS NOTIONAL_GBP,
  ROUND(t.QUANTITY * l.CLOSE_PRICE / t.LEVERAGE, 2) AS MARGIN_GBP,
  ROUND(IFF(t.SIDE = 'BUY', 1, -1) * (l.CLOSE_PRICE - t.PRICE) * t.QUANTITY, 2) AS UNREALISED_PNL_GBP,
  t.LEVERAGE, t.TRADE_TS AS OPENED_TS
FROM TRADES t JOIN latest l ON l.INSTRUMENT_ID = t.INSTRUMENT_ID
WHERE t.TRADE_TS >= DATEADD(day, -10, CURRENT_DATE())
  AND t.PRODUCT_LINE IN ('CFD','SPREAD_BET','PRIME','OPTIONS_FUTURES','CRYPTO')
  AND UNIFORM(1, 100, RANDOM()) <= 45;

-- Account balances (cash) sized against margin
CREATE OR REPLACE TABLE ACCOUNT_BALANCES AS
SELECT a.ACCOUNT_ID, a.CLIENT_ID, a.PRODUCT_LINE,
       ROUND(GREATEST(COALESCE(p.MARGIN, 0) * UNIFORM(1.1::FLOAT, 4::FLOAT, RANDOM()),
                      IFF(c.FIRST_FUNDED_DATE IS NULL OR a.ACCOUNT_STATUS = 'Closed', 0, EXP(7.5 + NORMAL(0, 1, RANDOM()))
                          * IFF(c.SEGMENT = 'Institutional', 80, IFF(c.SEGMENT = 'Professional', 8, 1)))), 2) AS CASH_BALANCE_GBP,
       COALESCE(p.MARGIN, 0) AS MARGIN_USED_GBP,
       COALESCE(p.UPNL, 0) AS UNREALISED_PNL_GBP,
       CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS AS_OF_TS
FROM ACCOUNTS a JOIN CLIENTS c USING (CLIENT_ID)
LEFT JOIN (SELECT ACCOUNT_ID, SUM(MARGIN_GBP) MARGIN, SUM(UNREALISED_PNL_GBP) UPNL FROM POSITIONS GROUP BY 1) p USING (ACCOUNT_ID);

-- ---------------------------------------------------------------------
-- Hedging with external brokers / venues
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE HEDGE_POSITIONS AS
SELECT i.INSTRUMENT_ID, i.HEDGE_VENUE,
       ARRAY_CONSTRUCT('Goldman Sachs','JP Morgan','Citi','UBS','Barclays')[UNIFORM(0, 4, RANDOM())]::STRING AS PRIME_BROKER,
       ROUND(-n.NET_CLIENT_NOTIONAL * UNIFORM(0.35::FLOAT, 0.95::FLOAT, RANDOM()), 2) AS HEDGE_NOTIONAL_GBP,
       ROUND(UNIFORM(0.2::FLOAT, 2.5::FLOAT, RANDOM()), 2) AS HEDGE_COST_BPS,
       CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS UPDATED_TS
FROM INSTRUMENTS i
JOIN (SELECT INSTRUMENT_ID, SUM(IFF(DIRECTION = 'LONG', NOTIONAL_GBP, -NOTIONAL_GBP)) NET_CLIENT_NOTIONAL
      FROM POSITIONS WHERE PRODUCT_LINE IN ('CFD','SPREAD_BET','PRIME','CRYPTO') GROUP BY 1) n USING (INSTRUMENT_ID);

CREATE OR REPLACE TABLE HEDGE_TRADES AS
SELECT 'H' || LPAD(ROW_NUMBER() OVER (ORDER BY d.D, h.INSTRUMENT_ID), 7, '0') AS HEDGE_TRADE_ID,
       h.INSTRUMENT_ID, h.PRIME_BROKER, h.HEDGE_VENUE, d.D AS TRADE_DATE,
       ROUND(ABS(h.HEDGE_NOTIONAL_GBP) * UNIFORM(0.05::FLOAT, 0.4::FLOAT, RANDOM()), 2) AS HEDGED_NOTIONAL_GBP,
       ROUND(ABS(h.HEDGE_NOTIONAL_GBP) * UNIFORM(0.05::FLOAT, 0.4::FLOAT, RANDOM()) * h.HEDGE_COST_BPS / 10000, 2) AS HEDGE_COST_GBP
FROM HEDGE_POSITIONS h
CROSS JOIN (SELECT DATEADD(day, -SEQ4(), CURRENT_DATE()) D FROM TABLE(GENERATOR(ROWCOUNT => 60))) d;

-- ---------------------------------------------------------------------
-- Payments (deposits / withdrawals) incl. seeded fraud patterns
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE PAYMENTS AS
WITH normal AS (
  SELECT c.CLIENT_ID, DATEADD(second, UNIFORM(0, 86399, RANDOM()),
           DATEADD(day, FLOOR(UNIFORM(0::FLOAT, 1::FLOAT, RANDOM()) * GREATEST(DATEDIFF(day, c.FIRST_FUNDED_DATE, COALESCE(c.LAST_ACTIVE_CUTOFF, CURRENT_DATE())), 0)), c.FIRST_FUNDED_DATE))::TIMESTAMP_NTZ AS PAYMENT_TS,
         IFF(UNIFORM(1, 100, RANDOM()) <= 72, 'DEPOSIT', 'WITHDRAWAL') AS DIRECTION,
         ROUND(EXP(6.6 + 0.9 * NORMAL(0, 1, RANDOM())) * IFF(c.SEGMENT = 'Institutional', 50, IFF(c.SEGMENT = 'Professional', 6, 1)), 2) AS AMOUNT_GBP,
         ARRAY_CONSTRUCT('Debit Card','Debit Card','Bank Transfer','Bank Transfer','PayPal','Apple Pay')[UNIFORM(0, 5, RANDOM())]::STRING AS METHOD,
         c.COUNTRY AS PAYER_COUNTRY
  FROM CLIENTS c, TABLE(GENERATOR(ROWCOUNT => 8)) g
  WHERE c.FIRST_FUNDED_DATE IS NOT NULL AND UNIFORM(1, 8, RANDOM()) <= 5),
mule AS (   -- rapid in/out via multiple third-party cards from different countries
  SELECT c.CLIENT_ID, DATEADD(hour, UNIFORM(0, 240, RANDOM()), DATEADD(day, -UNIFORM(1, 30, RANDOM()), CURRENT_DATE()))::TIMESTAMP_NTZ,
         IFF(g.SEQ % 2 = 0, 'DEPOSIT', 'WITHDRAWAL'),
         ROUND(UNIFORM(2000::FLOAT, 9500::FLOAT, RANDOM()), 2),
         'Debit Card',
         ARRAY_CONSTRUCT('Nigeria','Romania','Lithuania','Brazil','Cyprus','Ukraine')[UNIFORM(0, 5, RANDOM())]::STRING
  FROM CLIENTS c, (SELECT SEQ4() SEQ FROM TABLE(GENERATOR(ROWCOUNT => 12))) g
  WHERE c._FRAUD_PATTERN = 'MULE' AND c.FIRST_FUNDED_DATE IS NOT NULL)
SELECT 'PAY' || LPAD(ROW_NUMBER() OVER (ORDER BY PAYMENT_TS), 8, '0') AS PAYMENT_ID, CLIENT_ID, PAYMENT_TS, DIRECTION, AMOUNT_GBP, METHOD,
       PAYER_COUNTRY,
       IFF(UNIFORM(1, 100, RANDOM()) <= 97, 'Settled', IFF(UNIFORM(1, 2, RANDOM()) = 1, 'Declined', 'Pending')) AS STATUS
FROM (SELECT * FROM normal UNION ALL SELECT * FROM mule);

-- ---------------------------------------------------------------------
-- Login events (security / ATO signals)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE LOGIN_EVENTS AS
WITH normal AS (
  SELECT c.CLIENT_ID,
         DATEADD(second, UNIFORM(0, 86399, RANDOM()), DATEADD(day, -UNIFORM(0, 89, RANDOM()), CURRENT_DATE()))::TIMESTAMP_NTZ AS LOGIN_TS,
         IFF(UNIFORM(1, 100, RANDOM()) <= 97, c.COUNTRY, ARRAY_CONSTRUCT('Spain','France','United States','Thailand')[UNIFORM(0, 3, RANDOM())]::STRING) AS IP_COUNTRY,
         'DEV-' || ABS(HASH(c.CLIENT_ID)) % 1000000 AS DEVICE_ID,
         ARRAY_CONSTRUCT('iOS','Android','Web')[ABS(HASH(c.CLIENT_ID)) % 3]::STRING AS PLATFORM,
         UNIFORM(1, 100, RANDOM()) <= 98 AS SUCCESS
  FROM CLIENTS c, TABLE(GENERATOR(ROWCOUNT => 25)) g
  WHERE c.FIRST_FUNDED_DATE IS NOT NULL AND UNIFORM(1, 25, RANDOM()) <= 12),
ato AS (
  SELECT c.CLIENT_ID,
         DATEADD(minute, UNIFORM(0, 600, RANDOM()), DATEADD(day, -UNIFORM(0, 6, RANDOM()), CURRENT_DATE()))::TIMESTAMP_NTZ,
         ARRAY_CONSTRUCT('Russia','Vietnam','Brazil','Indonesia','Nigeria')[UNIFORM(0, 4, RANDOM())]::STRING,
         'DEV-NEW-' || UNIFORM(1, 99999, RANDOM()),
         'Web',
         UNIFORM(1, 100, RANDOM()) <= 40
  FROM CLIENTS c, TABLE(GENERATOR(ROWCOUNT => 15)) g
  WHERE c._FRAUD_PATTERN IN ('ATO','MULE'))
SELECT 'L' || LPAD(ROW_NUMBER() OVER (ORDER BY LOGIN_TS), 9, '0') AS LOGIN_ID, * FROM (SELECT * FROM normal UNION ALL SELECT * FROM ato);

-- ---------------------------------------------------------------------
-- Regulatory transaction reporting (last 30 days of trades)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE REG_TRANSACTION_REPORTS AS
WITH t AS (SELECT tr.*, UNIFORM(1, 1000, RANDOM()) AS R FROM TRADES tr
           WHERE tr.TRADE_TS >= DATEADD(day, -30, CURRENT_DATE())
             AND tr.PRODUCT_LINE IN ('CFD','SPREAD_BET','PRIME','OPTIONS_FUTURES','SHARE_DEALING'))
SELECT 'RPT' || SUBSTR(t.TRADE_ID, 2) AS REPORT_ID, t.TRADE_ID, t.ENTITY, e.REPORTING_REGIME AS REGIME, e.REGULATOR,
       t.TRADE_TS,
       DATEADD(minute, IFF(t.R <= 985, UNIFORM(5, 900, RANDOM()), UNIFORM(1500, 4000, RANDOM())), t.TRADE_TS) AS SUBMITTED_TS,
       CASE WHEN t.R <= 960 THEN 'ACCEPTED' WHEN t.R <= 982 THEN 'REJECTED' WHEN t.R <= 992 THEN 'LATE' ELSE 'PENDING' END AS STATUS,
       CASE WHEN t.R > 960 AND t.R <= 982 THEN
            ARRAY_CONSTRUCT('Invalid LEI','Missing client national ID','ISIN not recognised','Price notation mismatch',
                            'Venue MIC invalid','Duplicate report','UTI missing')[UNIFORM(0, 6, RANDOM())]::STRING END AS REJECT_REASON
FROM t JOIN ENTITIES e ON e.ENTITY = t.ENTITY;

-- Client money (CASS 7) daily reconciliation per entity
CREATE OR REPLACE TABLE CLIENT_MONEY_RECON AS
WITH d AS (SELECT DATEADD(day, -SEQ4(), CURRENT_DATE()) RECON_DATE FROM TABLE(GENERATOR(ROWCOUNT => 90))),
base AS (SELECT c.ENTITY, SUM(b.CASH_BALANCE_GBP) REQ FROM ACCOUNT_BALANCES b JOIN CLIENTS c USING (CLIENT_ID) GROUP BY 1)
SELECT d.RECON_DATE, b.ENTITY,
       ROUND(b.REQ * (1 + 0.04 * NORMAL(0, 1, RANDOM())), 2) AS CLIENT_MONEY_REQUIREMENT_GBP,
       ROUND(b.REQ * (1 + 0.04 * NORMAL(0, 1, RANDOM())) * (1 + IFF(UNIFORM(1, 100, RANDOM()) <= 4, -0.012, 0.003)), 2) AS CLIENT_MONEY_RESOURCE_GBP
FROM d CROSS JOIN base b;

CREATE OR REPLACE VIEW CLIENT_MONEY_RECON_V AS
SELECT *, CLIENT_MONEY_RESOURCE_GBP - CLIENT_MONEY_REQUIREMENT_GBP AS DIFFERENCE_GBP,
       IFF(CLIENT_MONEY_RESOURCE_GBP < CLIENT_MONEY_REQUIREMENT_GBP, 'SHORTFALL', 'OK') AS RECON_STATUS
FROM CLIENT_MONEY_RECON;

-- hide the seed column from consumers
ALTER TABLE CLIENTS RENAME COLUMN _FRAUD_PATTERN TO _SEED_PATTERN;
CREATE OR REPLACE SECURE VIEW CLIENTS_V AS SELECT * EXCLUDE (_SEED_PATTERN, LAST_ACTIVE_CUTOFF) FROM CLIENTS;
