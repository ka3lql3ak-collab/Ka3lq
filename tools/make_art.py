"""Render the watercolor artwork used by the book into assets/ (slow; run once, results are committed)."""
import math, pathlib, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from florals import bouquet, single, trim

OUT = ROOT / "assets"
OUT.mkdir(exist_ok=True)


def save(img, name):
    img = trim(img)
    img.save(OUT / f"{name}.png", optimize=True)
    print(name, img.size)


if __name__ == "__main__":
    # Lush bouquet anchored top-left, trailing down-right (flipped for the other corners).
    S = (1500, 1500)
    save(bouquet(S, 430, 430, 2.0, 3, math.pi / 4), "bouquet_big")
    save(bouquet(S, 430, 430, 1.9, 11, math.pi / 4, kinds=("cream", "blush", "pink", "peach")), "bouquet_big2")
    # Lighter corner spray for interior pages.
    S = (900, 900)
    save(bouquet(S, 260, 260, 1.0, 21, math.pi / 4, spread=1.1, kinds=("blush", "cream")), "corner")
    save(bouquet(S, 260, 260, 0.85, 8, math.pi / 4, spread=1.0, kinds=("pink",)), "corner_small")
    # Centred ornament above page titles.
    S = (500, 300)
    save(single(S, 250, 150, 1.6, 4, "blush"), "ornament")
