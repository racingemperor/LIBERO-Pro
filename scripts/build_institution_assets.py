"""Build compact Home affiliation logos from the universities' official marks."""
import json
from io import BytesIO
from pathlib import Path

import fitz
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
institutions = json.loads((ROOT / "data/people.json").read_text(encoding="utf-8"))["affiliations"]

for institution in institutions:
    response = requests.get(institution["source"], headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    response.raise_for_status()
    if institution["source"].endswith(".svg"):
        # The official reversed mark needs a dark foreground on our white page.
        svg = response.content.replace(b"#FFFFFF", b"#002A5C").replace(b"#fff", b"#173B62")
        with fitz.open(stream=svg, filetype="svg") as document:
            png = document[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=True).tobytes("png")
        image = Image.open(BytesIO(png)).convert("RGBA")
    else:
        image = Image.open(BytesIO(response.content)).convert("RGBA")
    if institution["id"] in {"hust", "tsinghua"}:
        # Preserve the official silhouette and antialiasing, changing only white ink.
        ink = Image.new("RGBA", image.size, "#66318C" if institution["id"] == "tsinghua" else "#173B62")
        ink.putalpha(image.getchannel("A"))
        image = ink
    # Equal CSS heights should describe the visible mark, not transparent margins.
    bounds = image.getchannel("A").getbbox()
    if bounds:
        image = image.crop(bounds)
    image.thumbnail((480, 192), Image.Resampling.LANCZOS)
    target = ROOT / institution["logo"]
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", lossless=True)
    print(f"{institution['id']}: {image.width}x{image.height}")
