(function () {
  'use strict';

  const DATA_PATH = 'data/leaderboard.json';
  const METRICS = {
    perturbed: {
      label: 'Perturbed SR',
      title: 'Perturbed success rate',
      caption: 'Mean over available non-RQ perturbation scores',
      color: '#2457c5'
    },
    static: {
      label: 'Static SR',
      title: 'Static perturbation success rate',
      caption: 'Mean over 83 applicable static perturbation scores',
      color: '#b66a13'
    },
    dynamic: {
      label: 'Dynamic SR',
      title: 'Dynamic perturbation success rate',
      caption: 'Mean over 80 applicable dynamic perturbation scores',
      color: '#177665'
    },
    base: {
      label: 'Base SR',
      title: 'Base-task success rate',
      caption: 'Mean of four suite BASE scores when all values are available',
      color: '#58677b'
    }
  };
  const TASK_LABELS = {
    goal: 'LIBERO-Goal',
    object: 'LIBERO-Object',
    spatial: 'LIBERO-Spatial',
    libero10: 'LIBERO-10'
  };
  const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');
  const DECIMAL_FORMATTER = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? PERCENT_FORMATTER.format(value) : '—';
  }

  function formatPoints(value) {
    return Number.isFinite(value) ? `${DECIMAL_FORMATTER.format(value * 100)} points` : 'unavailable';
  }

  function scoreWidth(value) {
    return Number.isFinite(value) ? `${Math.max(0, Math.min(100, value * 100))}%` : '0%';
  }

  function sortedEntries(entries, metric) {
    return [...entries].sort((left, right) => {
      const leftValue = left.scores[metric];
      const rightValue = right.scores[metric];
      if (!Number.isFinite(leftValue) && !Number.isFinite(rightValue)) return left.model.localeCompare(right.model);
      if (!Number.isFinite(leftValue)) return 1;
      if (!Number.isFinite(rightValue)) return -1;
      return rightValue - leftValue || left.model.localeCompare(right.model);
    });
  }

  function renderMetadata(data) {
    setText('leaderboard-model-count', NUMBER_FORMATTER.format(data.entries.length));
    setText('leaderboard-suite-count', NUMBER_FORMATTER.format(data.scope.suites));
    setText('leaderboard-direction-count', NUMBER_FORMATTER.format(data.scope.perturbationDirections));
    setText('leaderboard-cell-count', NUMBER_FORMATTER.format(data.scope.applicableScoreCellsPerModel));

    const updated = document.getElementById('leaderboard-updated');
    if (updated) {
      const date = new Date(`${data.snapshot.accessed}T00:00:00Z`);
      updated.dateTime = data.snapshot.accessed;
      updated.textContent = Number.isNaN(date.getTime()) ? data.snapshot.accessed : DATE_FORMATTER.format(date);
    }

    const source = document.getElementById('leaderboard-source-link');
    if (source) source.href = data.snapshot.sourceUrl;
    const counts = document.getElementById('leaderboard-counts-link');
    if (counts) counts.href = data.snapshot.completedEvaluationCountsUrl;
  }

  function populateCategories(data) {
    const select = document.getElementById('leaderboard-category-filter');
    if (!select) return;

    [...new Set(data.entries.map((entry) => entry.category))]
      .sort((left, right) => left.localeCompare(right))
      .forEach((category) => {
        const option = createElement('option', '', category);
        option.value = category;
        select.appendChild(option);
      });
  }

  function getVisibleEntries(data, state) {
    const query = state.query.trim().toLocaleLowerCase();
    return data.entries.filter((entry) => {
      const matchesCategory = state.category === 'all' || entry.category === state.category;
      const searchable = `${entry.model} ${entry.category}`.toLocaleLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
  }

  function renderResultSummary(data, entries, metric) {
    const summary = document.getElementById('leaderboard-result-summary');
    if (!summary) return;

    if (!entries.length) {
      summary.textContent = 'No models match the current filters.';
      return;
    }

    const leader = sortedEntries(entries, metric)[0];
    summary.textContent = `Showing ${entries.length} of ${data.entries.length} models · Leader: ${leader.model} at ${formatPercent(leader.scores[metric])}`;
  }

  function renderRanking(entries, state, onSelect) {
    const chart = document.getElementById('leaderboard-ranking-chart');
    if (!chart) return;

    const metric = METRICS[state.metric];
    setText('leaderboard-chart-title', metric.title);
    setText('leaderboard-chart-caption', metric.caption);
    setText('leaderboard-metric-key', metric.label);
    chart.style.setProperty('--lb-metric', metric.color);
    chart.setAttribute('aria-busy', 'false');
    chart.replaceChildren();

    if (!entries.length) {
      chart.appendChild(createElement('p', 'lb-state lb-empty-state', 'No matching models. Change the search or category filter.'));
      return;
    }

    sortedEntries(entries, state.metric).forEach((entry, index) => {
      const value = entry.scores[state.metric];
      const row = createElement('button', 'lb-chart-row');
      row.type = 'button';
      row.classList.toggle('is-selected', entry.model === state.selectedModel);
      row.classList.toggle('is-missing', !Number.isFinite(value));
      row.setAttribute('aria-pressed', String(entry.model === state.selectedModel));
      row.setAttribute('aria-label', `Rank ${index + 1}, ${entry.model}, ${metric.label} ${formatPercent(value)}`);
      row.addEventListener('click', () => onSelect(entry.model));

      const identity = createElement('span', 'lb-chart-identity');
      identity.append(
        createElement('span', 'lb-chart-model', entry.model),
        createElement('span', 'lb-chart-category', entry.category)
      );

      const track = createElement('span', 'lb-chart-track');
      const fill = createElement('span', 'lb-chart-fill');
      fill.style.setProperty('--score-width', scoreWidth(value));
      track.appendChild(fill);

      row.append(
        createElement('span', 'lb-chart-rank', String(index + 1)),
        identity,
        track,
        createElement('span', 'lb-chart-value', formatPercent(value))
      );
      chart.appendChild(row);
    });
  }

  function createProfileBar(label, value, modifier) {
    const row = createElement('div', `lb-profile-bar ${modifier || ''}`.trim());
    const labelElement = createElement('span', 'lb-profile-bar-label', label);
    const track = createElement('span', 'lb-profile-bar-track');
    const fill = createElement('span', 'lb-profile-bar-fill');
    const valueElement = createElement('span', 'lb-profile-bar-value', formatPercent(value));

    fill.style.setProperty('--score-width', scoreWidth(value));
    track.appendChild(fill);
    row.append(labelElement, track, valueElement);
    if (!Number.isFinite(value)) row.classList.add('is-missing');
    return row;
  }

  function renderModelDetail(data, state) {
    const panel = document.getElementById('leaderboard-model-detail');
    if (!panel) return;

    const entry = data.entries.find((candidate) => candidate.model === state.selectedModel);
    panel.replaceChildren();
    panel.style.setProperty('--lb-metric', METRICS[state.metric].color);

    if (!entry) {
      panel.appendChild(createElement('p', 'lb-state lb-empty-state', 'Select a model from the ranking to inspect it.'));
      return;
    }

    const header = createElement('div', 'lb-profile-head');
    const identity = createElement('div', 'lb-profile-identity');
    identity.append(
      createElement('h3', '', entry.model),
      createElement('p', '', entry.category)
    );
    const activeMetric = createElement('div', 'lb-profile-active');
    activeMetric.append(
      createElement('strong', '', formatPercent(entry.scores[state.metric])),
      createElement('span', '', METRICS[state.metric].label)
    );
    header.append(identity, activeMetric);

    const comparison = createElement('section', 'lb-profile-group');
    comparison.appendChild(createElement('h4', '', 'Base to perturbation'));
    const comparisonBars = createElement('div', 'lb-profile-bars');
    comparisonBars.append(
      createProfileBar('Base', entry.scores.base, 'is-base'),
      createProfileBar('Perturbed', entry.scores.perturbed, 'is-perturbed')
    );
    comparison.appendChild(comparisonBars);

    const drop = createElement('p', 'lb-drop-summary');
    if (Number.isFinite(entry.scores.drop)) {
      drop.textContent = `${formatPoints(entry.scores.drop)} lower under perturbation.`;
    } else {
      drop.textContent = 'Base score unavailable; robustness drop is not calculated.';
    }
    comparison.appendChild(drop);

    const split = createElement('section', 'lb-profile-group');
    split.appendChild(createElement('h4', '', 'Perturbation split'));
    const splitBars = createElement('div', 'lb-profile-bars');
    splitBars.append(
      createProfileBar('Static', entry.scores.static, 'is-static'),
      createProfileBar('Dynamic', entry.scores.dynamic, 'is-dynamic')
    );
    split.appendChild(splitBars);

    const tasks = createElement('section', 'lb-profile-group');
    tasks.appendChild(createElement('h4', '', 'By suite'));
    const taskBars = createElement('div', 'lb-profile-bars lb-task-bars');
    Object.entries(TASK_LABELS).forEach(([key, label]) => {
      taskBars.appendChild(createProfileBar(label, entry.tasks[key], 'is-task'));
    });
    tasks.appendChild(taskBars);

    const coverage = createElement(
      'p',
      'lb-profile-coverage',
      `Coverage ${entry.coverage.valid}/${entry.coverage.expected} applicable scores`
    );

    panel.append(header, comparison, split, tasks, coverage);
    const provenance = createElement('p', 'lb-profile-coverage');
    const sourceLink = createElement('a', '', entry.source?.label || 'Source sheet');
    sourceLink.href = entry.source?.url || data.snapshot.sourceUrl;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    if (entry.source) {
      provenance.append(document.createTextNode(
        `${NUMBER_FORMATTER.format(entry.source.completedEpisodes)} completed episodes · ` +
        `${entry.source.baseTasks} tasks · ${entry.source.trialsPerCase} rollouts per case. `
      ));
    }
    provenance.append(sourceLink);
    panel.append(provenance);
  }

  function scoreCell(value, metric, isPrimary) {
    const cell = createElement('td', 'lb-score-cell');
    cell.classList.toggle('is-primary-metric', isPrimary);
    cell.classList.toggle('is-missing', !Number.isFinite(value));
    cell.dataset.metric = metric;
    cell.textContent = formatPercent(value);
    return cell;
  }

  function renderTable(entries, state, onSelect) {
    const body = document.getElementById('leaderboard-body');
    if (!body) return;

    body.replaceChildren();
    if (!entries.length) {
      const row = createElement('tr', 'benchmark-table-empty');
      const cell = createElement('td', '', 'No matching models.');
      cell.colSpan = 13;
      row.appendChild(cell);
      body.appendChild(row);
    } else {
      sortedEntries(entries, state.metric).forEach((entry, index) => {
        const row = document.createElement('tr');
        row.classList.toggle('is-selected', entry.model === state.selectedModel);

        const rank = createElement('td', 'is-sticky-rank lb-rank', String(index + 1));
        const model = createElement('td', 'is-sticky-model lb-model');
        const modelButton = createElement('button', 'lb-model-button', entry.model);
        modelButton.type = 'button';
        modelButton.setAttribute('aria-label', `Inspect ${entry.model}`);
        modelButton.addEventListener('click', () => onSelect(entry.model));
        model.appendChild(modelButton);

        row.append(
          rank,
          model,
          createElement('td', 'lb-category-cell', entry.category),
          scoreCell(entry.scores.perturbed, 'perturbed', state.metric === 'perturbed'),
          scoreCell(entry.scores.base, 'base', state.metric === 'base'),
          scoreCell(entry.scores.drop, 'drop', false),
          scoreCell(entry.scores.static, 'static', state.metric === 'static'),
          scoreCell(entry.scores.dynamic, 'dynamic', state.metric === 'dynamic'),
          scoreCell(entry.tasks.goal, 'goal', false),
          scoreCell(entry.tasks.object, 'object', false),
          scoreCell(entry.tasks.spatial, 'spatial', false),
          scoreCell(entry.tasks.libero10, 'libero10', false),
          createElement('td', 'lb-coverage-cell', `${entry.coverage.valid}/${entry.coverage.expected}`)
        );
        body.appendChild(row);
      });
    }

    document.querySelectorAll('[data-score-heading]').forEach((heading) => {
      const active = heading.dataset.scoreHeading === state.metric;
      heading.classList.toggle('is-primary-metric', active);
      heading.setAttribute('aria-sort', active ? 'descending' : 'none');
    });
  }

  function renderTaskLeaders(data) {
    const container = document.getElementById('leaderboard-suite-leaders');
    if (!container) return;

    container.replaceChildren();
    Object.entries(TASK_LABELS).forEach(([key, label]) => {
      const leader = [...data.entries].sort((left, right) => right.tasks[key] - left.tasks[key])[0];
      const item = createElement('article', 'lb-task-leader');
      const text = createElement('div', 'lb-task-leader-copy');
      text.append(
        createElement('h3', '', label),
        createElement('p', '', leader.model)
      );
      const result = createElement('div', 'lb-task-leader-result');
      result.append(
        createElement('strong', '', formatPercent(leader.tasks[key])),
        createElement('span', '', 'Perturbed SR')
      );
      const track = createElement('span', 'lb-task-leader-track');
      const fill = createElement('span', 'lb-task-leader-fill');
      fill.style.setProperty('--score-width', scoreWidth(leader.tasks[key]));
      track.appendChild(fill);
      item.append(text, result, track);
      container.appendChild(item);
    });
  }

  function showError() {
    setText('leaderboard-result-summary', 'Leaderboard data could not be loaded. Reload the page to try again.');
    const body = document.getElementById('leaderboard-body');
    const chart = document.getElementById('leaderboard-ranking-chart');
    const detail = document.getElementById('leaderboard-model-detail');
    if (body) body.innerHTML = '<tr class="benchmark-table-empty"><td colspan="13">Leaderboard data could not be loaded. Reload the page to try again.</td></tr>';
    if (chart) {
      chart.setAttribute('aria-busy', 'false');
      chart.textContent = 'Leaderboard data could not be loaded. Reload the page to try again.';
    }
    if (detail) detail.textContent = 'Model profile could not be loaded. Reload the page to try again.';
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch(DATA_PATH)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        populateCategories(data);
        renderMetadata(data);
        renderTaskLeaders(data);

        const state = {
          metric: data.methodology.primaryMetric,
          selectedModel: '',
          category: 'all',
          query: ''
        };

        const search = document.getElementById('leaderboard-search');
        const category = document.getElementById('leaderboard-category-filter');
        const clear = document.getElementById('leaderboard-clear-filters');
        const toolbar = document.getElementById('leaderboard-toolbar');

        function readUrlState() {
          const params = new URLSearchParams(window.location.search);
          const metric = params.get('metric');
          state.metric = Object.hasOwn(METRICS, metric) ? metric : data.methodology.primaryMetric;
          state.query = params.get('q') || '';
          state.category = params.get('category') || 'all';
          state.selectedModel = params.get('model') || '';

          const categories = new Set(data.entries.map((entry) => entry.category));
          if (state.category !== 'all' && !categories.has(state.category)) state.category = 'all';
        }

        function normalizeSelection(entries) {
          if (!entries.some((entry) => entry.model === state.selectedModel)) {
            state.selectedModel = entries.length ? sortedEntries(entries, state.metric)[0].model : '';
          }
        }

        function writeUrl(mode) {
          const url = new URL(window.location.href);
          url.searchParams.set('metric', state.metric);
          if (state.selectedModel) url.searchParams.set('model', state.selectedModel);
          else url.searchParams.delete('model');
          if (state.category !== 'all') url.searchParams.set('category', state.category);
          else url.searchParams.delete('category');
          if (state.query) url.searchParams.set('q', state.query);
          else url.searchParams.delete('q');
          window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url);
        }

        function syncControls() {
          document.querySelector('.leaderboard-page')?.style.setProperty('--lb-metric', METRICS[state.metric].color);
          document.querySelectorAll('[data-sort-key]').forEach((button) => {
            const active = button.dataset.sortKey === state.metric;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
          });
          if (search && search.value !== state.query) search.value = state.query;
          if (category) category.value = state.category;
          if (clear) clear.hidden = state.category === 'all' && !state.query;
        }

        function renderAll(historyMode) {
          const entries = getVisibleEntries(data, state);
          normalizeSelection(entries);
          syncControls();
          renderResultSummary(data, entries, state.metric);
          renderRanking(entries, state, selectModel);
          renderModelDetail(data, state);
          renderTable(entries, state, selectModel);
          if (historyMode) writeUrl(historyMode);
        }

        function selectModel(model) {
          state.selectedModel = model;
          renderAll('push');
        }

        function selectMetric(metric) {
          if (!Object.hasOwn(METRICS, metric) || metric === state.metric) return;
          state.metric = metric;
          renderAll('push');
        }

        readUrlState();
        renderAll('replace');

        toolbar?.addEventListener('submit', (event) => event.preventDefault());
        search?.addEventListener('input', () => {
          state.query = search.value;
          renderAll('replace');
        });
        category?.addEventListener('change', () => {
          state.category = category.value;
          renderAll('push');
        });
        clear?.addEventListener('click', () => {
          state.query = '';
          state.category = 'all';
          renderAll('push');
          search?.focus();
        });
        document.querySelectorAll('[data-sort-key]').forEach((button) => {
          button.addEventListener('click', () => selectMetric(button.dataset.sortKey));
        });
        document.querySelectorAll('[data-table-sort]').forEach((button) => {
          button.addEventListener('click', () => selectMetric(button.dataset.tableSort));
        });
        window.addEventListener('popstate', () => {
          readUrlState();
          renderAll('');
        });
      })
      .catch(showError);
  });
}());
