"""Procedural watercolor florals (garden roses, blossoms, leaves, sprigs) for the journal artwork.

All painters draw onto transparent RGBA canvases; `bouquet()` arranges a corner cluster.
"""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROSES = {
    "blush": ((222, 128, 140), (247, 200, 196)),   # (heart color, petal-edge color)
    "pink": ((208, 108, 124), (240, 178, 182)),
    "cream": ((228, 186, 160), (253, 241, 226)),
    "peach": ((226, 150, 140), (250, 214, 200)),
}
SAGE = [(126, 148, 112), (150, 168, 128), (108, 132, 98), (170, 184, 146)]
BLOSSOM = [(242, 190, 192), (236, 170, 178), (248, 214, 210), (230, 156, 166)]
GOLD = (200, 164, 102)


def blank(size):
    return Image.new("RGBA", size, (0, 0, 0, 0))


def _soft(img, r):
    """Premultiplied blur so soft edges keep their color instead of greying."""
    if r <= 0:
        return img
    a = np.asarray(img).astype(np.float32)
    al = a[..., 3:4] / 255.0
    pm = np.concatenate([a[..., :3] * al, a[..., 3:4]], axis=2)
    chans = [np.asarray(Image.fromarray(np.clip(pm[..., i], 0, 255).astype(np.uint8))
                        .filter(ImageFilter.GaussianBlur(r))).astype(np.float32) for i in range(4)]
    b = np.stack(chans, axis=2)
    alpha = np.maximum(b[..., 3:4] / 255.0, 1e-3)
    rgb = np.where(b[..., 3:4] > 0.5, b[..., :3] / alpha, 0)
    return Image.fromarray(np.clip(np.concatenate([rgb, b[..., 3:4]], axis=2), 0, 255).astype(np.uint8))


def _fill(size, mask, color_fn, alpha=1.0):
    """Paint a mask with a per-pixel color field color_fn(xx, yy) -> HxWx3."""
    m = np.asarray(mask).astype(np.float32) / 255.0
    ys, xs = np.nonzero(m)
    out = np.zeros((size[1], size[0], 4), np.float32)
    if len(xs) == 0:
        return Image.fromarray(out.astype(np.uint8))
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    out[y0:y1, x0:x1, :3] = color_fn(xx, yy)
    out[..., 3] = m * 255 * alpha
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def _mix(c1, c2, t):
    t = np.clip(t, 0, 1)[..., None]
    return np.array(c1, np.float32) * (1 - t) + np.array(c2, np.float32) * t


def _petal_poly(cx, cy, length, width, angle, wobble, rng):
    pts = []
    for k in range(48):
        u = 2 * math.pi * k / 48
        # Broad, rounded petal: wide at the outer edge, narrow at the base.
        x = math.sin(u) * width * (0.62 + 0.38 * (1 - math.cos(u)) / 2)
        y = length * (1 - math.cos(u)) / 2
        y += math.sin(u * 3 + wobble) * length * 0.03 * ((1 - math.cos(u)) / 2)
        pts.append((x, y))
    ca, sa = math.cos(angle), math.sin(angle)
    return [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]


def rose(size, cx, cy, R, kind="blush", seed=0):
    """Garden rose seen from above: an open outer ring, a cupped middle and a swirled heart."""
    rng = random.Random(seed)
    heart, edge = ROSES[kind]
    out = blank(size)
    field = lambda xx, yy: _mix(heart, edge, (np.hypot(xx - cx, yy - cy) / R) ** 0.8)
    rings = [(1.00, 7, 0.0, 1.00), (0.80, 6, 0.45, 0.97), (0.60, 5, 0.1, 0.94), (0.42, 5, 0.6, 0.90),
             (0.27, 4, 0.2, 0.86)]
    for scale, n, off, shade in rings:
        for k in range(n):
            a = 2 * math.pi * k / n + off + rng.uniform(-0.12, 0.12)
            length = R * scale * rng.uniform(0.92, 1.04)
            poly = _petal_poly(cx, cy, length, length * 0.62, a - math.pi / 2, rng.uniform(0, 6), rng)
            mask = Image.new("L", size, 0)
            ImageDraw.Draw(mask).polygon(poly, fill=255)
            f = lambda xx, yy, s=shade: field(xx, yy) * s
            petal = _fill(size, mask, f, 0.93)
            # A slightly deeper rim where watercolor pigment pools.
            rim = blank(size)
            ImageDraw.Draw(rim).line(poly + [poly[0]], fill=tuple(int(c * 0.84) for c in heart) + (105,),
                                     width=max(1, int(R * 0.018)))
            petal = Image.alpha_composite(petal, _soft(rim, R * 0.008))
            out = Image.alpha_composite(out, _soft(petal, R * 0.01))
    d = ImageDraw.Draw(out)
    deep = tuple(int(c * 0.72) for c in heart)
    for k in range(4):
        r = R * (0.04 + 0.04 * k)
        a0 = rng.uniform(0, 360)
        d.arc([cx - r, cy - r * 0.85, cx + r, cy + r * 0.85], a0, a0 + rng.uniform(150, 230),
              fill=deep + (120,), width=max(1, int(R * 0.022)))
    return out


def leaf(size, x, y, length, angle, color):
    mask = Image.new("L", size, 0)
    pts = []
    for t in range(41):
        u = t / 40
        w = math.sin(math.pi * u) ** 0.85 * length * 0.23 * (1 - 0.25 * u)
        pts.append((u * length, w))
    pts += [(u, -w) for u, w in reversed(pts)]
    ca, sa = math.cos(angle), math.sin(angle)
    tr = lambda px, py: (x + px * ca - py * sa, y + px * sa + py * ca)
    ImageDraw.Draw(mask).polygon([tr(px, py) for px, py in pts], fill=255)
    dark = tuple(int(c * 0.85) for c in color)
    light = tuple(min(255, int(c * 1.12)) for c in color)

    def field(xx, yy):
        along = ((xx - x) * ca + (yy - y) * sa) / length
        return _mix(dark, light, along)

    lay = _fill(size, mask, field, 0.9)
    ImageDraw.Draw(lay).line([tr(length * 0.04, 0), tr(length * 0.82, 0)], fill=light + (150,),
                             width=max(1, int(length * 0.015)))
    return _soft(lay, max(0.6, length * 0.008))


def stem(size, pts, width, color=(132, 150, 112)):
    lay = blank(size)
    ImageDraw.Draw(lay).line(pts, fill=color + (210,), width=width, joint="curve")
    return _soft(lay, 0.7)


def sprig(size, x, y, length, angle, rng, leaf_scale=0.2):
    """Eucalyptus-style stem with paired leaves."""
    out = blank(size)
    bend = rng.uniform(-0.35, 0.35)
    pts = [(x + math.cos(angle + bend * t / 24) * length * t / 24, y + math.sin(angle + bend * t / 24) * length * t / 24)
           for t in range(25)]
    out = Image.alpha_composite(out, stem(size, pts, max(2, int(length * 0.01))))
    for i in range(3, 25, 4):
        px, py = pts[i]
        a = angle + bend * i / 24
        s = leaf_scale * (1.15 - 0.4 * i / 24)
        for side in (-1, 1):
            out = Image.alpha_composite(out, leaf(size, px, py, length * s * rng.uniform(0.85, 1.1),
                                                  a + side * rng.uniform(0.55, 0.85), rng.choice(SAGE)))
    return out


def blossom(size, cx, cy, r, color):
    lay = blank(size)
    d = ImageDraw.Draw(lay)
    for k in range(5):
        a = 2 * math.pi * k / 5 - math.pi / 2
        px, py = cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.55
        d.ellipse([px - r * 0.48, py - r * 0.48, px + r * 0.48, py + r * 0.48], fill=color + (225,))
    lay = _soft(lay, max(0.6, r * 0.05))
    ImageDraw.Draw(lay).ellipse([cx - r * 0.17, cy - r * 0.17, cx + r * 0.17, cy + r * 0.17], fill=GOLD + (235,))
    return lay


def filler(size, x, y, length, angle, rng):
    """Thin stem ending in tiny blossoms and buds (wax flower / baby's breath feel)."""
    out = blank(size)
    bend = rng.uniform(-0.4, 0.4)
    pts = [(x + math.cos(angle + bend * t / 16) * length * t / 16, y + math.sin(angle + bend * t / 16) * length * t / 16)
           for t in range(17)]
    out = Image.alpha_composite(out, stem(size, pts, max(1, int(length * 0.008)), (150, 160, 120)))
    for i in (8, 12, 16):
        px, py = pts[i]
        out = Image.alpha_composite(out, blossom(size, px, py, length * rng.uniform(0.05, 0.08), rng.choice(BLOSSOM)))
    return out


def bouquet(size, cx, cy, scale, seed, direction, spread=1.3, kinds=("blush", "cream", "pink")):
    """Corner bouquet centred at (cx, cy), trailing toward `direction` (radians)."""
    rng = random.Random(seed)
    out = blank(size)
    for _ in range(7):
        a = direction + rng.uniform(-spread, spread)
        out = Image.alpha_composite(out, sprig(size, cx, cy, 300 * scale * rng.uniform(0.75, 1.15), a, rng))
    for _ in range(9):
        a = direction + rng.uniform(-spread * 1.2, spread * 1.2)
        out = Image.alpha_composite(out, leaf(size, cx + math.cos(a) * 40 * scale, cy + math.sin(a) * 40 * scale,
                                              150 * scale * rng.uniform(0.8, 1.2), a, rng.choice(SAGE)))
    for _ in range(6):
        a = direction + rng.uniform(-spread, spread)
        out = Image.alpha_composite(out, filler(size, cx, cy, 260 * scale * rng.uniform(0.8, 1.2), a, rng))
    places = [(0, 0, 1.0)]
    for i in range(1, len(kinds)):
        a = direction + (-1) ** i * rng.uniform(0.5, 0.9)
        places.append((math.cos(a) * 125 * scale, math.sin(a) * 125 * scale, rng.uniform(0.62, 0.78)))
    for (dx, dy, s), kind in sorted(zip(places, kinds), key=lambda p: p[0][2]):
        out = Image.alpha_composite(out, rose(size, cx + dx, cy + dy, 110 * scale * s, kind, rng.randint(0, 999)))
    for _ in range(5):
        a = direction + rng.uniform(-spread, spread)
        dist = rng.uniform(150, 230) * scale
        out = Image.alpha_composite(out, blossom(size, cx + math.cos(a) * dist, cy + math.sin(a) * dist,
                                                 rng.uniform(13, 20) * scale, rng.choice(BLOSSOM)))
    return out


def single(size, cx, cy, scale, seed=5, kind="blush"):
    """Small centred ornament: one rose with a leaf on each side."""
    out = blank(size)
    for side in (-1, 1):
        out = Image.alpha_composite(out, leaf(size, cx + side * 30 * scale, cy + 6 * scale, 120 * scale,
                                              math.pi / 2 - side * (math.pi / 2 + 0.25), SAGE[side % 2]))
    return Image.alpha_composite(out, rose(size, cx, cy, 52 * scale, kind, seed))


def paper(size, base, seed=1, strength=6, vignette=14):
    rng = np.random.default_rng(seed)
    w, h = size
    coarse = rng.normal(0, 1, (h // 6 + 1, w // 6 + 1)).astype(np.float32)
    n = Image.fromarray(((coarse - coarse.min()) / (np.ptp(coarse)) * 255).astype(np.uint8))
    n = np.asarray(n.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(4)), np.float32) / 255 - 0.5
    fine = np.asarray(Image.fromarray(rng.integers(0, 255, (h, w), dtype=np.uint8))
                      .filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255 - 0.5
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    v = (xx / w - 0.5) ** 2 + (yy / h - 0.5) ** 2
    img = np.array(base, np.float32)[None, None, :] + (n * strength + fine * strength * 0.6)[..., None] \
        - (v * vignette)[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def trim(img, pad=6):
    box = img.getbbox()
    if not box:
        return img
    l, t, r, b = box
    return img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r + pad), min(img.height, b + pad)))
