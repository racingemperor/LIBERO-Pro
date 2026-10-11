"""Import a supplied model rollout archive; keep all audit metadata outside the site."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import zipfile

import cv2
import imageio_ffmpeg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MODELS = {'anchor-align', 'cosmos-policy'}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def resolve_entries(archive):
    tasks = {t['id']: t for t in read_json(ROOT / 'data/tasks.json')['tasks']}
    designs = read_json(ROOT / 'data/task-designs.json')['tasks']
    directions = {p.get('sourceId', p['id']): p['id'] for p in read_json(ROOT / 'data/catalogue.json')['perturbations']}
    directions['BASE'] = 'BASE'
    videos = [n for n in archive.namelist() if n.endswith('.mp4')]
    by_name = {PurePosixPath(n).name: n for n in videos}
    assert len(by_name) == len(videos), 'Ambiguous archive video names'
    entries = {}
    matched = set()
    for member in archive.namelist():
        if '/results/' not in member or not member.endswith('.json'):
            continue
        record = json.loads(archive.read(member))
        model, suite, task_id, variant = (record[k] for k in ('agent_name', 'suite', 'task_id', 'variant'))
        task = f'{suite}-{task_id}'
        assert model in MODELS and task in tasks and variant in directions
        assert record['status'] == 'completed'
        public_id = directions[variant]
        assert public_id not in designs[task]['excluded'], f'Unsupported archive combination: {task}/{public_id}'
        basename = PurePosixPath(record['video_path']).name
        pattern = re.escape(f'{model}_{suite}_task{task_id}_{variant}_') + r'seed\d+_init\d+\.mp4'
        assert re.fullmatch(pattern, basename), 'Video filename disagrees with result identity'
        video_member = by_name[basename]
        assert f'/videos/{suite}/{variant}/' in video_member
        assert member.split('/')[0] == video_member.split('/')[0]
        key = (model, task, public_id)
        assert key not in entries and video_member not in matched
        entries[key] = video_member
        matched.add(video_member)
    expected = {(model, task, variant) for model in MODELS for task in tasks
                for variant in directions.values() if variant not in designs[task]['excluded']}
    assert set(entries) == expected, 'Archive must cover each applicable task exactly once'
    assert matched == set(videos), 'Every supplied video must be mapped'
    return entries


def import_video(archive_path, review, key, member):
    model, task, variant = key
    relative = Path('assets/rollouts/models') / model / task / variant
    destination = ROOT / relative.with_suffix('.mp4')
    poster = ROOT / relative.with_suffix('.webp')
    source = review / 'source' / model / task / f'{variant}.mp4'
    source.parent.mkdir(parents=True, exist_ok=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive_path) as archive:
        source.write_bytes(archive.read(member))
    cap = cv2.VideoCapture(str(source))
    width, height = (int(cap.get(prop)) for prop in (cv2.CAP_PROP_FRAME_WIDTH, cv2.CAP_PROP_FRAME_HEIGHT))
    frames, fps = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)), cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    assert (width, height) == (640, 640) and frames > 0 and fps > 0
    # Same orientation as Document/Home: rotate 180 degrees, then mirror horizontally.
    # This is exactly one vertical flip; no resizing or speed changes.
    command = [imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-xerror', '-y',
               '-i', str(source), '-map', '0:v:0', '-vf', 'vflip', '-an', '-map_metadata', '-1',
               '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-threads', '2',
               '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(destination)]
    subprocess.run(command, check=True, capture_output=True)
    output = cv2.VideoCapture(str(destination))
    assert output.get(cv2.CAP_PROP_FPS) == fps
    decoded = 0
    while True:
        ok, frame = output.read()
        if not ok:
            break
        assert frame.shape[:2] == (640, 640)
        if decoded == 0:
            Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).save(poster, quality=82)
        decoded += 1
    output.release()
    assert decoded == frames, f'Incomplete output: {key}'
    media = {'src': relative.with_suffix('.mp4').as_posix(), 'poster': relative.with_suffix('.webp').as_posix()}
    audit = {'model': model, 'task': task, 'variant': variant, 'archiveMember': member,
             'frames': frames, 'fps': fps, 'width': width, 'height': height,
             'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
             'outputSha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
    return key, media, audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--review-dir', required=True, type=Path)
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    review = args.review_dir.resolve()
    assert not review.is_relative_to(ROOT), 'Audit files must remain outside the public site'
    with zipfile.ZipFile(args.archive) as archive:
        entries = resolve_entries(archive)
    print(f'Validated {len(entries)} videos against task applicability and public IDs.', flush=True)
    public = {'models': {}}
    audit = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = [pool.submit(import_video, args.archive, review, key, member) for key, member in entries.items()]
        for i, job in enumerate(as_completed(jobs), 1):
            (model, task, variant), media, record = job.result()
            public['models'].setdefault(model, {}).setdefault(task, {})[variant] = media
            audit.append(record)
            if i % 40 == 0 or i == len(jobs):
                print(f'{i}/{len(jobs)} corrected, fully decoded and verified', flush=True)
    (ROOT / 'data/model-rollouts.json').write_text(json.dumps(public, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    (review / 'import-audit.json').write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')
    print(f'Published media index only; {sum(r["frames"] for r in audit)} frames verified.', flush=True)


if __name__ == '__main__':
    main()
