"""Create horizontally mirrored Document demonstrations from the public Home clips.

Requires OpenCV, Pillow, NumPy and imageio-ffmpeg. Source media stays unchanged.
The external review directory receives comparison sheets and a conversion audit.
"""
import argparse
import json
from pathlib import Path
import subprocess

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'assets/rollouts/documents'


def verify_mirror(source, output):
    original, mirrored = cv2.VideoCapture(str(source)), cv2.VideoCapture(str(output))
    try:
        if not original.isOpened() or not mirrored.isOpened():
            raise ValueError(f'Unable to open video: {output.name}')
        fps = original.get(cv2.CAP_PROP_FPS)
        if abs(fps - mirrored.get(cv2.CAP_PROP_FPS)) > 0.001:
            raise ValueError(f'Frame rate changed: {output.name}')
        count, maximum_error = 0, 0.0
        while True:
            left_ok, left = original.read()
            right_ok, right = mirrored.read()
            if left_ok != right_ok:
                raise ValueError(f'Frame count changed: {output.name}')
            if not left_ok:
                break
            if left.shape != right.shape:
                raise ValueError(f'Frame dimensions changed: {output.name}')
            error = float(np.abs(cv2.flip(left, 1).astype(np.float32) - right).mean())
            maximum_error = max(maximum_error, error)
            count += 1
        if not count or maximum_error > 5:
            raise ValueError(f'Mirror verification failed: {output.name}, error={maximum_error}')
        return {'frames': count, 'fps': fps, 'duration': count / fps,
                'maximumMeanPixelError': round(maximum_error, 3)}
    finally:
        original.release()
        mirrored.release()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review-dir', required=True, type=Path)
    args = parser.parse_args()
    review = args.review_dir.resolve()
    if review == ROOT or ROOT in review.parents:
        parser.error('--review-dir must be outside the public repository')
    catalogue = json.loads((ROOT / 'data/catalogue.json').read_text(encoding='utf-8'))['perturbations']
    clips = json.loads((ROOT / 'data/home-rollouts.json').read_text(encoding='utf-8'))['clips']
    by_id = {clip['perturbation']: clip for clip in clips}
    if len(clips) != len(catalogue) or set(by_id) != {p['id'] for p in catalogue}:
        raise ValueError('Every perturbation must have exactly one Home clip')
    DESTINATION.mkdir(parents=True, exist_ok=True)
    review.mkdir(parents=True, exist_ok=True)
    audit = []
    sheets = []
    for index, perturbation in enumerate(catalogue):
        identifier = perturbation['id']
        clip = by_id[identifier]
        source = ROOT / clip['src']
        output = DESTINATION / f'{identifier}.mp4'
        subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error',
            '-y', '-i', str(source), '-map', '0:v:0', '-map_metadata', '-1',
            '-an', '-vf', 'hflip', '-c:v', 'libx264', '-preset', 'slow',
            '-crf', '18', '-threads', '2', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', str(output),
        ], check=True)
        with Image.open(ROOT / clip['poster']) as original_poster:
            poster = ImageOps.mirror(original_poster.convert('RGB'))
        poster.save(DESTINATION / f'{identifier}.webp', lossless=True)
        audit.append({'perturbation': identifier, **verify_mirror(source, output)})
        if index % 7 == 0:
            sheets.append(Image.new('RGB', (1400, 7 * 270), 'white'))
        sheet, top = sheets[-1], (index % 7) * 270
        ImageDraw.Draw(sheet).text((8, top + 5), f'{identifier} - mirrored video | paper illustration', fill='black')
        sheet.paste(poster.resize((232, 232)), (8, top + 28))
        with Image.open(ROOT / perturbation['image']) as figure:
            preview = ImageOps.contain(figure.convert('RGB'), (1140, 235))
        sheet.paste(preview, (252, top + 28 + (235 - preview.height) // 2))
        print(f'{identifier}: mirrored {audit[-1]["frames"]} frames', flush=True)
    for index, sheet in enumerate(sheets, 1):
        sheet.save(review / f'mirror-comparison-{index}.jpg', quality=92)
    (review / 'mirror-audit.json').write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')
    print(f'Completed {len(audit)} clips; all frames verified against their horizontal mirror.')


if __name__ == '__main__':
    main()
