from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

SNOWFLAKE_BLUE = RGBColor(0x29, 0xB5, 0xE8)
MID_BLUE = RGBColor(0x11, 0x56, 0x7F)
MIDNIGHT = RGBColor(0, 0, 0)
STAR_BLUE = RGBColor(0x71, 0xD3, 0xDC)
PURPLE_MOON = RGBColor(0x7D, 0x44, 0xCF)
WINDY_CITY = RGBColor(0x8A, 0x99, 0x9E)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xF2, 0xF5, 0xF9)
SOFT_BLUE_BG = RGBColor(0xE4, 0xF5, 0xFD)

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
s = prs.slides.add_slide(prs.slide_layouts[6])


def box(x, y, w, h, fill, line=None, shape=MSO_SHAPE.RECTANGLE):
    sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if line: sh.line.color.rgb = line; sh.line.width = Pt(1.25)
    else: sh.line.fill.background()
    sh.shadow.inherit = False
    return sh


def text(sh_or_xywh, t, size, color=MIDNIGHT, bold=False, align=PP_ALIGN.LEFT, font="Lato"):
    if isinstance(sh_or_xywh, tuple):
        x, y, w, h = sh_or_xywh
        sh = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    else:
        sh = sh_or_xywh
    tf = sh.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    lines = t if isinstance(t, list) else [t]
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run(); r.text = ln
        r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color; r.font.name = font
    return sh


# Frame
box(0, 0, 13.333, 0.08, SNOWFLAKE_BLUE)
box(0, 0.08, 13.333, 1.0, MID_BLUE)
box(0, 7.42, 13.333, 0.08, STAR_BLUE)
text((0.5, 0.13, 10.5, 0.9),
     "One Snowflake platform delivers IG Group's market and enterprise data — no pipelines, no copies",
     24, WHITE, True, font="Texta")
s.shapes.add_picture("/tmp/sf-logo-white.png", Inches(11.4), Inches(0.33), height=Inches(0.5))


def panel(x, title, sub, items, accent, tag):
    box(x, 1.4, 6.0, 5.2, LIGHT_GRAY)
    box(x, 1.4, 6.0, 0.07, accent)
    text((x + 0.3, 1.55, 5.4, 0.5), title, 20, MID_BLUE, True, font="Texta")
    text((x + 0.3, 2.05, 5.4, 0.45), sub, 12, WINDY_CITY)
    for i, (name, desc) in enumerate(items):
        col, row = i % 2, i // 2
        cx, cy = x + 0.3 + col * 2.75, 2.65 + row * 1.05
        c = box(cx, cy, 2.6, 0.9, WHITE, accent, MSO_SHAPE.ROUNDED_RECTANGLE)
        c.adjustments[0] = 0.12
        tf = c.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = name
        r.font.size = Pt(15); r.font.bold = True; r.font.color.rgb = MIDNIGHT; r.font.name = "Lato"
        p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.CENTER
        r2 = p2.add_run(); r2.text = desc
        r2.font.size = Pt(10); r2.font.color.rgb = WINDY_CITY; r2.font.name = "Lato"
    t = box(x + 0.3, 5.95, 5.4, 0.45, SOFT_BLUE_BG, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    text(t, tag, 12, MID_BLUE, True, PP_ALIGN.CENTER)


panel(0.5, "Snowflake Marketplace",
      "Live, governed market data shared directly into IG's account",
      [("Bloomberg", "Reference, pricing & B-PIPE data"),
       ("FactSet", "Fundamentals, estimates, ownership"),
       ("LSEG", "Tick history, Refinitiv data"),
       ("ICE", "Pricing, reference & analytics"),
       ("DTCC", "Trade repository & post-trade data"),
       ("Eurex", "Derivatives market data")],
      SNOWFLAKE_BLUE, "Subscribe in minutes — always current, no FTP or ETL")

panel(6.833, "Zero-Copy Data Sharing",
      "Bi-directional access to core business applications",
      [("Salesforce", "Data Cloud — clients & CRM"),
       ("SAP", "Business Data Cloud — finance & ERP"),
       ("Enfusion", "OMS / PMS — positions & trades"),
       ("Aladdin", "BlackRock — portfolio & risk"),
       ("Workday", "HR & financials")],
      PURPLE_MOON, "Query in place — single source of truth, no duplication")

text((0.5, 6.75, 12.3, 0.5),
     "Combine external market data with internal client, trading and finance data under one security & governance model (Horizon) — ready for Cortex AI.",
     12, MIDNIGHT, align=PP_ALIGN.CENTER)

prs.save("/Users/cmoynihan/Documents/code/IG_Group_app/slides/IG_Group_Snowflake_Marketplace.pptx")
print("saved")
