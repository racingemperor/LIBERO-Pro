"""Build Home loops from the newest local archive for each perturbation/task pair.

Requires OpenCV, Pillow and imageio-ffmpeg. Original archives are read-only.
Run without --build to review contact sheets and the latest-per-pair audit first.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

import cv2
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PATTERN = re.compile(r'(pi05?)_(libero_\w+)_task(\d+)_([SD]\d+)_seed(\d+)_init(\d+)\.mp4$')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--review-dir', type=Path, required=True)
    parser.add_argument('--static-manifest', type=Path, required=True)
    parser.add_argument('--dynamic-manifest', type=Path, required=True)
    parser.add_argument('--build', action='store_true')
    args = parser.parse_args()
    catalogue = json.loads((ROOT / 'data/catalogue.json').read_text(encoding='utf-8'))['perturbations']
    illustrations = {}
    for row in json.loads(args.static_manifest.read_text(encoding='utf-8'))['rows']:
        illustrations[row['case_id']] = json.loads((Path(row['source']) / 'render.json').read_text(encoding='utf-8'))
    for row in json.loads(args.dynamic_manifest.read_text(encoding='utf-8')):
        public = {'D20': 'D19', 'D21': 'D20'}.get(row['case_id'], row['case_id'])
        illustrations[public] = row
    assert set(illustrations) == {p['id'] for p in catalogue}
    groups = collections.defaultdict(list)
    newest_suite = {}
    for archive in sorted(args.source.glob('*.zip')):
        batch = '2026' + archive.name[:4]
        if not re.fullmatch(r'2026\d{4}', batch):
            continue
        with zipfile.ZipFile(archive) as z:
            metadata = {}
            manifest = next((n for n in z.namelist() if n.endswith('/manifest.json')), None)
            if manifest:
                records = json.loads(z.read(manifest))
                metadata = {r['filename']: r for r in records}
            for member in z.infolist():
                match = PATTERN.search(member.filename)
                if not match or member.filename.startswith('__MACOSX/'):
                    continue
                model, suite, task, internal, seed, init = match.groups()
                task = int(task)
                if internal == 'D19':
                    continue
                if (internal == 'S04' and suite == 'libero_spatial') or (internal == 'D06' and suite == 'libero_10' and task == 8):
                    continue
                public = {'D20': 'D19', 'D21': 'D20'}.get(internal, internal)
                if public not in {p['id'] for p in catalogue}:
                    continue
                illustration = illustrations[public]
                if (suite, task) != (illustration['suite'], illustration['task_id']):
                    continue
                newest_suite[suite] = max(batch, newest_suite.get(suite, ''))
                filename = Path(member.filename).name
                record = metadata.get(filename, {})
                run = re.search(r'20\d{6}', record.get('source_video', ''))
                groups[(public, suite, task)].append({
                    'archive': archive.name, 'member': member.filename, 'batch': batch,
                    'runDate': run[0] if run else None, 'filename': filename,
                    'task': f'{suite}-{task}', 'perturbation': public,
                    'internalVariant': internal, 'model': model, 'seed': int(seed),
                    'init': int(init), 'outcome': 'success' if '/success/' in member.filename else 'failure',
                    'zipDate': list(member.date_time),
                })
    audit = []
    eligible = collections.defaultdict(list)
    for (public, suite, _), rows in sorted(groups.items()):
        latest = max(r['batch'] for r in rows)
        # Seeds within one experiment are parallel trials, not revisions. Never
        # use outcome as a selection criterion or encode-time as a run version.
        candidates = sorted((r for r in rows if r['batch'] == latest), key=lambda r: (r['seed'] != illustrations[public]['seed'], r['seed'], r['init'], r['model'], r['filename']))
        record = candidates[0]
        current = latest == newest_suite[suite]
        audit.append({**record, 'currentBatch': current, 'latestTrialCount': len(candidates)})
        if current:
            eligible[public].append(record)
    assert len(audit) == len(catalogue), 'Missing matching illustration task'
    args.review_dir.mkdir(parents=True, exist_ok=True)
    (args.review_dir / 'latest-per-pair.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
    chosen = []
    for perturbation in catalogue:
        assert eligible[perturbation['id']], f"No current batch for {perturbation['id']}"
        record = eligible[perturbation['id']][0]
        chosen.append({**record, 'mode': perturbation['mode'], 'name': perturbation['name']})
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)
    rendered = []
    for record in chosen:
        local = args.review_dir / record['filename']
        with zipfile.ZipFile(args.source / record['archive']) as z:
            original = z.read(record['member'])
        local.write_bytes(original)
        cap = cv2.VideoCapture(str(local))
        assert cap.isOpened(), local
        count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frames = []
        for fraction in [0, .3, .6, .9]:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int((count - 1) * fraction))
            ok, frame = cap.read()
            assert ok, local
            frames.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).transpose(Image.Transpose.ROTATE_180))
        cap.release()
        record.update(duration=round(count / fps, 3), width=frames[0].width, height=frames[0].height, sourceSha256=hashlib.sha256(original).hexdigest())
        rendered.append((record, frames))
        if args.build:
            dest = ROOT / 'assets/rollouts/home'
            dest.mkdir(parents=True, exist_ok=True)
            output = dest / (record['perturbation'] + '.mp4')
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y', '-i', str(local), '-an', '-vf', 'hflip,vflip,fps=20,scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)], check=True)
            frames[0].save(dest / (record['perturbation'] + '.webp'), quality=82)
    for start in range(0, len(rendered), 7):
        sheet = Image.new('RGB', (4 * 192, 7 * 220), 'white')
        draw = ImageDraw.Draw(sheet)
        for row, (record, frames) in enumerate(rendered[start:start + 7]):
            draw.text((4, row * 220 + 3), f"{record['perturbation']} {record['task']} {record['duration']}s {record['outcome']}", font=font, fill='black')
            for col, frame in enumerate(frames):
                sheet.paste(frame.resize((192, 192)), (col * 192, row * 220 + 25))
        sheet.save(args.review_dir / f'contact-{start // 7 + 1}.jpg', quality=90)
    (args.review_dir / 'home-selection.json').write_text(json.dumps(chosen, ensure_ascii=False, indent=2), encoding='utf-8')
    if args.build:
        public_records = []
        for record in chosen:
            public_records.append({k: record[k] for k in ['perturbation', 'task', 'model', 'seed', 'init', 'outcome', 'archive', 'runDate', 'internalVariant', 'sourceSha256', 'duration', 'width', 'height']} | {
                'src': f"assets/rollouts/home/{record['perturbation']}.mp4", 'poster': f"assets/rollouts/home/{record['perturbation']}.webp",
                'rotationDegrees': 180,
            })
        payload = {'description': 'One illustrative rollout per perturbation, using the same task as its paper illustration. Not an aggregate success-rate sample.', 'selection': 'Newest batch per task and perturbation. Prefer the illustration seed within the same run, otherwise the lowest available seed. No outcome selection or fallback to older suite revisions.', 'clips': public_records}
        (ROOT / 'data/home-rollouts.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'pairs': len(audit), 'current': sum(r['currentBatch'] for r in audit), 'olderOnly': [{k: r[k] for k in ['task', 'perturbation', 'archive']} for r in audit if not r['currentBatch']], 'homeClips': len(chosen), 'batches': dict(collections.Counter(r['archive'] for r in chosen))}, ensure_ascii=False))


if __name__ == '__main__':
    main()
