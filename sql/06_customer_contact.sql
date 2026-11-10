-- =====================================================================
-- IG_GROUP_DB  |  06  Customer contact centre (synthetic data)
-- Version: v2  |  Date: 2026-11-08
-- v2: call transcripts; every opening must state "The IG Group is regulated
--     by the FCA in the UK" (FCA_DISCLOSURE_GIVEN / DISCLOSURE_MISSED red flags).
-- Modelled on https://www.ig.com/ie/contact-us :
--   channels Phone, Live Chat, WhatsApp, Email; staffed 24h from
--   08:00 Saturday to 22:00 Friday (UK time); wellbeing concerns routed to
--   compliance@ig.com. 90 days of contacts linked to real CLIENTS rows.
-- =====================================================================
USE ROLE ACCOUNTADMIN;
USE WAREHOUSE IG_WH;
USE SCHEMA IG_GROUP_DB.STRUCTURED;

-- ---------------------------------------------------------------------
-- Contact centre agents
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE CONTACT_AGENTS AS
SELECT 'AG' || LPAD(SEQ4() + 1, 4, '0') AS AGENT_ID,
       DECODE(MOD(SEQ4(), 6), 0, 'London Client Services', 1, 'Dublin Client Services', 2, 'Krakow Client Services',
                              3, 'Trading Desk Support', 4, 'Payments & KYC', 5, 'Bangalore Client Services') AS TEAM,
       DECODE(MOD(SEQ4(), 5), 0, 'Senior', 1, 'Senior', 'Associate') AS GRADE,
       DECODE(MOD(SEQ4(), 7), 0, 'German', 1, 'French', 2, 'Spanish', 3, 'Italian', 'English') AS LANGUAGE,
       DATEADD(day, -UNIFORM(60, 2500, RANDOM(11)), CURRENT_DATE()) AS HIRE_DATE
FROM TABLE(GENERATOR(ROWCOUNT => 240));

-- ---------------------------------------------------------------------
-- Contacts (one row per inbound contact)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE CUSTOMER_CONTACTS AS
WITH base AS (
  SELECT SEQ4() AS N,
         -- spread over last 90 days with intraday peaks at UK and US open
         DATEADD(minute,
                 UNIFORM(0, 59, RANDOM(1)) +
                 60 * DECODE(UNIFORM(1, 10, RANDOM(2)), 1, UNIFORM(0, 23, RANDOM(3)), 2, UNIFORM(0, 23, RANDOM(3)),
                             3, 7, 4, 8, 5, 9, 6, 14, 7, 15, 8, UNIFORM(10, 13, RANDOM(3)), 9, UNIFORM(16, 20, RANDOM(3)), UNIFORM(8, 17, RANDOM(3))),
                 DATEADD(day, -UNIFORM(0, 89, RANDOM(4)), CURRENT_DATE())::TIMESTAMP_NTZ) AS START_TS,
         UNIFORM(1, 100, RANDOM(5)) AS R_CH,
         UNIFORM(1, 1000, RANDOM(6)) AS R_RS,
         UNIFORM(0, 1749999, RANDOM(7)) AS CLI_IX,
         UNIFORM(0, 239, RANDOM(8)) AS AG_IX,
         UNIFORM(0::FLOAT, 1::FLOAT, RANDOM(9)) AS U1,
         UNIFORM(0::FLOAT, 1::FLOAT, RANDOM(10)) AS U2,
         UNIFORM(0::FLOAT, 1::FLOAT, RANDOM(12)) AS U3,
         UNIFORM(0::FLOAT, 1::FLOAT, RANDOM(13)) AS U4,
         UNIFORM(0::FLOAT, 1::FLOAT, RANDOM(14)) AS U5
  FROM TABLE(GENERATOR(ROWCOUNT => 300000))
),
open_hours AS (   -- closed 22:00 Friday -> 08:00 Saturday
  SELECT * FROM base
  WHERE NOT ((DAYOFWEEKISO(START_TS) = 5 AND HOUR(START_TS) >= 22)
          OR (DAYOFWEEKISO(START_TS) = 6 AND HOUR(START_TS) < 8))
    AND START_TS <= CURRENT_TIMESTAMP()::TIMESTAMP_NTZ
),
cli AS (SELECT CLIENT_ID, ENTITY, COUNTRY, SEGMENT, PRIMARY_PRODUCT, ROW_NUMBER() OVER (ORDER BY CLIENT_ID) - 1 AS IX FROM CLIENTS),
ag AS (SELECT *, ROW_NUMBER() OVER (ORDER BY AGENT_ID) - 1 AS IX FROM CONTACT_AGENTS),
shaped AS (
  SELECT o.*, c.CLIENT_ID, c.ENTITY, c.COUNTRY, c.SEGMENT, c.PRIMARY_PRODUCT,
         CASE WHEN R_CH <= 38 THEN 'Phone' WHEN R_CH <= 76 THEN 'Live Chat' WHEN R_CH <= 90 THEN 'WhatsApp' ELSE 'Email' END AS CHANNEL,
         CASE WHEN R_RS <= 170 THEN 'Deposits & withdrawals'
              WHEN R_RS <= 290 THEN 'Platform & login'
              WHEN R_RS <= 400 THEN 'Account opening & verification (KYC)'
              WHEN R_RS <= 500 THEN 'Margin calls & position close-outs'
              WHEN R_RS <= 590 THEN 'Order execution & slippage'
              WHEN R_RS <= 670 THEN 'Charges, fees & overnight funding'
              WHEN R_RS <= 740 THEN 'Spread betting & CFD product questions'
              WHEN R_RS <= 800 THEN 'Share dealing, ISA & SIPP'
              WHEN R_RS <= 850 THEN 'Options & futures'
              WHEN R_RS <= 895 THEN 'Tax statements & documents'
              WHEN R_RS <= 935 THEN 'Account closure'
              WHEN R_RS <= 970 THEN 'Complaint'
              WHEN R_RS <= 985 THEN 'Trading wellbeing concern'
              ELSE 'Refer a friend & promotions' END AS REASON
  FROM open_hours o JOIN cli c ON c.IX = o.CLI_IX
),
metrics AS (
  SELECT s.*, a.AGENT_ID, a.TEAM, a.GRADE,
         -- difficulty multiplier by reason
         DECODE(REASON, 'Margin calls & position close-outs', 1.5, 'Complaint', 1.9, 'Trading wellbeing concern', 2.2,
                'Order execution & slippage', 1.4, 'Account opening & verification (KYC)', 1.2,
                'Platform & login', 0.8, 'Refer a friend & promotions', 0.6, 1.0) AS DIFF,
         -- busier at market opens -> longer queues
         IFF(HOUR(START_TS) IN (8, 9, 14, 15), 2.0, IFF(DAYOFWEEKISO(START_TS) >= 6, 0.6, 1.0)) AS PEAK
  FROM shaped s JOIN ag a ON a.IX = s.AG_IX
),
final AS (
  SELECT m.*,
         ROUND(DECODE(CHANNEL, 'Phone', 25, 'Live Chat', 15, 'WhatsApp', 90, 'Email', 4 * 3600) * PEAK * (-LN(GREATEST(U1, 0.0001)))) AS WAIT_SEC,
         (U2 < DECODE(CHANNEL, 'Phone', 0.025, 'Live Chat', 0.035, 'WhatsApp', 0.015, 0.0) * PEAK * (0.4 + U1)) AS ABANDONED
  FROM metrics m
)
SELECT 'CT' || LPAD(N, 8, '0') AS CONTACT_ID,
       CLIENT_ID, ENTITY, COUNTRY, SEGMENT, PRIMARY_PRODUCT, CHANNEL, REASON,
       START_TS,
       START_TS::DATE AS CONTACT_DATE,
       WAIT_SEC,
       ABANDONED,
       IFF(ABANDONED, NULL, AGENT_ID) AS AGENT_ID,
       IFF(ABANDONED, NULL, TEAM) AS TEAM,
       IFF(ABANDONED, 0, ROUND(DECODE(CHANNEL, 'Phone', 330, 'Live Chat', 540, 'WhatsApp', 720, 'Email', 240) * DIFF * (0.5 + U3) * IFF(GRADE = 'Senior', 0.85, 1))) AS HANDLE_SEC,
       IFF(ABANDONED OR CHANNEL <> 'Phone', 0, ROUND(45 * DIFF * U4 * U4)) AS HOLD_SEC,
       IFF(ABANDONED, 0, ROUND(60 * DIFF * (0.4 + U5))) AS ACW_SEC,
       NOT ABANDONED AND WAIT_SEC <= DECODE(CHANNEL, 'Phone', 20, 'Live Chat', 30, 'WhatsApp', 300, 'Email', 86400) AS SLA_MET,
       NOT ABANDONED AND U4 < 0.08 * DIFF AS TRANSFERRED,
       NOT ABANDONED AND U5 > 0.20 * DIFF + IFF(GRADE = 'Senior', -0.05, 0) AS RESOLVED_FIRST_CONTACT,
       NOT ABANDONED AND (REASON = 'Complaint' OR (REASON IN ('Order execution & slippage', 'Margin calls & position close-outs') AND U3 < 0.06)) AS COMPLAINT_LOGGED,
       NOT ABANDONED AND (REASON = 'Trading wellbeing concern' OR U2 > 0.996) AS VULNERABILITY_FLAG,
       REASON = 'Trading wellbeing concern' AND NOT ABANDONED AS ESCALATED_TO_COMPLIANCE,
       IFF(ABANDONED OR U1 > 0.32, NULL,   -- ~30% survey response
           LEAST(5, GREATEST(1, ROUND(4.7 - 0.9 * (DIFF - 1) - 0.35 * LEAST(WAIT_SEC / DECODE(CHANNEL, 'Phone', 20, 'Live Chat', 30, 'WhatsApp', 300, 14400), 5) + (U3 - 0.5) * 1.6)))) AS CSAT,
       IFF(ABANDONED OR U1 > 0.18, NULL,
           LEAST(10, GREATEST(0, ROUND(8.6 - 2 * (DIFF - 1) - 0.8 * LEAST(WAIT_SEC / DECODE(CHANNEL, 'Phone', 20, 'Live Chat', 30, 'WhatsApp', 300, 14400), 5) + (U5 - 0.5) * 4)))) AS NPS_SCORE,
       IFF(ABANDONED, NULL, ROUND(0.55 - 0.45 * (DIFF - 1) - 0.05 * LEAST(WAIT_SEC / DECODE(CHANNEL, 'Phone', 20, 'Live Chat', 30, 'WhatsApp', 300, 14400), 5) + (U3 - 0.5), 2)) AS SENTIMENT
FROM final;

-- ---------------------------------------------------------------------
-- Repeat contact (same client within 7 days of a prior contact)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE CUSTOMER_CONTACTS AS
SELECT *,
       COALESCE(DATEDIFF(day, LAG(START_TS) OVER (PARTITION BY CLIENT_ID ORDER BY START_TS), START_TS) <= 7, FALSE) AS REPEAT_7D
FROM CUSTOMER_CONTACTS;

-- ---------------------------------------------------------------------
-- Transcripts. Every agent opening must include the regulatory disclosure
-- "The IG Group is regulated by the FCA in the UK". ~2.5% of handled
-- contacts omit it (more often under peak load / junior agents) so the
-- disclosure check has red flags to surface.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE CUSTOMER_CONTACTS AS
WITH t AS (
  SELECT c.*, SPLIT_PART(k.FULL_NAME, ' ', 1) AS FIRST_NAME,
         'Agent ' || c.AGENT_ID AS AGENT_NAME,
         NOT c.ABANDONED AND UNIFORM(0::FLOAT, 1::FLOAT, RANDOM(21))
             < 0.015 * IFF(HOUR(c.START_TS) IN (8, 9, 14, 15), 2.2, 1) * IFF(g.GRADE = 'Senior', 0.5, 1.2) AS DISCLOSURE_MISSED,
         UNIFORM(1, 3, RANDOM(22)) AS V
  FROM CUSTOMER_CONTACTS c
  JOIN CLIENTS k USING (CLIENT_ID)
  LEFT JOIN CONTACT_AGENTS g ON g.AGENT_ID = c.AGENT_ID
)
SELECT * EXCLUDE (FIRST_NAME, AGENT_NAME, V),
       NOT ABANDONED AND NOT DISCLOSURE_MISSED AS FCA_DISCLOSURE_GIVEN,
       IFF(ABANDONED, NULL,
         -- opening
         DECODE(CHANNEL, 'Email', 'Subject: Re: your enquiry\n\n', '') ||
         AGENT_NAME || ': ' ||
         DECODE(CHANNEL, 'Phone', 'Good ' || IFF(HOUR(START_TS) < 12, 'morning', 'afternoon') || ', thank you for calling IG, ',
                         'Email', 'Dear ' || FIRST_NAME || ', thank you for contacting IG. ',
                         'Hi ' || FIRST_NAME || ', thanks for messaging IG, ') ||
         IFF(DISCLOSURE_MISSED, '', 'The IG Group is regulated by the FCA in the UK. ') ||
         IFF(CHANNEL = 'Phone', 'Calls are recorded for training and regulatory purposes. ', '') ||
         'How can I help you today?\n' ||
         -- client
         'Client: ' ||
         CASE REASON
           WHEN 'Deposits & withdrawals' THEN DECODE(V, 1, 'I requested a withdrawal of ' || UNIFORM(500, 20000, RANDOM(23)) || ' three days ago and it still hasn''t reached my bank.',
                                                        2, 'My card deposit was declined but the money has left my account.',
                                                        'How long does a bank transfer deposit take to show?')
           WHEN 'Platform & login' THEN DECODE(V, 1, 'I can''t log in, it keeps asking for my two-factor code.', 2, 'The mobile app froze during the US open and I couldn''t close my trade.', 'My charts aren''t loading on the web platform.')
           WHEN 'Account opening & verification (KYC)' THEN DECODE(V, 1, 'You asked for proof of address again, I already uploaded it.', 2, 'Why did my appropriateness test fail?', 'How long does verification take?')
           WHEN 'Margin calls & position close-outs' THEN DECODE(V, 1, 'My position on ' || ENTITY || ' was closed out overnight, I didn''t get a margin call.', 2, 'I got a margin call, what do I need to deposit?', 'Why was my position closed at that price?')
           WHEN 'Order execution & slippage' THEN DECODE(V, 1, 'My stop executed well below my stop level.', 2, 'My limit order didn''t fill even though the price went through it.', 'I was slipped on the NFP release.')
           WHEN 'Charges, fees & overnight funding' THEN DECODE(V, 1, 'What is this overnight funding charge on my statement?', 2, 'Why was I charged an inactivity fee?', 'Can you explain the FX conversion fee?')
           WHEN 'Spread betting & CFD product questions' THEN 'Can you explain the difference between a spread bet and a CFD for me?'
           WHEN 'Share dealing, ISA & SIPP' THEN DECODE(V, 1, 'I want to transfer my ISA in from another provider.', 2, 'When will my dividend be paid?', 'How do I top up my SIPP?')
           WHEN 'Options & futures' THEN 'How is margin calculated on my options position?'
           WHEN 'Tax statements & documents' THEN 'I need my annual tax statement for my accountant.'
           WHEN 'Account closure' THEN 'I''d like to close my account and withdraw my balance.'
           WHEN 'Complaint' THEN DECODE(V, 1, 'I want to make a formal complaint about how my account was handled.', 2, 'This is the third time I''ve called about this, I want to complain.', 'I''m unhappy with the outcome of my last query.')
           WHEN 'Trading wellbeing concern' THEN DECODE(V, 1, 'I''ve lost more than I can afford and I''m struggling to stop trading.', 2, 'My trading is affecting my sleep and my family.', 'I think I need to put limits on my account.')
           ELSE 'How does the refer-a-friend offer work?'
         END || '\n' ||
         -- agent handling
         AGENT_NAME || ': ' ||
         CASE
           WHEN REASON = 'Trading wellbeing concern' THEN 'Thank you for telling me. I can set deposit limits or a cooling-off period on your account now, and I''m referring this to our compliance team at compliance@ig.com who will follow up. You can also contact free support services such as GamCare.'
           WHEN REASON = 'Complaint' THEN 'I''m sorry to hear that. I''ve logged this as a formal complaint; you''ll receive an acknowledgement and a final response within 8 weeks, and you can refer it to the Financial Ombudsman Service if you are not satisfied.'
           WHEN TRANSFERRED THEN 'I''m going to transfer you to a specialist team who can look into this for you.'
           WHEN RESOLVED_FIRST_CONTACT THEN 'I''ve checked your account and resolved that for you now. Is there anything else I can help with?'
           ELSE 'I''ve raised this with the relevant team and we''ll come back to you within two working days.'
         END ||
         IFF(COMPLAINT_LOGGED AND REASON <> 'Complaint', '\n[Expression of dissatisfaction logged as complaint]', '') ||
         IFF(VULNERABILITY_FLAG AND REASON <> 'Trading wellbeing concern', '\n[Potential vulnerability noted on account]', '')
       ) AS TRANSCRIPT
FROM t;

ALTER TABLE CUSTOMER_CONTACTS SET COMMENT = 'Synthetic inbound contacts (Phone / Live Chat / WhatsApp / Email) - 90 days';

SELECT CHANNEL, COUNT(*) N, AVG(WAIT_SEC) ASA, AVG(HANDLE_SEC) AHT, AVG(ABANDONED::INT) ABN,
       AVG(RESOLVED_FIRST_CONTACT::INT) FCR, AVG(CSAT) CSAT
FROM CUSTOMER_CONTACTS GROUP BY 1;
