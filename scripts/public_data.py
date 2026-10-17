"""Publish only the fields rendered by the website, from private local inputs."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOMAINS = ('condition', 'environment', 'observation', 'execution', 'robot', 'language')


def private_directory(path):
    path = path.resolve()
    if path == ROOT or ROOT in path.parents:
        raise ValueError('Internal evaluation inputs must be outside the website repository')
    if not path.is_dir():
        raise ValueError('Private data directory does not exist')
    return path


def public_results(data):
    models = []
    for model in data['models']:
        scores = {key: model['scores'][key] for key in ('base', 'overall')}
        for mode in ('static', 'dynamic'):
            score = model['scores'][mode]
            scores[mode] = {
                'average': score['average'],
                'categories': {key: score['categories'][key] for key in DOMAINS},
                'cells': score['cells'],
            }
        models.append({
            **{key: model[key] for key in ('id', 'name', 'type')},
            'scores': scores,
            'cells': [{key: cell[key] for key in ('suite', 'direction', 'rate')}
                      for cell in model['cells'] if cell['direction'] != 'BASE'],
            'taskRates': [{'task': case['task'], 'direction': case['direction'],
                           'rate': case['successes'] / case['episodes']}
                          for case in model['cases'] if case['direction'] != 'BASE'],
            'updated': model['source']['date'],
            'granularity': model['source']['granularity'],
        })
    return {key: data[key] for key in ('metric', 'aggregation')} | {'models': models}


def public_home_rollouts(data):
    return {'clips': [{key: clip[key] for key in ('perturbation', 'src', 'poster')}
                      for clip in data['clips']]}


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--private-data', type=Path, required=True)
    args = parser.parse_args()
    private = private_directory(args.private_data)
    results = json.loads((private / 'data/results-internal.json').read_text(encoding='utf-8'))
    rollouts = json.loads((private / 'data/home-rollouts-internal.json').read_text(encoding='utf-8'))
    write_json(ROOT / 'data/results.json', public_results(results))
    write_json(ROOT / 'data/home-rollouts.json', public_home_rollouts(rollouts))
    print('Published display rates and Home media references only.')


if __name__ == '__main__':
    main()
