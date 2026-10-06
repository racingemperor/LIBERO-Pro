(function () {
  'use strict';

  const DATA_PATH = 'data/leaderboard.json';
  const NEWS_PATH = 'data/news.json';
  const METRICS = {
    perturbed: { label: 'Perturbed SR', title: 'Perturbed Success Rate', caption: 'Mean over available non-RQ perturbation scores', color: '#2457c5' },
    static: { label: 'Static SR', title: 'Static Perturbation Success Rate', caption: 'Mean over 83 applicable static perturbation scores', color: '#a65d0b' },
    dynamic: { label: 'Dynamic SR', title: 'Dynamic Perturbation Success Rate', caption: 'Mean over 80 applicable dynamic perturbation scores', color: '#087d6b' },
    base: { label: 'Base SR', title: 'Base-Task Success Rate', caption: 'Mean of four suite BASE scores when all values are available', color: '#526273' }
  };
  const TASK_LABELS = { goal: 'LIBERO-Goal', object: 'LIBERO-Object', spatial: 'LIBERO-Spatial', libero10: 'LIBERO-10' };
  const CATEGORY_META = {
    'Mainstream VLA': { label: 'VLA', className: 'is-vla' },
    'World Action Models': { label: 'World Action Model', className: 'is-wam' },
    'Robustness-oriented': { label: 'Robustness-Oriented', className: 'is-robust' }
  };
  const MODEL_MARKS = {
    'Lingbot-VA': 'LB', MolmoAct2: 'M2', 'Cosmos Policy': 'CP', 'π0.5': 'π5', xvla: 'XV', FastWAM: 'FW',
    'GR00T N1.7': 'G7', 'OpenVLA-OFT_m': 'OM', 'OpenVLA-OFT': 'OF', 'OpenVLA-OFT+': 'O+',
    'Anchor-Align': 'AA', 'OpenVLA-OFT_w': 'OW', 'RIPT-VLA': 'RV', 'π0': 'π0'
  };
  const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');
  const DECIMAL_FORMATTER = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

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

  function parseDate(value) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
  }

  function categoryMeta(category) {
    return CATEGORY_META[category] || { label: category, className: 'is-other' };
  }

  function createCategoryTag(category, compact) {
    const meta = categoryMeta(category);
    const tag = createElement('span', `lb-category-tag ${meta.className}`, compact ? meta.label : category);
    tag.title = category;
    return tag;
  }

  function createModelMark(entry, extraClass) {
    const meta = categoryMeta(entry.category);
    const mark = createElement('span', `lb-model-mark ${meta.className}${extraClass ? ` ${extraClass}` : ''}`, MODEL_MARKS[entry.model] || entry.model.slice(0, 2).toUpperCase());
    mark.setAttribute('aria-hidden', 'true');
    return mark;
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

  function fieldMean(entries, metric) {
    const values = entries.map((entry) => entry.scores[metric]).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function createModelHref(state, model) {
    const url = new URL(window.location.href);
    url.searchParams.set('metric', state.metric);
    url.searchParams.set('model', model);
    if (state.category !== 'all') url.searchParams.set('category', state.category);
    else url.searchParams.delete('category');
    if (state.query) url.searchParams.set('q', state.query);
    else url.searchParams.delete('q');
    url.hash = 'leaderboard-model-detail';
    return url.toString();
  }

  function shouldNavigateInPage(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function bindModelLink(link, model, onSelect, revealDetail) {
    link.addEventListener('click', (event) => {
      if (!shouldNavigateInPage(event)) return;
      event.preventDefault();
      onSelect(model, revealDetail);
    });
  }

  function renderMetadata(data) {
    setText('leaderboard-model-count', NUMBER_FORMATTER.format(data.entries.length));
    setText('leaderboard-suite-count', NUMBER_FORMATTER.format(data.scope.suites));
    setText('leaderboard-direction-count', NUMBER_FORMATTER.format(data.scope.perturbationDirections));
    setText('leaderboard-cell-count', NUMBER_FORMATTER.format(data.scope.applicableScoreCellsPerModel));
    const updated = document.getElementById('leaderboard-updated');
    if (updated) {
      updated.dateTime = data.snapshot.accessed;
      updated.textContent = parseDate(data.snapshot.accessed);
    }
    const source = document.getElementById('leaderboard-source-link');
    if (source) source.href = data.snapshot.sourceUrl;
    const counts = document.getElementById('leaderboard-counts-link');
    if (counts) counts.href = data.snapshot.completedEvaluationCountsUrl;
  }

  function renderNews(news) {
    const list = document.getElementById('leaderboard-news-list');
    const status = document.getElementById('leaderboard-news-status');
    if (!list || !status) return;
    const entries = [...(news.entries || [])].sort((left, right) => right.date.localeCompare(left.date));
    list.replaceChildren();
    list.setAttribute('aria-busy', 'false');
    status.textContent = entries.length ? `${NUMBER_FORMATTER.format(entries.length)} published update${entries.length === 1 ? '' : 's'}` : 'No published updates';
    if (!entries.length) {
      list.appendChild(createElement('li', 'lb-state', 'No leaderboard updates have been published yet.'));
      return;
    }
    entries.forEach((entry) => {
      const item = createElement('li', 'lb-news-item');
      const time = createElement('time', 'lb-news-date', parseDate(entry.date));
      time.dateTime = entry.date;
      const copy = createElement('div', 'lb-news-copy');
      copy.append(createElement('h3', '', entry.title), createElement('p', '', entry.summary));
      item.append(time, copy);
      list.appendChild(item);
    });
  }

  function showNewsError() {
    const list = document.getElementById('leaderboard-news-list');
    const status = document.getElementById('leaderboard-news-status');
    if (status) status.textContent = 'Update feed unavailable';
    if (list) {
      list.setAttribute('aria-busy', 'false');
      list.replaceChildren(createElement('li', 'lb-state', 'News could not be loaded. Reload the page to try again.'));
    }
  }

  function populateCategories(data) {
    const select = document.getElementById('leaderboard-category-filter');
    if (!select) return;
    [...new Set(data.entries.map((entry) => entry.category))].sort((left, right) => left.localeCompare(right)).forEach((category) => {
      const option = createElement('option', '', category);
      option.value = category;
      select.appendChild(option);
    });
  }

  function renderCategoryKey(data) {
    const key = document.getElementById('leaderboard-category-key');
    if (!key) return;
    key.replaceChildren(createElement('span', 'lb-category-key-label', 'Model types'));
    [...new Set(data.entries.map((entry) => entry.category))].sort((left, right) => left.localeCompare(right)).forEach((category) => key.appendChild(createCategoryTag(category, false)));
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
      const row = createElement('a', 'lb-chart-row');
      row.href = createModelHref(state, entry.model);
      row.classList.toggle('is-selected', entry.model === state.selectedModel);
      row.classList.toggle('is-missing', !Number.isFinite(value));
      if (entry.model === state.selectedModel) row.setAttribute('aria-current', 'location');
      row.setAttribute('aria-label', `View details for rank ${index + 1}, ${entry.model}, ${metric.label} ${formatPercent(value)}`);
      bindModelLink(row, entry.model, onSelect, false);
      const identity = createElement('span', 'lb-chart-identity');
      const identityCopy = createElement('span', 'lb-chart-identity-copy');
      identityCopy.append(createElement('span', 'lb-chart-model', entry.model), createCategoryTag(entry.category, true));
      identity.append(createModelMark(entry), identityCopy);
      const track = createElement('span', 'lb-chart-track');
      const fill = createElement('span', 'lb-chart-fill');
      fill.style.setProperty('--score-width', scoreWidth(value));
      track.appendChild(fill);
      const rank = createElement('span', `lb-chart-rank${index < 3 ? ` is-top-${index + 1}` : ''}`, String(index + 1));
      row.append(rank, identity, track, createElement('span', 'lb-chart-value', formatPercent(value)));
      chart.appendChild(row);
    });
  }

  function createProfileBar(label, value, modifier) {
    const row = createElement('div', `lb-profile-bar ${modifier || ''}`.trim());
    const track = createElement('span', 'lb-profile-bar-track');
    const fill = createElement('span', 'lb-profile-bar-fill');
    fill.style.setProperty('--score-width', scoreWidth(value));
    track.appendChild(fill);
    row.append(createElement('span', 'lb-profile-bar-label', label), track, createElement('span', 'lb-profile-bar-value', formatPercent(value)));
    if (!Number.isFinite(value)) row.classList.add('is-missing');
    return row;
  }

  function createProfileStat(label, value, modifier) {
    const item = createElement('div', `lb-profile-stat ${modifier || ''}`.trim());
    item.append(createElement('dt', '', label), createElement('dd', '', value));
    return item;
  }

  function createProfileNavigationLink(label, entry, state, onSelect) {
    if (!entry) {
      const disabled = createElement('span', 'lb-profile-nav-link is-disabled', label);
      disabled.setAttribute('aria-disabled', 'true');
      return disabled;
    }
    const link = createElement('a', 'lb-profile-nav-link', label);
    link.href = createModelHref(state, entry.model);
    link.setAttribute('aria-label', `${label}: ${entry.model}`);
    bindModelLink(link, entry.model, onSelect, false);
    return link;
  }

  function renderModelDetail(data, entries, state, onSelect) {
    const panel = document.getElementById('leaderboard-model-detail');
    if (!panel) return;
    const entry = data.entries.find((candidate) => candidate.model === state.selectedModel);
    panel.replaceChildren();
    panel.style.setProperty('--lb-metric', METRICS[state.metric].color);
    if (!entry) {
      panel.appendChild(createElement('p', 'lb-state lb-empty-state', 'Select a model from the ranking to inspect it.'));
      return;
    }
    const orderedEntries = sortedEntries(entries, state.metric);
    const index = orderedEntries.findIndex((candidate) => candidate.model === entry.model);
    const rank = index + 1;
    const metric = METRICS[state.metric];
    const mean = fieldMean(entries, state.metric);
    const delta = Number.isFinite(entry.scores[state.metric]) && Number.isFinite(mean) ? entry.scores[state.metric] - mean : null;
    panel.setAttribute('aria-label', `${entry.model} detailed performance`);
    const navigation = createElement('nav', 'lb-profile-nav');
    navigation.setAttribute('aria-label', 'Browse ranked models');
    navigation.append(
      createProfileNavigationLink('← Previous', orderedEntries[index - 1], state, onSelect),
      createElement('span', 'lb-profile-position', `${rank} / ${orderedEntries.length}`),
      createProfileNavigationLink('Next →', orderedEntries[index + 1], state, onSelect)
    );
    const header = createElement('div', 'lb-profile-head');
    const identity = createElement('div', 'lb-profile-identity');
    const identityLine = createElement('div', 'lb-profile-identity-line');
    const identityCopy = createElement('div', 'lb-profile-identity-copy');
    identityCopy.append(createElement('h3', '', entry.model), createCategoryTag(entry.category, false));
    identityLine.append(createModelMark(entry, 'is-large'), identityCopy);
    identity.append(identityLine, createElement('p', '', `Rank ${rank} of ${orderedEntries.length} by ${metric.label}`));
    const activeMetric = createElement('div', 'lb-profile-active');
    activeMetric.append(createElement('strong', '', formatPercent(entry.scores[state.metric])), createElement('span', '', metric.label));
    if (Number.isFinite(delta)) {
      activeMetric.appendChild(createElement('small', delta >= 0 ? 'is-positive' : 'is-negative', `${delta >= 0 ? '+' : '−'}${DECIMAL_FORMATTER.format(Math.abs(delta) * 100)} vs. field mean`));
    }
    header.append(identity, activeMetric);
    const stats = createElement('dl', 'lb-profile-stats');
    stats.append(
      createProfileStat('Base SR', formatPercent(entry.scores.base), 'is-base'),
      createProfileStat('Perturbed SR', formatPercent(entry.scores.perturbed), 'is-perturbed'),
      createProfileStat('Robustness Drop', Number.isFinite(entry.scores.drop) ? formatPoints(entry.scores.drop) : '—', 'is-drop'),
      createProfileStat('Coverage', `${entry.coverage.valid}/${entry.coverage.expected}`, 'is-coverage')
    );
    const split = createElement('section', 'lb-profile-group');
    split.appendChild(createElement('h4', '', 'Static vs. Dynamic'));
    const splitBars = createElement('div', 'lb-profile-bars');
    splitBars.append(createProfileBar('Static', entry.scores.static, 'is-static'), createProfileBar('Dynamic', entry.scores.dynamic, 'is-dynamic'));
    split.appendChild(splitBars);
    const tasks = createElement('section', 'lb-profile-group');
    tasks.appendChild(createElement('h4', '', 'LIBERO Suites'));
    const taskBars = createElement('div', 'lb-profile-bars lb-task-bars');
    Object.entries(TASK_LABELS).forEach(([key, label]) => taskBars.appendChild(createProfileBar(label, entry.tasks[key], 'is-task')));
    tasks.appendChild(taskBars);
    const evidence = createElement('section', 'lb-profile-group lb-profile-evidence');
    evidence.appendChild(createElement('h4', '', 'Evidence & Provenance'));
    const evidenceCopy = createElement('p', '');
    evidenceCopy.textContent = entry.source
      ? `${NUMBER_FORMATTER.format(entry.source.completedEpisodes)} completed episodes across ${entry.source.baseTasks} base tasks, with ${entry.source.trialsPerCase} rollouts per case.`
      : 'No model-specific rollout or report is published in this snapshot. The aggregate result is available in the source sheet.';
    const sourceLink = createElement('a', 'lb-evidence-link', entry.source ? 'Open evaluation counts' : 'Open source sheet');
    sourceLink.href = entry.source?.url || data.snapshot.sourceUrl;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    evidence.append(evidenceCopy, sourceLink);
    panel.append(navigation, header, stats, split, tasks, evidence);
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
        const row = createElement('tr', 'lb-model-row');
        row.classList.toggle('is-selected', entry.model === state.selectedModel);
        row.title = `View ${entry.model} details`;
        row.addEventListener('click', (event) => {
          if (event.target.closest('a, button, input, select')) return;
          onSelect(entry.model, true);
        });
        const rank = createElement('td', `is-sticky-rank lb-rank${index < 3 ? ` is-top-${index + 1}` : ''}`);
        rank.appendChild(createElement('span', 'lb-rank-number', String(index + 1)));
        const model = createElement('td', 'is-sticky-model lb-model');
        const modelLink = createElement('a', 'lb-model-button');
        modelLink.href = createModelHref(state, entry.model);
        modelLink.setAttribute('aria-label', `View detailed results for ${entry.model}`);
        if (entry.model === state.selectedModel) modelLink.setAttribute('aria-current', 'location');
        bindModelLink(modelLink, entry.model, onSelect, true);
        const modelCopy = createElement('span', 'lb-model-copy');
        modelCopy.append(createElement('span', 'lb-model-name', entry.model), createElement('span', 'lb-model-open', 'View details'));
        modelLink.append(createModelMark(entry), modelCopy);
        model.appendChild(modelLink);
        const category = createElement('td', 'lb-category-cell');
        category.appendChild(createCategoryTag(entry.category, false));
        row.append(
          rank, model, category,
          scoreCell(entry.scores.perturbed, 'perturbed', state.metric === 'perturbed'),
          scoreCell(entry.scores.base, 'base', state.metric === 'base'),
          scoreCell(entry.scores.drop, 'drop', false),
          scoreCell(entry.scores.static, 'static', state.metric === 'static'),
          scoreCell(entry.scores.dynamic, 'dynamic', state.metric === 'dynamic'),
          scoreCell(entry.tasks.goal, 'goal', false), scoreCell(entry.tasks.object, 'object', false),
          scoreCell(entry.tasks.spatial, 'spatial', false), scoreCell(entry.tasks.libero10, 'libero10', false),
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

  function renderTaskLeaders(data, state, onSelect) {
    const container = document.getElementById('leaderboard-suite-leaders');
    if (!container) return;
    container.replaceChildren();
    Object.entries(TASK_LABELS).forEach(([key, label]) => {
      const leader = [...data.entries].sort((left, right) => right.tasks[key] - left.tasks[key])[0];
      const item = createElement('a', 'lb-task-leader');
      item.href = createModelHref(state, leader.model);
      item.setAttribute('aria-label', `View ${leader.model}, leader for ${label} at ${formatPercent(leader.tasks[key])}`);
      item.addEventListener('click', (event) => {
        if (!shouldNavigateInPage(event)) return;
        event.preventDefault();
        onSelect(leader.model, true, true);
      });
      const text = createElement('div', 'lb-task-leader-copy');
      const model = createElement('div', 'lb-task-leader-model');
      model.append(createModelMark(leader), createElement('p', '', leader.model));
      text.append(createElement('h3', '', label), model);
      const result = createElement('div', 'lb-task-leader-result');
      result.append(createElement('strong', '', formatPercent(leader.tasks[key])), createElement('span', '', 'Perturbed SR'));
      const track = createElement('span', 'lb-task-leader-track');
      track.setAttribute('aria-hidden', 'true');
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

  function revealModelDetail() {
    const panel = document.getElementById('leaderboard-model-detail');
    if (!panel) return;
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      panel.focus({ preventScroll: true });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch(NEWS_PATH).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(renderNews).catch(showNewsError);

    fetch(DATA_PATH).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then((data) => {
      populateCategories(data);
      renderCategoryKey(data);
      renderMetadata(data);
      const state = { metric: data.methodology.primaryMetric, selectedModel: '', category: 'all', query: '' };
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
        if (!entries.some((entry) => entry.model === state.selectedModel)) state.selectedModel = entries.length ? sortedEntries(entries, state.metric)[0].model : '';
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
        renderModelDetail(data, entries, state, selectModel);
        renderTable(entries, state, selectModel);
        renderTaskLeaders(data, state, selectModel);
        if (historyMode) writeUrl(historyMode);
      }

      function selectModel(model, revealDetail, clearFilters) {
        if (clearFilters) {
          state.query = '';
          state.category = 'all';
        }
        const changed = state.selectedModel !== model;
        state.selectedModel = model;
        renderAll(changed ? 'push' : '');
        if (revealDetail) revealModelDetail();
      }

      function selectMetric(metric) {
        if (!Object.hasOwn(METRICS, metric) || metric === state.metric) return;
        state.metric = metric;
        renderAll('push');
      }

      readUrlState();
      renderAll('replace');
      toolbar?.addEventListener('submit', (event) => event.preventDefault());
      search?.addEventListener('input', () => { state.query = search.value; renderAll('replace'); });
      category?.addEventListener('change', () => { state.category = category.value; renderAll('push'); });
      clear?.addEventListener('click', () => {
        state.query = '';
        state.category = 'all';
        renderAll('push');
        search?.focus();
      });
      document.querySelectorAll('[data-sort-key]').forEach((button) => button.addEventListener('click', () => selectMetric(button.dataset.sortKey)));
      document.querySelectorAll('[data-table-sort]').forEach((button) => button.addEventListener('click', () => selectMetric(button.dataset.tableSort)));
      window.addEventListener('popstate', () => { readUrlState(); renderAll(''); });
    }).catch(showError);
  });
}());
