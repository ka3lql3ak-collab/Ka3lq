"""Extract the journal's verses from the World English Bible JSON (npm `world-english-bible`).

Usage: python3 tools/extract_verses.py <path-to-package/json> > data/verses.json
The WEB is public domain. "Yahweh" is rendered as "the LORD", as in common WEB editions.
"""
import json, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from content.days import DAYS

FILES = {"1 John": "1john", "1 Peter": "1peter", "2 Corinthians": "2corinthians", "1 Corinthians": "1corinthians",
         "1 Thessalonians": "1thessalonians", "1 Timothy": "1timothy", "2 Peter": "2peter"}

# Hand trims where only part of a verse is quoted, or the WEB vocative needs care.
OVERRIDES = {
    "James 4:8": "Draw near to God, and he will draw near to you.",
    "Genesis 16:13": "She called the name of the LORD who spoke to her, “You are a God who sees.”",
    "1 John 3:1": "See how great a love the Father has given to us, that we should be called children of God!",
    "Esther 4:14": "Who knows if you haven’t come to the kingdom for such a time as this?",
    "Isaiah 55:8-9": "“For my thoughts are not your thoughts, and your ways are not my ways,” says the LORD. “For as the heavens are higher than the earth, so are my ways higher than your ways, and my thoughts than your thoughts.”",
    "Psalms 37:4": "Delight yourself in the LORD, and he will give you the desires of your heart.",
    "Psalms 4:8": "In peace I will both lay myself down and sleep, for you alone, LORD, make me live in safety.",
    "Psalms 36:5": "Your loving kindness, LORD, is in the heavens. Your faithfulness reaches to the skies.",
}

def tidy(t):
    t = t.strip()
    if t.count("“") > t.count("”"):
        t = t.replace("“", "", 1) if t.startswith("“") else t + "”"
    elif t.count("”") > t.count("“"):
        t = t[:-1] if t.endswith("”") else t
    t = re.sub(r"[,;:]$", ".", t)
    return t[0].upper() + t[1:]

def lord(t):
    t = t.replace("Lord Yahweh", "Lord GOD").replace("O Yahweh", "O LORD")
    t = re.sub(r"(^|[.!?;:]\s+|[“\"‘']\s*)Yahweh", lambda m: m.group(1) + "The LORD", t)
    t = t.replace("Yahweh", "the LORD")
    return t

def get(root, ref):
    book, cv = ref.rsplit(" ", 1)
    ch, vs = cv.split(":")
    a, _, b = vs.partition("-")
    a, b = int(a), int(b or a)
    data = json.load(open(root / (FILES.get(book, book.lower().replace(" ", "")) + ".json")))
    parts = [x["value"] for x in data if x.get("chapterNumber") == int(ch) and a <= x.get("verseNumber", 0) <= b and "value" in x]
    text = re.sub(r"\s+", " ", "".join(parts)).strip()
    return OVERRIDES.get(ref) or tidy(lord(text))

root = pathlib.Path(sys.argv[1])
out = {d["ref"]: get(root, d["ref"]) for d in DAYS}
json.dump(out, sys.stdout, indent=1, ensure_ascii=False)
