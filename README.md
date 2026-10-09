# LIBERO-Pro benchmark website

Website: https://racingemperor.github.io/LIBERO-Pro/

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

**Model capabilities** compares Overall → Dynamic → Static success rates on a shared 0–100% line chart. Logo chips above the chart toggle any combination of models; the top three by overall success rate are selected initially. `compare` stores the selected IDs in the URL (`compare=` means none), independently of table filters. Hover or keyboard focus anywhere on a line shows the model introduction and scores. Each line, point and end label is a native link: click, tap or Enter opens that model's results directly; modified clicks can open a new tab. A 32px invisible stroke makes the full line easier to target; overlapping strokes resolve to the nearest line, including taps without a prior hover. The preview does not intercept pointer input, and Escape dismisses it. Official project links remain on model pages. A score table provides an accessible alternative. `assets/capabilities.js` owns the chart; editorial introductions and official sources live in `data/model-profiles.json`. Overall uses `scores.overall`, the mean of all 167 applicable suite × perturbation cells, not a 50/50 average of the two settings. The Home bar-chart preview is unchanged.

Below the domain table, **Perturbation comparison** (`leaderboard.html#perturbation-rankings`) lists all 18 models against S01–S22 or D01–D20 in public ID order. Its controls use the same Static/Dynamic tabs and Model type selector styling as the domain table; sorting is available through column headings, without an extra Rank by dropdown. Pale blue cells link directly to that model's matching perturbation and eight task slots. Blue heat shading and the selected header distinguish it from the green domain table above. Each score averages available suite results, exactly as model details do; no missing values are replaced with zero. Rank and model/logo columns stay visible while the table scrolls horizontally. Its setting, model filter, sort and order use independent `perturbationMode`, `perturbationType`, `perturbationSort` and `perturbationOrder` URL parameters so changes preserve the domain table's selection and do not reload the page.

Home exploration links open the complete Document with section anchors, retaining all eight task designs and 42 perturbation documents. `#taxonomy` lists all six domains, `#domain-CONDITION_ID` targets a domain row, and `#static-perturbations` / `#dynamic-perturbations` target the full 22/20-item indexes. Home's overview figure and taxonomy diagram share the navigation bar's center line; the six domain descriptions flank the diagram in two equal columns on desktop.

The Home taxonomy is an interactive SVG generated from `data/catalogue.json` by `assets/taxonomy.js`. Its 42 equal outer segments run clockwise from the top in public ID order: S01–S22, then D01–D20. The inner ring has only two parts, Static (22) and Dynamic (20), aligned with the corresponding outer codes and linked to their full Document indexes. The six domains do not reorder or partition the ring. Hovering or focusing a side description highlights and lifts matching codes in their original positions; a code previews its own full name in the center. Clicking or tapping a code opens its design in the complete Document. Fixed hit areas prevent pointer flicker, Escape clears a preview, compact screens stagger horizontal labels across two radii, and reduced-motion preferences use a static highlight. The original paper figure is retained as an asset.

Open `scripts/taxonomy-test.html` for chart interaction checks, including exact clockwise ID order, domain highlighting without reordering, keyboard/touch navigation, horizontal label overlap, and the full Document directory. Add `?width=375` to check the compact layout.

## Structure

- `assets/app.js`, `assets/site.css`: shared rendering, navigation, tables, charts and task galleries.
- Main navigation: **Home, Document, Leaderboard, Eval**, matching RoboDojo's first four entries. The task catalogue remains accessible through Document and Home; Findings has no top-level navigation entry.
- `index.html`, `assets/home.js`: Home slideshow, three-row static/dynamic rollout galleries, taxonomy, tasks, leaderboard preview and empty News. Galleries use compact square videos without visible card captions (156px desktop / 120px mobile, 12px / 8px gaps), fading into the background at both horizontal edges. Accessible link names retain the perturbation ID and title; keyboard focus removes the fade and shows an inset outline. Rows move right / left / right and autoplay without gallery buttons, with enough repeated content to span the viewport through each loop. Hover/focus holds the row in place while the clip keeps playing. Horizontal touch, wheel or keyboard browsing holds just that row, resuming 1.8 seconds after interaction once hover/focus leaves; vertical page scrolling does not pause the gallery. Reduced-motion preferences suppress autoplay. Videos only load and play when visible, and pause when off-screen or the tab is hidden. Gallery headings have no explanatory captions. All Home titles remain visible. The slideshow cycles automatically without a pause button; arrows, dots and keyboard navigation remain available, and manual choices reset the cycle. Hover or keyboard focus holds the current slide until the visitor leaves it.
- Home slides 2 and 3 use `assets/home-examples/`: proportionally enlarged image strips with transparent gutters and no surrounding paper headings, white card or visible caption. Run `python scripts/build_home_examples.py` to regenerate them from the six existing paper illustrations. All four panels and their internal scientific annotations remain intact; Document keeps the full original figures.
- Home sections fade in and rise slightly on their first entry into the viewport. Native scrolling is preserved. Keyboard focus reveals its containing section immediately; reduced-motion preferences, unsupported observation and printing leave content visible.
- Home's **Tested models** section replaces Resources. It uses all 18 models in `data/results.json`, in the same order as the Leaderboard comparison chips, with a shared green tint, sourced images and direct links to model pages. **Upcoming models** appears beneath it with gray outlines and grayscale imagery: 46 names from the maintainer's list after excluding 8 already tested models. Public names and IDs come from `data/upcoming-models.json`; corresponding project, family or institutional marks and their credits live in `data/model-assets.json`. Where no mark has been located, an attributed paper illustration is used. RAIN's unverified logo has a reserved empty circle, never an invented initial. `python scripts/build_assets.py` downloads local WebP assets; SVG sources require PyMuPDF. Do not publish internal queues, schedules or trial data. Models that acquire published results automatically appear only in the tested group; upcoming entries are not links to nonexistent results.
- `leaderboard.html`: interactive three-metric model comparison lines, sortable domain scores and a complete per-perturbation comparison table.
- `model.html?id=MODEL_ID`: model profile and perturbation/task results.
- `tasks.html`, `perturbation.html?id=S01`, `task.html?id=libero_goal-3`: browsable catalogue and eight task slots per perturbation.
- `findings.html`: analysis sections reserved for future content.
- `docs.html`: grouped document directory, task design index, protocol, aggregation, sources and coverage.
- `docs.html?task=libero_10-8`: each base task's instruction, scene, sequence, exact success predicates and media slots.
- `docs.html?perturbation=D06`: each perturbation's mechanism, category, timing or constraint, and task/gallery links.
- `eval.html`: evaluation setup, execution and result reporting. No online evaluation or submission service is claimed.
- `data/task-designs.json`: eight task designs and applicability exclusions, checked against the BASE scene definitions and paper. This editorial file is separate from the generated task manifest.

## Display data and private evaluation inputs

`data/catalogue.json` uses public paper IDs. Paper D19 maps to internal D20, paper D20 maps to internal D21, and internal D19 is excluded. S06 belongs to Environment.

`data/results.json` contains only the rates and labels needed to render 18 models on the website. Average success rates include S22 and average available suite × perturbation cells, pooling task counts privately before calculating the displayed rates. Missing data is never zero-filled. Δ is Average − Base.

The site has no evaluation snapshot or raw-data download links. Internal trial counts, source worksheet cells, historical evaluation files and rollout provenance are kept outside this public repository. Public task entries contain success rates only; suite-level results are not used to infer unavailable task rates.

`scripts/public_data.py` applies explicit field allowlists to the private input before writing the display files. Displayed values necessarily reach the visitor's browser; the generated files must never contain internal records. The data verifier checks this separation before publishing.

To rebuild from an authorized paper-source download and rendered overview/taxonomy PNGs:

```sh
python scripts/build_data.py --paper PATH_TO_PAPER_SOURCE --figures PATH_TO_RENDERED_FIGURES --private-data PRIVATE_DIRECTORY
# Optional authorized refresh: add --refresh-sheet --sheet-url PRIVATE_SOURCE_URL.
python scripts/build_assets.py
node scripts/verify-data.mjs
node scripts/verify-data.mjs --private-data PRIVATE_DIRECTORY
```

Builders require Pillow. The site itself does not require Python or Node.

The private directory uses a `data/` subdirectory for internal inputs and must be outside this repository. Obtain it separately from the maintainer; it is not distributed with the website. Builders read raw records there and write only display fields here. An optional source refresh requires authorized access and saves its raw result only in the private directory. After reviewing updated internal results and Home media records, `python scripts/public_data.py --private-data PRIVATE_DIRECTORY` can regenerate just the display files.

## Add rollout media

Place GIF, WebP, MP4 or WebM files under `assets/rollouts/`. In `data/tasks.json`, populate a task's `media` mapping:

```json
{"media":{"openvla-oft-m":{"D01":"assets/rollouts/oft-m-goal3-D01.mp4"}}}
```

Use only genuine evaluation media for the matching model, task and perturbation. Missing media renders as a reserved slot. S04 is not applicable to the two Spatial evaluation tasks; D06 is not applicable to Long task 8. These slots show N/A rather than missing scores.

Home uses a separate `data/home-rollouts.json` containing only each public perturbation ID and its video/poster URLs. These illustrative clips are not evidence for any leaderboard score. Trial seeds, outcomes, source archive names and hashes remain in the external local review directory.

All 42 examples use the latest available task/perturbation batch and preserve the paper illustration's task. Selection never uses success/failure as a criterion. Videos and posters are rotated 180° to display upright; original duration and playback speed are preserved. Silent H.264 MP4 loops provide the animated-image effect with a WebP poster.

To rebuild these assets from authorized local archives and illustration manifests (OpenCV, Pillow and imageio-ffmpeg required):

```sh
python scripts/build_home_rollouts.py --source ARCHIVE_DIRECTORY --review-dir LOCAL_REVIEW_DIRECTORY --static-manifest STATIC_MANIFEST_JSON --dynamic-manifest DYNAMIC_MANIFEST_JSON --build
```

`LOCAL_REVIEW_DIRECTORY` must be outside the public repository. Without `--build`, the script only prepares local contact sheets and a source-selection audit. With `--build`, the full `home-rollouts-internal.json` stays in that review directory; the website gets only media references. Original archives remain untouched. Older batches are never substituted when a task has no video in the latest suite revision.

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

GitHub Pages publishes the root of `site-framework-experiment`, the default branch of `racingemperor/LIBERO-Pro`. Only `origin` is updated. The original upstream website and `master` branch are unchanged.
