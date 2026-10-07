# LIBERO-Pro benchmark website

Experimental deployment: https://racingemperor.github.io/demo/

A standalone static site for the current LIBERO-Pro benchmark. The frontend is rebuilt around the paper's six-domain taxonomy, 22 static shifts, 20 dynamic interventions and eight held-out tasks. The Home introduction summarizes the original LIBERO-Pro study's motivation; its pages, scripts, media and numerical results are not reused.

## Run locally

```sh
python -m http.server 8765 --bind 127.0.0.1
node scripts/verify-data.mjs
```

Open http://127.0.0.1:8765/. No frontend dependencies or build step are required.

For browser navigation regression checks, open http://127.0.0.1:8765/scripts/navigation-test.html (or add `?width=375` for the narrow layout). The checks exercise the real pages and verify document identity, history length, scroll, filters, deep links and the document directory.

## Navigation behavior

Selections within a page (model perturbations, static/dynamic settings, domains, model filters and sorting) update in place. The URL is replaced with the current selection so it remains shareable without adding a browser Back stop for each click. Back returns to the previous page; Forward restores the final selection. Cross-page links, downloads and opening links in new tabs keep native browser behavior.

The shared updater in `assets/navigation.js` keeps unchanged DOM elements, controls and scroll containers. Document selection updates the reading panel and preserves the expanded directory; a new document starts at the top of its content. Section anchors also replace the current URL instead of filling navigation history.

Leaderboard headings use one row of domain names. Static/dynamic perturbation IDs and their domain assignments are documented in **Document → Paper taxonomy** (`docs.html#taxonomy`).

Home exploration links open the complete Document with section anchors, retaining all eight task designs and 42 perturbation documents. `#taxonomy` lists all six domains, `#domain-CONDITION_ID` targets a domain row, and `#static-perturbations` / `#dynamic-perturbations` target the full 22/20-item indexes. Home's overview figure and taxonomy diagram share the navigation bar's center line; the six domain descriptions flank the diagram in two equal columns on desktop.

The Home taxonomy is an interactive SVG generated from `data/catalogue.json` by `assets/taxonomy.js`. Its 42 equal outer segments run clockwise from the top in public ID order: S01–S22, then D01–D20. The inner ring has only two parts, Static (22) and Dynamic (20), aligned with the corresponding outer codes and linked to their full Document indexes. The six domains do not reorder or partition the ring. Hovering or focusing a side description highlights and lifts matching codes in their original positions; a code previews its own full name in the center. Clicking or tapping a code opens its design in the complete Document. Fixed hit areas prevent pointer flicker, Escape clears a preview, compact screens stagger horizontal labels across two radii, and reduced-motion preferences use a static highlight. The original paper figure is retained as an asset.

Open `scripts/taxonomy-test.html` for chart interaction checks, including exact clockwise ID order, domain highlighting without reordering, keyboard/touch navigation, horizontal label overlap, and the full Document directory. Add `?width=375` to check the compact layout.

## Structure

- `assets/app.js`, `assets/site.css`: shared rendering, navigation, tables, charts and task galleries.
- Main navigation: **Home, Document, Leaderboard, Eval**, matching RoboDojo's first four entries. The task catalogue remains accessible through Document and Home; Findings has no top-level navigation entry.
- `index.html`, `assets/home.js`: Home slideshow, scrolling static/dynamic paper galleries, taxonomy, tasks, leaderboard preview and empty News. Slideshow and galleries have pause controls, pause on hover/focus, and start paused for reduced-motion preferences. Touch, wheel or keyboard interaction stops gallery autoplay.
- Home sections fade in and rise slightly on their first entry into the viewport. Native scrolling is preserved. Keyboard focus reveals its containing section immediately; reduced-motion preferences, unsupported observation and printing leave content visible.
- `leaderboard.html`: separate static/dynamic charts and sortable domain success-rate tables.
- `model.html?id=MODEL_ID`: model profile and perturbation/task results.
- `tasks.html`, `perturbation.html?id=S01`, `task.html?id=libero_goal-3`: browsable catalogue and eight task slots per perturbation.
- `findings.html`: analysis sections reserved for future content.
- `docs.html`: grouped document directory, task design index, protocol, aggregation, sources and coverage.
- `docs.html?task=libero_10-8`: each base task's instruction, scene, sequence, exact success predicates and media slots.
- `docs.html?perturbation=D06`: each perturbation's mechanism, category, timing or constraint, and task/gallery links.
- `eval.html`: evaluation setup, execution and result reporting. No online evaluation or submission service is claimed.
- `data/task-designs.json`: eight task designs and applicability exclusions, checked against the BASE scene definitions and paper. This editorial file is separate from the generated task manifest.

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

Use only genuine evaluation media for the matching model, task and perturbation. Missing media renders as a reserved slot. S04 is not applicable to the two Spatial evaluation tasks; D06 is not applicable to Long task 8. These slots show N/A rather than missing scores. The Home galleries currently animate real paper illustrations, not model rollout videos.

## People and institution logos

`data/people.json` is intentionally empty until the user supplies the author and affiliation list. Home always shows the Authors and Affiliations rows, with blank space until confirmed records exist. Author records use `name` and an `affiliations` array of institution IDs. Institution records use `id`, `name`, `logo` (a real local image under `assets/institutions/`) and `source` (the official source URL). Use official logos with clear provenance; never generate initials as a fallback. Institution order determines the displayed affiliation numbers.

## Publication details and citation

`data/publication.json` supplies `published` (display text), `report.label` and `report.url` (HTTPS), `email`, and `bibtex` (the exact confirmed citation as a string). These values are currently empty. Home reserves blank Published, Report and Email rows alongside the existing repository and leaderboard links. The final Citation section reserves a code block and disables Copy until BibTeX is supplied; no old author list, date or citation is substituted. Once populated, Copy writes the displayed citation and announces success, with manual-copy guidance if the clipboard is unavailable.

The two-paragraph Home introduction summarizes the memorization/generalization concern from the original upstream website's Abstract, then describes the current 22-static / 20-dynamic protocol. The original study's numerical results are not presented as results of this benchmark.

## News

`data/news.json` currently has an empty `entries` array. Future entries support `date` and `title` fields. No announcements have been fabricated.

## Images and attribution

Paper figures were read from the current Overleaf source on 2026-10-07. Appendix figures illustrate mechanisms and are not presented as model rollouts. `data/model-assets.json` records official model, family and organization image sources. FastWAM and RIPT-VLA use official project illustrations where no independent logo was found. Third-party marks remain the property of their owners.

The layout and interaction reference is [RoboDojo](https://robodojo-benchmark.com/). Implementation and styling are independent; no RoboDojo source code or mountain graphic is copied. The repository's history originated from LIBERO-Pro's academic website and the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template), distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Deployment

GitHub Pages publishes the root of `codex/site-framework-experiment` in `racingemperor/demo`. Only `origin` is updated. The original upstream website and `master` branch are unchanged.
