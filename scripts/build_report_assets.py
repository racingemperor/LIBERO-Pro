"""Create a compact thumbnail from the original project's public overview figure."""
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://raw.githubusercontent.com/Zxy-MLlab/LIBERO-PRO/master/images/overall.png"
with urlopen(SOURCE, timeout=30) as response:
    overview = Image.open(BytesIO(response.read())).convert("RGB")
overview.thumbnail((640, 360), Image.Resampling.LANCZOS)
canvas = Image.new("RGB", (640, 360), "white")
canvas.paste(overview, ((640 - overview.width) // 2, (360 - overview.height) // 2))
canvas.save(ROOT / "assets/paper/libero-pro-original.webp", quality=88)
