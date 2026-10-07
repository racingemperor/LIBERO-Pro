// Run against the real static app: open /scripts/navigation-test.html on the local server.
const frame = document.querySelector('iframe');
if(new URLSearchParams(location.search).get('width')==='375'){frame.style.width='375px';frame.style.height='812px';}
const report = document.querySelector('#results');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const waitFor = async predicate => {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Timed out waiting for the updated view');
};
const doc = () => frame.contentDocument;
const win = () => frame.contentWindow;
const query = selector => doc().querySelector(selector);
const load = async path => {
  const target = new URL(path, new URL('../', location.href));
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Page load timed out')), 10000);
    frame.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, {once:true});
  });
  if(win().location.href === target.href)win().location.reload();
  else frame.src = target;
  await loaded;
  await waitFor(() => query('#content h1') && !query('.loading'));
};
const click = selector => {
  assert(query(selector), 'Missing control: ' + selector);
  query(selector).click();
};
const select = (selector, value) => {
  query(selector).value = value;
  query(selector).dispatchEvent(new (win().Event)('change', {bubbles:true}));
};
async function change(action, ready) {
  const before = {document:doc(), header:query('.site-header'), history:win().history.length, origin:win().performance.timeOrigin};
  action();
  await waitFor(ready);
  assert(doc() === before.document && win().performance.timeOrigin === before.origin, 'The document reloaded');
  assert(query('.site-header') === before.header, 'The page shell was replaced');
  assert(win().history.length === before.history, 'A selection added a browser history entry');
}

const tests = [
  ['Model S01 → S02 keeps the document, profile, directory and scroll position', async () => {
    await load('model.html?id=openvla-oft-m&perturbation=S01');
    win().scrollTo(0, 550);
    const scroll = win().scrollY, header = query('.detail-head'), nav = query('.catalogue-nav');
    await change(() => click('.nav-item[href*="perturbation=S02"]'), () => query('#rollouts h2')?.textContent === 'Receiver planar pose');
    assert(query('.detail-head') === header && query('.catalogue-nav') === nav, 'Stable profile or directory was replaced');
    assert(Math.abs(win().scrollY - scroll) < 2, 'Page scroll jumped');
    assert(query('.nav-item.active').textContent.includes('S02'), 'Selected task is stale');
    assert(doc().querySelectorAll('.rollout-slot').length === 8, 'Missing task slots');
    await change(() => click('.nav-item.active'), () => query('.nav-item.active')?.textContent.includes('S02'));
    assert(Math.abs(win().scrollY - scroll) < 2, 'Clicking the current task jumped the page');
    await change(() => click('.catalogue-nav a[href*="mode=dynamic"]'), () => query('.nav-item.active')?.textContent.includes('D01'));
    assert(query('[aria-label="Category success rates"] h2').textContent.startsWith('Dynamic'), 'Category scores did not switch');
  }],
  ['Leaderboard filters and sorting update in place and keep their state', async () => {
    await load('leaderboard.html');
    win().scrollTo(0, query('#rankings').offsetTop - 120);
    const charts = query('#capabilities'), scroll = win().scrollY;
    await change(() => select('[data-query="type"]', 'World Action Models'), () => doc().querySelectorAll('tbody tr').length === 3);
    await change(() => click('[data-sort="environment"]'), () => query('[data-sort="environment"]').closest('th').getAttribute('aria-sort') === 'descending');
    const tableScroll = query('.table-scroll');
    tableScroll.scrollLeft = 80;
    const left = tableScroll.scrollLeft;
    await change(() => click('.tab[href*="mode=dynamic"]'), () => query('.table-scroll').getAttribute('aria-label').startsWith('Dynamic'));
    assert(query('[data-query="type"]').value === 'World Action Models', 'Model type reset');
    assert(query('[data-sort="environment"]').closest('th').getAttribute('aria-sort') === 'descending', 'Sort reset on setting change');
    assert(query('#capabilities') === charts, 'Capability charts were replaced');
    assert(Math.abs(win().scrollY-scroll) < 2 && query('.table-scroll').scrollLeft === left, 'Page/table scroll jumped');
    assert(!query('thead small'), 'Perturbation IDs remain in the header');
    await load(win().location.href);
    assert(query('.tab.active').textContent.includes('Dynamic') && query('[data-query="type"]').value === 'World Action Models', 'Deep link did not restore filters');
  }],
  ['Task catalogue switches domains and settings without navigation', async () => {
    await load('tasks.html');
    await change(() => click('.domain-filter a[href*="category=environment"]'), () => doc().querySelectorAll('.perturbation-card').length === 7);
    await change(() => click('.tab[href*="mode=dynamic"]'), () => doc().querySelectorAll('.perturbation-card').length === 3);
    assert(query('.domain-filter .active').textContent.includes('Environment'), 'Domain reset');
  }],
  ['Task results keep the selected model and domain when changing setting', async () => {
    await load('task.html?id=libero_goal-3');
    await change(() => select('#model-select', 'openvla-oft-m'), () => query('.slot-rate')?.textContent !== '—');
    await change(() => click('.domain-filter a[href*="category=environment"]'), () => doc().querySelectorAll('.rollout-slot').length === 7);
    await change(() => click('.tab[href*="mode=dynamic"]'), () => doc().querySelectorAll('.rollout-slot').length === 3);
    assert(query('#model-select').value === 'openvla-oft-m', 'Model selection reset');
    assert(query('.domain-filter .active').textContent === 'Environment', 'Task domain reset');
  }],
  ['Perturbation gallery stays in its current view after selecting a model', async () => {
    await load('perturbation.html?id=S01');
    await change(() => select('#model-select', 'openvla-oft-m'), () => !!query('.direction-score'));
    await change(() => click('.nav-item[href*="id=S02"]'), () => query('#rollouts h2')?.textContent === 'Receiver planar pose');
    assert(win().location.pathname.endsWith('/perturbation.html'), 'Task switch opened the model profile');
    assert(query('#model-select').value === 'openvla-oft-m', 'Selected model was lost');
  }],
  ['Document directory, adjacent documents and anchors update without history noise', async () => {
    await load('docs.html?perturbation=S01');
    const sidebar = query('.docs-sidebar');
    const group = [...doc().querySelectorAll('.doc-nav-group details')].find(el => el.querySelector('summary').textContent === 'Environment');
    group.open = true;
    await change(() => click('.docs-sidebar a[href*="perturbation=S02"]'), () => query('h1')?.textContent === 'Receiver planar pose');
    assert(query('.docs-sidebar') === sidebar && group.open, 'Directory or expanded group was lost');
    await change(() => click('.doc-pagination a:last-child'), () => query('h1')?.textContent === 'Receiver or support height');
    await change(() => click('.docs-sidebar a[href="docs.html#scoring"]'), () => !!query('#scoring'));
    await change(() => click('.doc-anchors a[href="#taxonomy"]'), () => win().location.hash === '#taxonomy');
    assert(query('#taxonomy').textContent.includes('S01'), 'Domain ID definitions are missing from Document');
  }],
  ['Back returns directly to the filtered leaderboard; Forward restores the final task', async () => {
    await load('leaderboard.html?type=Mainstream+VLA&sort=environment&order=desc#rankings');
    const previous = win().location.href;
    click('a[aria-label="View OpenVLA-OFT_m details"]');
    await waitFor(() => !!query('.nav-item'));
    await change(() => click('.nav-item[href*="perturbation=S01"]'), () => query('.nav-item.active')?.textContent.includes('S01'));
    await change(() => click('.nav-item[href*="perturbation=S02"]'), () => query('#rollouts h2')?.textContent === 'Receiver planar pose');
    const finalSelection = win().location.href;
    win().history.back();
    await waitFor(() => win().location.href === previous && !!query('.leaderboard-table'));
    assert(query('[data-query="type"]').value === 'Mainstream VLA', 'Back lost the leaderboard filter');
    assert(query('[data-sort="environment"]').closest('th').getAttribute('aria-sort') === 'descending', 'Back lost the leaderboard sorting');
    win().history.forward();
    await waitFor(() => win().location.href === finalSelection && query('#rollouts h2')?.textContent === 'Receiver planar pose');
  }],
];

let failed = 0;
for (const [name, run] of tests) {
  const item = document.createElement('li');
  try {
    await run();
    item.className = 'pass';
    item.textContent = 'PASS: ' + name;
  } catch (error) {
    failed++;
    item.className = 'fail';
    item.textContent = 'FAIL: ' + name + ' — ' + error.message;
  }
  report.append(item);
}
document.querySelector('#status').textContent = `${tests.length - failed}/${tests.length} passed; ${failed} failed.`;
