#!/usr/bin/env python3
"""Create a lightweight, legible WhatsApp/OpenGraph card from the approved SST TV artwork."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sst-tv" / "Equipo de Seguridad La Movida SST+.png"
DEST = ROOT / "sst-tv" / "og-sst-tv-20261113.jpg"
W, H = 1200, 630

if not SOURCE.is_file():
    raise SystemExit("Missing approved SST TV image: " + str(SOURCE))
image = ImageOps.fit(Image.open(SOURCE).convert("RGB"), (W, H), Image.Resampling.LANCZOS, centering=(.52,.50)).convert("RGBA")
overlay = Image.new("RGBA", (W,H))
fade = ImageDraw.Draw(overlay)
for x in range(W):
    strength = max(0, min(1, (735-x)/545))
    fade.line([(x,0),(x,H)], fill=(0,28,63,int(158*strength)))
image = Image.alpha_composite(image, overlay)
draw = ImageDraw.Draw(image)
bold_file = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
regular_file = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
def font(size, bold=True):
    return ImageFont.truetype(bold_file if bold else regular_file, size)
draw.rounded_rectangle((65,92,385,136), radius=22, fill=(10,88,104,230), outline=(190,237,231,120), width=2)
draw.text((85,101), "LA MOVIDA DE SST+", font=font(19), fill="white")
draw.text((61,182), "SST", font=font(112), fill="white", stroke_width=2, stroke_fill=(0,36,64,140))
draw.text((335,182), "TV", font=font(112), fill="#ffb600", stroke_width=2, stroke_fill=(0,36,64,140))
draw.rounded_rectangle((66,337,501,344), radius=3, fill="#ffb600")
draw.text((65,368), "VIDEOS · CONFERENCIAS", font=font(29), fill="white")
draw.text((65,411), "SEGURIDAD Y SALUD", font=font(29), fill="white")
draw.text((65,454), "EN EL TRABAJO", font=font(29), fill="white")
draw.text((65,548), "De la Reacción a la Prevención", font=font(19,False), fill=(240,250,249,255))
image.convert("RGB").save(DEST, quality=82, optimize=True, progressive=True, subsampling=0)
size = DEST.stat().st_size
if size > 350_000:
    raise SystemExit(f"Preview JPG too large: {size} bytes")
print(f"Generated {DEST} ({size} bytes; {W}x{H})")
