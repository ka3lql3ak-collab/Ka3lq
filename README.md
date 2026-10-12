# A Little Time with God

*A 90-Day Guided Prayer Journal to Build a Consistent Daily Prayer Habit for Young Christian Women*

Source and build tools for the Amazon KDP editions.

## Files to upload (`output/`)

| File | Use on KDP |
|---|---|
| `A-Little-Time-with-God_kindle.epub` | **Kindle eBook → Manuscript** (reflowable EPUB 3, passes epubcheck) |
| `A-Little-Time-with-God_kindle-cover.jpg` | **Kindle eBook → Cover** (1600×2560). A typographic fallback: use your floral art if you have it at this size |
| `A-Little-Time-with-God_paperback-interior_6x9.pdf` | **Paperback → Manuscript** (optional), 120 pages, 6×9 in, no bleed, cream paper |

The paperback needs its own wraparound cover (spine for 120 cream pages ≈ 0.30 in). Use KDP's Cover Calculator or Cover Creator.

## What's inside

- Welcome, How to Use, My Prayer Routine, Prayer List, 90-Day Tracker, When I Miss a Day
- 3 parts: *Building the Habit*, *Going Deeper*, *Walking Closer*
- 13 weekly themes, 90 daily devotions: Scripture, a short reflection, a reflection question, a prayer starter, gratitude
- 12 Weekly Habit Reviews, Ninety Days Later, Answered Prayer Reflections, My Next 30 Days, closing, and a thank-you page with a review request

In the **ebook**, prompts are answered in a notebook, because Kindle readers can't write on the page. The **paperback** has lined writing space.

## Editing

- Daily content: `content/days.py`
- Front/back matter and **author name** (`AUTHOR`): `content/book.py`
- Then run `./build.sh` (needs `pip install -r requirements.txt`)

Scripture is from the World English Bible (public domain), extracted into `data/verses.json` by `tools/extract_verses.py`.
Fonts (Great Vibes, Cormorant Garamond, EB Garamond) are under the SIL Open Font License (see `fonts/`).

See `KDP-LISTING.md` for the description, keywords and categories.
