"""Build the public, success-rate-only benchmark catalogue.

Usage: python scripts/build_data.py --paper PATH --figures PATH
Optional refresh: --refresh-sheet --sheet-url PRIVATE_SOURCE_URL
Reads only the four named non-RQ sheets. Never edits the source spreadsheet.
"""
import argparse
import collections
import concurrent.futures
import csv
from datetime import date
import io
import json
import re
import urllib.request
from urllib.parse import urlsplit
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHEET_SNAPSHOT = 'data/sheet-success-rates.json'
SHEET_PROVENANCE = 'Approved non-RQ success rates exported from the private evaluation worksheet.'
SUITES = {'Spatial': 'libero_spatial', 'Object': 'libero_object', 'Goal': 'libero_goal', 'Long': 'libero_10'}
COMPLETED_SOURCE = 'data/completed-evaluations-2026-10-08.json'
CATEGORIES = [
    ('condition', 'Condition', 'Task geometry, object poses and interaction constraints.', [1,2,3,4,5,7,8,9], list(range(1,7))),
    ('environment', 'Environment', 'Scene composition, appearance and visual context.', [6,10,11,12,13,14,22], [7,8,9]),
    ('observation', 'Observation', 'Image formation, sensor quality and observation timing.', [15,16,19], [10,11,12,13]),
    ('execution', 'Execution', 'Control timing, command delivery and action execution.', [20], [14,15,16]),
    ('robot', 'Robot', 'Robot state, calibration and recoverable execution outcomes.', [17,18], [17,18,19]),
    ('language', 'Language', 'Equivalent instructions with the original task goal preserved.', [21], [20]),
]

def read_json(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8-sig'))

def write_json(name, obj):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'LIBERO-Pro website data builder'})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()

def mean(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None

def public_id(direction):
    if direction == 'D19':
        return None
    return {'D20': 'D19', 'D21': 'D20'}.get(direction, direction)

def get_sheet(label, names, sheet_url):
    sheet_name = {'Spatial':'libero-spatial', 'Object':'libero-object', 'Goal':'libero-goal', 'Long':'libero-10'}[label]
    rows = list(csv.reader(io.StringIO(fetch(sheet_url + '/gviz/tq?tqx=out:csv&sheet=' + sheet_name).decode('utf-8-sig'))))
    found = collections.Counter()
    cells = []
    for line, row in enumerate(rows, 1):
        if len(row) < 4 or row[1] not in names:
            continue
        name = row[1]
        found[name] += 1
        if found[name] > 2:
            continue  # RQ or subsequent tables are deliberately excluded.
        mode = 'S' if found[name] == 1 else 'D'
        for column in range(3, min(len(row), 26 if mode == 'S' else 25)):
            raw = row[column].strip()
            if not raw or raw.upper() in ('N/A', 'NA'):
                continue
            if not re.fullmatch(r'\d+(?:\.\d+)?%', raw):
                raise ValueError(f'Unexpected rate in {sheet_name}:{line}:{column+1}')
            source_id = 'BASE' if column == 3 else f'{mode}{column-3:02}'
            direction = public_id(source_id)
            if direction is None or (direction == 'BASE' and mode == 'D'):
                continue
            cells.append(dict(model=name, suite=SUITES[label], direction=direction, sourceDirection=source_id,
                              rate=float(raw[:-1])/100, sourceSheet=sheet_name, sourceRow=line, sourceColumn=column+1))
    assert all(found[name] >= 2 for name in names), (label, found)
    return cells

def build(args):
    old = read_json('data/archive/leaderboard-before-paper-taxonomy.json')
    completed = read_json(COMPLETED_SOURCE)
    entries = {e['model']: e for e in old['entries']}
    for model in completed['models']:
        entries[model['model']] = model
    all_names = set(entries)
    counted_names = {e['model'] for e in completed['models']}
    sheet_names = all_names - counted_names
    if args.refresh_sheet:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            batches = list(pool.map(lambda label: get_sheet(label, sheet_names, args.sheet_url), SUITES))
        write_json(SHEET_SNAPSHOT, dict(accessed=date.today().isoformat(), source=SHEET_PROVENANCE, cells=sum(batches, [])))
    snapshot = read_json(SHEET_SNAPSHOT)
    categories = [dict(id=id, name=name, description=desc,
                       static=[f'S{i:02}' for i in static], dynamic=[f'D{i:02}' for i in dynamic])
                  for id,name,desc,static,dynamic in CATEGORIES]
    directions = []
    for mode in ['static', 'dynamic']:
        raw = (args.paper / 'tables' / f'{mode}_perturbations.tex').read_text(encoding='utf-8')
        for line in raw.splitlines():
            if not re.match(r'^[SD]\d{2} &', line):
                continue
            id, name, description, constraint = [p.strip().rstrip('\\*').strip().replace('--', '–') for p in line.split('&')]
            category = next(c['id'] for c in categories if id in c[mode])
            source_id = {'D19':'D20', 'D20':'D21'}.get(id, id)
            directions.append(dict(id=id, sourceId=source_id, mode=mode, category=category, name=name,
                                   description=description, constraint=constraint, image=f'assets/perturbations/{id}.webp'))
            path = ROOT / f'assets/perturbations/{id}.webp'
            path.parent.mkdir(parents=True, exist_ok=True)
            image = Image.open(args.paper / 'figures' / f'appendix_{mode}' / f'{id}.png').convert('RGB')
            image.save(path, 'WEBP', quality=86)
    assert len(directions) == 42 and len({d['id'] for d in directions}) == 42
    tasks = []
    raw = (args.paper / 'tables/evaluation_tasks.tex').read_text(encoding='utf-8')
    for line in raw.splitlines():
        if not re.match(r'^(Spatial|Object|Goal|Long) &', line):
            continue
        suite, task_id, instruction = [p.strip().rstrip('\\*').strip() for p in line.split('&')]
        tasks.append(dict(id=f'{SUITES[suite]}-{task_id}', suite=SUITES[suite], suiteName=suite,
                          taskId=int(task_id), instruction=instruction, media={}))
    assert len(tasks) == 8
    write_json('data/tasks.json', {'tasks':tasks})
    write_json('data/catalogue.json', {'source':'Current paper source, downloaded 2026-10-07', 'categories':categories, 'perturbations':directions})
    models = []
    for entry in entries.values():
        name = entry['model']
        source = next((m for m in completed['models'] if m['model']==name), None)
        cases = []
        if source:
            groups = collections.defaultdict(lambda:[0,0])
            for case in source['cases']:
                direction = public_id(case['direction'])
                if direction is None:
                    continue
                cases.append(dict(task=f"{case['suite']}-{case['taskId']}", direction=direction,
                                  successes=case['successes'], episodes=case['episodes']))
                group = groups[(case['suite'], direction)]
                group[0] += case['successes']; group[1] += case['episodes']
            cells = [dict(suite=s, direction=d, rate=w/n) for (s,d),(w,n) in groups.items()]
        else:
            cells = [{k:c[k] for k in ['suite','direction','rate']} for c in snapshot['cells'] if c['model']==name]
        assert len({(c['suite'],c['direction']) for c in cells}) == len(cells)
        scores = {}
        for mode in ['static','dynamic']:
            valid_ids = [d['id'] for d in directions if d['mode']==mode]
            scores[mode] = dict(average=mean(c['rate'] for c in cells if c['direction'] in valid_ids),
                categories={cat['id']:mean(c['rate'] for c in cells if c['direction'] in cat[mode]) for cat in categories},
                cells=sum(c['direction'] in valid_ids for c in cells))
        scores['base'] = mean(c['rate'] for c in cells if c['direction']=='BASE')
        scores['overall'] = mean(c['rate'] for c in cells if c['direction']!='BASE')
        slug = name.lower().replace('π','pi').replace('+','-plus').replace('_','-').replace(' ','-').replace('.','-')
        models.append(dict(id=slug, name=name, type=entry['category'], scores=scores, cells=cells, cases=cases,
            source={'label':'Completed evaluation counts' if source else 'Published evaluation snapshot',
                    'date':completed['accessed'][:10] if source else snapshot['accessed'],
                    'url':COMPLETED_SOURCE if source else SHEET_SNAPSHOT,
                    'granularity':'task' if source else 'suite'}))
    write_json('data/results.json', dict(metric='Success rate', aggregation='Mean of available suite × perturbation success rates, including S22. Pool task counts within each suite × perturbation before averaging. Missing values are excluded, never zero-filled.', models=models))
    for name in ['overview','taxonomy']:
        image = Image.open(args.figures / f'{name}.png').convert('RGB')
        (ROOT/'assets/paper').mkdir(parents=True, exist_ok=True)
        image.save(ROOT/f'assets/paper/{name}.webp', 'WEBP', quality=92)
    print(json.dumps({'models':len(models), 'perturbations':len(directions), 'tasks':len(tasks),
        'scores':[{ 'model':m['name'], 'static':round(m['scores']['static']['average']*100,1),
                    'dynamic':round(m['scores']['dynamic']['average']*100,1),
                    'cells':[m['scores'][x]['cells'] for x in ['static','dynamic']]} for m in models]}, ensure_ascii=False))

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--paper', type=Path, required=True)
    parser.add_argument('--figures', type=Path, required=True)
    parser.add_argument('--refresh-sheet', action='store_true')
    parser.add_argument('--sheet-url', help='Private source URL for an authorized refresh; never saved to public data')
    args = parser.parse_args()
    if args.refresh_sheet:
        if not args.sheet_url:
            parser.error('--refresh-sheet requires --sheet-url; offline builds use the published snapshot')
        parts = urlsplit(args.sheet_url)
        match = re.fullmatch(r'/spreadsheets/d/([A-Za-z0-9_-]+)(?:/edit)?/?', parts.path)
        if parts.scheme != 'https' or parts.netloc != 'docs.google.com' or not match:
            parser.error('--sheet-url must be a Google Sheets base or edit URL')
        args.sheet_url = f'https://{parts.netloc}/spreadsheets/d/{match[1]}'
    build(args)
