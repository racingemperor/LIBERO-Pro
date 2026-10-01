(function () {
  'use strict';

  const DATA_PATH = 'data/leaderboard.json';
  const METRICS = {
    perturbed: {
      label: 'Perturbed SR',
      title: 'Perturbed success rate by model',
      caption: 'Mean over available non-RQ perturbed evaluations',
      color: '#5b5bd6',
      tint: '#efefff'
    },
    static: {
      label: 'Static SR',
      title: 'Static success rate by model',
      caption: 'Mean over 83 applicable static perturbation scores',
      color: '#c28a18',
      tint: '#fff6df'
    },
    dynamic: {
      label: 'Dynamic SR',
      title: 'Dynamic success rate by model',
      caption: 'Mean over 80 applicable dynamic perturbation scores',
      color: '#16836b',
      tint: '#e9f7f3'
    },
    base: {
      label: 'Base SR',
      title: 'Base success rate by model',
      caption: 'Mean of four base tasks when all values are available',
      color: '#3f72c6',
      tint: '#edf4ff'
    }
  };
  const SCORE_COLORS = {
    perturbed: '#5b5bd6',
    base: '#3f72c6',
    drop: '#d45142',
    static: '#c28a18',
    dynamic: '#16836b',
    goal: '#6e59d9',
    object: '#218c74',
    spatial: '#be8616',
    libero10: '#d45142'
  };
  const CATEGORY_COLORS = {
    'Mainstream VLA': '#5968c7',
    'Robustness-oriented': '#d28931',
    'World Action Models': '#2b9685'
  };
  const TASK_LABELS = {
    goal: 'LIBERO-Goal',
    object: 'LIBERO-Object',
    spatial: 'LIBERO-Spatial',
    libero10: 'LIBERO-10'
  };

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
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
  }

  function formatPoints(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)} points` : 'unavailable';
  }

  function scoreWidth(value) {
    return Number.isFinite(value) ? `${Math.max(0, Math.min(100, value * 100))}%` : '0%';
  }

  function categoryColor(category) {
    return CATEGORY_COLORS[category] || '#6f7781';
  }

  function sortedEntries(entries, sortKey) {
    return [...entries].sort((left, right) => {
      const leftValue = left.scores[sortKey];
      const rightValue = right.scores[sortKey];
      if (!Number.isFinite(leftValue) && !Number.isFinite(rightValue)) return left.model.localeCompare(right.model);
      if (!Number.isFinite(leftValue)) return 1;
      if (!Number.isFinite(rightValue)) return -1;
      return rightValue - leftValue || left.model.localeCompare(right.model);
    });
  }

  function scoreCell(value, metricKey, isPrimary) {
    const cell = createElement('td', `leaderboard-score${isPrimary ? ' is-primary-metric' : ''}`);
    const shell = createElement('span', 'leaderboard-score-shell');
    const fill = createElement('span', 'leaderboard-score-fill');
    const text = createElement('span', 'leaderboard-score-text', formatPercent(value));
    const color = SCORE_COLORS[metricKey] || '#5968c7';

    shell.style.setProperty('--score-color', color);
    fill.style.setProperty('--score-color', color);
    fill.style.setProperty('--score-width', scoreWidth(value));
    shell.append(fill, text);
    cell.appendChild(shell);
    if (!Number.isFinite(value)) cell.classList.add('is-missing');
    if (metricKey === 'drop') cell.classList.add('leaderboard-drop');
    return cell;
  }

  function renderMetadata(data) {
    const scores = data.entries.map((entry) => entry.scores.perturbed).filter(Number.isFinite);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    setText('leaderboard-model-count', data.entries.length);
    setText('leaderboard-suite-count', data.scope.baseTasks);
    setText('leaderboard-direction-count', data.scope.perturbationDirections);
    setText('leaderboard-cell-count', data.scope.applicableScoreCellsPerModel);
    setText('leaderboard-updated', data.snapshot.accessed);
    setText('leaderboard-best-score', formatPercent(Math.max(...scores)));
    setText('leaderboard-mean-score', formatPercent(mean));
    setText('leaderboard-static-count', data.scope.applicableStaticScoreCells);
    setText('leaderboard-dynamic-count', data.scope.applicableDynamicScoreCells);
  }

  function renderRanking(data, sortKey, selectedModel, onSelect) {
    const container = document.getElementById('leaderboard-ranking-chart');
    const panel = container && container.closest('.leaderboard-ranking-panel');
    const metric = METRICS[sortKey];
    if (!container || !panel || !metric) return;

    panel.style.setProperty('--metric-color', metric.color);
    panel.style.setProperty('--metric-tint', metric.tint);
    setText('leaderboard-chart-title', metric.title);
    setText('leaderboard-chart-caption', metric.caption);

    const metricKey = document.getElementById('leaderboard-metric-key');
    if (metricKey) metricKey.replaceChildren(createElement('span'), document.createTextNode(metric.label));

    container.replaceChildren();
    sortedEntries(data.entries, sortKey).forEach((entry, index) => {
      const value = entry.scores[sortKey];
      const row = createElement('button', 'leaderboard-chart-row');
      row.type = 'button';
      row.classList.toggle('is-selected', entry.model === selectedModel);
      row.classList.toggle('is-missing', !Number.isFinite(value));
      row.setAttribute('aria-pressed', String(entry.model === selectedModel));
      row.setAttribute('aria-label', `${entry.model}, ${metric.label} ${formatPercent(value)}`);
      row.style.setProperty('--category-color', categoryColor(entry.category));
      row.addEventListener('click', () => onSelect(entry.model));

      const rank = createElement('span', 'leaderboard-chart-rank', String(index + 1));
      const model = createElement('span', 'leaderboard-chart-model');
      model.append(
        createElement('span', 'leaderboard-category-dot'),
        createElement('span', 'leaderboard-chart-model-name', entry.model)
      );

      const track = createElement('span', 'leaderboard-chart-track');
      const fill = createElement('span', 'leaderboard-chart-fill');
      fill.style.setProperty('--score-width', scoreWidth(value));
      track.appendChild(fill);

      row.append(rank, model, track, createElement('span', 'leaderboard-chart-value', formatPercent(value)));
      container.appendChild(row);
    });
  }

  function profileMetric(label, value, className) {
    const item = createElement('div', `leaderboard-profile-metric ${className}`);
    if (!Number.isFinite(value)) item.classList.add('is-missing');
    item.append(
      createElement('span', 'leaderboard-profile-metric-label', label),
      createElement('strong', 'leaderboard-profile-metric-value', formatPercent(value))
    );
    return item;
  }

  function renderModelDetail(data, sortKey, selectedModel) {
    const panel = document.getElementById('leaderboard-model-detail');
    const entry = data.entries.find((candidate) => candidate.model === selectedModel);
    const metric = METRICS[sortKey];
    if (!panel || !entry || !metric) return;

    const ranking = sortedEntries(data.entries, sortKey);
    const rank = ranking.findIndex((candidate) => candidate.model === entry.model) + 1;
    const score = entry.scores[sortKey];
    panel.style.setProperty('--metric-color', metric.color);
    panel.style.setProperty('--metric-tint', metric.tint);
    panel.replaceChildren();

    const head = createElement('div', 'leaderboard-profile-head');
    const heading = createElement('div');
    heading.append(
      createElement('p', 'leaderboard-profile-eyebrow', 'Selected model'),
      createElement('h3', 'leaderboard-profile-name', entry.model)
    );
    const badge = createElement('span', 'leaderboard-category-badge', entry.category);
    badge.style.setProperty('--category-color', categoryColor(entry.category));
    head.append(heading, badge);

    const focus = createElement('div', 'leaderboard-score-focus');
    const ring = createElement('div', 'leaderboard-score-ring');
    ring.style.setProperty('--score', Number.isFinite(score) ? String(score * 100) : '0');
    if (!Number.isFinite(score)) ring.classList.add('is-missing');
    const ringCopy = createElement('div', 'leaderboard-score-ring-copy');
    ringCopy.append(
      createElement('strong', 'leaderboard-score-ring-value', formatPercent(score)),
      createElement('span', 'leaderboard-score-ring-label', metric.label)
    );
    ring.appendChild(ringCopy);

    const focusCopy = createElement('div', 'leaderboard-focus-copy');
    const rankText = Number.isFinite(score) ? `${metric.label} rank #${rank}` : `${metric.label} unavailable`;
    focusCopy.append(
      createElement('strong', '', rankText),
      createElement('span', '', `Robustness drop: ${formatPoints(entry.scores.drop)}`),
      createElement('span', '', `Coverage: ${entry.coverage.valid}/${entry.coverage.expected} applicable scores`)
    );
    focus.append(ring, focusCopy);

    const metrics = createElement('div', 'leaderboard-profile-metrics');
    metrics.append(
      profileMetric('Perturbed SR', entry.scores.perturbed, 'is-perturbed'),
      profileMetric('Base SR', entry.scores.base, 'is-base'),
      profileMetric('Static SR', entry.scores.static, 'is-static'),
      profileMetric('Dynamic SR', entry.scores.dynamic, 'is-dynamic')
    );

    const tasks = createElement('div', 'leaderboard-task-profile');
    tasks.appendChild(createElement('h4', 'leaderboard-task-profile-title', 'Base-task perturbed SR'));
    Object.entries(TASK_LABELS).forEach(([key, label]) => {
      const taskValue = entry.tasks[key];
      const row = createElement('div', 'leaderboard-task-bar');
      const track = createElement('span', 'leaderboard-task-track');
      const fill = createElement('span', 'leaderboard-task-fill');
      fill.style.setProperty('--score-width', scoreWidth(taskValue));
      fill.style.setProperty('--task-color', SCORE_COLORS[key]);
      track.appendChild(fill);
      row.append(
        createElement('span', 'leaderboard-task-name', label),
        track,
        createElement('span', 'leaderboard-task-value', formatPercent(taskValue))
      );
      tasks.appendChild(row);
    });

    panel.append(head, focus, metrics, tasks);
  }

  function renderTable(data, sortKey, selectedModel, onSelect) {
    const body = document.getElementById('leaderboard-body');
    if (!body) return;

    body.replaceChildren();
    sortedEntries(data.entries, sortKey).forEach((entry, index) => {
      const row = document.createElement('tr');
      row.classList.toggle('is-selected', entry.model === selectedModel);

      const rank = createElement('td', 'is-sticky-rank leaderboard-rank', String(index + 1));
      const model = createElement('td', 'is-sticky-model leaderboard-model');
      const modelButton = createElement('button', 'leaderboard-model-button', entry.model);
      modelButton.type = 'button';
      modelButton.setAttribute('aria-label', `View ${entry.model} performance profile`);
      modelButton.addEventListener('click', () => onSelect(entry.model));
      model.appendChild(modelButton);

      const category = createElement('td', 'leaderboard-category');
      const categoryLabel = createElement('span', 'leaderboard-category-badge', entry.category);
      categoryLabel.style.setProperty('--category-color', categoryColor(entry.category));
      category.appendChild(categoryLabel);

      row.append(rank, model, category);
      row.appendChild(scoreCell(entry.scores.perturbed, 'perturbed', sortKey === 'perturbed'));
      row.appendChild(scoreCell(entry.scores.base, 'base', sortKey === 'base'));
      row.appendChild(scoreCell(entry.scores.drop, 'drop', false));
      row.appendChild(scoreCell(entry.scores.static, 'static', sortKey === 'static'));
      row.appendChild(scoreCell(entry.scores.dynamic, 'dynamic', sortKey === 'dynamic'));
      row.appendChild(scoreCell(entry.tasks.goal, 'goal', false));
      row.appendChild(scoreCell(entry.tasks.object, 'object', false));
      row.appendChild(scoreCell(entry.tasks.spatial, 'spatial', false));
      row.appendChild(scoreCell(entry.tasks.libero10, 'libero10', false));

      const coverage = createElement('td', 'leaderboard-coverage', `${entry.coverage.valid}/${entry.coverage.expected}`);
      row.appendChild(coverage);
      body.appendChild(row);
    });

    document.querySelectorAll('[data-score-heading]').forEach((heading) => {
      const active = heading.dataset.scoreHeading === sortKey;
      heading.classList.toggle('is-primary-metric', active);
      heading.style.setProperty('--metric-color', METRICS[sortKey].color);
    });
  }

  function renderSuiteLeaders(data) {
    const container = document.getElementById('leaderboard-suite-leaders');
    if (!container) return;

    container.replaceChildren();
    Object.entries(TASK_LABELS).forEach(([key, label]) => {
      const leader = [...data.entries].sort((left, right) => right.tasks[key] - left.tasks[key])[0];
      const item = createElement('article', 'leaderboard-suite-item');
      const track = createElement('span', 'leaderboard-suite-track');
      const fill = createElement('span', 'leaderboard-suite-fill');
      fill.style.setProperty('--score-width', scoreWidth(leader.tasks[key]));
      track.appendChild(fill);
      item.append(
        createElement('span', 'leaderboard-suite-name', label),
        createElement('strong', 'leaderboard-suite-model', leader.model),
        createElement('span', 'leaderboard-suite-score', formatPercent(leader.tasks[key])),
        track
      );
      container.appendChild(item);
    });
  }

  function showError() {
    const body = document.getElementById('leaderboard-body');
    const chart = document.getElementById('leaderboard-ranking-chart');
    const detail = document.getElementById('leaderboard-model-detail');
    if (body) body.innerHTML = '<tr class="benchmark-table-empty"><td colspan="13">Leaderboard data could not be loaded</td></tr>';
    if (chart) chart.textContent = 'Leaderboard data could not be loaded';
    if (detail) detail.textContent = 'Model profile could not be loaded';
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch(DATA_PATH)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const state = {
          sortKey: data.methodology.primaryMetric,
          selectedModel: sortedEntries(data.entries, data.methodology.primaryMetric)[0].model
        };

        function updateSortControls() {
          const sort = document.querySelector('.leaderboard-sort');
          if (sort) sort.style.setProperty('--metric-color', METRICS[state.sortKey].color);
          document.querySelectorAll('[data-sort-key]').forEach((button) => {
            const active = button.dataset.sortKey === state.sortKey;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
          });
        }

        function selectModel(model) {
          state.selectedModel = model;
          renderExplorer();
        }

        function renderExplorer() {
          renderRanking(data, state.sortKey, state.selectedModel, selectModel);
          renderModelDetail(data, state.sortKey, state.selectedModel);
          renderTable(data, state.sortKey, state.selectedModel, selectModel);
        }

        renderMetadata(data);
        renderSuiteLeaders(data);
        updateSortControls();
        renderExplorer();

        document.querySelectorAll('[data-sort-key]').forEach((button) => {
          button.addEventListener('click', function () {
            state.sortKey = button.dataset.sortKey;
            state.selectedModel = sortedEntries(data.entries, state.sortKey)[0].model;
            updateSortControls();
            renderExplorer();
          });
        });
      })
      .catch(showError);
  });
}());
