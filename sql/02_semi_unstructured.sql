-- =====================================================================
-- IG_GROUP_DB  |  02  SEMI_STRUCTURED + UNSTRUCTURED schemas
-- Version: v2  |  Date: 2026-11-05
-- v2: full-volume client base; support chats sampled (~10k) to bound Cortex AI enrichment cost
-- =====================================================================
USE ROLE ACCOUNTADMIN;
USE WAREHOUSE IG_WH;

-- =============================== SEMI_STRUCTURED =====================
USE SCHEMA IG_GROUP_DB.SEMI_STRUCTURED;

-- App / web clickstream events (JSON payloads as landed from Kafka/Snowpipe Streaming)
CREATE OR REPLACE TABLE APP_EVENTS (EVENT_ID STRING, INGESTED_TS TIMESTAMP_NTZ, PAYLOAD VARIANT) AS
SELECT UUID_STRING(), ts,
  OBJECT_CONSTRUCT(
    'client_id', c.CLIENT_ID,
    'event_type', ARRAY_CONSTRUCT('app_open','view_market','add_watchlist','open_deal_ticket','price_alert_set',
                                  'view_education','deposit_started','deposit_abandoned','chart_study_added','logout')[UNIFORM(0, 9, RANDOM())]::STRING,
    'ts', ts,
    'device', OBJECT_CONSTRUCT('platform', ARRAY_CONSTRUCT('iOS','Android','Web')[UNIFORM(0, 2, RANDOM())]::STRING,
                               'app_version', '9.' || UNIFORM(10, 32, RANDOM()) || '.' || UNIFORM(0, 9, RANDOM())),
    'context', OBJECT_CONSTRUCT('market', i.SYMBOL, 'entity', c.ENTITY, 'session_secs', UNIFORM(5, 1800, RANDOM())),
    'experiment', IFF(UNIFORM(1, 100, RANDOM()) <= 30, OBJECT_CONSTRUCT('id', 'onboarding_v' || UNIFORM(2, 4, RANDOM()), 'variant', IFF(UNIFORM(1,2,RANDOM())=1,'A','B')), NULL))
FROM (SELECT c.*, DATEADD(second, UNIFORM(0, 86399, RANDOM()), DATEADD(day, -UNIFORM(0, 89, RANDOM()), CURRENT_DATE()))::TIMESTAMP_NTZ ts,
             UNIFORM(0, 39, RANDOM()) ir
      FROM IG_GROUP_DB.STRUCTURED.CLIENTS c, TABLE(GENERATOR(ROWCOUNT => 20)) g
      WHERE UNIFORM(1, 20, RANDOM()) <= 8) c
JOIN (SELECT SYMBOL, ROW_NUMBER() OVER (ORDER BY INSTRUMENT_ID) - 1 rn FROM IG_GROUP_DB.STRUCTURED.INSTRUMENTS) i ON i.rn = c.ir;

-- CRM profile documents (Salesforce-style export)
CREATE OR REPLACE TABLE CRM_PROFILES (CLIENT_ID STRING, UPDATED_TS TIMESTAMP_NTZ, PROFILE VARIANT) AS
SELECT CLIENT_ID, CURRENT_TIMESTAMP()::TIMESTAMP_NTZ,
  OBJECT_CONSTRUCT(
    'owner', ARRAY_CONSTRUCT('Retail Desk London','Retail Desk Dublin','Premium Services','APAC Desk Sydney','tastytrade Chicago','Institutional Sales')[UNIFORM(0, 5, RANDOM())]::STRING,
    'tier', CASE SEGMENT WHEN 'Institutional' THEN 'Prime' WHEN 'Professional' THEN 'Premium' ELSE ARRAY_CONSTRUCT('Standard','Standard','Gold')[UNIFORM(0, 2, RANDOM())]::STRING END,
    'marketing', OBJECT_CONSTRUCT('email_opt_in', UNIFORM(1, 100, RANDOM()) <= 64, 'push_opt_in', UNIFORM(1, 100, RANDOM()) <= 55,
                                  'last_campaign', ARRAY_CONSTRUCT('Q3 Gold Promo','ISA Season','Options Education','Crypto Launch','Refer a Friend')[UNIFORM(0, 4, RANDOM())]::STRING),
    'interests', ARRAY_SLICE(ARRAY_CONSTRUCT('indices','fx','commodities','us shares','uk shares','crypto','options','etfs'), UNIFORM(0, 4, RANDOM()), UNIFORM(5, 8, RANDOM())),
    'nps', IFF(UNIFORM(1, 100, RANDOM()) <= 40, UNIFORM(0, 10, RANDOM()), NULL),
    'experience_years', UNIFORM(0, 20, RANDOM()))
FROM IG_GROUP_DB.STRUCTURED.CLIENTS;

-- KYC / onboarding vendor responses
CREATE OR REPLACE TABLE KYC_RESPONSES (CLIENT_ID STRING, RECEIVED_TS TIMESTAMP_NTZ, RESPONSE VARIANT) AS
SELECT CLIENT_ID, SIGNUP_DATE::TIMESTAMP_NTZ,
  OBJECT_CONSTRUCT(
    'vendor', ARRAY_CONSTRUCT('Onfido','Jumio','GBG')[UNIFORM(0, 2, RANDOM())]::STRING,
    'result', KYC_STATUS,
    'checks', OBJECT_CONSTRUCT('document', IFF(KYC_STATUS = 'Failed', 'fail', 'pass'), 'liveness', 'pass',
                               'pep', UNIFORM(1, 1000, RANDOM()) <= 6, 'sanctions_hit', UNIFORM(1, 2000, RANDOM()) <= 2,
                               'adverse_media', UNIFORM(1, 1000, RANDOM()) <= 10),
    'appropriateness', OBJECT_CONSTRUCT('score', UNIFORM(40, 100, RANDOM()), 'passed', UNIFORM(1, 100, RANDOM()) <= 88),
    'source_of_funds', ARRAY_CONSTRUCT('Employment','Savings','Business income','Inheritance','Investments')[UNIFORM(0, 4, RANDOM())]::STRING)
FROM IG_GROUP_DB.STRUCTURED.CLIENTS;

-- Raw price ticks (as landed by a streaming feed) - last 2 days, major markets
CREATE OR REPLACE TABLE PRICE_TICKS_RAW (TICK VARIANT) AS
SELECT OBJECT_CONSTRUCT('epic', 'IX.D.' || REPLACE(i.SYMBOL, ' ', '') || '.DAILY.IP', 'symbol', i.SYMBOL,
                        'bid', ROUND(mp.CLOSE_PRICE * (1 + 0.002 * NORMAL(0, 1, RANDOM())), 5),
                        'offer_spread_bps', i.SPREAD_BPS,
                        'ts', DATEADD(second, SEQ4() % 86400, mp.PRICE_DATE::TIMESTAMP_NTZ))
FROM IG_GROUP_DB.STRUCTURED.INSTRUMENTS i
JOIN IG_GROUP_DB.STRUCTURED.MARKET_PRICES mp ON mp.INSTRUMENT_ID = i.INSTRUMENT_ID AND mp.PRICE_DATE >= DATEADD(day, -1, CURRENT_DATE()),
TABLE(GENERATOR(ROWCOUNT => 200)) g;

-- Flattened, typed view over events
CREATE OR REPLACE VIEW APP_EVENTS_V AS
SELECT EVENT_ID, PAYLOAD:client_id::STRING CLIENT_ID, PAYLOAD:event_type::STRING EVENT_TYPE, PAYLOAD:ts::TIMESTAMP_NTZ EVENT_TS,
       PAYLOAD:device.platform::STRING PLATFORM, PAYLOAD:device.app_version::STRING APP_VERSION,
       PAYLOAD:context.market::STRING MARKET, PAYLOAD:context.session_secs::INT SESSION_SECS,
       PAYLOAD:experiment.id::STRING EXPERIMENT_ID, PAYLOAD:experiment.variant::STRING EXPERIMENT_VARIANT
FROM APP_EVENTS;

-- =============================== UNSTRUCTURED ========================
USE SCHEMA IG_GROUP_DB.UNSTRUCTURED;

-- Support chats assembled from realistic fragments (topic drives wording)
CREATE OR REPLACE TABLE SUPPORT_CHATS AS
WITH topics AS (
  SELECT * FROM VALUES
   (0,'Margin call','I got a margin call on my {m} position overnight and it was closed out before I could add funds. Why was it liquidated so quickly?','I understand how stressful that is. Your account fell below the 50% margin close-out level required under ESMA rules, so positions were closed automatically.'),
   (1,'Withdrawal delay','My withdrawal of {a} has been pending for three days. I need the money urgently, when will it arrive?','Apologies for the delay. Withdrawals to cards can take 3-5 working days; I have escalated this to our payments team.'),
   (2,'Platform outage','The app froze during the US open and I could not close my {m} trade. I lost money because of your platform.','I am sorry. We did see elevated latency between 14:30 and 14:42. I will raise this with our trading desk for review.'),
   (3,'Spread widening','Spreads on {m} widened massively at the open, this feels unfair. Is this normal?','Spreads can widen during volatile periods and outside core hours. Our published minimum spreads apply in normal market conditions.'),
   (4,'Account verification','I have uploaded my passport twice but my account is still not verified. Can you help?','Thanks for your patience. The image was blurred; please upload a clear photo and we will review within 24 hours.'),
   (5,'Overnight funding','Why am I being charged overnight funding on my {m} CFD? Nobody explained this.','Overnight funding applies to leveraged positions held past 10pm UK time. It is shown in your deal ticket and costs page.'),
   (6,'ISA transfer','I would like to transfer my ISA from another provider into IG. How long does it take?','Great to hear. Cash ISA transfers take around 15 working days and stocks and shares ISA transfers up to 30.'),
   (7,'Options approval','I want to trade options on tastytrade but my account is not approved for level 2. How do I upgrade?','You can request an upgrade in account settings; we assess options experience and objectives.'),
   (8,'Crypto deposit','Can I transfer my bitcoin from another wallet into my IG crypto account?','Currently you can buy and sell crypto with GBP but on-chain transfers in are not supported.'),
   (9,'Praise','Just wanted to say the new charting on mobile is excellent and the {m} analysis from your team really helped me.','Thank you so much for the kind words, I will pass this on to the product and research teams.'),
   (10,'Account closure','Please close my account, I am not happy with the fees and the losses I have made on {m}.','I am sorry to hear that. Before closing, could I help review your costs or set risk limits on your account?'),
   (11,'Suspicious login','I got an email about a login from a country I have never been to. Has my account been hacked?','Thank you for flagging this. I have locked your account and reset your password; please enable two-factor authentication.')
  AS t(TOPIC_ID, TOPIC, CLIENT_MSG, AGENT_MSG)),
s AS (
  SELECT c.CLIENT_ID, c.ENTITY, UNIFORM(0, 11, RANDOM()) TID, UNIFORM(0, 39, RANDOM()) IR, UNIFORM(200, 20000, RANDOM()) AMT,
         DATEADD(minute, UNIFORM(0, 1439, RANDOM()), DATEADD(day, -UNIFORM(0, 119, RANDOM()), CURRENT_DATE()))::TIMESTAMP_NTZ TS,
         UNIFORM(1, 3, RANDOM()) FOLLOW
  FROM IG_GROUP_DB.STRUCTURED.CLIENTS c, TABLE(GENERATOR(ROWCOUNT => 2)) g
  WHERE c.FIRST_FUNDED_DATE IS NOT NULL AND UNIFORM(1, 10000, RANDOM()) <= 37),   -- ~10k chats across 1.34M funded clients
inst AS (SELECT SYMBOL, ROW_NUMBER() OVER (ORDER BY INSTRUMENT_ID) - 1 rn FROM IG_GROUP_DB.STRUCTURED.INSTRUMENTS)
SELECT 'CHAT' || LPAD(ROW_NUMBER() OVER (ORDER BY s.TS), 7, '0') AS CHAT_ID, s.CLIENT_ID, s.ENTITY, s.TS AS CHAT_TS,
       t.TOPIC AS SEED_TOPIC,
       ARRAY_CONSTRUCT('Live chat','Email','Phone transcript','In-app chat')[UNIFORM(0, 3, RANDOM())]::STRING AS CHANNEL,
       'Client: ' || REPLACE(REPLACE(t.CLIENT_MSG, '{m}', i.SYMBOL), '{a}', 'GBP ' || s.AMT) || '\n' ||
       'Agent: ' || t.AGENT_MSG || '\n' ||
       CASE s.FOLLOW WHEN 1 THEN 'Client: OK thanks, that makes sense.'
                     WHEN 2 THEN 'Client: This is not good enough, I want to make a formal complaint.'
                     ELSE 'Client: I will think about moving my account elsewhere if this keeps happening.' END AS TRANSCRIPT
FROM s JOIN topics t ON t.TOPIC_ID = s.TID JOIN inst i ON i.rn = s.IR;

-- Formal complaints (subset of chats escalated + extra)
CREATE OR REPLACE TABLE COMPLAINTS AS
SELECT 'CMP' || LPAD(ROW_NUMBER() OVER (ORDER BY CHAT_TS), 6, '0') AS COMPLAINT_ID, CLIENT_ID, ENTITY, CHAT_ID,
       DATEADD(hour, UNIFORM(1, 48, RANDOM()), CHAT_TS) AS RAISED_TS,
       SPLIT_PART(TRANSCRIPT, '\n', 1) || ' ' || SPLIT_PART(TRANSCRIPT, '\n', 3) AS COMPLAINT_TEXT,
       IFF(UNIFORM(1, 100, RANDOM()) <= 70, 'Closed', 'Open') AS STATUS,
       IFF(UNIFORM(1, 100, RANDOM()) <= 35, 'Upheld', IFF(UNIFORM(1, 100, RANDOM()) <= 50, 'Not upheld', 'Partially upheld')) AS OUTCOME,
       UNIFORM(1, 56, RANDOM()) AS DAYS_TO_RESOLVE,
       IFF(UNIFORM(1, 100, RANDOM()) <= 5, TRUE, FALSE) AS REFERRED_TO_OMBUDSMAN
FROM SUPPORT_CHATS
WHERE TRANSCRIPT ILIKE '%formal complaint%' OR (TRANSCRIPT ILIKE '%moving my account%' AND UNIFORM(1, 100, RANDOM()) <= 30);

-- Research & market-insight notes (AI-written, for Cortex Search / agent grounding)
CREATE OR REPLACE TABLE RESEARCH_NOTES AS
WITH topics AS (
  SELECT ROW_NUMBER() OVER (ORDER BY 1) AS N, * FROM VALUES
   ('FTSE 100','Index outlook: FTSE 100 after the Bank of England rate decision','Chris Beauchamp'),
   ('US 500','S&P 500 earnings season preview and positioning','Joshua Mahony'),
   ('US TECH 100','Nasdaq 100: AI capex cycle and mega-cap concentration risk','Chris Beauchamp'),
   ('GERMANY 40','DAX 40: German industrial slowdown and tariff exposure','Joshua Mahony'),
   ('EUR/USD','EUR/USD: ECB vs Fed policy divergence','Axel Rudolph'),
   ('GBP/USD','GBP/USD: UK inflation surprise and sterling','Axel Rudolph'),
   ('USD/JPY','USD/JPY: Bank of Japan normalisation and intervention risk','Tony Sycamore'),
   ('GOLD','Gold at record highs: central bank buying and real yields','Axel Rudolph'),
   ('OIL - BRENT','Brent crude: OPEC+ supply policy and demand outlook','Tony Sycamore'),
   ('NATURAL GAS','Natural gas: winter storage and weather risk','Tony Sycamore'),
   ('NVDA','NVIDIA results preview: data-centre demand and margins','Chris Beauchamp'),
   ('TSLA','Tesla: deliveries, pricing and robotaxi narrative','Joshua Mahony'),
   ('AAPL','Apple: iPhone cycle and services growth','Chris Beauchamp'),
   ('BTC/USD','Bitcoin: ETF flows and halving aftermath','Tony Sycamore'),
   ('ETH/USD','Ether: staking yields and ETF approval','Tony Sycamore'),
   ('SHEL','Shell: buybacks, LNG and energy transition','Joshua Mahony'),
   ('HSBA','HSBC: net interest margin peak and Asia pivot','Joshua Mahony'),
   ('AUSTRALIA 200','ASX 200: China stimulus and iron ore','Tony Sycamore'),
   ('JAPAN 225','Nikkei 225: corporate governance reforms and yen','Tony Sycamore'),
   ('UK GILT','Gilts: fiscal rules, issuance and term premium','Axel Rudolph'),
   ('RISK','Weekly risk: leverage, volatility and position sizing for retail traders','IG Risk Desk'),
   ('OPTIONS','Options education: using covered calls and spreads on tastytrade','tastytrade Education'),
   ('ISA','ISA season: tax-efficient investing and Smart Portfolios','IG Investments Team'),
   ('REGULATION','Consumer Duty one year on: what it means for CFD providers','IG Compliance Insights')
  AS t(MARKET, TITLE, AUTHOR))
SELECT 'RN' || LPAD(N, 4, '0') AS NOTE_ID, MARKET, TITLE, AUTHOR,
       DATEADD(day, -N * 3, CURRENT_DATE()) AS PUBLISHED_DATE,
       AI_COMPLETE('claude-sonnet-4-5',
         'Write a concise (250-350 words) professional market insight note for IG Group retail and professional clients. ' ||
         'Title: "' || TITLE || '". Market: ' || MARKET || '. Author: ' || AUTHOR || '. ' ||
         'Include: key drivers, technical levels or scenarios, risks, and one sentence reminding readers that CFDs and spread bets are leveraged and most retail accounts lose money. ' ||
         'Plain text only, no markdown headings.')::STRING AS BODY
FROM topics;
