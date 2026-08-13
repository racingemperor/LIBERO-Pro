(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character];
    });
  }

  function loadJson(path) {
    return fetch(path).then(function (response) {
      if (!response.ok) throw new Error('Unable to load ' + path);
      return response.json();
    });
  }

  function renderPerturbations(directions) {
    var target = document.getElementById('perturbation-rows');
    if (!target) return;
    target.innerHTML = directions.map(function (direction) {
      var modeLabel = direction.mode === 'static' ? 'Static' : 'Dynamic';
      return '<tr>' +
        '<td><strong>' + escapeHtml(direction.id) + '</strong></td>' +
        '<td><span class="benchmark-tag is-' + escapeHtml(direction.mode) + '">' + modeLabel + '</span></td>' +
        '<td class="benchmark-wrap-cell">' + escapeHtml(direction.name) + '</td>' +
        '<td>' + escapeHtml(direction.primary) + '</td>' +
        '<td>' + escapeHtml(direction.validation) + '</td>' +
        '<td>' + escapeHtml(direction.tier) + '</td>' +
      '</tr>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('perturbation-rows')) {
      loadJson('data/perturbations.json').then(function (data) {
        renderPerturbations(data.directions || []);
      }).catch(function () {});
    }
  });
}());
