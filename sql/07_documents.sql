-- =====================================================================
-- IG_GROUP_DB  |  07  IG Group documents: ESG, annual, quarterly, news
-- Version: v1  |  Date: 2026-11-10
-- v1: Real IG Group publications (iggroup.com / RNS) parsed with
--     AI_PARSE_DOCUMENT, chunked, summarised (AI_AGG), sentiment-scored
--     (AI_SENTIMENT with aspects) and indexed by Cortex Search DOCS_SEARCH.
-- PDFs are uploaded first (documents/*.pdf) with:
--   PUT file://documents/*.pdf @IG_GROUP_DB.UNSTRUCTURED.IG_DOCS_STAGE AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
-- =====================================================================
USE ROLE ACCOUNTADMIN;
USE WAREHOUSE IG_WH;
USE SCHEMA IG_GROUP_DB.UNSTRUCTURED;

CREATE STAGE IF NOT EXISTS IG_DOCS_STAGE DIRECTORY = (ENABLE = TRUE) ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')
  COMMENT = 'IG Group published reports (annual, ESG, results, trading updates)';

-- --------------------------- Document register ------------------------
-- FILE_NAME set -> PDF on IG_DOCS_STAGE; otherwise BODY holds the release text.
CREATE OR REPLACE TABLE IG_DOCUMENTS (
  DOC_ID STRING, TITLE STRING, DOC_TYPE STRING, PERIOD STRING, PUBLISHED_DATE DATE,
  SOURCE_URL STRING, FILE_NAME STRING, BODY STRING,
  PAGE_COUNT INT, SUMMARY STRING, SENTIMENT STRING, SENTIMENT_ASPECTS VARIANT, PROCESSED_AT TIMESTAMP_LTZ
) COMMENT = 'IG Group ESG reports, annual reports, quarterly/interim reports and news with AI summary and sentiment';

INSERT INTO IG_DOCUMENTS (DOC_ID, TITLE, DOC_TYPE, PERIOD, PUBLISHED_DATE, SOURCE_URL, FILE_NAME, BODY) VALUES
('AR-2025-DEC', 'Annual Report - 31 December 2025 ("Accelerating growth")', 'Annual Report', '7 months to 31 Dec 2025', '2026-03-19',
 'https://www.iggroup.com/~/media/Files/I/IG-Group/documents/investors/financial-results/results-reports-and-presentations/2026/annual-report-31-December-2025.pdf',
 'annual-report-31-December-2025.pdf', NULL),
('AR-2025-MAY', 'Annual Report 2025 ("Moving faster")', 'Annual Report', 'FY to 31 May 2025', '2025-07-24',
 'https://www.iggroup.com/~/media/Files/I/IG-Group/documents/investors/financial-results/results-reports-and-presentations/2025/annual-report-2025.pdf',
 'annual-report-2025.pdf', NULL),
('RES-CY25', 'Results for the financial year ended 31 December 2025', 'Annual Report', 'FY to 31 Dec 2025', '2026-03-19',
 'https://www.iggroup.com/~/media/Files/I/IG-Group/documents/investors/financial-results/results-reports-and-presentations/2026/igg-cy25-results-rns.pdf',
 'igg-cy25-results-rns.pdf', NULL),
('ESG-2025', 'Sustainability addendum 2025 (SASB / GRI disclosures)', 'ESG Report', 'Year to 31 Dec 2025', '2026-03-19',
 'https://www.iggroup.com/~/media/Files/I/IG-Group/documents/investors/shareholder-information/regulatory-information/sustainability-addendum-2025.pdf',
 'sustainability-addendum-2025.pdf', NULL),
('Q1-2026', 'AGM trading update - Q1 2026', 'Quarterly Report', 'Q1 2026 (3 months to 31 Mar 2026)', '2026-05-19',
 'https://www.iggroup.com/~/media/Files/I/IG-Group/documents/investors/financial-results/results-reports-and-presentations/2026/igg-agm-trading-update.pdf',
 'igg-agm-trading-update.pdf', NULL),
('H1-2026', 'H1 2026 results', 'Quarterly Report', 'H1 2026 (6 months to 30 Jun 2026)', '2026-07-30',
 'https://www.iggroup.com/~/media/Files/I/IG-Group/documents/investors/financial-results/results-reports-and-presentations/2026/ig-group-h1-2026-results-rns.pdf',
 'ig-group-h1-2026-results-rns.pdf', NULL),
('H1-TU-2026', 'New holding company proposal and H1 2026 trading update', 'Quarterly Report', 'H1 2026 trading update', '2026-07-08',
 'https://www.iggroup.com/investor-relations/press-releases/2026/igg-holdco-proposal-and-trading-update', NULL,
$$IG Group Holdings plc ("IG", "the Group") today issues an update on the strategic review announced on 19 March 2026, including a proposal to establish a new Group holding company and a refreshed organisational model, together with a trading update for the half year ended 30 June 2026 ahead of interim results scheduled for 31 July 2026.

New holding company. As part of the strategic review, IG today announces a proposal to establish a new Group holding company ("New HoldCo"), incorporated in Jersey, subject to shareholder and regulatory approval. The new structure will give the Group greater financial and strategic flexibility and better reflect its international footprint, with around two-thirds of revenue now generated outside the UK. It will not change IG's listing, tax residence or London operations: the Group's shares will remain listed on the London Stock Exchange, with continued eligibility for existing index inclusion; the Group will remain UK tax resident, with no change to its effective tax rate as a result of the reorganisation; and the Group's London presence and employees will be unaffected. The proposal will be implemented by way of a Court-approved scheme of arrangement under the Companies Act 2006. Shareholders will exchange their ordinary shares in IG Group Holdings plc for new ordinary shares in New HoldCo on a one-for-one basis. IG Group Holdings plc will become a sub-group of New HoldCo and remain the head of the FCA-supervised regulatory group. A shareholder circular is expected in Q3 2026 and, subject to approvals (including from the FCA and certain other international financial regulators), the Scheme is anticipated to become effective in Q4 2026.

Organisational model. IG is streamlining its operating model to serve customers better, bring products to market faster and improve efficiency. Three regional commercial divisions - UK & Ireland, Europe, and APAC & Middle East - will be combined into a single commercial business unit, led by Michael Healy, who will become CEO, IG Consumer. Customer-facing technology teams, operations and Independent Reserve will move into this new division, alongside Freetrade. North America and Institutional will continue as separate business units, led respectively by Michael Vaughan (CEO, IG North America) and Andy Biggs (CEO, IG Securities). The changes take effect in H2 2026.

H1 2026 trading update. The Group expects to report H1 2026 total revenue of approximately £643 million, up around 18% on the prior year, and organic total revenue of approximately £624 million, up around 16% (17% on an organic, continuing operations basis). First trades increased approximately 107% on a reported basis and 74% organically, and active customers increased approximately 66% on a reported basis and 13% organically.

Guidance. The Group continued to trade well in Q2 2026 and expects full-year results in line with market expectations. The Board reiterates its 2026 guidance, upgraded on 19 May 2026: organic total revenue, excluding Freetrade and Independent Reserve, is expected to grow 10-15% year-on-year from the 2025 base of approximately £1,100 million, with EBITDA margins in a mid-40s per cent range and net interest income of £110-120 million. Beyond 2026, the Board remains confident the Group can compound organic total revenue at least 10% per annum on the 2025 base, with EBITDA margins sustained in a mid-40s per cent range.

Strategic review. The review is also evaluating acquisitions to accelerate growth, the Group's listing venues, and potential combinations of parts of the Group with other industry participants. Outcomes will be set out at a Strategy Update in autumn 2026.$$),
('Q3-2026', 'Q3 2026 trading update', 'Quarterly Report', 'Q3 2026 (3 months to 30 Sep 2026)', '2026-10-02',
 'https://www.investegate.co.uk/announcement/rns/ig-group-holdings--igg/q3-trading-update-/9803001', NULL,
$$IG GROUP HOLDINGS PLC - Q3 trading update, 2 October 2026. THIS ANNOUNCEMENT CONTAINS INSIDE INFORMATION.

Breon Corcoran, CEO, said: "Growth in first trades and active customers remained strong in Q3 2026. Lower Q3 revenue reflected reduced OTC revenue retention in less supportive market conditions, and I remain confident in meeting our medium-term guidance."

- Q3 2026 total revenue expected to be approximately £240 million, down approximately 14% year-on-year, reflecting lower OTC revenue retention.
- 2026 total revenue growth now expected to be in a mid-single-digit per cent range year-on-year.
- Q3 2026 organic first trades up over 25% year-on-year; organic active customers up around 17%.
- Underdog traded strongly, with Q3 2026 net revenue up over 100% year-on-year to approximately $105 million, ahead of the seasonally important Q4 period, which accounted for more than a third of Underdog's revenue in 2025.

Group total revenue in Q3 2026 is expected to be approximately £240 million (Q3 2025: £280.1 million), including net trading revenue of approximately £210 million (Q3 2025: £249.5 million). Within OTC derivatives, revenue retention in Q3 2026 was approximately 70%, below the approximately 80% averaged since the introduction of market-making optimisation measures in H2 2025. The Board remains confident that these measures will structurally increase OTC revenue retention over the medium to long term, albeit with greater expected short-term variability.

The underlying business remains strong. While Q3 2026 OTC net trading revenue of approximately £155 million was around 18% lower year-on-year, OTC customer income increased by approximately 8%.

Non-recurring costs relating to the Group's redomicile to Jersey and the restructuring associated with the refreshed organisational model announced on 8 July 2026 are expected to be approximately £30 million for 2026, of which £16.4 million was reported in H1 2026. Excluding these non-recurring costs and expenses related to the acquisition of Underdog, which are contingent on closing, the Group EBITDA margin for 2026 is expected to be in the low-40s per cent range.

The Board remains confident of meeting its medium-term guidance beyond 2026, reflecting customer growth, driven by investment in product and brand, together with higher OTC revenue retention. IG will provide further detail on Q3 2026 trading on 22 October 2026, ahead of its strategy update that day, and will host a virtual seminar on Underdog on 8 October 2026.$$),
('NEWS-CME-2026', 'Capital Markets Event', 'News', 'Oct 2026', '2026-10-22',
 'https://www.iggroup.com/investor-relations/press-releases/2026/capital-markets-event', NULL,
$$IG Group Holdings plc ("IG", "the Group") is today hosting a Capital Markets Event for investors and analysts. The event will set out the priorities arising from the strategic review announced on 19 March 2026, alongside its maintained medium-term guidance and an updated capital allocation framework. Further to the trading update of 2 October 2026, the Group is also providing product and divisional commentary on Q3 2026 trading. The strategic review evaluated routes to maximise shareholder value including acquisitions, the Group's domicile and listing venues, and potential combinations of parts of the Group with other industry participants; it led to the proposed Jersey holding company, the IG Consumer / IG North America / IG Securities organisational model and the proposed acquisition of Underdog.$$),
('NEWS-UNDERDOG-2026', 'Acquisition of Underdog', 'News', 'Jul 2026', '2026-07-30',
 'https://www.iggroup.com/investor-relations/press-releases/2026/acquisition-of-underdog', NULL,
$$IG Group Holdings plc ("IG", "the Group") announces that it has agreed to acquire Underdog (Underdog Sports Holdings, Inc.), a leading US daily fantasy sports and prediction markets operator, for total consideration of up to approximately $1.3 billion. IG said the acquisition marks a decisive step in its strategy, establishing IG as a leader in the fast-growing US prediction markets. Over 60% of Underdog customers are aged under 30. Pro forma gross leverage is expected to be below 2.0x at the end of the year of completion, deleveraging thereafter, and IG remains committed to retaining an investment grade credit rating. Completion is subject to regulatory and antitrust approvals and is expected in late 2026 or early 2027. IG hosted a virtual seminar on Underdog for analysts and investors on 8 October 2026.$$),
('NEWS-MONEYREADY-2026', 'IG Group makes landmark commitment to Money Ready in major financial education partnership', 'News', 'Jun 2026', '2026-06-26',
 'https://www.iggroup.com/investor-relations/press-releases/2026/ig-group-commitment-to-money-ready', NULL,
$$Global trading and investing platform IG Group ("IG") and UK financial education charity Money Ready today announced a transformative three-year partnership - the charity's single largest funding commitment to date. The announcement comes as momentum grows behind the Government's Financial Inclusion Strategy and calls for financial education to become a curriculum priority. New research from Money Ready's 2025 Cost of Not Knowing campaign reveals that the average person loses over £640 every year to financial confusion and indecision; over 30 years that adds up to almost £20,000. The three-year partnership will fund Money Ready's direct and indirect programmes, with a target of reaching 245,000 learners over the partnership period, including 70,000 in Year 1 alone. Year 1 will also see the opening of a new Money Ready Hub and a plan for 500 hours of employee volunteering. The partnership aims to be a new blueprint for IG's corporate social investment - going beyond traditional philanthropy to embed within communities, measure real-world outcomes and create meaningful employee engagement. It is funded through IG's four-year pledge to donate 1% of profits to charitable causes, fulfilled in late 2025. Programme outcomes will be tracked against improvements in financial knowledge, skills, confidence, attitudes and behaviours.
Leon Ward, CEO, Money Ready: "A lack of financial understanding isn't a personal failing; it's a knowledge gap. Our research shows that 27% of UK adults feel ashamed of their financial knowledge and a third have avoided major financial decisions. This is the biggest single funding commitment we have ever received."
Michael Healy, Managing Director, UK & Ireland, IG Group: "Financial capability is one of the most important factors influencing long-term financial wellbeing, yet too many people still reach adulthood without the confidence or knowledge to make informed decisions about money. Together we are aiming to reach hundreds of thousands of people over the next three years."$$);

-- --------------------------- Parse PDFs (page split, LAYOUT keeps tables) --
CREATE OR REPLACE TABLE IG_DOCUMENT_PAGES AS
WITH parsed AS (
  SELECT d.DOC_ID,
         AI_PARSE_DOCUMENT(TO_FILE('@IG_DOCS_STAGE', d.FILE_NAME), {'mode': 'LAYOUT', 'page_split': TRUE}) AS P
  FROM IG_DOCUMENTS d WHERE d.FILE_NAME IS NOT NULL
)
SELECT DOC_ID, f.value:index::INT + 1 AS PAGE_NO, f.value:content::STRING AS CONTENT
FROM parsed, LATERAL FLATTEN(input => P:pages) f
UNION ALL
SELECT DOC_ID, 1, BODY FROM IG_DOCUMENTS WHERE BODY IS NOT NULL;

-- --------------------------- Chunks for search ------------------------
CREATE OR REPLACE TABLE IG_DOCUMENT_CHUNKS CHANGE_TRACKING = TRUE AS
SELECT p.DOC_ID || '-p' || p.PAGE_NO || '-' || c.index AS CHUNK_ID,
       p.DOC_ID, d.TITLE, d.DOC_TYPE, d.PERIOD, d.PUBLISHED_DATE, d.SOURCE_URL, p.PAGE_NO,
       c.value::STRING AS CHUNK
FROM IG_DOCUMENT_PAGES p
JOIN IG_DOCUMENTS d USING (DOC_ID),
     LATERAL FLATTEN(input => SNOWFLAKE.CORTEX.SPLIT_TEXT_RECURSIVE_CHARACTER(p.CONTENT, 'markdown', 1800, 200)) c
WHERE LENGTH(TRIM(p.CONTENT)) > 40;

-- --------------------------- AI summary + sentiment -------------------
-- AI_AGG summarises across all pages of a document; AI_SENTIMENT (2k-token window) scores the summary.
CREATE OR REPLACE TEMPORARY TABLE _DOC_SUMMARY AS
SELECT DOC_ID, COUNT(*) AS PAGES,
       AI_AGG(CONTENT,
         'You are an equity analyst. Write an executive summary of this IG Group publication in 120-180 words, '
         || 'then 4-6 bullet points of the most important facts with figures (revenue, profit, customers, guidance, '
         || 'ESG targets, strategy, risks). Plain text; start bullets with "- ". Do not invent numbers.') AS SUMMARY
FROM IG_DOCUMENT_PAGES GROUP BY DOC_ID;

UPDATE IG_DOCUMENTS d SET
  PAGE_COUNT = s.PAGES,
  SUMMARY = s.SUMMARY,
  SENTIMENT_ASPECTS = AI_SENTIMENT(s.SUMMARY, ['Financial performance', 'Growth outlook', 'Customers', 'Regulation', 'Sustainability', 'Strategy']),
  PROCESSED_AT = CURRENT_TIMESTAMP()
FROM _DOC_SUMMARY s WHERE d.DOC_ID = s.DOC_ID;

UPDATE IG_DOCUMENTS SET SENTIMENT = FILTER(SENTIMENT_ASPECTS:categories, c -> c:name = 'overall')[0]:sentiment::STRING;

-- --------------------------- Cortex Search ----------------------------
CREATE OR REPLACE CORTEX SEARCH SERVICE DOCS_SEARCH
  ON CHUNK ATTRIBUTES DOC_TYPE, DOC_ID, TITLE
  WAREHOUSE = IG_WH TARGET_LAG = '1 day'
  COMMENT = 'IG Group annual reports, ESG/sustainability reports, quarterly/interim results and news releases'
AS SELECT CHUNK_ID, DOC_ID, TITLE, DOC_TYPE, PERIOD, PUBLISHED_DATE::STRING AS PUBLISHED_DATE, SOURCE_URL, PAGE_NO, CHUNK
   FROM IG_GROUP_DB.UNSTRUCTURED.IG_DOCUMENT_CHUNKS;
