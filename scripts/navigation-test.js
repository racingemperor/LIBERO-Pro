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
  const target=query(selector);
  if(typeof target.click==='function')target.click();
  else target.dispatchEvent(new (win().MouseEvent)('click',{bubbles:true,button:0}));
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
  ['Model chips toggle lines without reloads and retain selection through independent table changes', async () => {
    await load('leaderboard.html#capabilities');
    const {models}=await (await fetch('../data/results.json')).json();
    const chosen=()=>[...doc().querySelectorAll('[data-chart-model][aria-pressed="true"]')].map(el=>el.dataset.chartModel);
    assert(chosen().length===3,'Default comparison should contain the top three models');
    assert(!query('#capabilities select'),'Chart selection uses a dropdown');
    assert(doc().querySelectorAll('[data-chart-model] img').length===models.length,'Every chip needs its model image');
    const chart=query('.capability-svg'),scroll=win().scrollY;
    query('[data-chart-model="pi0"]').focus({preventScroll:true});
    await change(()=>click('[data-chart-model="pi0"]'),()=>chosen().includes('pi0'));
    assert(doc().activeElement===query('[data-chart-model="pi0"]'),'Toggle lost keyboard focus');
    assert(query('.capability-svg')===chart&&Math.abs(win().scrollY-scroll)<2,'Chart or scroll reset');
    const selection=chosen().join(',');
    await change(()=>select('[data-query="type"]','World Action Models'),()=>doc().querySelectorAll('#rankings tbody tr').length===3);
    await change(()=>click('#perturbation-rankings .tab[href*="perturbationMode=dynamic"]'),()=>!!query('[data-perturbation-sort="D20"]'));
    assert(chosen().join(',')===selection&&new URL(win().location).searchParams.get('compare')===selection,'Table controls changed chart selection');
    await load(win().location.href);
    assert(chosen().join(',')===selection,'Reload lost selected models');
    await change(()=>click('[data-chart-select="all"]'),()=>chosen().length===models.length);
    assert(doc().querySelectorAll('[data-series]:not([hidden])').length===models.length,'Some selected models have no lines');
    await change(()=>click('[data-chart-select="none"]'),()=>chosen().length===0);
    assert(!query('.capability-empty').hidden&&!doc().querySelectorAll('[data-series]:not([hidden])').length,'Empty selection is misleading');
    await load(win().location.href);
    assert(chosen().length===0,'An empty deep-link selection reset to defaults');
    await change(()=>click('[data-chart-model="molmoact2"]'),()=>chosen().length===1);
    assert(doc().documentElement.scrollWidth<=win().innerWidth,'Chart causes horizontal page overflow');
  }],
  ['All 42 chart points and accessible table scores match the original aggregate data', async () => {
    await load('leaderboard.html');
    click('[data-chart-select="all"]');
    const {models}=await (await fetch('../data/results.json')).json();
    const rows=[...doc().querySelectorAll('.capability-data tbody tr')];
    for(const m of models){
      const series=query(`[data-series="${m.id}"]`),points=[...series.querySelectorAll('[data-metric]')];
      const expected=[m.scores.overall,m.scores.dynamic.average,m.scores.static.average];
      assert(points.map(p=>p.dataset.metric).join(',')==='overall,dynamic,static','Wrong metric order');
      points.forEach((point,i)=>assert(Math.abs(Number(point.dataset.value)-expected[i])<1e-10,m.name+' chart point is wrong'));
      const cells=m.cells.filter(c=>c.direction!=='BASE');
      assert(Math.abs(expected[0]-cells.reduce((s,c)=>s+c.rate,0)/cells.length)<1e-10,'Overall no longer averages available cells');
      const row=rows.find(r=>new URL(r.querySelector('a').href).searchParams.get('id')===m.id);
      assert([...row.querySelectorAll('td')].map(c=>c.textContent).join(',')===expected.map(v=>(v*100).toFixed(1)+'%').join(','),'Accessible table differs from chart');
    }
    const grid=query('.capability-grid').textContent;
    assert(grid.includes('100%')&&grid.includes('0'),'Shared success-rate scale is missing');
  }],
  ['Line hover, keyboard and touch reveal sourced introductions and preserve model drill-down history', async () => {
    await load('leaderboard.html?compare=lingbot-va,pi0#capabilities');
    const card=()=>query('#capability-preview');
    const series=query('[data-series="lingbot-va"]');
    series.dispatchEvent(new (win().PointerEvent)('pointerover',{bubbles:true,pointerType:'mouse',clientX:150,clientY:300}));
    assert(!card().hidden&&card().textContent.includes('autoregressive'),'Hover did not show the model introduction');
    assert(card().textContent.includes('75.0%')&&card().querySelector('a[target="_blank"]'),'Missing real score or official source');
    series.dispatchEvent(new (win().KeyboardEvent)('keydown',{bubbles:true,key:'Escape'}));
    assert(card().hidden,'Escape failed to dismiss hover details');
    const pi=query('[data-series="pi0"]');pi.focus({preventScroll:true});
    assert(!card().hidden&&card().textContent.includes('flow-based'),'Keyboard focus did not expose details');
    pi.dispatchEvent(new (win().KeyboardEvent)('keydown',{bubbles:true,key:'Enter'}));
    assert(doc().activeElement===card().querySelector('a'),'Keyboard activation did not reach model details');
    pi.dispatchEvent(new (win().PointerEvent)('pointerout',{bubbles:true,pointerType:'mouse'}));
    await new Promise(resolve=>setTimeout(resolve,230));
    assert(!card().hidden,'Pinned details disappeared');
    card().querySelector('a').dispatchEvent(new (win().KeyboardEvent)('keydown',{bubbles:true,key:'Escape'}));
    assert(card().hidden&&doc().activeElement===pi,'Escape did not return focus to the model line');
    pi.dispatchEvent(new (win().KeyboardEvent)('keydown',{bubbles:true,key:'Enter'}));
    click('[data-close-preview]');assert(card().hidden,'Close did not dismiss details');
    pi.dispatchEvent(new (win().PointerEvent)('pointerover',{bubbles:true,pointerType:'touch'}));
    click('[data-series="pi0"]');assert(!card().hidden,'Tap did not expose details');
    const previous=win().location.href;
    click('#capability-preview a[href*="model.html"]');
    await waitFor(()=>query('.model-title')?.textContent.includes('π0'));
    assert(new URL(win().location).searchParams.get('id')==='pi0','Opened the wrong model profile');
    win().history.back();
    await waitFor(()=>win().location.href===previous&&!!query('.capability-chart'));
    assert(doc().querySelectorAll('[data-chart-model][aria-pressed="true"]').length===2,'Back lost selected models');
    win().history.forward();
    await waitFor(()=>query('.model-title')?.textContent.includes('π0'));
  }],
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
    await change(() => select('[data-query="type"]', 'World Action Models'), () => doc().querySelectorAll('#rankings tbody tr').length === 3);
    await change(() => click('[data-sort="environment"]'), () => query('[data-sort="environment"]').closest('th').getAttribute('aria-sort') === 'descending');
    const tableScroll = query('#rankings .table-scroll');
    tableScroll.scrollLeft = 80;
    const left = tableScroll.scrollLeft;
    await change(() => click('.tab[href*="mode=dynamic"]'), () => query('#rankings .table-scroll').getAttribute('aria-label').startsWith('Dynamic'));
    assert(query('[data-query="type"]').value === 'World Action Models', 'Model type reset');
    assert(query('[data-sort="environment"]').closest('th').getAttribute('aria-sort') === 'descending', 'Sort reset on setting change');
    assert(query('#capabilities') === charts, 'Capability charts were replaced');
    assert(Math.abs(win().scrollY-scroll) < 2 && query('#rankings .table-scroll').scrollLeft === left, 'Page/table scroll jumped');
    assert(!query('thead small'), 'Perturbation IDs remain in the header');
    await load(win().location.href);
    assert(query('.tab.active').textContent.includes('Dynamic') && query('[data-query="type"]').value === 'World Action Models', 'Deep link did not restore filters');
  }],
  ['All 588 perturbation scores and detail links match the published suite results', async () => {
    const [{models},{perturbations}]=await Promise.all(['results','catalogue'].map(async name=>(await fetch('../data/'+name+'.json')).json()));
    for(const mode of ['static','dynamic']){
      await load('leaderboard.html?perturbationMode='+mode+'#perturbation-rankings');
      const directions=perturbations.filter(p=>p.mode===mode);
      const table=query('.perturbation-table');
      const ids=[...table.querySelectorAll('[data-perturbation-sort]')].map(el=>el.dataset.perturbationSort).slice(1);
      assert(JSON.stringify(ids)===JSON.stringify(directions.map(p=>p.id)), 'Perturbations missing or out of public ID order');
      assert(table.querySelectorAll('tbody tr').length===14, 'Missing models');
      for(const model of models){
        const row=table.querySelector(`[data-model="${model.id}"]`);
        assert(row.querySelector('.model-link img')?.getAttribute('src'), 'Model image missing');
        for(const p of directions){
          const rates=model.cells.filter(c=>c.direction===p.id&&Number.isFinite(c.rate)).map(c=>c.rate);
          const expected=rates.length?(100*rates.reduce((sum,v)=>sum+v,0)/rates.length).toFixed(1)+'%':'—';
          const cell=row.querySelector(`[data-perturbation="${p.id}"] a`);
          assert(cell.textContent===expected, model.name+'/'+p.id+' score is wrong');
          const target=new URL(cell.href);
          assert(target.searchParams.get('id')===model.id&&target.searchParams.get('perturbation')===p.id&&target.searchParams.get('category')===p.category&&target.searchParams.get('mode')===mode&&target.hash==='#rollouts', 'Score points to the wrong model/perturbation');
        }
      }
      assert(doc().documentElement.scrollWidth<=win().innerWidth, 'Wide table overflows the page');
      assert(query('.perturbation-table').closest('.table-scroll').scrollWidth>query('.perturbation-table').closest('.table-scroll').clientWidth, 'Table should scroll inside its wrapper');
    }
  }],
  ['Perturbation sorting, filtering and setting changes preserve the independent domain table', async () => {
    await load('leaderboard.html?mode=dynamic&type=World+Action+Models&sort=environment#perturbation-rankings');
    const original=query('#rankings .leaderboard-table').innerHTML,tableScroll=query('#perturbation-rankings .table-scroll');
    const position=win().scrollY;
    await change(()=>click('[data-perturbation-sort="S22"]'),()=>query('[data-perturbation-sort="S22"]').closest('th').getAttribute('aria-sort')==='descending');
    assert(tableScroll.scrollLeft>0, 'Selected far column was not revealed');
    const values=()=>[...doc().querySelectorAll('#perturbation-rankings [data-perturbation="S22"]')].map(el=>parseFloat(el.textContent));
    const descending=values();
    assert(descending.every((v,i)=>!i||v<=descending[i-1]), 'Scores are not ranked descending');
    await change(()=>click('[data-perturbation-sort="S22"]'),()=>query('[data-perturbation-sort="S22"]').closest('th').getAttribute('aria-sort')==='ascending');
    const ascending=values();
    assert(ascending.every((v,i)=>!i||v>=ascending[i-1]), 'Scores are not ranked ascending');
    await change(()=>select('[data-query="perturbationType"]','Robustness-oriented'),()=>doc().querySelectorAll('#perturbation-rankings tbody tr').length===2);
    await change(()=>click('#perturbation-rankings .tab[href*="perturbationMode=dynamic"]'),()=>!!query('[data-perturbation-sort="D20"]'));
    assert(query('#rankings .leaderboard-table').innerHTML===original&&query('[data-query="type"]').value==='World Action Models'&&query('#rankings .tab.active').textContent.includes('Dynamic'), 'Perturbation controls changed the domain table');
    assert(!query('[data-perturbation-sort="S22"]'), 'Static column survived in dynamic mode');
    assert(query('[data-query="perturbationType"]').value==='Robustness-oriented', 'Type filter was lost on mode change');
    assert(Math.abs(win().scrollY-position)<2, 'Page jumped during perturbation selections');
    await change(()=>click('[data-perturbation-sort="D19"]'),()=>query('[data-perturbation-sort="D19"]').closest('th').getAttribute('aria-sort')==='descending');
    await change(()=>click('#rankings .tab[href*="mode=static"]'),()=>query('#rankings .tab.active').textContent.includes('Static'));
    assert(query('[data-perturbation-sort="D19"]').closest('th').getAttribute('aria-sort')==='descending'&&query('#perturbation-rankings .tab.active').textContent.includes('Dynamic'), 'Domain setting discarded perturbation state');
    await load(win().location.href);
    assert(query('[data-perturbation-sort="D19"]').closest('th').getAttribute('aria-sort')==='descending'&&query('[data-query="perturbationType"]').value==='Robustness-oriented', 'Deep link lost selections');
    const previous=win().location.href,first=query('#perturbation-rankings [data-perturbation="D19"] a'),target=new URL(first.href);
    first.click();
    await waitFor(()=>query('.nav-item.active')?.textContent.includes('D19'));
    assert(win().location.search===target.search&&query('#rollouts h2').textContent==='Robot joint displacement', 'Wrong dynamic mapping or model detail');
    win().history.back();
    await waitFor(()=>win().location.href===previous&&!!query('.perturbation-table'));
    assert(query('[data-perturbation-sort="D19"]').closest('th').getAttribute('aria-sort')==='descending', 'Back lost selected perturbation');
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
