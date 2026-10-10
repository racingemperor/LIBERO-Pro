"""Validate and publish eight native 640px successful X-VLA demonstrations.

Requires OpenCV, Pillow and numpy. The review directory contains selected
task JSON records plus their videos, posters and private simulation traces.
No evaluation records or traces are copied into the public website.
"""
import argparse
import json
import math
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEEDUP = 4
SIZE = (640, 640)
SOURCE_INSTRUCTIONS = {
    'libero_spatial-0': 'pick up the black bowl between the plate and the ramekin and place it on the plate',
    'libero_spatial-8': 'pick up the black bowl next to the plate and place it on the plate',
    'libero_object-1': 'pick up the cream cheese and place it in the basket',
    'libero_object-8': 'pick up the chocolate pudding and place it in the basket',
    'libero_goal-3': 'open the top drawer and put the bowl inside',
    'libero_goal-6': 'put the cream cheese in the bowl',
    'libero_10-5': 'pick up the book and place it in the back compartment of the caddy',
    'libero_10-8': 'put both moka pots on the stove',
}


def source_file(review, name):
    path = (review / name).resolve()
    if review not in path.parents or not path.is_file():
        raise ValueError(f'Invalid external source file: {name}')
    return path


def validate(review, task):
    task_id = task['id']
    record = json.loads((review / f'{task_id}.json').read_text(encoding='utf-8'))
    # Match simulator language exactly; website BDDL instructions use some aliases.
    expected = SOURCE_INSTRUCTIONS[task_id]
    required = {
        'task': task_id, 'instruction': expected, 'model': 'lerobot/xvla-libero',
        'variant': 'BASE', 'camera_width': 640, 'camera_height': 640,
        'control_hz': 20, 'fps': 80, 'speedup': SPEEDUP,
    }
    for key, value in required.items():
        if record.get(key) != value:
            raise ValueError(f'{task_id}: unexpected {key}')
    for key in ('success', 'terminal_success', 'native_render'):
        if record.get(key) is not True:
            raise ValueError(f'{task_id}: missing {key} evidence')
    video = source_file(review, record['video'])
    poster = source_file(review, record['poster'])
    trace_path = source_file(review, str(Path(record['video']).with_suffix('.npz')))
    with np.load(trace_path, allow_pickle=False) as trace:
        checks = trace['success_checks']
        if (len(checks) != record['steps'] or checks.dtype != np.bool_
                or not checks[-1] or checks[:-1].any()
                or len(trace['actions']) != record['steps']
                or len(trace['states']) != record['steps'] + 1):
            raise ValueError(f'{task_id}: inconsistent simulator success trace')
    if record['frames'] != record['steps'] + 1:
        raise ValueError(f'{task_id}: incomplete action sequence')
    with Image.open(poster) as image:
        if image.size != SIZE:
            raise ValueError(f'{task_id}: poster must be 640 x 640')
    capture = cv2.VideoCapture(str(video))
    try:
        fps = capture.get(cv2.CAP_PROP_FPS)
        if not capture.isOpened() or not math.isclose(fps, record['fps'], abs_tol=.01):
            raise ValueError(f'{task_id}: invalid video or unequal speedup')
        frames = 0
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame.shape != (640, 640, 3):
                raise ValueError(f'{task_id}: video is not 640 x 640')
            frames += 1
        if frames != record['frames']:
            raise ValueError(f'{task_id}: video frame count mismatch')
    finally:
        capture.release()
    print(f'{task_id}: success verified, 640x640, {frames} frames, {frames/fps:.3f}s, {SPEEDUP}x')
    return task_id, video, poster


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review-dir', type=Path, required=True)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    review = args.review_dir.resolve()
    if review == ROOT or ROOT in review.parents:
        parser.error('--review-dir must be outside the public repository')
    tasks = json.loads((ROOT/'data/tasks.json').read_text(encoding='utf-8'))['tasks']
    # Validate the complete set before replacing any public media.
    selected = [validate(review, task) for task in tasks]
    if not args.check_only:
        output = ROOT / 'assets/rollouts/base'
        for task_id, video, poster in selected:
            shutil.copyfile(video, output/f'{task_id}.mp4')
            shutil.copyfile(poster, output/f'{task_id}.webp')


if __name__ == '__main__':
    main()
