(function () {
  'use strict';

  const DATA_PATH = 'data/perturbations.json';
  const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');
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

  function statusLabel(status) {
    return status === 'runtime-only' ? 'Runtime-only' : 'Published';
  }

  function statusElement(status) {
    return createElement('span', `task-status is-${status}`, statusLabel(status));
  }

  function modeElement(mode) {
    return createElement('span', `task-mode is-${mode.toLowerCase()}`, mode);
  }

  function codeCell(value) {
    const cell = document.createElement('td');
    const code = createElement('code', '', value);
    code.translate = false;
    cell.appendChild(code);
    return cell;
  }

  function renderMetadata(data) {
    setText('task-published-count', NUMBER_FORMATTER.format(data.scope.publishedDirectionCount));
    setText('task-static-count', NUMBER_FORMATTER.format(data.scope.staticCount));
    setText('task-dynamic-count', NUMBER_FORMATTER.format(data.scope.publishedDynamicCount));
    setText('task-suite-count', NUMBER_FORMATTER.format(data.scope.baseSuiteCount));

    const version = document.getElementById('task-source-version');
    if (version) {
      const date = new Date(`${data.source.version}T00:00:00Z`);
      version.dateTime = data.source.version;
      version.textContent = Number.isNaN(date.getTime())
        ? `Version ${data.source.version}`
        : `Version ${DATE_FORMATTER.format(date)}`;
    }
  }

  function populateOperators(data) {
    const select = document.getElementById('task-operator-filter');
    if (!select) return;

    [...new Set(data.directions.map((direction) => direction.operator))]
      .sort((left, right) => left.localeCompare(right))
      .forEach((operator) => {
        const option = createElement('option', '', operator);
        option.value = operator;
        option.translate = false;
        select.appendChild(option);
      });
  }

  function getVisibleDirections(data, state) {
    const query = state.query.trim().toLocaleLowerCase();
    return data.directions.filter((direction) => {
      const matchesMode = state.mode === 'all' || direction.mode === state.mode;
      const matchesOperator = state.operator === 'all' || direction.operator === state.operator;
      const matchesStatus = state.status === 'all' || direction.status === state.status;
      const searchable = [
        direction.id,
        direction.name,
        direction.operator,
        direction.variant,
        direction.trigger,
        direction.definition
      ].join(' ').toLocaleLowerCase();
      return matchesMode && matchesOperator && matchesStatus && (!query || searchable.includes(query));
    });
  }

  function renderSummary(data, directions) {
    const summary = document.getElementById('task-result-summary');
    if (!summary) return;

    if (!directions.length) {
      summary.textContent = 'No directions match the current filters.';
      return;
    }

    const published = directions.filter((direction) => direction.status === 'published').length;
    const runtimeOnly = directions.length - published;
    const suffix = runtimeOnly ? ` · ${runtimeOnly} runtime-only` : '';
    summary.textContent = `Showing ${directions.length} of ${data.scope.taxonomyDirectionCount} runtime directions · ${published} published${suffix}`;
  }

  function renderTable(directions, state, onSelect) {
    const body = document.getElementById('task-catalog-body');
    if (!body) return;

    body.replaceChildren();
    if (!directions.length) {
      const row = document.createElement('tr');
      const cell = createElement('td', 'task-table-state', 'No matching directions. Change or clear the current filters.');
      cell.colSpan = 7;
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    directions.forEach((direction) => {
      const row = document.createElement('tr');
      row.classList.toggle('is-selected', direction.id === state.selectedId);

      const id = createElement('td', '', direction.id);
      id.translate = false;

      const mode = document.createElement('td');
      mode.appendChild(modeElement(direction.mode));

      const name = document.createElement('td');
      const button = createElement('button', 'task-direction-button', direction.name);
      button.type = 'button';
      button.lang = 'zh-CN';
      button.setAttribute('aria-label', `Inspect ${direction.id}: ${direction.name}`);
      button.addEventListener('click', () => onSelect(direction.id));
      name.appendChild(button);

      const status = document.createElement('td');
      status.appendChild(statusElement(direction.status));

      row.append(
        id,
        mode,
        name,
        codeCell(direction.operator),
        codeCell(direction.variant),
        codeCell(direction.trigger),
        status
      );
      body.appendChild(row);
    });
  }

  function detailField(label, value) {
    const item = document.createElement('div');
    const term = createElement('dt', '', label);
    const description = createElement('dd', '', value);
    description.translate = false;
    item.append(term, description);
    return item;
  }

  function renderDetail(data, state) {
    const panel = document.getElementById('task-direction-detail');
    if (!panel) return;

    const direction = data.directions.find((candidate) => candidate.id === state.selectedId);
    panel.replaceChildren();
    if (!direction) {
      panel.appendChild(createElement('p', 'task-detail-state', 'No direction is selected.'));
      return;
    }

    const head = createElement('div', 'task-detail-head');
    const id = createElement('p', 'task-detail-id', direction.id);
    id.translate = false;
    const title = createElement('h3', '', direction.name);
    title.id = 'task-detail-title';
    title.lang = 'zh-CN';

    const statusLine = createElement('div', 'task-detail-status-line');
    statusLine.append(modeElement(direction.mode), statusElement(direction.status));
    head.append(id, title, statusLine);

    const definition = createElement('p', 'task-detail-definition', direction.definition);
    definition.lang = 'zh-CN';

    const metadata = document.createElement('dl');
    metadata.append(
      detailField('Operator', direction.operator),
      detailField('Variant', direction.variant),
      detailField('Trigger', direction.trigger),
      detailField('Matrix', direction.status === 'published' ? 'included_in_published_matrix' : 'excluded_from_published_matrix')
    );
    if (direction.constraint) metadata.appendChild(detailField('Constraint', direction.constraint));

    panel.append(head, definition, metadata);
    if (direction.note) panel.appendChild(createElement('p', 'task-detail-note', direction.note));
  }

  function showError() {
    setText('task-result-summary', 'Catalog data could not be loaded. Reload the page to try again.');
    const body = document.getElementById('task-catalog-body');
    const detail = document.getElementById('task-direction-detail');
    if (body) {
      body.replaceChildren();
      const row = document.createElement('tr');
      const cell = createElement('td', 'task-table-state', 'Catalog data could not be loaded. Reload the page to try again.');
      cell.colSpan = 7;
      row.appendChild(cell);
      body.appendChild(row);
    }
    if (detail) detail.textContent = 'Direction details could not be loaded.';
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch(DATA_PATH)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        renderMetadata(data);
        populateOperators(data);

        const state = {
          query: '',
          mode: 'all',
          operator: 'all',
          status: 'all',
          selectedId: ''
        };

        const search = document.getElementById('task-search');
        const mode = document.getElementById('task-mode-filter');
        const operator = document.getElementById('task-operator-filter');
        const status = document.getElementById('task-status-filter');
        const clear = document.getElementById('task-clear-filters');
        const toolbar = document.getElementById('task-toolbar');
        const validModes = new Set(['all', 'Static', 'Dynamic']);
        const validOperators = new Set(['all', ...data.directions.map((direction) => direction.operator)]);
        const validStatuses = new Set(['all', 'published', 'runtime-only']);
        const validIds = new Set(data.directions.map((direction) => direction.id));

        function readUrlState() {
          const params = new URLSearchParams(window.location.search);
          const requestedMode = params.get('mode') || 'all';
          const requestedOperator = params.get('operator') || 'all';
          const requestedStatus = params.get('status') || 'all';
          const requestedId = (params.get('direction') || '').toUpperCase();

          state.query = params.get('q') || '';
          state.mode = validModes.has(requestedMode) ? requestedMode : 'all';
          state.operator = validOperators.has(requestedOperator) ? requestedOperator : 'all';
          state.status = validStatuses.has(requestedStatus) ? requestedStatus : 'all';
          state.selectedId = validIds.has(requestedId) ? requestedId : '';
        }

        function normalizeSelection(directions) {
          if (!directions.some((direction) => direction.id === state.selectedId)) {
            state.selectedId = directions.length ? directions[0].id : '';
          }
        }

        function writeUrl(modeName) {
          const url = new URL(window.location.href);
          const values = {
            q: state.query,
            mode: state.mode === 'all' ? '' : state.mode,
            operator: state.operator === 'all' ? '' : state.operator,
            status: state.status === 'all' ? '' : state.status,
            direction: state.selectedId
          };

          Object.entries(values).forEach(([key, value]) => {
            if (value) url.searchParams.set(key, value);
            else url.searchParams.delete(key);
          });
          window.history[modeName === 'push' ? 'pushState' : 'replaceState']({}, '', url);
        }

        function syncControls() {
          if (search && search.value !== state.query) search.value = state.query;
          if (mode) mode.value = state.mode;
          if (operator) operator.value = state.operator;
          if (status) status.value = state.status;
          if (clear) {
            clear.hidden = !state.query && state.mode === 'all' && state.operator === 'all' && state.status === 'all';
          }
        }

        function renderAll(historyMode) {
          const directions = getVisibleDirections(data, state);
          normalizeSelection(directions);
          syncControls();
          renderSummary(data, directions);
          renderTable(directions, state, selectDirection);
          renderDetail(data, state);
          if (historyMode) writeUrl(historyMode);
        }

        function selectDirection(id) {
          state.selectedId = id;
          renderAll('push');
          if (window.matchMedia('(max-width: 1080px)').matches) {
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.requestAnimationFrame(() => {
              const detail = document.getElementById('task-direction-detail');
              detail?.focus({ preventScroll: true });
              detail?.scrollIntoView({
                behavior: reducedMotion ? 'auto' : 'smooth',
                block: 'start'
              });
            });
          }
        }

        readUrlState();
        renderAll('replace');

        toolbar?.addEventListener('submit', (event) => event.preventDefault());
        search?.addEventListener('input', () => {
          state.query = search.value;
          renderAll('replace');
        });
        mode?.addEventListener('change', () => {
          state.mode = mode.value;
          renderAll('push');
        });
        operator?.addEventListener('change', () => {
          state.operator = operator.value;
          renderAll('push');
        });
        status?.addEventListener('change', () => {
          state.status = status.value;
          renderAll('push');
        });
        clear?.addEventListener('click', () => {
          state.query = '';
          state.mode = 'all';
          state.operator = 'all';
          state.status = 'all';
          renderAll('push');
          search?.focus();
        });
        window.addEventListener('popstate', () => {
          readUrlState();
          renderAll('');
        });
      })
      .catch(showError);
  });
}());
