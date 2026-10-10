"""Render eight nominal LIBERO demonstrations from a pinned public dataset.

Requires requests, pyarrow >= 21, Pillow, numpy and imageio-ffmpeg.
Downloaded source episodes and review sheets stay outside the website.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import pyarrow.parquet as pq
import requests
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
REVISION = 'affa19c0de0f6bce2a7edd26dddef8a532e7e6f6'
SOURCE = f'https://huggingface.co/datasets/HuggingFaceVLA/libero/resolve/{REVISION}/'
DEMO_SPEEDUP = 4
# Dataset task indices differ from LIBERO suite-local IDs. Match the instruction,
# never assume the two numbering systems agree.
INSTRUCTIONS = {
    'libero_spatial-0': 'pick up the black bowl between the plate and the ramekin and place it on the plate',
    'libero_spatial-8': 'pick up the black bowl next to the plate and place it on the plate',
    'libero_object-1': 'pick up the cream cheese and place it in the basket',
    'libero_object-8': 'pick up the chocolate pudding and place it in the basket',
    'libero_goal-3': 'open the top drawer and put the bowl inside',
    'libero_goal-6': 'put the cream cheese in the bowl',
    'libero_10-5': 'pick up the book and place it in the back compartment of the caddy',
    'libero_10-8': 'put both moka pots on the stove',
}
# Reviewed episodes from OpenVLA's success-only demonstration conversion.
# The LeRobot files omit reward/done; provenance and visual completion checks
# are documented in assets/rollouts/base/README.md. Pin bytes as well as IDs so
# a later rebuild cannot silently substitute an unreviewed demonstration.
REVIEWED_EPISODES = {
    'libero_spatial-0': (1272, 'b5a7fc668444ec03895d3f3fe2b2933ca2da98f0640d899e73800ca5eb26d68d'),
    'libero_spatial-8': (1280, '0b54a2ab955f0edb2cb878b1bd83fffb746d970312779f332a609ded761a9f1a'),
    'libero_object-1': (810, 'fff48910567fefc814a7edd33be1d90dcf058326fbf7728c8c0167c70414497c'),
    'libero_object-8': (823, 'a3817c584a80aa27df1cb485035bc872a3afeae5f822c5a84d84f9cb83160215'),
    'libero_goal-3': (382, '45062a8f1b46540e5903934bce767a0fd8a77fb94343462fb72a4582951711d3'),
    'libero_goal-6': (384, '468267eadcad3c6ebda92f96c88abcbe3ce9eb3d1c7a9188a5f1764ab403af3e'),
    'libero_10-5': (27, 'b15b4afdaa7bf4c31e627d85e705b52bbb912eb628bc3a7c2915c7de57144833'),
    'libero_10-8': (10, '4214069fdee3750a0b98a6bb6b21728fa472899a3ff2c0d1c1bb94350e3e5574'),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review-dir', type=Path, required=True)
    args = parser.parse_args()
    review = args.review_dir.resolve()
    if review == ROOT or ROOT in review.parents:
        parser.error('--review-dir must be outside the public repository')
    review.mkdir(parents=True, exist_ok=True)
    output = ROOT / 'assets/rollouts/base'
    output.mkdir(parents=True, exist_ok=True)
    session = requests.Session()

    def download(name):
        destination = review / name
        if not destination.exists():
            response = session.get(SOURCE + name, timeout=60)
            response.raise_for_status()
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(response.content)
        return destination.read_bytes()

    info = json.loads(download('meta/info.json'))
    episodes = [json.loads(line) for line in download('meta/episodes.jsonl').decode().splitlines()]
    episodes_by_index = {episode['episode_index']: episode for episode in episodes}
    tasks = [json.loads(line) for line in download('meta/tasks.jsonl').decode().splitlines()]
    task_indices = {task['task']: task['task_index'] for task in tasks}
    contact = Image.new('RGB', (4 * 192, 8 * 220), 'white')
    draw = ImageDraw.Draw(contact)
    audit = []
    for row, (task_id, instruction) in enumerate(INSTRUCTIONS.items()):
        index, reviewed_sha256 = REVIEWED_EPISODES[task_id]
        episode = episodes_by_index[index]
        if episode['tasks'] != [instruction]:
            raise ValueError(f'{task_id}: reviewed episode instruction changed')
        name = info['data_path'].format(episode_chunk=index // info['chunks_size'], episode_index=index)
        raw = download(name)
        source_sha256 = hashlib.sha256(raw).hexdigest()
        if source_sha256 != reviewed_sha256:
            raise ValueError(f'{task_id}: reviewed episode checksum mismatch')
        table = pq.read_table(io.BytesIO(raw), columns=['observation.images.image', 'task_index', 'episode_index', 'frame_index'])
        assert table.num_rows == episode['length']
        assert set(table['task_index'].to_pylist()) == {task_indices[instruction]}
        assert set(table['episode_index'].to_pylist()) == {index}
        assert table['frame_index'].to_pylist() == list(range(table.num_rows))
        frames = [Image.open(io.BytesIO(value['bytes'])).convert('RGB') for value in table['observation.images.image'].to_pylist()]
        assert all(frame.size == (256, 256) for frame in frames)
        target = output / f'{task_id}.mp4'
        # Use the same speedup for every task and retain every source frame.
        output_fps = info['fps'] * DEMO_SPEEDUP
        writer = imageio_ffmpeg.write_frames(str(target), (256, 256), fps=output_fps, codec='libx264',
            pix_fmt_out='yuv420p', ffmpeg_log_level='error', output_params=['-crf', '20', '-movflags', '+faststart'])
        writer.send(None)
        try:
            for frame in frames:
                writer.send(np.asarray(frame))
        finally:
            writer.close()
        frames[0].save(output / f'{task_id}.webp', quality=88)
        draw.text((8, row * 220 + 5), task_id, fill='black')
        for col, fraction in enumerate([0, .33, .66, 1]):
            contact.paste(frames[round((len(frames) - 1) * fraction)].resize((192, 192)), (col * 192, row * 220 + 24))
        audit.append({'task': task_id, 'instruction': instruction, 'episode': index, 'source': SOURCE + name,
                      'sourceSha256': source_sha256, 'successBasis': 'upstream-success-filter-and-visual-review',
                      'sourceFrames': len(frames), 'sourceFps': info['fps'],
                      'sourceDuration': len(frames) / info['fps'], 'frames': len(frames), 'fps': output_fps,
                      'duration': len(frames) / output_fps, 'speedup': DEMO_SPEEDUP, 'rotationDegrees': 0})
        print(f'{task_id}: {len(frames)} frames, {len(frames) / output_fps:.3f}s, {DEMO_SPEEDUP}x', flush=True)
    contact.save(review / 'contact.jpg', quality=92)
    (review / 'source-audit.json').write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
