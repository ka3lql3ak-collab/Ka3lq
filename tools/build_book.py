"""Build the complete journal as ONE 120-page PDF: front cover, interior pages, back cover.

Usage: python3 tools/build_book.py  ->  output/A-Little-Time-with-God.pdf
Page size 7 x 10 in. Artwork comes from assets/ (see tools/make_art.py).
"""
import json, math, pathlib, sys
import numpy as np
from PIL import Image, ImageOps
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))
from content.days import DAYS, WEEKS
from florals import paper

VERSES = json.load(open(ROOT / "data/verses.json"))
ASSETS = ROOT / "assets"
CACHE = ROOT / "build"

BRAND = "digiByDK"
YEAR = 2026

W, H = 7 * 72, 10 * 72
BL = 9                               # KDP bleed: 0.125 in
M, TOP, BOT = 50, 54, 48            # side, top and bottom margins

MAUVE = HexColor("#8E5A63")          # titles
ROSE = HexColor("#B9737E")           # labels
INK = HexColor("#5B4848")
SOFT = HexColor("#8C7676")
LINE = HexColor("#E2CDC9")
GOLD = HexColor("#B8935A")
GOLD_LIGHT = HexColor("#E3C88F")
GOLD_DARK = HexColor("#9C7438")
BLUSH_BOX = HexColor("#F7E6E3")

for name, file in [("Script", "GreatVibes-Regular"), ("Pinyon", "PinyonScript-Regular"),
                   ("Serif", "Cormorant-Medium"), ("SerifB", "Cormorant-SemiBold"), ("SerifI", "Cormorant-Italic"),
                   ("Body", "EBGaramond-Regular"), ("BodyI", "EBGaramond-Italic"), ("Caps", "Cinzel-Regular"),
                   ("CapsM", "Cinzel-Medium")]:
    pdfmetrics.registerFont(TTFont(name, str(ROOT / "fonts" / f"{file}.ttf")))


# ---------------------------------------------------------------- artwork
def prepare_art():
    """Backgrounds and mirrored floral corners, cached in build/."""
    CACHE.mkdir(exist_ok=True)
    px = (W * 150 // 72, H * 150 // 72)
    for name, color, strength, vig in [("cream", (253, 249, 244), 3, 8), ("pink", (246, 221, 214), 7, 22)]:
        p = CACHE / f"bg_{name}.jpg"
        if not p.exists():
            paper(px, color, seed=3, strength=strength, vignette=vig).save(p, quality=90)
    p = CACHE / "bg_cover.jpg"
    if not p.exists():
        bg = np.asarray(paper(px, (244, 210, 204), seed=5, strength=6, vignette=0), np.float32)
        hgt, wid = bg.shape[:2]
        yy, xx = np.mgrid[0:hgt, 0:wid].astype(np.float32)
        glow = np.exp(-(((xx / wid - 0.5) / 0.45) ** 2 + ((yy / hgt - 0.45) / 0.5) ** 2))
        bg += (glow * 14)[..., None] - ((yy / hgt) * 10)[..., None]
        Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).save(p, quality=92)
    for base in ("bouquet_big", "bouquet_big2", "corner", "corner_small"):
        img = Image.open(ASSETS / f"{base}.png")
        for tag, fn in [("tl", lambda i: i), ("tr", ImageOps.mirror), ("bl", ImageOps.flip),
                        ("br", lambda i: ImageOps.flip(ImageOps.mirror(i)))]:
            p = CACHE / f"{base}_{tag}.png"
            if not p.exists():
                fn(img).save(p)


def art(name):
    return str(CACHE / f"{name}.png") if (CACHE / f"{name}.png").exists() else str(ASSETS / f"{name}.png")


# ---------------------------------------------------------------- book
class Book:
    def __init__(self, path, preview=False, mode="full"):
        """mode: "full" (one PDF, covers included), "interior" (KDP manuscript with bleed, no covers)
        or "cover" (pages drawn into panels of a KDP wraparound cover)."""
        self.mode = mode
        self.c = canvas.Canvas(str(path), pagesize=(W + BL, H + 2 * BL) if mode == "interior" else (W, H))
        self.c.setTitle("A Little Time with God")
        self.c.setAuthor(BRAND)
        self.c.setSubject("A 90-Day Guided Prayer Journal to Build a Consistent Daily Prayer Habit "
                          "for Young Christian Women")
        self.c.setCreator(BRAND)
        self.c.setKeywords([BRAND, f"Copyright {YEAR} {BRAND}. All rights reserved."])
        self.page = 0
        self.framed = False
        self.preview = preview

    # ---- primitives
    def finish_page(self):
        """Brand mark on every page; the preview edition also gets a large diagonal watermark."""
        c = self.c
        if self.page > 1 or self.mode == "interior":
            self.text(f"© {YEAR} {BRAND}", 44 if self.framed else 32, "Serif", 7.5, SOFT)
        if self.preview:
            c.saveState()
            c.setFillColor(MAUVE)
            c.setFillAlpha(0.13)
            c.setFont("SerifB", 54)
            c.translate(W / 2, H / 2)
            c.rotate(35)
            for row in range(-4, 5):
                c.drawCentredString((row % 2) * 120, row * 120, f"{BRAND}  ·  preview")
            c.restoreState()
        c.showPage()

    def new_page(self, bg="cream"):
        if self.mode == "cover":
            return
        if self.page:
            self.finish_page()
        self.page += 1
        self.framed = False
        if self.mode == "interior":
            # Bleed sits on the outside edge: right of odd (right-hand) pages, left of even ones.
            self.c.setPageSize((W + BL, H + 2 * BL))
            self.c.translate(0 if self.page % 2 else BL, BL)
            self.c.drawImage(str(CACHE / f"bg_{bg}.jpg"), -BL, -BL, W + 2 * BL, H + 2 * BL)
        else:
            self.c.drawImage(str(CACHE / f"bg_{bg}.jpg"), 0, 0, W, H)

    def img(self, name, x, y, w=None, h=None, anchor="bl"):
        path = art(name)
        iw, ih = Image.open(path).size
        if w and not h:
            h = w * ih / iw
        if h and not w:
            w = h * iw / ih
        if "t" in anchor:
            y -= h
        if "r" in anchor:
            x -= w
        if "c" == anchor:
            x -= w / 2
        self.c.drawImage(path, x, y, w, h, mask="auto")

    def text(self, s, y, font, size, color=INK, x=None, align="center", spacing=0):
        c = self.c
        c.setFillColor(color)
        c.setFont(font, size)
        x = W / 2 if x is None and align == "center" else (M if x is None else x)
        width = pdfmetrics.stringWidth(s, font, size) + spacing * max(0, len(s) - 1)
        if align == "center":
            x -= width / 2
        elif align == "right":
            x -= width
        c.drawString(x, y, s, charSpace=spacing)
        return width

    def wrap(self, s, font, size, width):
        out, cur = [], ""
        for w in s.split():
            t = (cur + " " + w).strip()
            if pdfmetrics.stringWidth(t, font, size) <= width:
                cur = t
            else:
                out.append(cur)
                cur = w
        return out + ([cur] if cur else [])

    def para(self, s, y, font, size, leading, color=INK, align="center", x=None, width=None):
        x = M if x is None else x
        width = W - 2 * M if width is None else width
        for line in self.wrap(s, font, size, width):
            if align == "center":
                self.text(line, y, font, size, color, x + width / 2, "center")
            else:
                self.text(line, y, font, size, color, x, "left")
            y -= leading
        return y

    def lines(self, y, n, gap=21, x=None, width=None):
        x = M if x is None else x
        width = W - 2 * M if width is None else width
        self.c.setStrokeColor(LINE)
        self.c.setLineWidth(0.6)
        for _ in range(n):
            y -= gap
            self.c.line(x, y, x + width, y)
        return y

    def label(self, s, y, x=None, size=12, color=ROSE):
        self.text(s, y, "SerifB", size, color, M if x is None else x, "left")

    def hint(self, s, y, x=None):
        self.text(s, y, "BodyI", 9.5, SOFT, M if x is None else x, "left")

    def box(self, x, y, s=8.5):
        self.c.setStrokeColor(ROSE)
        self.c.setLineWidth(0.7)
        self.c.rect(x, y - 1.5, s, s)

    def circle(self, x, y, r=4.2):
        self.c.setStrokeColor(ROSE)
        self.c.setLineWidth(0.7)
        self.c.circle(x + r, y + 2.5, r)

    def option(self, kind, x, y, s, size=10):
        (self.box if kind == "box" else self.circle)(x, y)
        self.text(s, y, "Body", size, INK, x + 15, "left")

    def heart(self, x, y, s=4.5, color=ROSE):
        c = self.c
        c.setFillColor(color)
        p = c.beginPath()
        p.moveTo(x, y - s)
        p.curveTo(x - s * 1.6, y + s * 0.1, x - s * 0.7, y + s * 1.3, x, y + s * 0.35)
        p.curveTo(x + s * 0.7, y + s * 1.3, x + s * 1.6, y + s * 0.1, x, y - s)
        c.drawPath(p, fill=1, stroke=0)

    def diamond(self, x, y, s=2.4, color=GOLD):
        c = self.c
        c.setFillColor(color)
        p = c.beginPath()
        p.moveTo(x, y + s); p.lineTo(x + s, y); p.lineTo(x, y - s); p.lineTo(x - s, y); p.close()
        c.drawPath(p, fill=1, stroke=0)

    def divider(self, y, half=60):
        self.c.setStrokeColor(GOLD)
        self.c.setLineWidth(0.6)
        self.c.line(W / 2 - half, y, W / 2 - 12, y)
        self.c.line(W / 2 + 12, y, W / 2 + half, y)
        self.heart(W / 2, y, 4)

    def frame(self, inset=30):
        self.framed = True
        c = self.c
        c.setStrokeColor(GOLD)
        c.setLineWidth(1.1)
        c.rect(inset, inset, W - 2 * inset, H - 2 * inset)
        c.setLineWidth(0.4)
        c.rect(inset + 5, inset + 5, W - 2 * inset - 10, H - 2 * inset - 10)

    def cross(self, x, y, h=46, color=GOLD):
        c = self.c
        c.setFillColor(color)
        c.rect(x - 1.6, y - h, 3.2, h, stroke=0, fill=1)
        c.rect(x - h * 0.27, y - h * 0.3, h * 0.54, 3.2, stroke=0, fill=1)

    def gold_text(self, s, x, y, font, size, spacing=0):
        """Text filled with a metallic gold gradient."""
        c = self.c
        width = pdfmetrics.stringWidth(s, font, size) + spacing * (len(s) - 1)
        x0 = x - width / 2
        c.saveState()
        t = c.beginText(x0, y)
        t.setFont(font, size)
        t.setCharSpace(spacing)
        t.setTextRenderMode(7)
        t.textOut(s)
        c.drawText(t)
        c.linearGradient(x0, y + size * 0.75, x0 + width * 0.3, y - size * 0.1,
                         (GOLD_LIGHT, GOLD, GOLD_DARK, GOLD, GOLD_LIGHT), (0, 0.3, 0.55, 0.8, 1), extend=True)
        c.restoreState()

    def header(self, title, sub=None, y=None):
        y = H - TOP if y is None else y
        self.img("ornament", W / 2, y + 10, w=58, anchor="c")
        self.text(title, y - 22, "Serif", 24, MAUVE)
        if sub:
            self.text(sub.upper(), y - 38, "Caps", 7, SOFT, spacing=1.6)
            return y - 62
        return y - 50

    def footer(self, s):
        self.text(s, BOT + 12, "Script", 17, ROSE)
        self.heart(W / 2, BOT, 3.4)

    def bottom_corners(self, small=True):
        name = "corner_small" if small else "corner"
        self.img(f"{name}_bl", 4, 4, w=120)
        self.img(f"{name}_br", W - 4, 4, w=120, anchor="br")

    # ---- pages
    def front_cover(self, pw=W, ph=H, pad=0):
        """Front cover built to read at thumbnail size: a cream arch window framed by florals,
        a big script title, gold GOD and a rose ribbon naming what the book is."""
        c, s = self.c, pw / W
        if self.mode != "cover":
            self.new_page("pink")
        c.drawImage(str(CACHE / "bg_cover.jpg"), -pad, -pad, pw + 2 * pad, ph + 2 * pad)

        # Arch window.
        ax0, ax1 = pw * 0.12, pw * 0.88
        aw, r = ax1 - ax0, (ax1 - ax0) / 2
        ybot, yc = ph * 0.075, ph * 0.80 - r
        def arch(inset):
            p = c.beginPath()
            p.moveTo(ax0 + inset, ybot + inset)
            p.lineTo(ax0 + inset, yc)
            p.arcTo(ax0 + inset, yc - r + inset, ax1 - inset, yc + r - inset, startAng=180, extent=-180)
            p.lineTo(ax1 - inset, ybot + inset)
            p.close()
            return p
        c.saveState()
        c.setFillColor(HexColor("#FFFBF6"))
        c.setFillAlpha(0.94)
        c.drawPath(arch(0), stroke=0, fill=1)
        c.restoreState()
        c.setStrokeColor(GOLD)
        c.setLineWidth(1.6 * s)
        c.drawPath(arch(0), stroke=1, fill=0)
        c.setLineWidth(0.6 * s)
        c.drawPath(arch(6 * s), stroke=1, fill=0)

        # Florals overlapping the arch's shoulders and base.
        self.img("bouquet_big_tl", -pw * 0.05, ph + ph * 0.02, w=pw * 0.46, anchor="tl")
        self.img("corner_tr", pw + pw * 0.01, ph + ph * 0.01, w=pw * 0.28, anchor="tr")
        self.img("bouquet_big2_br", pw + pw * 0.06, -ph * 0.03, w=pw * 0.42, anchor="br")
        self.img("corner_bl", -pw * 0.01, -ph * 0.01, w=pw * 0.26)

        # Gold sparkles.
        import random
        rng = random.Random(9)
        for _ in range(26):
            x, y = rng.uniform(0.04, 0.96) * pw, rng.uniform(0.05, 0.95) * ph
            if ax0 - 6 < x < ax1 + 6 and ybot < y < yc + r:
                continue
            self.diamond(x, y, rng.uniform(1.2, 2.6) * s, GOLD_LIGHT if rng.random() < 0.5 else GOLD)

        # Title block, centred inside the arch.
        fit = lambda txt, font, size, width: min(size, size * width / pdfmetrics.stringWidth(txt, font, size))
        t1 = fit("A Little Time", "Script", 66 * s, aw * 0.9)
        god = fit("GOD", "CapsM", 112 * s, aw * 0.74)
        rib = "90-DAY GUIDED PRAYER JOURNAL"
        rs = fit(rib, "CapsM", 12.5 * s, aw * 0.86)
        top = yc + r
        block = (34 + 40 + 42 + 44 + 34 + 21) * s + t1 * 0.95 + god * 0.86
        room = top - (ybot + 50 * s)
        y = top - max(34 * s, (room - block) / 2)
        self.cross(pw / 2, y, 40 * s)
        y -= 40 * s + t1 * 0.95
        self.text("A Little Time", y, "Script", t1, MAUVE, pw / 2)
        y -= 42 * s
        self.text("with", y, "Script", 40 * s, MAUVE, pw / 2)
        y -= god * 0.86
        self.gold_text("GOD", pw / 2 + 3 * s, y, "CapsM", god, spacing=5 * s)
        # Rose ribbon with notched ends, wider than the arch.
        y -= 44 * s
        rh, rw = 30 * s, aw * 1.08
        rx = pw / 2 - rw / 2
        c.setFillColor(HexColor("#B9707C"))
        p = c.beginPath()
        notch = 10 * s
        p.moveTo(rx, y); p.lineTo(rx + rw, y); p.lineTo(rx + rw - notch, y + rh / 2); p.lineTo(rx + rw, y + rh)
        p.lineTo(rx, y + rh); p.lineTo(rx + notch, y + rh / 2); p.close()
        c.drawPath(p, stroke=0, fill=1)
        c.setStrokeColor(GOLD_LIGHT)
        c.setLineWidth(0.6 * s)
        c.line(rx + notch * 1.6, y + 3.5 * s, rx + rw - notch * 1.6, y + 3.5 * s)
        c.line(rx + notch * 1.6, y + rh - 3.5 * s, rx + rw - notch * 1.6, y + rh - 3.5 * s)
        self.text(rib, y + rh / 2 - rs * 0.36, "CapsM", rs, HexColor("#FFF8F2"), pw / 2, spacing=1.2 * s)
        y -= 34 * s
        self.text("to Build a Consistent Daily Prayer Habit", y, "SerifI", 16.5 * s, INK, pw / 2)
        y -= 21 * s
        self.text("for Young Christian Women", y, "SerifI", 16.5 * s, INK, pw / 2)
        y -= 30 * s
        parts = ["PRAY", "GROW", "WALK CLOSER"]
        ts = 8.5 * s
        widths = [pdfmetrics.stringWidth(q, "Caps", ts) + 1.8 * s * (len(q) - 1) for q in parts]
        x = pw / 2 - (sum(widths) + 2 * 24 * s) / 2
        for i, (q, wd) in enumerate(zip(parts, widths)):
            self.text(q, y, "Caps", ts, SOFT, x, "left", spacing=1.8 * s)
            x += wd
            if i < 2:
                self.diamond(x + 12 * s, y + 3 * s, 2.4 * s)
                x += 24 * s
        self.text(BRAND, ybot + 20 * s, "Pinyon", 19 * s, MAUVE, pw / 2)

    def belongs_page(self):
        self.new_page()
        self.frame()
        self.img("corner_tr", W - 6, H - 6, w=150, anchor="tr")
        self.img("corner_bl", 6, 6, w=150)
        y = H / 2 + 120
        self.text("This journal belongs to", y, "Script", 32, MAUVE)
        self.c.setStrokeColor(GOLD)
        self.c.setLineWidth(0.6)
        self.c.line(W / 2 - 130, y - 50, W / 2 + 130, y - 50)
        self.text("I began my 90 days on", y - 100, "Serif", 13, SOFT)
        self.text("______ / ______ / ______", y - 124, "Body", 12, SOFT)
        self.divider(y - 160)
        self.para("“Draw near to God, and he will draw near to you.”", y - 196, "SerifI", 15, 19, INK)
        self.text("JAMES 4:8", y - 218, "Caps", 8, GOLD, spacing=1.6)
        y -= 250
        for s in [f"© {YEAR} {BRAND}. All rights reserved.",
                  "For personal use only. This journal may not be copied, shared, resold or",
                  "redistributed, in whole or in part, without written permission from " + BRAND + ".",
                  "Scripture quotations are from the World English Bible (public domain)."]:
            self.text(s, y, "BodyI", 7.5, SOFT)
            y -= 11

    def welcome_page(self):
        self.new_page()
        self.frame()
        self.img("corner_tr", W - 6, H - 6, w=165, anchor="tr")
        self.img("corner_bl", 6, 6, w=165)
        y = H - 120
        self.text("WELCOME TO", y, "Caps", 10, INK, spacing=3)
        self.text("A Little Time", y - 62, "Script", 50, MAUVE)
        self.text("with", y - 108, "Script", 36, MAUVE, W / 2 - 62)
        self.gold_text("GOD", W / 2 + 46, y - 112, "CapsM", 46, spacing=3)
        self.divider(y - 138)
        y -= 175
        for s in ["This 90-day journal is your invitation to slow down, be still, and spend intentional time "
                  "with the One who loves you most. Whether you’re new to prayer or you’ve prayed for years but "
                  "want to be more consistent, this journal will help you create a daily prayer habit that fits your life.",
                  "You don’t have to have it all figured out. You just need a willingness to show up, "
                  "and God will meet you there."]:
            y = self.para(s, y, "Body", 12, 18, INK, x=M + 18, width=W - 2 * M - 36) - 14
        self.text("Let’s begin.", y - 34, "Script", 34, ROSE)
        self.heart(W / 2, y - 62, 4.5)

    def how_to_page(self):
        self.new_page()
        y = self.header("How to Use This Journal", "Ten minutes  ·  one day at a time")
        steps = [("Find your quiet place", "Choose a time and a spot, then fill in My Prayer Routine on the next page."),
                 ("Read today’s Scripture", "Read it slowly, twice if you can, and let it settle in your heart."),
                 ("Reflect", "Answer the question honestly. There are no wrong answers."),
                 ("Pray", "Write your prayer as naturally as you would speak to a friend who loves you."),
                 ("Give thanks", "Name one thing you’re grateful for. Small things count."),
                 ("Check in", "Tick the boxes at the bottom of the page, then color in today on your tracker."),
                 ("Review each week", "Every seven days, pause for a Weekly Habit Review."),
                 ("Missed a day?", "Turn to When I Miss a Day, then simply begin again. Grace gets you back.")]
        y -= 6
        for i, (h, s) in enumerate(steps, 1):
            self.c.setFillColor(BLUSH_BOX)
            self.c.circle(M + 13, y - 4, 13, stroke=0, fill=1)
            self.text(str(i), y - 9, "SerifB", 14, ROSE, M + 13)
            self.text(h, y, "SerifB", 14, MAUVE, M + 38, "left")
            y = self.para(s, y - 17, "Body", 10.5, 14, SOFT, "left", M + 38, W - 2 * M - 38) - 16
        self.bottom_corners()
        self.footer("Progress, not perfection.")

    def routine_page(self):
        self.new_page()
        y = self.header("My Prayer Routine", "Create a space that works for you")
        self.label("My preferred time:", y)
        y -= 22
        for i, s in enumerate(["Morning", "Afternoon", "Evening"]):
            self.option("box", M + 10 + i * 120, y, s)
        y -= 20
        self.option("box", M + 10, y, "Other:")
        self.c.setStrokeColor(LINE); self.c.line(M + 70, y - 2, W - M, y - 2)
        y -= 34
        self.label("My prayer space:", y)
        y = self.lines(y - 4, 3) - 30
        self.label("My starting duration:", y)
        y -= 22
        for s in ["5 minutes", "10 minutes", "15 minutes or more"]:
            self.option("box", M + 10, y, s)
            y -= 20
        y -= 14
        self.label("What might get in the way, and my plan for it:", y)
        y = self.lines(y - 4, 3) - 30
        self.label("Notes:", y)
        self.lines(y - 4, int((y - BOT - 96) // 21))
        self.bottom_corners()
        self.text("“Be still, and know that I am God.”", BOT + 26, "SerifI", 14, ROSE)
        self.text("PSALM 46:10", BOT + 10, "Caps", 7.5, SOFT, spacing=1.4)

    def tracker_page(self):
        self.new_page()
        y = self.header("90-Day Prayer Tracker", "Color in a circle each day you pray")
        cols, r, gy = 10, 14, 37
        gx = (W - 2 * M) / cols
        y -= 12
        for i in range(90):
            row, col = divmod(i, cols)
            x, yy = M + gx * (col + 0.5), y - row * gy
            self.c.setStrokeColor(ROSE)
            self.c.setLineWidth(0.8)
            self.c.circle(x, yy, r)
            self.text(str(i + 1), yy - 3.5, "Serif", 11, INK, x)
        y -= 8 * gy + 44
        self.c.setFillColor(BLUSH_BOX)
        self.c.roundRect(M + 20, y - 92, W - 2 * M - 40, 92, 10, stroke=0, fill=1)
        self.text("You’re doing it!", y - 36, "Script", 28, ROSE)
        self.text("Every day you show up for God,", y - 58, "Body", 11, INK)
        self.text("you are building a stronger, closer walk with Him.", y - 73, "Body", 11, INK)
        self.heart(W / 2, y - 84, 3.2)
        self.img("corner_bl", 4, 4, w=140)

    def prayer_list_page(self):
        self.new_page()
        y = self.header("My Prayer List", "People  ·  Situations  ·  Intentions")
        avail = y - BOT - 50
        h = avail / 3 - 12
        for s in ["People I’m Praying For", "Situations I’m Lifting Up", "My Personal Intentions"]:
            self.c.setStrokeColor(HexColor("#E8C9C6"))
            self.c.setLineWidth(0.8)
            self.c.roundRect(M, y - h, W - 2 * M, h, 8)
            self.label(s, y - 18, M + 12, 12)
            self.lines(y - 24, int((h - 32) // 21), 21, M + 12, W - 2 * M - 24)
            y -= h + 12
        self.bottom_corners()
        self.footer("He hears every prayer.")

    def miss_day_page(self):
        self.new_page()
        y = self.header("When I Miss a Day", "It’s not the end — it’s a new beginning")
        y = self.para("Everyone misses a day. What matters is that you come back. God’s mercies are new every morning.",
                      y + 4, "BodyI", 10.5, 14, SOFT, x=M + 20, width=W - 2 * M - 40) - 18
        for q in ["What happened?", "What can I learn from this?"]:
            self.label(q, y)
            y = self.lines(y - 4, 5) - 30
        self.label("My next step:", y)
        y -= 22
        for s in ["Pray now", "Set a reminder", "Adjust my routine", "Ask for support", "Other:"]:
            self.option("box", M + 10, y, s)
            if s == "Other:":
                self.c.setStrokeColor(LINE); self.c.line(M + 70, y - 2, W - M, y - 2)
            y -= 20
        self.bottom_corners()
        self.footer("Grace gets you back.")

    def day_page(self, n, d):
        self.new_page()
        self.img("corner_small_tl", 2, H - 2, w=118, anchor="tl")
        self.img("corner_small_tr", W - 2, H - 2, w=118, anchor="tr")
        y = H - TOP - 8
        self.text(f"DAY {n}", y, "CapsM", 13, INK, spacing=2.5)
        self.text(d["title"], y - 26, "Serif", 21, MAUVE)
        self.text("Date: ________ / ________ / ________", y - 46, "Body", 10, SOFT)
        y -= 78

        self.label("Today’s Scripture", y)
        verse = VERSES[d["ref"]]
        if not verse.startswith("“"):
            verse = f"“{verse}”"
        y = self.para(verse, y - 18, "SerifI", 12.5, 15.5, INK, "left") + 15.5
        self.text(d["ref"].replace("Psalms ", "Psalm ") + " (WEB)", y - 17, "Serif", 10, SOFT, W - M, "right")
        y -= 46

        # Bottom check-in block is fixed; writing sections share the rest.
        block_top = BOT + 74
        q = self.wrap(d["question"], "BodyI", 9.5, W - 2 * M)
        n_lines = int((y - block_top - 3 * 30 - 13 * (len(q) + 1)) // 21)
        r_ref = max(3, round(n_lines * 0.38))
        r_gr = 2
        r_pr = n_lines - r_ref - r_gr

        self.label("Reflection", y)
        y = self.para(d["question"], y - 15, "BodyI", 9.5, 13, SOFT, "left") + 13
        y = self.lines(y - 2, r_ref) - 26
        self.label("My Prayer", y)
        self.hint("Write as naturally as you would speak.", y - 15)
        y = self.lines(y - 17, r_pr) - 26
        self.label("One Thing I’m Grateful For", y)
        self.lines(y - 4, r_gr)

        y = block_top
        self.c.setStrokeColor(HexColor("#EBD6D2"))
        self.c.setLineWidth(0.6)
        self.c.line(M, y + 14, W - M, y + 14)
        self.option("box", M, y - 4, "I made time for prayer today.", 10)
        y -= 26
        self.text("How long did I spend?", y, "SerifB", 10.5, ROSE, M, "left")
        self.text("What got in the way?", y, "SerifB", 10.5, ROSE, W / 2 + 14, "left")
        self.c.setStrokeColor(HexColor("#EBD6D2"))
        self.c.line(W / 2, y + 10, W / 2, y - 50)
        for i, s in enumerate(["Under 5 minutes", "5 minutes", "10 minutes or more"]):
            self.option("circle", M + 4, y - 16 - i * 15, s, 9.5)
        opts = ["None today", "Busy schedule", "Forgot or distracted", "Unsure what to pray", "Other:"]
        for i, s in enumerate(opts):
            yy = y - 16 - (i % 3) * 15
            x = W / 2 + 18 + (i // 3) * 112
            self.option("circle", x, yy, s, 9.5)
        self.c.setStrokeColor(LINE)
        ox = W / 2 + 18 + 112 + 15 + pdfmetrics.stringWidth("Other: ", "Body", 9.5)
        self.c.line(ox, y - 33, W - M, y - 33)

    def review_page(self, week):
        self.new_page()
        y = self.header("Weekly Habit Review", f"Week {week}  ·  {WEEKS[week - 1][0]}")
        self.text("Week of: ________ / ________ / ________", y + 2, "Body", 10, SOFT)
        y -= 26
        self.label("Days I prayed this week:", y)
        for i in range(7):
            x = M + 168 + i * 34
            self.c.setStrokeColor(ROSE)
            self.c.circle(x, y + 4, 11)
            self.text(str((week - 1) * 7 + i + 1), y + 0.5, "Serif", 9.5, INK, x)
        y -= 34
        qs = ["What went well this week?", "What was challenging?", "What helped me stay consistent?",
              "What do I want to do differently next week?"]
        per = int((y - BOT - 70 - len(qs) * 30) // len(qs) // 21)
        for q in qs:
            self.label(q, y)
            y = self.lines(y - 4, per) - 30
        self.bottom_corners()
        self.footer("Progress, not perfection.")

    def answered_page(self):
        self.new_page()
        y = self.header("Answered Prayer Reflections", "Look back  ·  Give thanks  ·  Keep going")
        self.label("Prayer I prayed:", y)
        y = self.lines(y - 4, 4) - 30
        self.label("What God did:", y)
        y = self.lines(y - 4, 4) - 30
        self.label("How it made me feel:", y)
        y -= 22
        for i, s in enumerate(["Grateful", "Peaceful", "More confident"]):
            self.option("box", M + 10 + i * 120, y, s)
        y -= 20
        self.option("box", M + 10, y, "Other:")
        self.c.setStrokeColor(LINE); self.c.line(M + 70, y - 2, W - M, y - 2)
        y -= 34
        self.label("What I’m learning:", y)
        self.lines(y - 4, int((y - BOT - 70) // 21))
        self.bottom_corners()
        self.footer("God is faithful.")

    def next30_page(self):
        self.new_page()
        y = self.header("My Next 30 Days", "Keep the momentum going")
        self.label("My goals:", y)
        y = self.lines(y - 4, 5) - 30
        self.label("Habits I want to keep:", y)
        y -= 22
        for s in ["Daily prayer", "Scripture reading", "Gratitude", "Praying for others", "Other:"]:
            self.option("box", M + 10, y, s)
            if s == "Other:":
                self.c.setStrokeColor(LINE); self.c.line(M + 70, y - 2, W - M, y - 2)
            y -= 20
        y -= 14
        self.label("Notes & encouragement:", y)
        self.lines(y - 4, int((y - BOT - 70) // 21))
        self.bottom_corners()
        self.footer("The best is still ahead.")

    def notes_page(self):
        self.new_page()
        y = self.header("Notes & Reflections")
        self.lines(y + 10, int((y - BOT - 60) // 21))
        self.bottom_corners()
        self.footer("Write it down, and remember His faithfulness.")

    def closing_page(self):
        self.new_page("pink")
        self.frame(28)
        self.img("bouquet_big_tr", W + 10, H + 10, w=230, anchor="tr")
        self.img("bouquet_big2_bl", -10, -10, w=230)
        y = H / 2 + 150
        self.cross(W / 2, y + 30, 44)
        for i, s in enumerate(["Keep praying.", "Keep growing.", "Keep going."]):
            self.text(s, y - 40 - i * 52, "Script", 44, MAUVE)
        self.para("You are closer to the life God has for you than you think.", y - 196, "Body", 13, 19, INK,
                  x=M + 60, width=W - 2 * M - 120)
        self.heart(W / 2, y - 250, 4.5)

    def back_cover(self):
        self.new_page("cover")
        self.frame(28)
        self.img("corner_tr", W - 4, H - 4, w=125, anchor="tr")
        self.img("bouquet_big_bl", -12, -12, w=170)
        y = H - 120
        for s in ["You don’t need", "perfect words…", "you just need", "a place to begin."]:
            self.text(s, y, "Script", 34, MAUVE)
            y -= 38
        y -= 10
        y = self.para("A Little Time with God is a 90-day guided prayer journal designed to help you build a "
                      "consistent daily prayer habit, one simple, meaningful step at a time.",
                      y, "Body", 12, 17, INK, x=M + 40, width=W - 2 * M - 80)
        self.divider(y - 8)
        y -= 44
        self.text("Inside you’ll find:", y, "Serif", 14, INK)
        y -= 26
        items = ["Daily Scripture reflections", "Guided prayer prompts", "Habit tracking & weekly check-ins",
                 "Practical tools for busy seasons", "Encouragement for the journey"]
        x = W / 2 - 100
        for s in items:
            self.heart(x, y + 4, 3.4)
            self.text(s, y, "Body", 12, INK, x + 14, "left")
            y -= 21
        y -= 20
        self.text("Because a stronger prayer life", y, "Body", 12, INK)
        self.text("leads to a closer relationship with God.", y - 17, "Body", 12, INK)

    # ---- assemble
    def build(self):
        if self.mode != "interior":
            self.front_cover()
        self.belongs_page()
        self.welcome_page()
        self.how_to_page()
        self.routine_page()
        self.tracker_page()
        self.prayer_list_page()
        self.miss_day_page()
        for n, d in enumerate(DAYS, 1):
            self.day_page(n, d)
            if n % 7 == 0 and n < 90:
                self.review_page(n // 7)
        self.prayer_list_page()
        for _ in range(3):
            self.answered_page()
        self.next30_page()
        for _ in range(3):
            self.notes_page()
        self.closing_page()
        if self.mode != "interior":
            self.back_cover()
        self.finish_page()
        self.c.save()
        return self.page


def build_kdp_cover(path, pages, paper="cream"):
    """KDP paperback wraparound cover: bleed + back + spine + front + bleed."""
    spine = pages * (0.0025 if paper == "cream" else 0.002252) * 72
    cw, ch = BL + W + spine + W + BL, H + 2 * BL
    b = Book(path, mode="cover")
    c = b.c
    c.setPageSize((cw, ch))
    c.drawImage(str(CACHE / "bg_cover.jpg"), 0, 0, cw, ch)
    for x0, clip_x, clip_w, draw in [(BL, 0, BL + W, b.back_cover),
                                     (BL + W + spine, BL + W + spine, W + BL, lambda: b.front_cover(pad=BL))]:
        c.saveState()
        p = c.beginPath()
        p.rect(clip_x, 0, clip_w, ch)
        c.clipPath(p, stroke=0, fill=0)
        c.translate(x0, BL)
        draw()
        c.restoreState()
    # Spine text, reading top to bottom.
    c.saveState()
    c.translate(BL + W + spine / 2, ch / 2)
    c.rotate(-90)
    c.setFillColor(MAUVE)
    c.setFont("Serif", 10)
    c.drawCentredString(0, -3.4, f"A Little Time with God   ·   {BRAND}")
    c.restoreState()
    c.showPage()
    c.save()
    return cw / 72, ch / 72, spine / 72


def build_kindle_cover(path_jpg):
    """Kindle eBook cover: 1600 x 2560 px JPG (KDP's recommended size)."""
    import subprocess, tempfile
    pw, ph = 480, 768
    tmp = pathlib.Path(tempfile.mkdtemp()) / "kindle.pdf"
    b = Book(tmp, mode="cover")
    b.c.setPageSize((pw, ph))
    b.front_cover(pw, ph)
    b.c.showPage()
    b.c.save()
    subprocess.run(["pdftoppm", "-singlefile", "-png", "-scale-to-x", "1600", "-scale-to-y", "2560",
                    str(tmp), str(tmp.with_suffix(""))], check=True)
    Image.open(tmp.with_suffix(".png")).convert("RGB").save(path_jpg, quality=93)


if __name__ == "__main__":
    prepare_art()
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    for name, preview in [("A-Little-Time-with-God.pdf", False), ("A-Little-Time-with-God_PREVIEW.pdf", True)]:
        path = out / name
        n = Book(path, preview).build()
        print(f"{path.relative_to(ROOT)}: {n} pages")
        assert n == 120, n
    kdp = out / "KDP-paperback"
    kdp.mkdir(exist_ok=True)
    path = kdp / "A-Little-Time-with-God_KDP-manuscript.pdf"
    pages = Book(path, mode="interior").build()
    print(f"{path.relative_to(ROOT)}: {pages} pages")
    path = kdp / "A-Little-Time-with-God_KDP-cover.pdf"
    w, h, sp = build_kdp_cover(path, pages)
    print(f"{path.relative_to(ROOT)}: {w:.3f} x {h:.3f} in, spine {sp:.3f} in")
    path = out / "A-Little-Time-with-God_cover-1600x2560.jpg"
    build_kindle_cover(path)
    print(path.relative_to(ROOT))
