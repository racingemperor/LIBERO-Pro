"""Fetch the explicitly sourced model imagery; preserve aspect ratios."""
import concurrent.futures
import io
import json
import urllib.request
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
        im=Image.open(io.BytesIO(response.read())).convert('RGBA')
    im.thumbnail((320,320),Image.Resampling.LANCZOS)
    im.save(path,'WEBP',quality=95)
    return asset['asset'],im.size
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    print(list(pool.map(save,{a['asset']:a for a in assets.values()}.values())))
