"""Rebuild the ICO fallback from assets/favicon.svg (PyMuPDF and Pillow)."""

from io import BytesIO
from pathlib import Path

import fitz
from PIL import Image


def main():
    assets = Path(__file__).resolve().parents[1] / "assets"
    with fitz.open(assets / "favicon.svg") as document:
        pixels = document[0].get_pixmap(matrix=fitz.Matrix(4, 4), alpha=True)
    with Image.open(BytesIO(pixels.tobytes("png"))) as icon:
        icon.save(assets / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == "__main__":
    main()
