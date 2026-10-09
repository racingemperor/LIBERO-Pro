"""Make transparent Home strips from the six existing paper illustrations.

Keep all four panels, their aspect ratio and in-panel scientific annotations.
Only the surrounding paper headings, white margins and gutters are omitted.
Document continues to use the unmodified illustrations.
"""
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = {"S01": 64, "S13": 64, "S22": 64,
            "D01": 82, "D04": 82, "D18": 82}


def build():
    destination = ROOT / "assets" / "home-examples"
    destination.mkdir(exist_ok=True)
    for identifier, top in EXAMPLES.items():
        with Image.open(ROOT / "assets" / "perturbations" / f"{identifier}.webp") as source:
            expected_height = 492 if identifier.startswith("S") else 510
            if source.size != (1760, expected_height):
                raise ValueError(f"Unexpected paper layout for {identifier}: {source.size}")
            strip = Image.new("RGBA", (1740, 420), (0, 0, 0, 0))
            for column in range(4):
                left = 10 + column * 440
                panel = source.crop((left, top, left + 420, top + 420))
                strip.paste(panel, (column * 440, 0))
            strip.save(destination / f"{identifier}.webp", "WEBP", lossless=True)
            print(f"{identifier}: 1740 x 420, transparent gutters")


if __name__ == "__main__":
    build()
