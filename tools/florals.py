"""Procedural watercolor florals (roses, blossoms, leaves, sprigs) for the journal artwork.

Each function paints onto a transparent RGBA canvas. `cluster()` arranges a bouquet.
"""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

BLUSH = [(238, 190, 188), (243, 205, 198), (232, 172, 176), (246, 216, 208)]
CREAM = [(250, 236, 220), (247, 230, 212), (252, 242, 230)]
DEEP = [(214, 140, 150), (224, 156, 160)]
SAGE = [(150, 168, 130), (168, 182, 146), (128, 148, 112), (182, 192, 160)]
GOLD = (196, 160, 98)


def _layer(size):
    return Image.new("RGBA", size, (0, 0, 0, 0))


def _blur(layer, radius):
    """Premultiplied-alpha blur, so soft edges don't pick up dark fringes."""
    a = np.asarray(layer).astype(np.float32)
    al = a[..., 3:4] / 255.0
    pm = np.concatenate([a[..., :3] * al, al * 255], axis=2)
    chans = [Image.fromarray(np.clip(pm[..., i], 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
             for i in range(4)]
    b = np.stack([np.asarray(c).astype(np.float32) for c in chans], axis=2)
    alpha = b[..., 3:4] / 255.0
    rgb = np.where(alpha > 0.003, b[..., :3] / np.maximum(alpha, 0.003), 0)
    return np.concatenate([rgb, b[..., 3:4]], axis=2)


def _wash(layer, blur):
    """Soft watercolor edge: blur, then let pigment pool a little darker at the rim."""
    a = _blur(layer, blur)
    alpha = a[..., 3] / 255.0
    rim = np.clip(alpha * (1 - alpha) * 4, 0, 1)
    a[..., :3] *= (1 - 0.10 * rim[..., None])
    a[..., 3] = np.clip(a[..., 3] * (0.9 + 0.25 * rim), 0, 255)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def _petal(size, cx, cy, length, width, angle, color, alpha):
    lay = _layer(size)
    d = ImageDraw.Draw(lay)
    pts = []
    for t in range(41):
        u = t / 40 * math.pi
        r = length * (0.55 + 0.45 * math.sin(u))
        x = math.cos(u - math.pi / 2) * width * math.sin(u) ** 0.6
        y = -r * math.sin(u) * 0.95 if False else -length * (t / 40)
        pts.append((x, y))
    # Rounded cup-shaped petal outline
    poly = []
    for t in range(61):
        u = t / 60 * 2 * math.pi
        x = math.sin(u) * width * (0.75 + 0.25 * math.cos(u))
        y = -length * (0.5 - 0.5 * math.cos(u)) ** 0.85
        poly.append((x, y))
    ca, sa = math.cos(angle), math.sin(angle)
    d.polygon([(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in poly], fill=color + (alpha,))
    return lay


def rose(size, cx, cy, R, palette, rng):
    """Garden rose: layered cupped petals from outside in, with a deeper, spiralled heart."""
    out = _layer(size)
    base = rng.choice(palette)
    rings = [(1.0, 9, 0.0), (0.82, 8, 0.3), (0.62, 7, 0.1), (0.44, 6, 0.5), (0.28, 5, 0.2)]
    for i, (scale, n, off) in enumerate(rings):
        shade = 1 - 0.07 * i
        col = tuple(int(c * shade) for c in base)
        lay = _layer(size)
        for k in range(n):
            a = 2 * math.pi * k / n + off + rng.uniform(-0.15, 0.15)
            dist = R * scale * 0.18
            px, py = cx + math.cos(a) * dist, cy + math.sin(a) * dist
            lay = Image.alpha_composite(lay, _petal(size, px, py, R * scale * rng.uniform(0.85, 1.0),
                                                    R * scale * 0.55, a + math.pi / 2, col, rng.randint(150, 200)))
        out = Image.alpha_composite(out, _wash(lay, max(1.5, R * 0.035)))
    # Heart of the rose: a few curled strokes
    lay = _layer(size)
    d = ImageDraw.Draw(lay)
    heart = tuple(int(c * 0.78) for c in base)
    for k in range(5):
        r = R * (0.08 + 0.05 * k)
        a0 = rng.uniform(0, 360)
        d.arc([cx - r, cy - r * 0.8, cx + r, cy + r * 0.8], a0, a0 + rng.uniform(140, 220), fill=heart + (170,),
              width=max(2, int(R * 0.035)))
    out = Image.alpha_composite(out, Image.fromarray(np.clip(_blur(lay, max(1, R * 0.015)), 0, 255).astype(np.uint8)))
    return out


def blossom(size, cx, cy, r, color, center=GOLD):
    lay = _layer(size)
    d = ImageDraw.Draw(lay)
    for k in range(5):
        a = 2 * math.pi * k / 5 - math.pi / 2
        px, py = cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.55
        d.ellipse([px - r * 0.5, py - r * 0.5, px + r * 0.5, py + r * 0.5], fill=color + (210,))
    lay = _wash(lay, max(1, r * 0.08))
    d = ImageDraw.Draw(lay)
    d.ellipse([cx - r * 0.16, cy - r * 0.16, cx + r * 0.16, cy + r * 0.16], fill=center + (230,))
    return lay


def leaf(size, x, y, length, angle, color):
    lay = _layer(size)
    d = ImageDraw.Draw(lay)
    poly = []
    for t in range(31):
        u = t / 30
        w = math.sin(math.pi * u) ** 0.9 * length * 0.24 * (1 - 0.3 * u)
        poly.append((u * length, w))
    poly += [(u, -w) for u, w in reversed(poly)]
    ca, sa = math.cos(angle), math.sin(angle)
    tr = lambda px, py: (x + px * ca - py * sa, y + px * sa + py * ca)
    d.polygon([tr(px, py) for px, py in poly], fill=color + (205,))
    lay = _wash(lay, max(1, length * 0.025))
    d = ImageDraw.Draw(lay)
    vein = tuple(int(c * 0.82) for c in color)
    d.line([tr(length * 0.05, 0), tr(length * 0.85, 0)], fill=vein + (150,), width=max(1, int(length * 0.018)))
    return lay


def stem(size, pts, color=(140, 156, 118), width=3):
    lay = _layer(size)
    ImageDraw.Draw(lay).line(pts, fill=color + (200,), width=width, joint="curve")
    return Image.fromarray(np.clip(_blur(lay, 0.8), 0, 255).astype(np.uint8))


def sprig(size, x, y, length, angle, rng, color=None):
    """A stem with small leaves along it (eucalyptus/olive feel)."""
    out = _layer(size)
    pts = []
    bend = rng.uniform(-0.25, 0.25)
    for t in range(21):
        u = t / 20
        a = angle + bend * u
        pts.append((x + math.cos(a) * length * u, y + math.sin(a) * length * u))
    out = Image.alpha_composite(out, stem(size, pts, width=max(2, int(length * 0.012))))
    for i in range(2, 20, 3):
        px, py = pts[i]
        a = angle + bend * i / 20
        for side in (-1, 1):
            out = Image.alpha_composite(out, leaf(size, px, py, length * rng.uniform(0.16, 0.22),
                                                  a + side * rng.uniform(0.6, 0.9), color or rng.choice(SAGE)))
    return out


def dots(size, cx, cy, spread, n, rng, palette):
    lay = _layer(size)
    d = ImageDraw.Draw(lay)
    for _ in range(n):
        x, y = cx + rng.gauss(0, spread), cy + rng.gauss(0, spread)
        r = rng.uniform(spread * 0.03, spread * 0.06)
        d.ellipse([x - r, y - r, x + r, y + r], fill=rng.choice(palette) + (220,))
    return Image.fromarray(np.clip(_blur(lay, 0.8), 0, 255).astype(np.uint8))


def cluster(size, cx, cy, scale, seed, direction=0.0, roses=3, cream=True):
    """A bouquet: sprigs and leaves behind, roses, then blossoms and dots in front.
    `direction` (radians) is where the bouquet trails toward."""
    rng = random.Random(seed)
    out = _layer(size)
    for k in range(7):
        a = direction + rng.uniform(-1.1, 1.1)
        out = Image.alpha_composite(out, sprig(size, cx, cy, 260 * scale * rng.uniform(0.7, 1.2), a, rng))
    for k in range(8):
        a = direction + rng.uniform(-1.6, 1.6)
        r0 = 90 * scale
        out = Image.alpha_composite(out, leaf(size, cx + math.cos(a) * r0 * 0.5, cy + math.sin(a) * r0 * 0.5,
                                              140 * scale * rng.uniform(0.8, 1.2), a, rng.choice(SAGE)))
    spots = [(0, 0, 1.0)] + [(rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.55, 0.8)) for _ in range(roses - 1)]
    for i, (dx, dy, s) in enumerate(spots):
        pal = CREAM if (cream and i == 1) else BLUSH
        a = direction + dx * 1.2
        dist = 0 if i == 0 else 120 * scale
        out = Image.alpha_composite(out, rose(size, cx + math.cos(a) * dist + dy * 30 * scale,
                                              cy + math.sin(a) * dist + dx * 30 * scale, 95 * scale * s, pal, rng))
    for k in range(6):
        a = direction + rng.uniform(-1.4, 1.4)
        dist = rng.uniform(150, 260) * scale
        out = Image.alpha_composite(out, blossom(size, cx + math.cos(a) * dist, cy + math.sin(a) * dist,
                                                 rng.uniform(14, 24) * scale, rng.choice(BLUSH + DEEP)))
    out = Image.alpha_composite(out, dots(size, cx + math.cos(direction) * 170 * scale,
                                          cy + math.sin(direction) * 170 * scale, 110 * scale, 26, rng,
                                          BLUSH + [GOLD]))
    return out


def paper(size, base, seed=1, strength=7):
    """Soft paper texture in the given base color."""
    rng = np.random.default_rng(seed)
    w, h = size
    noise = rng.normal(0, 1, (h // 4 + 1, w // 4 + 1)).astype(np.float32)
    n = Image.fromarray(((noise - noise.min()) / (noise.max() - noise.min()) * 255).astype(np.uint8))
    n = n.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
    fine = Image.fromarray(rng.integers(0, 255, (h, w), dtype=np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    a = (np.asarray(n, np.float32) / 255 - 0.5) * strength + (np.asarray(fine, np.float32) / 255 - 0.5) * strength * 0.5
    img = np.empty((h, w, 3), np.float32)
    for i in range(3):
        img[..., i] = base[i] + a
    # Gentle vignette
    yy, xx = np.mgrid[0:h, 0:w]
    v = ((xx / w - 0.5) ** 2 + (yy / h - 0.5) ** 2)
    img -= (v * 18)[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
