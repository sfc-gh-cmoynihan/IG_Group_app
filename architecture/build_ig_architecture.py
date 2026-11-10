"""Build IG Group future-state Snowflake architecture deck (Snowflake brand)."""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn

SNOWFLAKE_BLUE = RGBColor(0x29, 0xB5, 0xE8)
MID_BLUE = RGBColor(0x11, 0x56, 0x7F)
MIDNIGHT = RGBColor(0x00, 0x00, 0x00)
STAR_BLUE = RGBColor(0x71, 0xD3, 0xDC)
VALENCIA_ORANGE = RGBColor(0xFF, 0x9F, 0x36)
PURPLE_MOON = RGBColor(0x7D, 0x44, 0xCF)
FIRST_LIGHT = RGBColor(0xD4, 0x5B, 0x90)
WINDY_CITY = RGBColor(0x8A, 0x99, 0x9E)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xF2, 0xF5, 0xF9)
SOFT_BLUE_BG = RGBColor(0xE4, 0xF5, 0xFD)
SOFT_ORANGE_BG = RGBColor(0xFF, 0xF3, 0xE0)

HEAD_FONT, BODY_FONT = "Texta", "Lato"
LOGO_WHITE, LOGO_BLUE = "/tmp/sf-logo-white.png", "/tmp/sf-logo-blue.png"
OUT = "/Users/cmoynihan/Documents/code/IG_Group_app/architecture/IG_Group_Snowflake_Future_State_Architecture.pptx"

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
BLANK = prs.slide_layouts[6]
W = prs.slide_width


def box(slide, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE, lw=1):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(lw)
    s.shadow.inherit = False
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = 0.12
    return s


def text(shape_or_slide, s, size=11, color=MIDNIGHT, bold=False, font=BODY_FONT,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, xywh=None):
    if xywh is not None:
        shape = shape_or_slide.shapes.add_textbox(*[Inches(v) for v in xywh])
    else:
        shape = shape_or_slide
    tf = shape.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for m in ("margin_left", "margin_right"):
        setattr(tf, m, Inches(0.06))
    tf.margin_top = tf.margin_bottom = Inches(0.03)
    lines = s if isinstance(s, list) else [s]
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run()
        r.text = ln
        r.font.size, r.font.bold, r.font.name = Pt(size), bold, font
        r.font.color.rgb = color
    return shape


def frame(slide, title, subtitle=None):
    box(slide, 0, 0, 13.333, 0.08, SNOWFLAKE_BLUE)
    box(slide, 0, 0.08, 13.333, 0.9, MID_BLUE)
    text(slide, title, 24, WHITE, True, HEAD_FONT, PP_ALIGN.LEFT, xywh=(0.45, 0.14, 10.8, 0.6))
    if subtitle:
        text(slide, subtitle, 12, STAR_BLUE, False, BODY_FONT, PP_ALIGN.LEFT, xywh=(0.45, 0.6, 10.8, 0.35))
    slide.shapes.add_picture(LOGO_WHITE, Inches(11.55), Inches(0.25), height=Inches(0.55))
    box(slide, 0, 7.42, 13.333, 0.08, STAR_BLUE)
    text(slide, "IG Group  |  Future-State Data Architecture  |  Illustrative – for discussion",
         9, WINDY_CITY, align=PP_ALIGN.LEFT, xywh=(0.45, 7.08, 9, 0.3))


def arrow(slide, x1, y1, x2, y2, color=WINDY_CITY, w=1.75):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = color
    c.line.width = Pt(w)
    ln = c.line._get_or_add_ln()
    tail = ln.makeelement(qn("a:tailEnd"), {"type": "triangle", "w": "med", "len": "med"})
    ln.append(tail)
    return c


# ---------- Slide 1: Title ----------
s = prs.slides.add_slide(BLANK)
box(s, 0, 0, 13.333, 7.5, MID_BLUE)
box(s, 0, 0, 13.333, 0.12, SNOWFLAKE_BLUE)
box(s, 0, 7.38, 13.333, 0.12, STAR_BLUE)
s.shapes.add_picture(LOGO_WHITE, Inches(0.8), Inches(0.8), height=Inches(0.9))
text(s, "IG Group on Snowflake", 44, WHITE, True, HEAD_FONT, PP_ALIGN.LEFT, xywh=(0.8, 2.6, 11, 1))
text(s, "One governed, real-time AI Data Cloud for trading, risk, clients and regulators",
     20, STAR_BLUE, False, BODY_FONT, PP_ALIGN.LEFT, xywh=(0.8, 3.6, 11, 0.6))
text(s, "Future-state reference architecture  |  November 2026", 14, WHITE,
     align=PP_ALIGN.LEFT, xywh=(0.8, 5.9, 11, 0.4))

# ---------- Slide 2: Architecture diagram ----------
s = prs.slides.add_slide(BLANK)
frame(s, "Every IG workload runs on one governed Snowflake platform",
      "Sources stream in once, become trusted data products, and serve trading, risk, AI and regulators")

top, bottom = 1.25, 6.95
# Column headers
cols = [(0.3, 2.35, "SOURCES"), (2.85, 1.75, "INGEST"), (4.8, 5.55, "SNOWFLAKE AI DATA CLOUD"), (10.55, 2.5, "CONSUME")]
for x, w, label in cols:
    text(s, label, 10, MID_BLUE, True, HEAD_FONT, xywh=(x, top, w, 0.28))

# Sources
sources = ["Trading platforms\n(CFD, spread bet, share dealing)", "tastytrade (US options & futures)",
           "Order mgmt & execution / pricing", "Market data feeds", "Client, CRM & KYC/onboarding",
           "Payments & treasury", "Finance & HR (ERP)", "Web, app & marketing events"]
sy, sh = top + 0.38, 0.6
for i, src in enumerate(sources):
    b = box(s, 0.3, sy + i * (sh + 0.06), 2.35, sh, LIGHT_GRAY, WINDY_CITY, MSO_SHAPE.ROUNDED_RECTANGLE, 0.75)
    text(b, src.split("\n"), 9, MIDNIGHT)

# Ingest
ingest = [("Snowpipe Streaming", "Kafka / ticks, orders, positions"),
          ("Openflow", "CDC from OLTP, SaaS, files"),
          ("Snowpipe / COPY", "batch & file drops"),
          ("Iceberg + Zero-copy", "open lakehouse, Salesforce"),
          ("Marketplace", "reference & market data")]
iy, ih = top + 0.38, 0.92
for i, (h, d) in enumerate(ingest):
    b = box(s, 2.85, iy + i * (ih + 0.12), 1.75, ih, SOFT_BLUE_BG, SNOWFLAKE_BLUE, MSO_SHAPE.ROUNDED_RECTANGLE)
    tf = text(b, h, 10, MID_BLUE, True).text_frame
    p = tf.add_paragraph(); p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = d; r.font.size = Pt(8); r.font.name = BODY_FONT; r.font.color.rgb = MIDNIGHT

# Snowflake platform container
px, pw = 4.8, 5.55
box(s, px, top + 0.33, pw, bottom - top - 0.33, WHITE, SNOWFLAKE_BLUE, MSO_SHAPE.ROUNDED_RECTANGLE, 2)

# Medallion layers
lx, ly, lw, lh = px + 0.2, top + 0.5, 1.6, 2.05
layers = [("RAW", "Immutable landing\nfull trade & tick history", STAR_BLUE),
          ("CURATED", "Conformed clients, accounts,\ninstruments, positions", SNOWFLAKE_BLUE),
          ("DATA PRODUCTS", "Client 360, Risk & Exposure,\nP&L, Regulatory, Marketing", MID_BLUE)]
for i, (h, d, c) in enumerate(layers):
    x = lx + i * (lw + 0.18)
    b = box(s, x, ly, lw, lh, c, None, MSO_SHAPE.ROUNDED_RECTANGLE)
    tf = text(b, h, 11, WHITE, True, HEAD_FONT, anchor=MSO_ANCHOR.TOP).text_frame
    tf.margin_top = Inches(0.12)
    for ln in d.split("\n"):
        p = tf.add_paragraph(); p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = ln; r.font.size = Pt(8.5); r.font.name = BODY_FONT; r.font.color.rgb = WHITE
    if i < 2:
        arrow(s, x + lw, ly + lh / 2, x + lw + 0.18, ly + lh / 2, MID_BLUE, 2)
text(s, "Dynamic Tables  •  Streams & Tasks  •  dbt Projects  •  Gen2 / Interactive Warehouses",
     8.5, MID_BLUE, True, xywh=(lx, ly + lh + 0.03, 5.15, 0.28))

# Capability tiles
caps = [("Cortex AI", "Agents, Analyst, Search,\nAI SQL functions", PURPLE_MOON),
        ("Snowpark & ML", "Fraud, churn, LTV,\nmargin & risk models", PURPLE_MOON),
        ("Apps on Snowflake", "SPCS & Streamlit:\nrisk, client & ops apps", PURPLE_MOON)]
cy, cw, ch = ly + lh + 0.4, 1.6, 1.0
for i, (h, d, c) in enumerate(caps):
    b = box(s, lx + i * (cw + 0.18), cy, cw, ch, WHITE, c, MSO_SHAPE.ROUNDED_RECTANGLE, 1.5)
    tf = text(b, h, 10, c, True).text_frame
    for ln in d.split("\n"):
        p = tf.add_paragraph(); p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = ln; r.font.size = Pt(8); r.font.name = BODY_FONT; r.font.color.rgb = MIDNIGHT

# Horizon governance band
gy = cy + ch + 0.15
g = box(s, lx, gy, 5.15, 0.78, SOFT_ORANGE_BG, VALENCIA_ORANGE, MSO_SHAPE.ROUNDED_RECTANGLE, 1.25)
tf = text(g, "HORIZON CATALOG — governance & security", 10, RGBColor(0xC0, 0x60, 0x00), True, HEAD_FONT).text_frame
p = tf.add_paragraph(); p.alignment = PP_ALIGN.CENTER
r = p.add_run()
r.text = "Classification • masking & row policies (PII, client money) • lineage • DMF data quality • audit for FCA / MiFID II / EMIR"
r.font.size = Pt(8); r.font.name = BODY_FONT; r.font.color.rgb = MIDNIGHT

# Ops band
oy = gy + 0.88
o = box(s, lx, oy, 5.15, 0.42, LIGHT_GRAY, None, MSO_SHAPE.ROUNDED_RECTANGLE)
text(o, "Cross-region replication & failover  •  Budgets & cost controls  •  CI/CD (DCM / Git)", 8.5, MIDNIGHT)

# Consumers
consumers = [("Real-time risk & exposure", "intraday positions, margin, hedging", MID_BLUE),
             ("Regulatory reporting", "transaction & trade reporting, CASS", MID_BLUE),
             ("Client 360 & personalisation", "onboarding, retention, next-best-action", SNOWFLAKE_BLUE),
             ("Fraud, AML & surveillance", "market abuse, payments anomalies", SNOWFLAKE_BLUE),
             ("Snowflake Intelligence", "NL Q&A agents for every team", PURPLE_MOON),
             ("BI & finance", "Power BI / Tableau, P&L, FP&A", STAR_BLUE),
             ("Secure data sharing", "regulators, partners, brokers", STAR_BLUE)]
cyy, chh = top + 0.38, 0.7
for i, (h, d, c) in enumerate(consumers):
    b = box(s, 10.55, cyy + i * (chh + 0.06), 2.5, chh, WHITE, c, MSO_SHAPE.ROUNDED_RECTANGLE, 1.5)
    tf = text(b, h, 9.5, c if c != STAR_BLUE else MID_BLUE, True).text_frame
    p = tf.add_paragraph(); p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = d; r.font.size = Pt(8); r.font.name = BODY_FONT; r.font.color.rgb = MIDNIGHT

# Flow arrows
mid = top + 0.33 + (bottom - top - 0.33) / 2
arrow(s, 2.67, mid, 2.83, mid)
arrow(s, 4.62, mid, 4.78, mid)
arrow(s, 10.37, mid, 10.53, mid)

# ---------- Slide 3: Value by domain ----------
s = prs.slides.add_slide(BLANK)
frame(s, "One platform replaces siloed stacks across four priority domains",
      "Target outcomes — to be validated with IG stakeholders")
pillars = [("Trading & Risk", SNOWFLAKE_BLUE, ["Seconds-fresh positions & exposure", "Unified CFD + tastytrade view",
                                               "Margin & hedging analytics", "Stress tests on full history"]),
           ("Clients & Growth", MID_BLUE, ["Single Client 360 across brands", "Churn & LTV models in Snowpark",
                                          "Personalised offers & nudges", "Faster onboarding insights"]),
           ("Regulation & Trust", VALENCIA_ORANGE, ["Lineage-backed regulatory reports", "Policy-enforced PII protection",
                                                  "Surveillance & AML on one copy", "Secure shares to regulators"]),
           ("AI & Productivity", PURPLE_MOON, ["Snowflake Intelligence agents", "Cortex Search over filings & docs",
                                              "Self-serve via semantic views", "Fewer pipelines to maintain"])]
pw, gap, x0 = 2.9, 0.22, 0.45
for i, (h, c, items) in enumerate(pillars):
    x = x0 + i * (pw + gap)
    box(s, x, 1.45, pw, 0.6, c, None, MSO_SHAPE.ROUNDED_RECTANGLE)
    text(s, h, 15, WHITE, True, HEAD_FONT, xywh=(x, 1.45, pw, 0.6))
    body = box(s, x, 2.15, pw, 4.6, LIGHT_GRAY, None, MSO_SHAPE.ROUNDED_RECTANGLE)
    tb = text(s, ["• " + it for it in items], 13, MIDNIGHT, align=PP_ALIGN.LEFT,
              anchor=MSO_ANCHOR.TOP, xywh=(x + 0.15, 2.35, pw - 0.3, 4.2))
    for p in tb.text_frame.paragraphs:
        p.space_after = Pt(14)

# ---------- Slide 4: Roadmap ----------
s = prs.slides.add_slide(BLANK)
frame(s, "A phased migration delivers value in each step",
      "Indicative sequencing — scope and timing to be agreed")
phases = [("PHASE 1", "Foundation", SNOWFLAKE_BLUE,
           ["Accounts, RBAC & Horizon policies", "Openflow CDC + Snowpipe Streaming", "Raw & curated layers", "Finance / BI migration"]),
          ("PHASE 2", "Trusted data products", MID_BLUE,
           ["Client 360 & Risk products", "Regulatory reporting on lineage", "Dynamic Tables replace batch ETL", "Decommission legacy DW"]),
          ("PHASE 3", "AI & real time", PURPLE_MOON,
           ["Real-time exposure apps (SPCS)", "Fraud / churn ML in Snowpark", "Snowflake Intelligence agents", "Sharing with partners & regulators"])]
pw, gap = 3.95, 0.25
for i, (tag, h, c, items) in enumerate(phases):
    x = 0.45 + i * (pw + gap)
    chev = box(s, x, 1.5, pw, 0.85, c, None, MSO_SHAPE.CHEVRON if i else MSO_SHAPE.PENTAGON)
    text(chev, [tag, h], 14, WHITE, True, HEAD_FONT)
    tb = text(s, ["• " + it for it in items], 14, MIDNIGHT, align=PP_ALIGN.LEFT,
              anchor=MSO_ANCHOR.TOP, xywh=(x + 0.15, 2.65, pw - 0.3, 3.8))
    for p in tb.text_frame.paragraphs:
        p.space_after = Pt(14)

# ---------- Slide: Zero ETL / zero copy (inserted after architecture slide) ----------
s = prs.slides.add_slide(BLANK)
frame(s, "Zero ETL, zero data-quality rework: live data shared, never copied",
      "Market data and enterprise apps arrive in IG's Snowflake account as live, governed shares")


def panel(x, title, sub, color, tiles):
    box(s, x, 1.35, 6.0, 0.55, color, None, MSO_SHAPE.ROUNDED_RECTANGLE)
    text(s, title, 15, WHITE, True, HEAD_FONT, xywh=(x, 1.35, 6.0, 0.55))
    text(s, sub, 10, WINDY_CITY, xywh=(x, 1.92, 6.0, 0.32))
    for i, (name, desc) in enumerate(tiles):
        tx, ty = x + (i % 2) * 3.05, 2.3 + (i // 2) * 1.12
        b = box(s, tx, ty, 2.95, 1.0, WHITE, color, MSO_SHAPE.ROUNDED_RECTANGLE, 1.5)
        tf = text(b, name, 14, color if color != STAR_BLUE else MID_BLUE, True, HEAD_FONT).text_frame
        p = tf.add_paragraph(); p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = desc; r.font.size = Pt(9); r.font.name = BODY_FONT; r.font.color.rgb = MIDNIGHT


panel(0.45, "SNOWFLAKE MARKETPLACE", "Market & reference data, live from the provider", SNOWFLAKE_BLUE,
      [("Bloomberg", "pricing, reference & corporate actions"), ("FactSet", "fundamentals, estimates, ownership"),
       ("MSCI", "indices, ESG & risk factors"), ("LSEG", "tick history, pricing, reference data")])
panel(6.88, "ZERO-COPY SHARING", "Enterprise apps share directly into Snowflake", PURPLE_MOON,
      [("Salesforce", "Data Cloud: clients, leads, cases"), ("Enfusion", "portfolio, positions, OMS data"),
       ("SAP", "Business Data Cloud: finance, GL"), ("Workday", "HR, headcount, finance")])

# Convergence into IG account
arrow(s, 3.5, 4.55, 5.2, 5.0, MID_BLUE, 2)
arrow(s, 9.9, 4.55, 8.1, 5.0, MID_BLUE, 2)
hub = box(s, 3.4, 5.0, 6.5, 0.75, MID_BLUE, None, MSO_SHAPE.ROUNDED_RECTANGLE)
text(hub, ["IG Group Snowflake account", "joined with trading, risk & client data products — governed by Horizon"],
     12, WHITE, True)

# Benefits strip
benefits = [("Zero ETL", "no pipelines to build or run"), ("Zero copies", "one live version, no drift"),
            ("Zero DQ rework", "no reconciling stale extracts"), ("Instant on", "subscribe in minutes, not months")]
for i, (h, d) in enumerate(benefits):
    bx = 0.45 + i * 3.13
    b = box(s, bx, 6.0, 2.98, 0.9, SOFT_BLUE_BG, None, MSO_SHAPE.ROUNDED_RECTANGLE)
    tf = text(b, h, 13, MID_BLUE, True, HEAD_FONT).text_frame
    p = tf.add_paragraph(); p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = d; r.font.size = Pt(9.5); r.font.name = BODY_FONT; r.font.color.rgb = MIDNIGHT

# Move new slide to position 3 (after the architecture diagram)
ids = prs.slides._sldIdLst
el = ids[-1]
ids.remove(el)
ids.insert(2, el)

prs.save(OUT)
print(OUT)
