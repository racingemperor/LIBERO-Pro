"""Incrementally import rollout archives, keeping audits and staging outside the site."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import zipfile

import cv2
import imageio_ffmpeg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MODEL_ALIASES = {
    'anchor-align': 'anchor-align', 'cosmos-policy': 'cosmos-policy',
    'GR00T-N1.7-LIBERO': 'gr00t-n1-7', 'pi05': 'pi0-5', 'xVLA': 'xvla',
    'MolmoAct2-LIBERO': 'molmoact2', 'OpenVLA-OFT-RIPT': 'ript-vla', 'pi0': 'pi0',
    'openvla_oft_m': 'openvla-oft-m',
}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def resolve_front_records(archive, records, tasks, designs, directions, selected_models):
    entries, matched = {}, set()
    videos = set()
    for name in archive.namelist():
        parts = PurePosixPath(name).parts
        if len(parts) > 1 and parts[0] == 'videos' and name.endswith('.mp4'):
            if selected_models is None or MODEL_ALIASES.get(parts[1]) in selected_models:
                videos.add(name)
    for member in records:
        parts = PurePosixPath(member).parts
        assert len(parts) == 4, 'Unknown front-record layout'
        alias = parts[1]
        if selected_models is not None and MODEL_ALIASES.get(alias) not in selected_models:
            continue
        assert alias in MODEL_ALIASES, f'Unknown model alias: {alias}'
        record = json.loads(archive.read(member))
        assert record['model'] == alias and record['status'] == 'completed'
        suite, task_id, internal = (record[k] for k in ('suite', 'task_id', 'case_id'))
        task = f'{suite}-{task_id}'
        assert task in tasks and internal in directions
        public_id = directions[internal]
        assert record['public_case_id'] == public_id, 'Incorrect public perturbation ID'
        assert parts[2:] == (suite, f'task{task_id}__{public_id}.json')
        assert public_id not in designs[task]['excluded'], 'Unsupported task/perturbation'
        video = record['video']
        video_member = video['path']
        video_parts = PurePosixPath(video_member).parts
        assert len(video_parts) == 5 and video_parts[:3] == ('videos', alias, suite)
        assert video_parts[3] in ('success', 'failure')
        assert video_parts[4] == f'task{task_id}__{public_id}__seed{record["seed"]}.mp4'
        assert video_member in videos and video_member not in matched
        content = archive.read(video_member)
        assert len(content) == video['bytes'] and hashlib.sha256(content).hexdigest() == video['sha256']
        key = (MODEL_ALIASES[alias], task, public_id)
        assert key not in entries, f'Duplicate combination: {key}'
        entries[key] = video_member
        matched.add(video_member)
    assert entries and matched == videos, 'Every selected video must have a matching record'
    return entries


def resolve_entries(archive, selected_models=None):
    tasks = {t['id']: t for t in read_json(ROOT / 'data/tasks.json')['tasks']}
    designs = read_json(ROOT / 'data/task-designs.json')['tasks']
    directions = {p.get('sourceId', p['id']): p['id'] for p in read_json(ROOT / 'data/catalogue.json')['perturbations']}
    directions['BASE'] = 'BASE'
    names = archive.namelist()
    assert len(names) == len(set(names)), 'Duplicate archive members'
    front_records = [n for n in names if n.startswith('records/') and n.endswith('.json')]
    if front_records:
        return resolve_front_records(archive, front_records, tasks, designs, directions, selected_models)
    videos = [n for n in names if n.endswith('.mp4')]
    by_name = {PurePosixPath(n).name: n for n in videos}
    assert len(by_name) == len(videos), 'Ambiguous archive video names'
    entries = {}
    matched = set()
    records = [n for n in names if '/results/' in n and n.endswith('.json')]
    for member in records:
        record = json.loads(archive.read(member))
        model, suite, task_id, variant = (record[k] for k in ('agent_name', 'suite', 'task_id', 'variant'))
        task = f'{suite}-{task_id}'
        assert model in MODEL_ALIASES and task in tasks and variant in directions
        assert record['status'] == 'completed'
        public_id = directions[variant]
        assert public_id not in designs[task]['excluded'], f'Unsupported archive combination: {task}/{public_id}'
        basename = PurePosixPath(record['video_path']).name
        pattern = re.escape(f'{model}_{suite}_task{task_id}_{variant}_') + r'seed\d+_init\d+\.mp4'
        assert re.fullmatch(pattern, basename), 'Video filename disagrees with result identity'
        video_member = by_name[basename]
        assert f'/videos/{suite}/{variant}/' in video_member
        assert member.split('/')[0] == video_member.split('/')[0]
        key = (MODEL_ALIASES[model], task, public_id)
        assert key not in entries and video_member not in matched
        entries[key] = video_member
        matched.add(video_member)
    if not records:
        # Video-only exports identify the model both in the directory and filename.
        # IDs here are experiment IDs, including D21; never infer paper IDs from order.
        for member in videos:
            parts = PurePosixPath(member).parts
            assert len(parts) == 3 and parts[0] == 'liberopro_video', 'Unknown archive layout'
            alias, basename = parts[1:]
            assert alias in MODEL_ALIASES, f'Unknown model alias: {alias}'
            prefix = 'xvla' if alias == 'xVLA' else alias
            pattern = re.escape(prefix) + r'_(libero_(?:spatial|object|goal|10))_task(\d+)_(base|BASE|[SD]\d{2})_seed\d+_init\d+\.mp4'
            match = re.fullmatch(pattern, basename)
            assert match, f'Unrecognized video identity: {member}'
            suite, task_id, variant = match.groups()
            task, variant = f'{suite}-{task_id}', variant.upper()
            assert task in tasks and variant in directions, f'Unknown task or variant: {member}'
            public_id = directions[variant]
            assert public_id not in designs[task]['excluded'], f'Unsupported combination: {task}/{public_id}'
            key = (MODEL_ALIASES[alias], task, public_id)
            assert key not in entries, f'Duplicate combination: {key}'
            entries[key] = member
            matched.add(member)
    assert entries, 'No model videos found'
    assert matched == set(videos), 'Every supplied video must be mapped'
    return {key: member for key, member in entries.items() if selected_models is None or key[0] in selected_models}


def validate_batch(entries, public, without_base=False):
    tasks = read_json(ROOT / 'data/task-designs.json')['tasks']
    variants = ([] if without_base else ['BASE']) + [p['id'] for p in read_json(ROOT / 'data/catalogue.json')['perturbations']]
    known_models = {m['id'] for m in read_json(ROOT / 'data/results.json')['models']}
    batch_models = {key[0] for key in entries}
    assert batch_models, 'No selected model videos found'
    assert batch_models <= known_models, 'A rollout model is absent from the leaderboard'
    expected = {(model, task, variant) for model in batch_models for task in tasks
                for variant in variants if variant not in tasks[task]['excluded']}
    assert set(entries) == expected, 'Each supplied model must cover every applicable task exactly once'
    for model, task, variant in entries:
        assert variant not in public['models'].get(model, {}).get(task, {}), 'Refusing to overwrite published media'
        stem = ROOT / 'assets/rollouts/models' / model / task / variant
        assert not stem.with_suffix('.mp4').exists() and not stem.with_suffix('.webp').exists(), 'Destination already exists'


def import_video(archive_path, review, key, member, orientation, crf, preset):
    model, task, variant = key
    relative = Path('assets/rollouts/models') / model / task / variant
    destination = review / 'encoded' / relative.with_suffix('.mp4')
    poster = review / 'encoded' / relative.with_suffix('.webp')
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
    # The source export determines the correction; never resize, trim or change speed.
    command = [imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-xerror', '-y',
               '-i', str(source), '-map', '0:v:0', '-vf', orientation, '-an', '-map_metadata', '-1',
               '-c:v', 'libx264', '-preset', preset, '-crf', str(crf), '-threads', '2',
               '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(destination)]
    # Observation-quality examples can contain deliberate noise, which ordinary
    # compression suppresses. Preserve that texture instead of smoothing it away.
    if variant == 'S19':
        command[-1:-1] = ['-tune', 'grain']
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
             'orientation': orientation, 'crf': crf, 'preset': preset, 'grain': variant == 'S19',
             'outputBytes': destination.stat().st_size, 'posterBytes': poster.stat().st_size,
             'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
             'outputSha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
    return key, media, audit


def site_bytes():
    size = 0
    for directory, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if not d.startswith(('.', '_'))]
        size += sum((Path(directory) / f).stat().st_size for f in files)
    return size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archives', type=Path, nargs='+')
    parser.add_argument('--review-dir', required=True, type=Path)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--orientation', choices=['null', 'hflip', 'vflip', 'hflip,vflip'], required=True,
                        help='Correction confirmed by visual comparison with the existing gallery')
    parser.add_argument('--crf', type=int, default=22)
    parser.add_argument('--preset', choices=['fast', 'medium', 'slow'], default='medium')
    parser.add_argument('--max-site-bytes', type=int, default=950_000_000)
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('--models', nargs='+', help='Import only these public model IDs')
    parser.add_argument('--without-base', action='store_true', help='Require the complete perturbation set without Base recordings')
    args = parser.parse_args()
    review = args.review_dir.resolve()
    assert not review.is_relative_to(ROOT), 'Audit files must remain outside the public site'
    assert 0 <= args.crf <= 40 and 1 <= args.workers <= 8
    public = read_json(ROOT / 'data/model-rollouts.json')
    entries = {}
    for archive_path in args.archives:
        with zipfile.ZipFile(archive_path) as archive:
            for key, member in resolve_entries(archive, set(args.models) if args.models else None).items():
                assert key not in entries, f'Duplicate video across archives: {key}'
                entries[key] = (archive_path, member)
    if args.models:
        assert {key[0] for key in entries} == set(args.models), 'A selected model was not found'
    validate_batch(entries, public, args.without_base)
    print(f'Validated {len(entries)} videos against task applicability and public IDs.', flush=True)
    if args.check_only:
        return
    review.mkdir(parents=True, exist_ok=True)
    audit = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = [pool.submit(import_video, archive, review, key, member, args.orientation, args.crf, args.preset)
                for key, (archive, member) in entries.items()]
        for i, job in enumerate(as_completed(jobs), 1):
            (model, task, variant), media, record = job.result()
            public['models'].setdefault(model, {}).setdefault(task, {})[variant] = media
            audit.append(record)
            if i % 40 == 0 or i == len(jobs):
                print(f'{i}/{len(jobs)} corrected, fully decoded and verified', flush=True)
    (review / 'import-audit.json').write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')
    index_text = json.dumps(public, indent=2, sort_keys=True) + '\n'
    projected = site_bytes() + sum(r['outputBytes'] + r['posterBytes'] for r in audit) + len(index_text.encode('utf-8'))
    assert projected <= args.max_site_bytes, f'Projected site exceeds budget: {projected} bytes; staged files remain private'
    # All frames, mappings and the deployment budget passed before touching public assets.
    for model, task, variant in entries:
        for field in ('src', 'poster'):
            relative = public['models'][model][task][variant][field]
            destination = ROOT / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(review / 'encoded' / relative, destination)
    (ROOT / 'data/model-rollouts.json').write_text(index_text, encoding='utf-8')
    print(f'Projected public site: {projected:,} bytes.', flush=True)
    print(f'Published media index only; {sum(r["frames"] for r in audit)} frames verified.', flush=True)


if __name__ == '__main__':
    main()
