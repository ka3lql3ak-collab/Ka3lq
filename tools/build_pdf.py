"""Build the 6x9in paperback interior (120 pages) for KDP.

Usage: python3 tools/build_pdf.py  ->  output/A-Little-Time-with-God_paperback-interior_6x9.pdf
No bleed: all artwork stays inside the margins. Upload with "No bleed", cream paper.
"""
import json, pathlib, sys
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from content.days import DAYS, WEEKS, PARTS
from content import book as B

VERSES = json.load(open(ROOT / "data/verses.json"))

W, H = 6 * 72, 9 * 72
INSIDE, OUTSIDE, TOP, BOTTOM = 50, 36, 40, 44

ROSE = HexColor("#B0707A")
ROSE_LIGHT = HexColor("#EBC9C9")
BLUSH = HexColor("#F8ECEA")
GOLD = HexColor("#B8935A")
LEAF = HexColor("#9DAA8E")
INK = HexColor("#4A3B3C")
SOFT = HexColor("#7D6A6B")
RULE = HexColor("#D8C4C0")

for name, file in [("Script", "GreatVibes-Regular"), ("Head", "Cormorant-SemiBold"), ("HeadM", "Cormorant-Medium"),
                   ("HeadI", "Cormorant-Italic"), ("Body", "EBGaramond-Regular"), ("BodyI", "EBGaramond-Italic"),
                   ("BodyB", "EBGaramond-SemiBold")]:
    pdfmetrics.registerFont(TTFont(name, str(ROOT / "fonts" / f"{file}.ttf")))


def ref_label(ref):
    return ref.replace("Psalms ", "Psalm ")


class Book:
    def __init__(self, path):
        self.c = canvas.Canvas(str(path), pagesize=(W, H))
        self.c.setTitle(B.TITLE)
        self.c.setAuthor(B.AUTHOR)
        self.c.setSubject(B.SUBTITLE)
        self.page = 1
        self.number_pages = False

    # ---- geometry -------------------------------------------------------
    @property
    def left(self):
        return INSIDE if self.page % 2 else OUTSIDE

    @property
    def right(self):
        return W - (OUTSIDE if self.page % 2 else INSIDE)

    @property
    def width(self):
        return self.right - self.left

    @property
    def cx(self):
        return (self.left + self.right) / 2

    def next_page(self):
        if self.number_pages:
            self.c.setFont("HeadM", 8.5)
            self.c.setFillColor(SOFT)
            self.c.drawCentredString(self.cx, BOTTOM - 22, str(self.page))
        self.c.showPage()
        self.page += 1

    # ---- primitives -----------------------------------------------------
    def wrap(self, text, font, size, width):
        words, lines, cur = text.split(), [], ""
        for w in words:
            t = f"{cur} {w}".strip()
            if pdfmetrics.stringWidth(t, font, size) <= width:
                cur = t
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    def para(self, text, y, font="Body", size=10, leading=None, color=INK, align="left", x=None, width=None):
        c, leading = self.c, leading or size * 1.35
        x = self.left if x is None else x
        width = self.width if width is None else width
        c.setFont(font, size)
        c.setFillColor(color)
        for line in self.wrap(text, font, size, width):
            y -= leading
            if align == "center":
                c.drawCentredString(x + width / 2, y + leading - size, line)
            elif align == "right":
                c.drawRightString(x + width, y + leading - size, line)
            else:
                c.drawString(x, y + leading - size, line)
        return y

    def text(self, s, y, font, size, color=INK, align="center", x=None, spacing=0):
        c = self.c
        c.setFillColor(color)
        if spacing:
            wid = pdfmetrics.stringWidth(s, font, size) + spacing * (len(s) - 1)
            xx = (self.cx - wid / 2) if align == "center" else (x if x is not None else self.left)
            c.setFont(font, size)
            c.drawString(xx, y, s, charSpace=spacing)
            return
        c.setFont(font, size)
        if align == "center":
            c.drawCentredString(self.cx if x is None else x, y, s)
        elif align == "right":
            c.drawRightString(self.right if x is None else x, y, s)
        else:
            c.drawString(self.left if x is None else x, y, s)

    def rules(self, y, n, gap=19, x=None, width=None):
        c = self.c
        x = self.left if x is None else x
        width = self.width if width is None else width
        c.setStrokeColor(RULE)
        c.setLineWidth(0.5)
        for _ in range(n):
            y -= gap
            c.line(x, y, x + width, y)
        return y

    def box(self, x, y, size=7):
        self.c.setStrokeColor(ROSE)
        self.c.setLineWidth(0.6)
        self.c.rect(x, y, size, size)

    def dot(self, x, y, r=3.3):
        self.c.setStrokeColor(ROSE)
        self.c.setLineWidth(0.6)
        self.c.circle(x, y, r)

    def heart(self, x, y, s=4, color=ROSE):
        c = self.c
        c.setFillColor(color)
        p = c.beginPath()
        p.moveTo(x, y - s)
        p.curveTo(x - s * 1.6, y + s * 0.1, x - s * 0.7, y + s * 1.3, x, y + s * 0.35)
        p.curveTo(x + s * 0.7, y + s * 1.3, x + s * 1.6, y + s * 0.1, x, y - s)
        c.drawPath(p, fill=1, stroke=0)

    def flower(self, x, y, r=5, petal=ROSE_LIGHT):
        """Small five-petal bloom with two leaves."""
        import math
        c = self.c
        c.setFillColor(LEAF)
        for ang in (200, -20):
            c.saveState()
            c.translate(x, y)
            c.rotate(ang)
            c.ellipse(r * 0.9, -r * 0.35, r * 2.6, r * 0.35, stroke=0, fill=1)
            c.restoreState()
        c.setFillColor(petal)
        for i in range(5):
            a = math.radians(90 + i * 72)
            c.circle(x + math.cos(a) * r * 0.62, y + math.sin(a) * r * 0.62, r * 0.55, stroke=0, fill=1)
        c.setFillColor(GOLD)
        c.circle(x, y, r * 0.28, stroke=0, fill=1)

    def divider(self, y, w=70):
        c = self.c
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.5)
        c.line(self.cx - w, y, self.cx - 9, y)
        c.line(self.cx + 9, y, self.cx + w, y)
        self.heart(self.cx, y, 3.2)

    def frame(self, inset=0):
        c = self.c
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.7)
        c.rect(self.left - 8 + inset, BOTTOM - 14 + inset, self.width + 16 - 2 * inset, H - TOP - BOTTOM + 22 - 2 * inset)
        c.setLineWidth(0.3)
        c.rect(self.left - 5 + inset, BOTTOM - 11 + inset, self.width + 10 - 2 * inset, H - TOP - BOTTOM + 16 - 2 * inset)

    def corner_blooms(self):
        self.flower(self.right - 10, H - TOP - 6, 7)
        self.flower(self.right - 26, H - TOP + 2, 4.5, ROSE)
        self.flower(self.left + 10, BOTTOM - 2, 7)
        self.flower(self.left + 26, BOTTOM - 10, 4.5, ROSE)

    def page_header(self, title, subtitle=None, y=None):
        y = H - TOP - 6 if y is None else y
        self.flower(self.cx, y, 5.5)
        self.text(title, y - 30, "Script", 26, ROSE)
        y -= 38
        if subtitle:
            self.text(subtitle.upper(), y - 8, "HeadM", 7.5, SOFT, spacing=1.6)
            y -= 14
        return y - 16

    def footer_script(self, s):
        self.text(s, BOTTOM + 4, "Script", 14, ROSE)

    def label(self, s, y, size=10.5, color=ROSE, x=None):
        self.text(s, y, "Head", size, color, align="left", x=x)
        return y

    # ---- pages ----------------------------------------------------------
    def title_page(self):
        self.frame()
        self.corner_blooms()
        y = H - 150
        self.c.setStrokeColor(GOLD)
        self.c.setLineWidth(1)
        self.c.line(self.cx, y + 70, self.cx, y + 30)
        self.c.line(self.cx - 11, y + 58, self.cx + 11, y + 58)
        self.text("A Little Time", y - 20, "Script", 44, ROSE)
        self.text("with", y - 58, "Script", 32, ROSE)
        self.text("GOD", y - 112, "Head", 60, GOLD, spacing=4)
        y = self.para(B.SUBTITLE, y - 135, "HeadM", 12.5, 16, INK, "center", self.left + 20, self.width - 40)
        self.text(B.TAGLINE.upper(), y - 30, "HeadM", 8, SOFT, spacing=1.8)
        self.text(B.AUTHOR, BOTTOM + 40, "HeadI", 13, INK)
        self.next_page()

    def copyright_page(self):
        y = BOTTOM + 190
        for s in [f"{B.TITLE}", f"Copyright © {B.YEAR} {B.AUTHOR}. All rights reserved.", "",
                  "No part of this journal may be reproduced or transmitted in any form without written permission "
                  "from the author, except for brief quotations in reviews.", "", B.SCRIPTURE_NOTE, "",
                  "This journal belongs to:"]:
            y = self.para(s, y, "Body", 8.5, 12, SOFT, "center") if s else y - 8
        self.rules(y - 4, 1, 20, self.cx - 90, 180)
        self.next_page()

    def welcome_page(self):
        self.frame()
        self.flower(self.right - 12, H - TOP - 6, 7)
        self.flower(self.left + 12, BOTTOM - 2, 7)
        y = H - TOP - 50
        self.text("WELCOME TO", y, "HeadM", 8.5, SOFT, spacing=2.2)
        self.text("A Little Time", y - 42, "Script", 34, ROSE)
        self.text("with GOD", y - 78, "Script", 30, ROSE)
        self.divider(y - 98)
        y -= 112
        for p in B.WELCOME:
            y = self.para(p, y, "Body", 10.5, 15, INK, "center", self.left + 14, self.width - 28) - 8
        self.text("Let's begin.", y - 26, "Script", 24, ROSE)
        self.heart(self.cx, y - 44, 3.5)
        self.next_page()

    def how_to_page(self):
        y = self.page_header("How to Use This Journal", "Ten minutes  ·  One day at a time")
        for i, (head, body) in enumerate(B.HOW_TO_USE, 1):
            self.c.setFillColor(BLUSH)
            self.c.circle(self.left + 11, y - 12, 11, stroke=0, fill=1)
            self.text(str(i), y - 16, "Head", 12, ROSE, x=self.left + 11)
            self.label(head, y - 10, 12, INK, x=self.left + 30)
            y = self.para(body, y - 14, "Body", 9.8, 13.5, SOFT, x=self.left + 30, width=self.width - 30) - 12
        y -= 6
        self.c.setFillColor(BLUSH)
        self.c.roundRect(self.left, y - 92, self.width, 92, 6, stroke=0, fill=1)
        self.label("Every 7 days", y - 20, 11, ROSE, x=self.left + 14)
        self.para("Pause for a Weekly Habit Review. Celebrate what went well, notice what got in the way, "
                  "and make a small plan for next week. Missed a day? Turn to “When I Miss a Day” and start again.",
                  y - 26, "Body", 9.5, 13, INK, x=self.left + 14, width=self.width - 28)
        self.footer_script("Progress, not perfection.")
        self.next_page()

    def routine_page(self):
        y = self.page_header("My Prayer Routine", "Create a space that works for you")
        self.label("My preferred time:", y - 6)
        y -= 26
        for i, s in enumerate(["Morning", "Afternoon", "Evening", "Before bed"]):
            x = self.left + i * self.width / 4
            self.box(x, y - 1)
            self.text(s, y, "Body", 9.5, INK, align="left", x=x + 12)
        y -= 26
        self.label("My prayer space:", y)
        y = self.rules(y - 2, 2) - 22
        self.label("My starting time:", y)
        y -= 20
        for i, s in enumerate(["5 minutes", "10 minutes", "15 minutes or more"]):
            x = self.left + i * self.width / 3
            self.box(x, y - 1)
            self.text(s, y, "Body", 9.5, INK, align="left", x=x + 12)
        y -= 26
        self.label("What usually gets in the way?", y)
        y = self.rules(y - 2, 2) - 22
        self.label("My plan when it does:", y)
        y = self.rules(y - 2, 2) - 22
        self.label("Someone who can encourage me:", y)
        y = self.rules(y - 2, 1) - 22
        self.label("Why I want to pray more:", y)
        self.rules(y - 2, 3)
        self.text("“Be still, and know that I am God.”", BOTTOM + 22, "HeadI", 11, ROSE)
        self.text("PSALM 46:10", BOTTOM + 8, "HeadM", 7, SOFT, spacing=1.4)
        self.next_page()

    def prayer_list_page(self, n=1):
        y = self.page_header("My Prayer List", "People  ·  Situations  ·  Intentions")
        sections = ["People I'm Praying For", "Situations I'm Lifting Up", "My Personal Intentions"]
        avail = y - (BOTTOM + 30)
        h = avail / 3 - 10
        for s in sections:
            self.c.setStrokeColor(ROSE_LIGHT)
            self.c.setLineWidth(0.8)
            self.c.roundRect(self.left, y - h, self.width, h, 6)
            self.label(s, y - 16, 10.5, ROSE, x=self.left + 10)
            self.rules(y - 20, int((h - 28) // 19), 19, self.left + 10, self.width - 20)
            y -= h + 10
        self.footer_script("He hears every prayer.")
        self.next_page()

    def tracker_page(self):
        y = self.page_header("90-Day Prayer Tracker", "Color in a circle each day you pray")
        cols, r = 10, 11
        gx = self.width / cols
        gy = 27
        for i in range(90):
            row, col = divmod(i, cols)
            x = self.left + gx * (col + 0.5)
            yy = y - 16 - row * gy
            self.c.setStrokeColor(ROSE)
            self.c.setLineWidth(0.7)
            self.c.circle(x, yy, r)
            self.text(str(i + 1), yy - 3, "HeadM", 8.5, INK, x=x)
        y = y - 16 - 9 * gy - 10
        self.c.setFillColor(BLUSH)
        self.c.roundRect(self.left + 10, y - 70, self.width - 20, 64, 6, stroke=0, fill=1)
        self.text("You're doing it!", y - 30, "Script", 20, ROSE)
        self.text("Every day you show up for God, you're building a stronger, closer walk with Him.",
                  y - 50, "Body", 8.8, INK)
        self.next_page()

    def miss_a_day_page(self):
        y = self.page_header("When I Miss a Day", "It's not the end, it's a new beginning")
        y = self.para(B.MISS_A_DAY_INTRO, y, "Body", 9.8, 13.5, SOFT, "center", self.left + 10, self.width - 20) - 14
        for q in B.MISS_A_DAY_QUESTIONS:
            self.label(q, y)
            y = self.rules(y - 2, 4) - 22
        self.label("My next step:", y)
        y -= 20
        for s in B.MISS_A_DAY_STEPS + ["Other:"]:
            self.box(self.left, y - 1)
            self.text(s, y, "Body", 9.5, INK, align="left", x=self.left + 13)
            if s == "Other:":
                self.c.setStrokeColor(RULE)
                self.c.line(self.left + 50, y - 2, self.right, y - 2)
            y -= 18
        self.label("A verse to hold on to:", y - 6)
        self.para("“It is because of the LORD’s loving kindnesses that we are not consumed, because his compassion "
                  "doesn’t fail. They are new every morning.” Lamentations 3:22-23",
                  y - 10, "BodyI", 9.5, 13, INK)
        self.footer_script("Grace gets you back.")
        self.next_page()

    def part_page(self, part):
        _, label, name, days, text = part
        self.frame()
        self.corner_blooms()
        y = H / 2 + 110
        self.text(label.upper(), y, "HeadM", 9, SOFT, spacing=2.4)
        self.text(name, y - 50, "Script", 40, ROSE)
        self.text(days.upper(), y - 78, "HeadM", 8.5, GOLD, spacing=2)
        self.divider(y - 96)
        self.para(text, y - 112, "Body", 10.5, 15, INK, "center", self.left + 24, self.width - 48)
        self.next_page()

    def day_page(self, n, d):
        c = self.c
        week = (n - 1) // 7
        theme = WEEKS[week][0]
        self.flower(self.left + 6, H - TOP - 4, 5.5)
        self.flower(self.right - 6, H - TOP - 4, 5.5)
        y = H - TOP
        self.text(f"DAY {n}", y - 6, "Head", 9.5, GOLD, spacing=2)
        self.text(d["title"], y - 34, "Script", 25, ROSE)
        self.text(f"WEEK {week + 1}  ·  {theme.upper()}", y - 48, "HeadM", 6.8, SOFT, spacing=1.2)
        self.text("Date: ______ / ______ / ______", y - 62, "Body", 8.5, SOFT)
        y -= 72

        # Scripture card
        verse = VERSES[d["ref"]]
        vlines = self.wrap(verse, "HeadI", 11, self.width - 28)
        bh = 30 + len(vlines) * 13.5
        c.setFillColor(BLUSH)
        c.roundRect(self.left, y - bh, self.width, bh, 6, stroke=0, fill=1)
        self.text("TODAY'S SCRIPTURE", y - 13, "Head", 7, ROSE, spacing=1.4)
        yy = y - 17
        c.setFont("HeadI", 11)
        c.setFillColor(INK)
        for line in vlines:
            yy -= 13.5
            c.drawCentredString(self.cx, yy + 2.5, line)
        self.text(ref_label(d["ref"]), y - bh + 6, "HeadM", 8, GOLD, align="right", x=self.right - 12)
        y -= bh + 16

        self.label("A Thought for Today", y)
        y = self.para(d["thought"], y - 4, "Body", 9.4, 12.4, INK) - 17

        # Remaining space is split between writing sections.
        foot = BOTTOM + 30
        q_lines = self.wrap(d["question"], "BodyI", 9.2, self.width)
        p_lines = self.wrap(d["prayer"], "BodyI", 9.2, self.width)
        fixed = 32 + 12 * (len(q_lines) + len(p_lines))
        n_rules = int((y - foot - fixed) // 18.5)
        r_reflect = max(2, round(n_rules * 0.38))
        r_grateful = 2 if n_rules >= 8 else 1
        r_prayer = max(2, n_rules - r_reflect - r_grateful)

        self.label("Reflect", y)
        y = self.para(d["question"], y - 3, "BodyI", 9.2, 12, SOFT)
        y = self.rules(y + 2, r_reflect, 18.5) - 16
        self.label("My Prayer", y)
        y = self.para(d["prayer"], y - 3, "BodyI", 9.2, 12, SOFT)
        y = self.rules(y + 2, r_prayer, 18.5) - 16
        self.label("One Thing I'm Grateful For", y)
        self.rules(y + 2, r_grateful, 18.5)

        # Check-in strip
        fy = BOTTOM + 6
        c.setStrokeColor(ROSE_LIGHT)
        c.setLineWidth(0.6)
        c.line(self.left, fy + 15, self.right, fy + 15)
        self.box(self.left, fy)
        self.text("I prayed today", fy + 1, "Body", 8.5, INK, align="left", x=self.left + 11)
        x = self.left + 82
        self.text("Time:", fy + 1, "Body", 8.5, SOFT, align="left", x=x)
        x += 26
        for s in ["5 min", "10 min", "15+ min"]:
            self.dot(x + 3, fy + 4)
            self.text(s, fy + 1, "Body", 8.5, INK, align="left", x=x + 9)
            x += 44
        self.heart(self.right - 4, fy + 4, 3.2, ROSE_LIGHT)
        self.next_page()

    def review_page(self, week):
        y = self.page_header("Weekly Habit Review", f"Week {week}  ·  {WEEKS[week - 1][0]}")
        self.text("Days I prayed this week:", y - 6, "Head", 10.5, ROSE, align="left")
        x = self.left + 128
        for i in range(7):
            self.c.setStrokeColor(ROSE)
            self.c.circle(x + i * 22, y - 3, 7.5)
            self.text(str((week - 1) * 7 + i + 1), y - 6, "HeadM", 7, SOFT, x=x + i * 22)
        y -= 28
        avail = y - (BOTTOM + 30)
        per = int((avail - len(B.REVIEW_QUESTIONS) * 22) // len(B.REVIEW_QUESTIONS) // 19)
        for q in B.REVIEW_QUESTIONS:
            self.label(q, y)
            y = self.rules(y - 2, per) - 22
        self.footer_script("Progress, not perfection.")
        self.next_page()

    def answered_page(self):
        y = self.page_header("Answered Prayer Reflections", "Look back  ·  Give thanks  ·  Keep going")
        for k in range(2):
            self.label(B.ANSWERED_FIELDS[0], y)
            y = self.rules(y - 2, 2) - 20
            self.label(B.ANSWERED_FIELDS[1], y)
            y = self.rules(y - 2, 2) - 20
            self.label("How it made me feel:", y)
            x = self.left + 112
            for s in B.ANSWERED_FEELINGS:
                self.box(x, y - 1)
                self.text(s, y, "Body", 9, INK, align="left", x=x + 11)
                x += 70
            y -= 24
            self.label(B.ANSWERED_FIELDS[2], y)
            y = self.rules(y - 2, 2) - 20
            if k == 0:
                self.divider(y + 6, 50)
                y -= 12
        self.footer_script("God is faithful.")
        self.next_page()

    def final_reflection_page(self):
        y = self.page_header("Ninety Days Later", "Look how far you've come")
        per = int((y - (BOTTOM + 30) - len(B.FINAL_QUESTIONS) * 22) // len(B.FINAL_QUESTIONS) // 19)
        for q in B.FINAL_QUESTIONS:
            self.label(q, y)
            y = self.rules(y - 2, per) - 22
        self.footer_script("Well done, faithful one.")
        self.next_page()

    def next30_page(self):
        y = self.page_header("My Next 30 Days", "Keep the momentum going")
        y = self.para(B.NEXT_30_INTRO, y, "Body", 9.8, 13.5, SOFT, "center") - 14
        self.label("My goals:", y)
        y = self.rules(y - 2, 4) - 22
        self.label("Habits I want to keep:", y)
        y -= 20
        for s in B.NEXT_30_HABITS + ["Other:"]:
            self.box(self.left, y - 1)
            self.text(s, y, "Body", 9.5, INK, align="left", x=self.left + 13)
            if s == "Other:":
                self.c.setStrokeColor(RULE)
                self.c.line(self.left + 50, y - 2, self.right, y - 2)
            y -= 18
        self.label("What's next for my time with God:", y - 6)
        y = self.rules(y - 8, 3) - 22
        self.label("Notes & encouragement:", y)
        self.rules(y - 2, int((y - BOTTOM - 40) // 19))
        self.footer_script("The best is still ahead.")
        self.next_page()

    def closing_page(self):
        self.frame()
        self.corner_blooms()
        y = H / 2 + 120
        self.c.setStrokeColor(GOLD)
        self.c.setLineWidth(1)
        self.c.line(self.cx, y + 40, self.cx, y + 6)
        self.c.line(self.cx - 9, y + 30, self.cx + 9, y + 30)
        for i, s in enumerate(B.CLOSING):
            self.text(s, y - 40 - i * 40, "Script", 30, ROSE)
        self.para(B.CLOSING_LINE, y - 150, "Body", 10.5, 15, INK, "center", self.left + 30, self.width - 60)
        self.heart(self.cx, y - 190, 3.5)
        self.next_page()

    def thank_you_page(self):
        y = self.page_header("Thank You", "From my heart to yours", H - TOP - 60)
        for p in B.THANK_YOU:
            y = self.para(p, y - 4, "Body", 10.5, 15, INK, "center", self.left + 14, self.width - 28) - 10
        self.text(B.AUTHOR, y - 30, "Script", 22, ROSE)
        self.next_page()

    # ---- assemble -------------------------------------------------------
    def build(self):
        self.title_page()
        self.copyright_page()
        self.number_pages = True
        self.welcome_page()
        self.how_to_page()
        self.routine_page()
        self.prayer_list_page()
        self.tracker_page()
        self.miss_a_day_page()
        parts = {p[0]: p for p in PARTS}
        for n, d in enumerate(DAYS, 1):
            if n in parts:
                self.part_page(parts[n])
            self.day_page(n, d)
            if n % 7 == 0 and n < 90:
                self.review_page(n // 7)
        self.final_reflection_page()
        for _ in range(3):
            self.answered_page()
        self.next30_page()
        self.closing_page()
        self.number_pages = False
        self.thank_you_page()
        self.c.save()
        return self.page - 1


if __name__ == "__main__":
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    path = out / "A-Little-Time-with-God_paperback-interior_6x9.pdf"
    pages = Book(path).build()
    print(f"{path.relative_to(ROOT)}: {pages} pages")
