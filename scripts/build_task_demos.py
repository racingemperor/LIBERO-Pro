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
    tasks = [json.loads(line) for line in download('meta/tasks.jsonl').decode().splitlines()]
    task_indices = {task['task']: task['task_index'] for task in tasks}
    contact = Image.new('RGB', (4 * 192, 8 * 220), 'white')
    draw = ImageDraw.Draw(contact)
    audit = []
    for row, (task_id, instruction) in enumerate(INSTRUCTIONS.items()):
        episode = min((e for e in episodes if e['tasks'] == [instruction]), key=lambda e: e['episode_index'])
        index = episode['episode_index']
        name = info['data_path'].format(episode_chunk=index // info['chunks_size'], episode_index=index)
        raw = download(name)
        table = pq.read_table(io.BytesIO(raw), columns=['observation.images.image', 'task_index', 'episode_index', 'frame_index'])
        assert table.num_rows == episode['length']
        assert set(table['task_index'].to_pylist()) == {task_indices[instruction]}
        assert set(table['episode_index'].to_pylist()) == {index}
        assert table['frame_index'].to_pylist() == list(range(table.num_rows))
        frames = [Image.open(io.BytesIO(value['bytes'])).convert('RGB') for value in table['observation.images.image'].to_pylist()]
        assert all(frame.size == (256, 256) for frame in frames)
        target = output / f'{task_id}.mp4'
        writer = imageio_ffmpeg.write_frames(str(target), (256, 256), fps=info['fps'], codec='libx264',
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
                      'sourceSha256': hashlib.sha256(raw).hexdigest(), 'frames': len(frames), 'fps': info['fps'],
                      'duration': len(frames) / info['fps'], 'rotationDegrees': 0})
        print(f'{task_id}: {len(frames)} frames, {len(frames) / info["fps"]:.1f}s', flush=True)
    contact.save(review / 'contact.jpg', quality=92)
    (review / 'source-audit.json').write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
