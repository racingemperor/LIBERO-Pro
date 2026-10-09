"""Fetch the explicitly sourced model imagery; preserve aspect ratios."""
import concurrent.futures
import io
import json
import urllib.request
from urllib.parse import urlparse
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
assets=json.loads((root/'data/model-assets.json').read_text(encoding='utf-8'))
def save(asset):
    path=root/'assets/models'/asset['asset']
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return asset['asset'], 'cached'
    with urllib.request.urlopen(urllib.request.Request(asset['source'],headers={'User-Agent':'Mozilla/5.0'}),timeout=40) as response:
        payload=response.read()
    if urlparse(asset['source']).path.lower().endswith('.svg'):
        import fitz
        with fitz.open(stream=payload,filetype='svg') as document:
            page=document[0]
            scale=min(320/page.rect.width,320/page.rect.height)
            pixels=page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=True)
            im=Image.open(io.BytesIO(pixels.tobytes('png'))).convert('RGBA')
    else:
        im=Image.open(io.BytesIO(payload)).convert('RGBA')
    im.thumbnail((320,320),Image.Resampling.LANCZOS)
    im.save(path,'WEBP',quality=95)
    return asset['asset'],im.size
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    print(list(pool.map(save,{a['asset']:a for a in assets.values() if a['asset']}.values())))
