(function () {
  'use strict';

  const DATA_PATH = 'data/leaderboard.json';
  const TASK_LABELS = {
    goal: 'LIBERO-Goal',
    object: 'LIBERO-Object',
    spatial: 'LIBERO-Spatial',
    libero10: 'LIBERO-10'
  };

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
  }

  function scoreCell(value, className) {
    const cell = document.createElement('td');
    cell.className = `leaderboard-score ${className || ''}`.trim();
    cell.textContent = formatPercent(value);
    if (!Number.isFinite(value)) cell.classList.add('is-missing');
    return cell;
  }

  function renderMetadata(data) {
    const scores = data.entries.map((entry) => entry.scores.perturbed);
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

  function renderTable(data, sortKey) {
    const body = document.getElementById('leaderboard-body');
    if (!body) return;

    const entries = [...data.entries].sort((left, right) => {
      const leftValue = left.scores[sortKey];
      const rightValue = right.scores[sortKey];
      if (!Number.isFinite(leftValue)) return 1;
      if (!Number.isFinite(rightValue)) return -1;
      return rightValue - leftValue || left.model.localeCompare(right.model);
    });

    body.replaceChildren();
    entries.forEach((entry, index) => {
      const row = document.createElement('tr');

      const rank = document.createElement('td');
      rank.className = 'is-sticky-rank leaderboard-rank';
      rank.textContent = index + 1;
      row.appendChild(rank);

      const model = document.createElement('td');
      model.className = 'is-sticky-model leaderboard-model';
      model.textContent = entry.model;
      row.appendChild(model);

      const category = document.createElement('td');
      category.className = 'leaderboard-category';
      category.textContent = entry.category;
      row.appendChild(category);

      row.appendChild(scoreCell(entry.scores.perturbed, sortKey === 'perturbed' ? 'is-primary-metric' : ''));
      row.appendChild(scoreCell(entry.scores.base, sortKey === 'base' ? 'is-primary-metric' : ''));
      row.appendChild(scoreCell(entry.scores.drop, 'leaderboard-drop'));
      row.appendChild(scoreCell(entry.scores.static, sortKey === 'static' ? 'is-primary-metric' : ''));
      row.appendChild(scoreCell(entry.scores.dynamic, sortKey === 'dynamic' ? 'is-primary-metric' : ''));
      row.appendChild(scoreCell(entry.tasks.goal));
      row.appendChild(scoreCell(entry.tasks.object));
      row.appendChild(scoreCell(entry.tasks.spatial));
      row.appendChild(scoreCell(entry.tasks.libero10));

      const coverage = document.createElement('td');
      coverage.className = 'leaderboard-coverage';
      coverage.textContent = `${entry.coverage.valid}/${entry.coverage.expected}`;
      row.appendChild(coverage);

      body.appendChild(row);
    });

    document.querySelectorAll('[data-score-heading]').forEach((heading) => {
      heading.classList.toggle('is-primary-metric', heading.dataset.scoreHeading === sortKey);
    });
  }

  function renderSuiteLeaders(data) {
    const container = document.getElementById('leaderboard-suite-leaders');
    if (!container) return;

    container.replaceChildren();
    Object.entries(TASK_LABELS).forEach(([key, label]) => {
      const leader = [...data.entries].sort((left, right) => right.tasks[key] - left.tasks[key])[0];
      const item = document.createElement('article');
      item.className = 'leaderboard-suite-item';

      const task = document.createElement('span');
      task.className = 'leaderboard-suite-name';
      task.textContent = label;

      const model = document.createElement('strong');
      model.className = 'leaderboard-suite-model';
      model.textContent = leader.model;

      const score = document.createElement('span');
      score.className = 'leaderboard-suite-score';
      score.textContent = formatPercent(leader.tasks[key]);

      item.append(task, model, score);
      container.appendChild(item);
    });
  }

  function showError() {
    const body = document.getElementById('leaderboard-body');
    if (!body) return;
    body.innerHTML = '<tr class="benchmark-table-empty"><td colspan="13">Leaderboard data could not be loaded</td></tr>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch(DATA_PATH)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        let sortKey = data.methodology.primaryMetric;
        renderMetadata(data);
        renderTable(data, sortKey);
        renderSuiteLeaders(data);

        document.querySelectorAll('[data-sort-key]').forEach((button) => {
          button.addEventListener('click', function () {
            sortKey = button.dataset.sortKey;
            document.querySelectorAll('[data-sort-key]').forEach((candidate) => {
              const active = candidate === button;
              candidate.classList.toggle('is-active', active);
              candidate.setAttribute('aria-pressed', String(active));
            });
            renderTable(data, sortKey);
          });
        });
      })
      .catch(showError);
  });
}());
