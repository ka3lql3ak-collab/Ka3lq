"""Build a typographic Kindle cover (1600x2560 JPG, KDP's recommended ebook size).

Usage: python3 tools/build_cover.py  ->  output/A-Little-Time-with-God_kindle-cover.jpg
If you have your own floral cover art, upload that to KDP instead and use this as a fallback.
"""
import math, pathlib, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from content import book as B

W, H = 1600, 2560
ROSE, GOLD, INK, LEAF = (176, 112, 122), (184, 147, 90), (84, 64, 66), (157, 170, 142)
PETALS = [(240, 205, 205), (232, 186, 190), (247, 226, 220), (214, 160, 168)]


def font(name, size):
    return ImageFont.truetype(str(ROOT / "fonts" / f"{name}.ttf"), size)


def centered(d, y, text, f, fill, spacing=0):
    if spacing:
        widths = [d.textlength(ch, font=f) for ch in text]
        x = (W - sum(widths) - spacing * (len(text) - 1)) / 2
        for ch, w in zip(text, widths):
            d.text((x, y), ch, font=f, fill=fill)
            x += w + spacing
    else:
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=fill)


def bloom(layer, x, y, r, color, rng):
    d = ImageDraw.Draw(layer)
    for ring, scale in ((0, 1.0), (1, 0.66), (2, 0.38)):
        n = 7 - ring
        c = tuple(max(0, v - ring * 14) for v in color)
        for i in range(n):
            a = 2 * math.pi * i / n + ring * 0.4 + rng.random() * 0.2
            px, py = x + math.cos(a) * r * 0.48 * scale, y + math.sin(a) * r * 0.48 * scale
            pr = r * 0.5 * scale
            d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=c + (235,))
    d.ellipse([x - r * 0.12, y - r * 0.12, x + r * 0.12, y + r * 0.12], fill=GOLD + (255,))


def leaf(layer, x, y, length, angle):
    d = ImageDraw.Draw(layer)
    pts = []
    for t in range(0, 21):
        u = t / 20
        w = math.sin(math.pi * u) * length * 0.22
        pts.append((u * length, w))
    pts += [(u, -w) for u, w in reversed(pts)]
    ca, sa = math.cos(angle), math.sin(angle)
    d.polygon([(x + px * ca - py * sa, y + px * sa + py * ca) for px, py in pts], fill=LEAF + (220,))


def cluster(layer, cx, cy, scale, rng):
    for _ in range(9):
        leaf(layer, cx + rng.uniform(-200, 200) * scale, cy + rng.uniform(-200, 200) * scale,
             rng.uniform(110, 190) * scale, rng.uniform(0, 2 * math.pi))
    for _ in range(6):
        bloom(layer, cx + rng.uniform(-190, 190) * scale, cy + rng.uniform(-170, 170) * scale,
              rng.uniform(70, 150) * scale, rng.choice(PETALS), rng)
    d = ImageDraw.Draw(layer)
    for _ in range(14):
        x, y = cx + rng.uniform(-300, 300) * scale, cy + rng.uniform(-300, 300) * scale
        r = rng.uniform(6, 13) * scale
        d.ellipse([x - r, y - r, x + r, y + r], fill=rng.choice(PETALS) + (230,))


def build(path):
    rng = random.Random(7)
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(0, W):
            t = (y / H) * 0.6 + (x / W) * 0.4
            px[x, y] = (int(250 - 8 * t), int(236 - 14 * t), int(232 - 12 * t))

    flowers = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cluster(flowers, 170, 260, 1.15, rng)
    cluster(flowers, W - 150, H - 300, 1.25, rng)
    cluster(flowers, W - 90, 1250, 0.55, rng)
    shadow = flowers.filter(ImageFilter.GaussianBlur(10))
    img.paste((160, 110, 110), (0, 0), shadow.split()[3].point(lambda a: a * 0.18))
    img.paste(flowers, (0, 0), flowers)

    d = ImageDraw.Draw(img)
    d.rectangle([90, 90, W - 90, H - 90], outline=GOLD, width=5)
    d.rectangle([112, 112, W - 112, H - 112], outline=GOLD, width=2)

    d.line([(W / 2, 360), (W / 2, 560)], fill=GOLD, width=9)
    d.line([(W / 2 - 55, 420), (W / 2 + 55, 420)], fill=GOLD, width=9)

    centered(d, 600, "A Little Time", font("GreatVibes-Regular", 230), ROSE)
    centered(d, 860, "with", font("GreatVibes-Regular", 170), ROSE)
    centered(d, 1010, "GOD", font("Cormorant-SemiBold", 380), GOLD, spacing=24)

    f = font("Cormorant-Medium", 66)
    y = 1520
    for line in ["A 90-Day Guided Prayer Journal", "to Build a Consistent Daily Prayer Habit",
                 "for Young Christian Women"]:
        centered(d, y, line, f, INK)
        y += 86
    centered(d, y + 70, B.TAGLINE.upper(), font("Cormorant-Medium", 44), ROSE, spacing=10)
    centered(d, H - 330, B.AUTHOR, font("Cormorant-Italic", 82), INK)
    img.save(path, "JPEG", quality=92)


if __name__ == "__main__":
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    path = out / "A-Little-Time-with-God_kindle-cover.jpg"
    build(path)
    print(path.relative_to(ROOT))
