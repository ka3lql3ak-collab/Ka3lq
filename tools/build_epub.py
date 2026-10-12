"""Build the Kindle ebook (reflowable EPUB 3) for KDP.

Usage: python3 tools/build_epub.py  ->  output/Kindle-ebook/A-Little-Time-with-God_Kindle.epub
Kindle readers can't write on the page, so every prompt is answered in a notebook.
"""
import html, json, pathlib, sys
from ebooklib import epub

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from content.days import DAYS, WEEKS, PARTS
from content import book as B

VERSES = json.load(open(ROOT / "data/verses.json"))
e = html.escape

CSS = """
@font-face { font-family: "Great Vibes"; src: url(../fonts/GreatVibes-Regular.ttf); }
@font-face { font-family: "Cormorant"; font-style: italic; src: url(../fonts/Cormorant-Italic.ttf); }
body { margin: 0 3%; line-height: 1.5; }
p { margin: 0 0 0.8em 0; text-indent: 0; }
h1, h2 { font-family: "Great Vibes", serif; font-weight: normal; color: #B0707A; text-align: center;
         margin: 0.4em 0 0.2em 0; line-height: 1.2; page-break-after: avoid; }
h1 { font-size: 2.4em; }
h2 { font-size: 2em; }
h3 { color: #B0707A; font-size: 1em; font-weight: normal; letter-spacing: 0.08em; text-transform: uppercase;
     margin: 1.4em 0 0.4em 0; page-break-after: avoid; }
.eyebrow { text-align: center; font-size: 0.75em; letter-spacing: 0.25em; text-transform: uppercase; color: #8A7375;
           margin: 1.5em 0 0 0; }
.sub { text-align: center; font-size: 0.8em; letter-spacing: 0.12em; text-transform: uppercase; color: #8A7375; margin: 0 0 1em 0; }
.orn { text-align: center; color: #B8935A; margin: 0.6em 0 1.2em 0; }
.verse { font-family: "Cormorant", serif; font-style: italic; font-size: 1.15em; text-align: center; margin: 0.6em 4% 0.2em 4%; }
.ref { text-align: center; color: #B8935A; font-size: 0.85em; letter-spacing: 0.1em; margin-bottom: 1.2em; }
.prompt { font-style: italic; }
.prayer { font-style: italic; border-left: 2px solid #EBC9C9; padding-left: 0.8em; }
.center { text-align: center; }
.script { font-family: "Great Vibes", serif; color: #B0707A; font-size: 1.8em; text-align: center; margin: 1em 0; }
.small { font-size: 0.85em; color: #6E5C5D; }
.check { margin: 0.2em 0 0.2em 1em; }
ol, ul { margin: 0.4em 0 1em 0; }
li { margin-bottom: 0.4em; }
table { border-collapse: collapse; width: 100%; margin: 0.5em 0 1em 0; }
td { border-bottom: 1px solid #E5D3D0; padding: 0.35em 0.3em; vertical-align: top; font-size: 0.9em; }
td.n { color: #B8935A; white-space: nowrap; }
.title-page { text-align: center; margin-top: 15%; }
.divider { width: 40%; max-width: 12em; }
.cross { height: 2.2em; }
.big { font-family: serif; font-size: 3.2em; letter-spacing: 0.12em; color: #B8935A; margin: 0; }
"""

ORN = '<p class="orn"><img src="images/divider.png" alt="" class="divider"/></p>'
CROSS = '<p class="orn"><img src="images/cross.png" alt="" class="cross"/></p>'


def ornaments():
    """Small PNG ornaments: Kindle fonts don't reliably include heart or cross glyphs."""
    import io
    from PIL import Image, ImageDraw
    gold, rose = (184, 147, 90, 255), (176, 112, 122, 255)
    out = {}
    im = Image.new("RGBA", (600, 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.line([(60, 30), (262, 30)], fill=gold, width=3)
    d.line([(338, 30), (540, 30)], fill=gold, width=3)
    d.ellipse([281, 14, 301, 34], fill=rose)
    d.ellipse([299, 14, 319, 34], fill=rose)
    d.polygon([(283, 28), (317, 28), (300, 48)], fill=rose)
    out["divider"] = im
    im = Image.new("RGBA", (80, 120), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([36, 4, 44, 116], fill=gold)
    d.rectangle([12, 32, 68, 40], fill=gold)
    out["cross"] = im
    for k, im in out.items():
        buf = io.BytesIO()
        im.save(buf, "PNG")
        out[k] = buf.getvalue()
    return out


def ref_label(ref):
    return ref.replace("Psalms ", "Psalm ")


def chapter(book, fname, title, body, toc=True):
    c = epub.EpubHtml(title=title, file_name=fname, lang=B.LANG)
    c.content = f'<html><head><link rel="stylesheet" href="style/book.css" type="text/css"/></head><body>{body}</body></html>'
    c.add_link(href="style/book.css", rel="stylesheet", type="text/css")
    book.add_item(c)
    return c


def paras(items, cls=None):
    attr = f' class="{cls}"' if cls else ""
    return "".join(f"<p{attr}>{e(p)}</p>" for p in items)


def build(path):
    book = epub.EpubBook()
    book.set_identifier("a-little-time-with-god-kindle-1")
    book.set_title(B.TITLE)
    book.set_language(B.LANG)
    book.add_author(B.AUTHOR)
    book.add_metadata("DC", "description", B.SUBTITLE)
    book.add_metadata("DC", "subject", "Christian prayer journal")
    book.set_cover("cover.jpg", open(ROOT / "output/Kindle-ebook/A-Little-Time-with-God_Kindle-cover.jpg", "rb").read())

    book.add_item(epub.EpubItem(uid="css", file_name="style/book.css", media_type="text/css", content=CSS))
    for f in ("GreatVibes-Regular", "Cormorant-Italic"):
        book.add_item(epub.EpubItem(uid=f, file_name=f"fonts/{f}.ttf", media_type="font/ttf",
                                    content=open(ROOT / "fonts" / f"{f}.ttf", "rb").read()))

    for k, data in ornaments().items():
        book.add_item(epub.EpubItem(uid=f"img-{k}", file_name=f"images/{k}.png", media_type="image/png", content=data))

    spine, toc = ["nav"], []

    def add(fname, title, body, in_toc=True):
        c = chapter(book, fname, title, body)
        spine.append(c)
        if in_toc:
            toc.append(c)
        return c

    add("title.xhtml", "Title Page",
        f'<div class="title-page">{CROSS}<h1>A Little Time</h1><h2>with</h2><p class="big">GOD</p>'
        f'<p class="center">{e(B.SUBTITLE)}</p><p class="sub">{e(B.TAGLINE)}</p>'
        f'<p class="center"><i>{e(B.AUTHOR)}</i></p></div>', in_toc=False)
    add("copyright.xhtml", "Copyright",
        f'<p class="small center">{e(B.TITLE)}<br/>Copyright © {B.YEAR} {e(B.AUTHOR)}. All rights reserved.</p>'
        '<p class="small center">For personal use only. No part of this book may be copied, shared, resold or '
        'redistributed in any form without written permission from digiByDK, except for brief quotations in reviews.</p>'
        f'<p class="small center">{e(B.SCRIPTURE_NOTE)}</p>', in_toc=False)

    add("welcome.xhtml", "Welcome",
        f'<p class="eyebrow">Welcome to</p><h1>A Little Time with God</h1>{ORN}{paras(B.WELCOME)}'
        '<p class="script">Let\'s begin.</p>')

    steps = "".join(f"<li><b>{e(h)}.</b> {e(t)}</li>" for h, t in B.HOW_TO_USE)
    add("how-to-use.xhtml", "How to Use This Journal",
        f'<h1>How to Use This Journal</h1><p class="sub">Ten minutes · One day at a time</p>{ORN}'
        f'<h3>Grab a notebook</h3><p>{e(B.HOW_TO_EBOOK_NOTE)}</p>'
        f'<h3>Each day</h3><ol>{steps}</ol>'
        '<h3>Every seven days</h3><p>Pause for a Weekly Habit Review. Celebrate what went well, notice what got in '
        'the way, and make a small plan for next week.</p>'
        '<h3>If you miss a day</h3><p>Turn to “When I Miss a Day” and start again. Progress, not perfection.</p>')

    qs = "".join(f"<li>{e(q)}</li>" for q in B.ROUTINE_QUESTIONS)
    add("routine.xhtml", "My Prayer Routine",
        f'<h1>My Prayer Routine</h1><p class="sub">Create a space that works for you</p>{ORN}'
        f'<p>Before Day 1, answer these questions in your notebook. Your answers are your plan.</p><ol class="prompt">{qs}</ol>'
        '<h3>Start a prayer list</h3><p>On a fresh notebook page, make three headings: <i>People I’m Praying For</i>, '
        '<i>Situations I’m Lifting Up</i>, and <i>My Personal Intentions</i>. Add to it as the weeks go by.</p>'
        '<h3>Track your days</h3><p>Write the numbers 1 to 90 on the inside cover of your notebook and circle each day '
        'you pray. Watching the circles fill up is a powerful encouragement.</p>'
        '<p class="verse">“Be still, and know that I am God.”</p><p class="ref">Psalm 46:10</p>')

    rows = "".join(f'<tr><td class="n">Week {i}</td><td><b>{e(t)}</b><br/>{e(s)}</td></tr>'
                   for i, (t, s) in enumerate(WEEKS, 1))
    add("journey.xhtml", "Your 90-Day Journey",
        f'<h1>Your 90-Day Journey</h1><p class="sub">Thirteen weeks · Three seasons</p>{ORN}<table>{rows}</table>')

    miss = "<ul>" + "".join(f"<li>{e(s)}</li>" for s in B.MISS_A_DAY_STEPS) + "</ul>"
    miss_page = (f'<h1>When I Miss a Day</h1><p class="sub">It’s not the end. It’s a new beginning.</p>{ORN}'
                 f'<p>{e(B.MISS_A_DAY_INTRO)}</p><h3>In your notebook</h3>'
                 + "".join(f'<p class="prompt">{e(q)}</p>' for q in B.MISS_A_DAY_QUESTIONS) +
                 f'<h3>My next step</h3>{miss}'
                 '<p class="verse">“It is because of the LORD’s loving kindnesses that we are not consumed, because his '
                 'compassion doesn’t fail. They are new every morning. Great is your faithfulness.”</p>'
                 '<p class="ref">Lamentations 3:22-23</p><p class="script">Grace gets you back.</p>')
    add("miss-a-day.xhtml", "When I Miss a Day", miss_page)

    parts = {p[0]: p for p in PARTS}
    review_q = "".join(f"<li>{e(q)}</li>" for q in B.REVIEW_QUESTIONS)
    for n, d in enumerate(DAYS, 1):
        if n in parts:
            _, label, name, days, text = parts[n]
            add(f"part-{label.split()[-1].lower()}.xhtml", f"{label}: {name}",
                f'<p class="eyebrow">{e(label)}</p><h1>{e(name)}</h1><p class="sub">{e(days)}</p>{ORN}<p class="center">{e(text)}</p>')
        if (n - 1) % 7 == 0:
            w = (n - 1) // 7
            theme, blurb = WEEKS[w]
            week_intro = (f'<p class="eyebrow">Week {w + 1}</p><h2>{e(theme)}</h2><p class="sub">{e(blurb)}</p>{ORN}')
        else:
            week_intro = ""
        add(f"day-{n:02d}.xhtml", f"Day {n}: {d['title']}",
            f'{week_intro}<p class="eyebrow">Day {n}</p><h2>{e(d["title"])}</h2>{ORN}'
            f'<p class="verse">“{e(VERSES[d["ref"]].strip("“”"))}”</p><p class="ref">{e(ref_label(d["ref"]))}</p>'
            f'<h3>A Thought for Today</h3><p>{e(d["thought"])}</p>'
            f'<h3>Reflect</h3><p class="prompt">{e(d["question"])}</p>'
            f'<h3>Pray</h3><p class="prayer">{e(d["prayer"])}</p>'
            '<p class="small">Keep going in your own words, as naturally as you would speak.</p>'
            '<h3>Give Thanks</h3><p class="prompt">Write down one thing you’re grateful for today.</p>'
            f'<p class="small center">Day {n} of 90 · Circle today on your notebook tracker.</p>')
        if n % 7 == 0 and n < 90:
            wk = n // 7
            add(f"review-{wk:02d}.xhtml", f"Week {wk} Review",
                f'<p class="eyebrow">Week {wk}</p><h2>Weekly Habit Review</h2><p class="sub">{e(WEEKS[wk - 1][0])}</p>{ORN}'
                f'<p>Count the days you prayed this week, then answer these in your notebook:</p><ol class="prompt">{review_q}</ol>'
                '<p class="script">Progress, not perfection.</p>', in_toc=False)

    final_q = "".join(f"<li>{e(q)}</li>" for q in B.FINAL_QUESTIONS)
    add("ninety-days-later.xhtml", "Ninety Days Later",
        f'<h1>Ninety Days Later</h1><p class="sub">Look how far you’ve come</p>{ORN}<ol class="prompt">{final_q}</ol>'
        '<p class="script">Well done, faithful one.</p>')

    fields = "".join(f"<li>{e(f)}</li>" for f in B.ANSWERED_FIELDS[:2]) + \
        f"<li>How it made me feel ({', '.join(B.ANSWERED_FEELINGS).lower()}, or something else)</li>" + \
        f"<li>{e(B.ANSWERED_FIELDS[2])}</li>"
    add("answered-prayers.xhtml", "Answered Prayer Reflections",
        f'<h1>Answered Prayer Reflections</h1><p class="sub">Look back · Give thanks · Keep going</p>{ORN}'
        f'<p>{e(B.ANSWERED_INTRO)}</p><p>Look back through your notebook and prayer list. For each answered prayer, write:</p>'
        f'<ol class="prompt">{fields}</ol><p class="script">God is faithful.</p>')

    habits = "<ul>" + "".join(f"<li>{e(h)}</li>" for h in B.NEXT_30_HABITS) + "</ul>"
    add("next-30-days.xhtml", "My Next 30 Days",
        f'<h1>My Next 30 Days</h1><p class="sub">Keep the momentum going</p>{ORN}<p>{e(B.NEXT_30_INTRO)}</p>'
        '<h3>In your notebook</h3><p class="prompt">What are my goals for the next 30 days?</p>'
        f'<h3>Habits I want to keep</h3>{habits}'
        '<p class="prompt">What’s next for my time with God? Will I read through a book of the Bible, start a new '
        'journal, or invite a friend to pray with me?</p><p class="script">The best is still ahead.</p>')

    add("keep-going.xhtml", "Keep Going",
        '<div class="title-page">{CROSS}'
        + "".join(f'<p class="script">{e(s)}</p>' for s in B.CLOSING) +
        f'<p class="center">{e(B.CLOSING_LINE)}</p>{ORN}</div>')
    add("thank-you.xhtml", "Thank You",
        f'<h1>Thank You</h1><p class="sub">From my heart to yours</p>{ORN}{paras(B.THANK_YOU)}'
        f'<p class="script">{e(B.AUTHOR)}</p>')

    book.toc = toc
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = spine
    epub.write_epub(str(path), book)


if __name__ == "__main__":
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    path = out / "Kindle-ebook" / "A-Little-Time-with-God_Kindle.epub"
    build(path)
    print(path.relative_to(ROOT))
