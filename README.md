# LIBERO-Pro benchmark website

Experimental deployment: https://racingemperor.github.io/demo/

A standalone static site for the current LIBERO-Pro benchmark. The frontend is rebuilt around the paper's six-domain taxonomy, 22 static shifts, 20 dynamic interventions and eight held-out tasks. No LIBERO-Pro 1.0 pages, scripts or media are used.

## Run locally

```sh
python -m http.server 8765 --bind 127.0.0.1
node scripts/verify-data.mjs
```

Open http://127.0.0.1:8765/. No frontend dependencies or build step are required.

## Structure

- `assets/app.js`, `assets/site.css`: shared rendering, navigation, tables, charts and task galleries.
- `index.html`: Home, current paper overview, taxonomy, tasks, leaderboard preview and empty News.
- `leaderboard.html`: separate static/dynamic charts and sortable domain success-rate tables.
- `model.html?id=MODEL_ID`: model profile and perturbation/task results.
- `tasks.html`, `perturbation.html?id=S01`, `task.html?id=libero_goal-3`: browsable catalogue and eight task slots per perturbation.
- `findings.html`: analysis sections reserved for future content.
- `docs.html`: protocol, aggregation, sources and coverage.

## Data and reproducibility

`data/catalogue.json` uses public paper IDs. Paper D19 maps to internal D20, paper D20 maps to internal D21, and internal D19 is excluded. S06 belongs to Environment.

`data/results.json` contains 14 models. Average success rates include S22 and average available suite × perturbation cells, pooling task counts within a cell first. There are 87 static and 80 dynamic cells per model. Missing data is never zero-filled. Δ is Average − Base.

Ten models use the four named non-RQ Google Sheets retrieved on 2026-10-07. Their source cells, without contributor names, are in `data/sheet-success-rates.json`. Four models use the unchanged `data/completed-evaluations-2026-10-04.json` trial counts. Each has 339 cases, including nominal cases, and 10,170 episodes. Only those four expose individual task rates. The earlier aggregate snapshot is retained under `data/archive/` for reproducibility.

To rebuild from an authorized paper-source download and rendered overview/taxonomy PNGs:

```sh
python scripts/build_data.py --paper PATH_TO_PAPER_SOURCE --figures PATH_TO_RENDERED_FIGURES
# Add --refresh-sheet only when intentionally updating the source snapshot.
python scripts/build_assets.py
node scripts/verify-data.mjs
```

Builders require Pillow. The site itself does not require Python or Node.

## Add rollout media

Place GIF, WebP, MP4 or WebM files under `assets/rollouts/`. In `data/tasks.json`, populate a task's `media` mapping:

```json
{"media":{"openvla-oft-m":{"D01":"assets/rollouts/oft-m-goal3-D01.mp4"}}}
```

Use only genuine evaluation media for the matching model, task and perturbation. Missing media renders as a reserved slot. S04 is not applicable to the two Spatial evaluation tasks.

## News

`data/news.json` currently has an empty `entries` array. Future entries support `date` and `title` fields. No announcements have been fabricated.

## Images and attribution

Paper figures were read from the current Overleaf source on 2026-10-07. Appendix figures illustrate mechanisms and are not presented as model rollouts. `data/model-assets.json` records official model, family and organization image sources. FastWAM and RIPT-VLA use official project illustrations where no independent logo was found. Third-party marks remain the property of their owners.

The layout and interaction reference is [RoboDojo](https://robodojo-benchmark.com/). Implementation and styling are independent; no RoboDojo source code or mountain graphic is copied. The repository's history originated from LIBERO-Pro's academic website and the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template), distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Deployment

GitHub Pages publishes the root of `codex/site-framework-experiment` in `racingemperor/demo`. Only `origin` is updated. The original upstream website and `master` branch are unchanged.
