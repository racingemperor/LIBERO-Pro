// Run against the real static app: open /scripts/navigation-test.html on the local server.
const frame = document.querySelector('iframe');
if(new URLSearchParams(location.search).get('width')==='375'){frame.style.width='375px';frame.style.height='812px';}
const report = document.querySelector('#results');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const waitFor = async (predicate,message='the updated view') => {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Timed out waiting for '+message);
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
  await waitFor(() => query('#content h1') && !query('.loading') && query('#view-status') && !query('#app[aria-busy="true"]'));
};
const click = selector => {
  assert(query(selector), 'Missing control: ' + selector);
  const target=query(selector);
  if(typeof target.click==='function')target.click();
  else target.dispatchEvent(new (win().MouseEvent)('click',{bubbles:true,cancelable:true,button:0}));
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

async function navigate(action,ready,{push=true}={}) {
  const before={document:doc(),header:query('.site-header'),origin:win().performance.timeOrigin,history:win().history.length,entry:win().history.state.liberoNavigation.entry};
  action();await waitFor(()=>ready()&&!query('#app[aria-busy="true"]'));
  assert(doc()===before.document&&win().performance.timeOrigin===before.origin,'Cross-page navigation reloaded the document');
  assert(query('.site-header')===before.header,'Cross-page navigation replaced the header');
  // Chromium caps session history at 50 entries, including earlier iframe test loads.
  if(push)assert(win().history.state.liberoNavigation.entry!==before.entry&&win().history.length>=before.history&&win().history.length<=before.history+1,'A section switch did not create a new history entry');
  else assert(win().history.length===before.history,'Back/Forward added a history entry');
}

const tests = [
  ['Citation retains both official BibTeX entries with an accessible Copy control', async()=>{
    await load('index.html');
    const publication=await (await fetch('../data/publication.json')).json();
    const code=query('#citation .citation-code code');
    assert(code?.textContent===publication.bibtex.trim(),'The citation text was changed or truncated');
    assert(code.textContent.includes('@misc{zhou2026liberopro2,')&&code.textContent.includes('@article{zhou2025liberopro,'),'Both versions need their own BibTeX entry');
    assert(query('#citation h3').textContent==='LIBERO-Pro2.0 & LIBERO-Pro','Citation heading must name both editions');
    const copy=query('[data-copy-citation]');
    assert(copy&&!copy.disabled&&copy.getAttribute('aria-label')==='Copy BibTeX','Copy is not available or labelled');
    assert(query('.citation-code').tabIndex===0,'Citation cannot be reached by keyboard');
    assert(doc().documentElement.scrollWidth<=win().innerWidth,'Citation causes whole-page overflow');
  }],
  ['All top-level sections switch in one document and Back/Forward follows their order', async()=>{
    await load('index.html');
    const pages=[['docs','Document'],['leaderboard','Leaderboard'],['report','Report'],['community','Community']];
    for(const [page,label] of pages){
      await navigate(()=>click(`.site-header a[href="${page}.html"]`),()=>doc().body.dataset.page===page);
      assert(query('.site-header [aria-current="page"]').textContent===label,'Active navigation did not follow the page');
      assert(doc().title.includes(label),'Page title was not updated');
      assert(doc().activeElement===query('#content h1'),'New page heading did not receive keyboard focus');
      assert(win().getComputedStyle(query('#content h1')).outlineStyle==='none','Route focus added a visible frame around the heading');
      assert(win().scrollY===0,'New section did not start at the top');
    }
    for(const page of ['report','leaderboard','docs','index']){
      await navigate(()=>win().history.back(),()=>doc().body.dataset.page===page,{push:false});
      assert(query('.site-header [aria-current="page"]').textContent===({index:'Home',docs:'Document',report:'Report',leaderboard:'Leaderboard'}[page]),'Back did not restore the active section');
    }
    for(const [page] of pages)await navigate(()=>win().history.forward(),()=>doc().body.dataset.page===page,{push:false});
    await change(()=>click('.site-header a[href="community.html"]'),()=>doc().body.dataset.page==='community');
    assert(doc().documentElement.scrollWidth<=win().innerWidth,'Routed content overflows the viewport');
  }],
  ['Back restores filters and page/table scroll; new sections release old media', async()=>{
    await load('leaderboard.html?mode=dynamic&type=World+Action+Models#perturbation-rankings');
    const table=query('.perturbation-table').closest('.table-scroll');
    table.scrollLeft=420;win().scrollTo({top:650,behavior:'instant'});
    await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));
    const position={top:win().scrollY,left:table.scrollLeft};
    await navigate(()=>click('.site-nav a[href="docs.html"]'),()=>doc().body.dataset.page==='docs');
    await navigate(()=>win().history.back(),()=>!!query('.perturbation-table'),{push:false});
    await waitFor(()=>Math.abs(win().scrollY-position.top)<2&&Math.abs(query('.perturbation-table').closest('.table-scroll').scrollLeft-position.left)<2);
    assert(query('[data-query="type"]').value==='World Action Models','Back lost the model filter');
    assert(query('#rankings .tab.active').textContent.includes('Dynamic'),'Back lost the selected benchmark');
    click('a[aria-label^="View "][aria-label$=" details"]');
    await waitFor(()=>doc().body.dataset.page==='model');
    const videos=[...doc().querySelectorAll('video[data-rollout]')];
    await navigate(()=>click('.site-nav a[href="report.html"]'),()=>doc().body.dataset.page==='report');
    assert(videos.every(video=>!video.isConnected&&video.paused&&!video.querySelector('source').hasAttribute('src')),'Leaving a model retained media playback or sources');
    await navigate(()=>win().history.back(),()=>doc().body.dataset.page==='model',{push:false});
    assert([...doc().querySelectorAll('video[data-rollout]')].every(video=>video.playbackRate===2),'Returning to a model lost 2× playback');
    await navigate(()=>click('.brand'),()=>doc().body.dataset.page==='index',{push:false});
    const homeVideos=[...doc().querySelectorAll('video')];
    // Returning from Back replaces the forward branch; history length need not grow.
    click('.site-nav a[href="report.html"]');await waitFor(()=>doc().body.dataset.page==='report');
    assert(homeVideos.every(video=>!video.isConnected&&video.paused&&!video.hasAttribute('src')),'Leaving Home retained a video source');
  }],
  ['Rapid navigation keeps the final requested page and preserves native link behavior', async()=>{
    await load('index.html');
    const before={document:doc(),history:win().history.length};
    click('.site-nav a[href="leaderboard.html"]');click('.site-nav a[href="docs.html"]');
    await waitFor(()=>doc().body.dataset.page==='docs'&&!query('#app[aria-busy="true"]'));
    await new Promise(resolve=>setTimeout(resolve,150));
    assert(doc()===before.document&&doc().body.dataset.page==='docs','An outdated request replaced the final destination');
    win().history.back();await waitFor(()=>doc().body.dataset.page==='index');
    assert(doc()===before.document,'Back after rapid navigation reloaded the document');
    win().history.forward();await waitFor(()=>doc().body.dataset.page==='docs');
    const {isSiteLink,siteRoute}=await import('../assets/site-router.js');
    const normal={button:0,defaultPrevented:false};
    assert(isSiteLink(normal,query('.brand')),'Home should be a routed link');
    assert(!isSiteLink({...normal,ctrlKey:true},query('.brand')),'Ctrl-click must remain native');
    assert(!isSiteLink({...normal,button:1},query('.brand')),'Middle-click must remain native');
    assert(!isSiteLink(normal,query('.site-links a[target="_blank"]')),'External new-tab link was intercepted');
    assert(!siteRoute(new URL('../outside.html',win().location.href))&&!siteRoute(new URL('assets/favicon.svg',win().location.href)),'Router accepted a non-page URL');
    await change(()=>click('.footer a[href="docs.html#protocol"]'),()=>win().location.hash==='#protocol');
  }],
  ['Model galleries autoplay visible videos, resume after scrolling, and switch in place', async () => {
    await load('model.html?id=anchor-align&perturbation=S01');
    assert(doc().querySelectorAll('video[data-rollout]').length===8,'Eight matched videos expected');
    const old=query('video[data-rollout]');
    assert(old.preload==='none'&&old.poster.endsWith('/S01.webp'),'Videos should use posters without preloading');
    old.scrollIntoView({block:'center',behavior:'instant'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await waitFor(()=>old.videoWidth===640&&old.currentTime>0);
    const second=doc().querySelectorAll('video[data-rollout]')[1];
    await waitFor(()=>!old.paused&&!second.paused&&second.currentTime>0);
    assert(old.muted&&second.muted&&old.loop&&second.loop,'Autoplay must be muted and looped');
    assert(old.playbackRate===2&&second.playbackRate===2&&old.defaultPlaybackRate===2,'Model rollouts must start at 2×');
    win().scrollTo({top:0,behavior:'instant'});
    await waitFor(()=>old.paused&&second.paused);
    old.scrollIntoView({block:'center',behavior:'instant'});
    await waitFor(()=>!old.paused&&!second.paused);
    assert(old.playbackRate===2&&second.playbackRate===2,'Scrolling changed the rollout speed');
    old.pause();
    await new Promise(resolve=>setTimeout(resolve,50));
    win().scrollTo({top:0,behavior:'instant'});
    await waitFor(()=>second.paused);
    old.scrollIntoView({block:'center',behavior:'instant'});
    await waitFor(()=>!second.paused);
    assert(old.paused,'User pause was overridden by automatic playback');
    await change(()=>click('.nav-item[href*="perturbation=S02"]'),()=>query('video source').getAttribute('src').endsWith('/S02.mp4'));
    assert(old.paused&&!old.isConnected,'Previous video kept playing');
    assert(!old.querySelector('source').hasAttribute('src'),'Detached video did not release its source');
    const replacement=query('video[data-rollout]');
    replacement.scrollIntoView({block:'center',behavior:'instant'});
    await waitFor(()=>replacement.currentTime>0&&!replacement.paused);
    assert(replacement.playbackRate===2,'Switching perturbations lost 2× playback');
    await change(()=>click('.nav-item[href*="perturbation=S04"]'),()=>doc().querySelectorAll('[data-availability="unsupported"]').length===3);
    assert(doc().querySelectorAll('video[data-rollout]').length===5,'Unsupported tasks received videos');
    assert([...doc().querySelectorAll('[data-availability="unsupported"]')].every(el=>el.textContent.includes('Not supported')),'Missing requested unsupported label');
    await change(()=>click('.catalogue-nav .tab[href*="perturbation=BASE"]'),()=>query('#rollouts h2').textContent==='Base tasks');
    assert(doc().querySelectorAll('video[data-rollout]').length===8,'Base videos missing');
    assert(!query('.catalogue-nav .nav-group'),'Base must not show static perturbation groups');
    assert([...doc().querySelectorAll('video source')].every(el=>el.getAttribute('src').endsWith('/BASE.mp4')),'Base source mismatch');
    await change(()=>click('.catalogue-nav .tab[href*="mode=dynamic"]'),()=>!!query('.nav-item[href*="perturbation=D20"]'));
    await change(()=>click('.nav-item[href*="perturbation=D19"]'),()=>query('#rollouts h2').textContent==='Robot joint displacement');
    assert(query('video source').getAttribute('src').endsWith('/D19.mp4'),'Public D19 mapping missing');
    await change(()=>click('.nav-item[href*="perturbation=D20"]'),()=>query('video source').getAttribute('src').endsWith('/D20.mp4'));
    assert(doc().documentElement.scrollWidth<=win().innerWidth,'Video grid overflows viewport');
    await load('perturbation.html?id=D06&model=cosmos-policy');
    assert(doc().querySelectorAll('video[data-rollout]').length===7,'Cosmos D06 videos missing');
    assert(query('[data-task="libero_10-8"] [data-availability="unsupported"]'),'Long8 D06 must be unsupported');
    const cosmos=query('video[data-rollout]');
    await change(()=>select('#model-select','anchor-align'),()=>query('video source').getAttribute('src').includes('/anchor-align/'));
    assert(cosmos.paused&&!cosmos.isConnected,'Model switch retained previous player');
    await change(()=>select('#model-select','openvla'),()=>!query('video[data-rollout]'));
    assert(query('[data-availability="missing"]'),'Missing media must not imply an unsupported task');
  }],
  ['Home, Document and task videos play automatically without pressing Play', async () => {
    for(const target of ['docs.html?task=libero_object-1','docs.html?perturbation=S01','task.html?id=libero_object-1&model=cosmos-policy']){
      await load(target);
      const video=query('video');
      video.scrollIntoView({block:'center',behavior:'instant'});
      await waitFor(()=>video.currentTime>0&&!video.paused);
      assert(video.muted&&video.loop,'Video must autoplay silently and loop');
      assert(video.playbackRate===(target.startsWith('task.html')?2:1),'Only model rollouts should gain 2× playback');
    }
    await load('index.html');
    await waitFor(()=>!!query('[data-gallery-row]'));
    query('[data-gallery-row]').scrollIntoView({block:'center',behavior:'instant'});
    await waitFor(()=>[...doc().querySelectorAll('.gallery-video')].filter(v=>!v.paused&&v.currentTime>0).length>=2);
    assert([...doc().querySelectorAll('.gallery-video')].every(v=>v.playbackRate===1),'Home gallery speed changed');
  }],
  ['Additional model recordings resolve Base and public dynamic IDs and autoplay', async () => {
    for(const model of ['gr00t-n1-7','pi0-5','xvla','molmoact2','ript-vla','pi0']){
      await load(`model.html?id=${model}&perturbation=BASE`);
      assert(doc().querySelectorAll('video[data-rollout]').length===8,`${model}: Base videos missing`);
      const first=query('video[data-rollout]');
      first.scrollIntoView({block:'center',behavior:'instant'});
      await waitFor(()=>first.videoWidth===640&&first.currentTime>0&&!first.paused);
      assert(first.muted&&first.loop,`${model}: autoplay settings are wrong`);
      assert([...doc().querySelectorAll('video[data-rollout]')].every(v=>v.playbackRate===2),`${model}: rollouts must default to 2×`);
      assert([...doc().querySelectorAll('video source')].every(el=>el.getAttribute('src').includes(`/models/${model}/`)&&el.getAttribute('src').endsWith('/BASE.mp4')),`${model}: wrong model or Base source`);
      await change(()=>click('.catalogue-nav .tab[href*="mode=static"]'),()=>!!query('.nav-item[href*="perturbation=S04"]'));
      await change(()=>click('.nav-item[href*="perturbation=S04"]'),()=>doc().querySelectorAll('[data-availability="unsupported"]').length===3);
      assert(doc().querySelectorAll('video[data-rollout]').length===5,`${model}: incorrect S04 applicability`);
      await change(()=>click('.catalogue-nav .tab[href*="mode=dynamic"]'),()=>!!query('.nav-item[href*="perturbation=D20"]'));
      for(const [id,title] of [['D19','Robot joint displacement'],['D20','Instruction restatement']]){
        await change(()=>click(`.nav-item[href*="perturbation=${id}"]`),()=>query('#rollouts h2').textContent===title);
        assert(doc().querySelectorAll('video[data-rollout]').length===8,`${model}/${id}: eight videos expected`);
        assert([...doc().querySelectorAll('video source')].every(el=>el.getAttribute('src').includes(`/models/${model}/`)&&el.getAttribute('src').endsWith(`/${id}.mp4`)),`${model}/${id}: incorrect media source`);
      }
      assert(first.paused&&!first.isConnected,`${model}: old video was not released`);
    }
  }],
  ['OFT_m recordings distinguish absent Base media from unsupported perturbations', async () => {
    await load('model.html?id=openvla-oft-m&perturbation=BASE');
    assert(!query('video[data-rollout]')&&doc().querySelectorAll('[data-availability="missing"]').length===8,'Do not substitute another model for absent Base recordings');
    await change(()=>click('.catalogue-nav .tab[href*="mode=static"]'),()=>!!query('.nav-item[href*="perturbation=S04"]'));
    assert(doc().querySelectorAll('video[data-rollout]').length===8,'S01 recordings missing');
    const first=query('video[data-rollout]');
    first.scrollIntoView({block:'center',behavior:'instant'});
    await waitFor(()=>first.videoWidth===640&&first.currentTime>0&&!first.paused);
    assert(first.muted&&first.loop,'OFT_m must autoplay silently and loop');
    assert(first.playbackRate===2,'OFT_m must start at 2×');
    await change(()=>click('.nav-item[href*="perturbation=S04"]'),()=>doc().querySelectorAll('[data-availability="unsupported"]').length===3);
    assert(doc().querySelectorAll('video[data-rollout]').length===5,'Wrong S04 applicability');
    assert(first.paused&&!first.isConnected,'Old OFT_m player was not released');
    await change(()=>click('.catalogue-nav .tab[href*="mode=dynamic"]'),()=>!!query('.nav-item[href*="perturbation=D20"]'));
    await change(()=>click('.nav-item[href*="perturbation=D06"]'),()=>!!query('[data-task="libero_10-8"] [data-availability="unsupported"]'));
    assert(doc().querySelectorAll('video[data-rollout]').length===7,'Wrong D06 applicability');
    for(const id of ['D19','D20']){
      await change(()=>click(`.nav-item[href*="perturbation=${id}"]`),()=>query('video source')?.getAttribute('src').endsWith(`/${id}.mp4`));
      assert(doc().querySelectorAll('video[data-rollout]').length===8,`${id}: missing recordings`);
      assert([...doc().querySelectorAll('video source')].every(el=>el.getAttribute('src').includes('/openvla-oft-m/')),`${id}: wrong model`);
    }
    const last=query('video[data-rollout]');
    last.scrollIntoView({block:'center',behavior:'instant'});
    await waitFor(()=>last.videoWidth===640&&last.currentTime>0&&!last.paused);
    assert(last.playbackRate===2,'Dynamic OFT_m playback lost 2× speed');
    assert(doc().documentElement.scrollWidth<=win().innerWidth,'OFT_m grid overflows');
  }],
  ['NORA recordings match tasks and perturbations and keep 2× playback', async () => {
    await load('model.html?id=nora&perturbation=BASE');
    assert(!query('video[data-rollout]')&&doc().querySelectorAll('[data-availability="missing"]').length===8,'NORA Base recordings were not supplied');
    await change(()=>click('.catalogue-nav .tab[href*="mode=static"]'),()=>doc().querySelectorAll('video[data-rollout]').length===8);
    const first=query('video[data-rollout]');
    first.scrollIntoView({block:'center',behavior:'instant'});
    await waitFor(()=>first.videoWidth===640&&first.currentTime>0&&!first.paused);
    assert(first.muted&&first.loop&&first.playbackRate===2&&first.defaultPlaybackRate===2,'NORA should autoplay silently at 2×');
    for(const [id,count] of [['S04',5],['S05',7]]){
      await change(()=>click(`.nav-item[href*="perturbation=${id}"]`),()=>query('video source')?.getAttribute('src').endsWith(`/${id}.mp4`));
      assert(doc().querySelectorAll('video[data-rollout]').length===count,`${id}: incorrect NORA task coverage`);
      assert([...doc().querySelectorAll('[data-availability="unsupported"]')].every(el=>el.textContent.includes('Not supported')),'Use the English unsupported label');
    }
    assert(first.paused&&!first.isConnected,'Old NORA player was not released');
    await change(()=>click('.catalogue-nav .tab[href*="mode=dynamic"]'),()=>!!query('.nav-item[href*="perturbation=D20"]'));
    for(const [id,count] of [['D06',7],['D19',8],['D20',8]]){
      await change(()=>click(`.nav-item[href*="perturbation=${id}"]`),()=>query('video source')?.getAttribute('src').endsWith(`/${id}.mp4`));
      assert(doc().querySelectorAll('video[data-rollout]').length===count,`${id}: incorrect NORA task coverage`);
      assert([...doc().querySelectorAll('video[data-rollout]')].every(v=>v.playbackRate===2&&v.querySelector('source').getAttribute('src').includes('/nora/')),'NORA switched to another speed or model');
    }
    const last=query('video[data-rollout]');
    last.scrollIntoView({block:'center',behavior:'instant'});
    await waitFor(()=>last.videoWidth===640&&last.currentTime>0&&!last.paused);
    assert(doc().documentElement.scrollWidth<=win().innerWidth,'NORA grid overflows');
  }],
  ['Model chips toggle lines without reloads and retain selection through independent table changes', async () => {
    await load('leaderboard.html#capabilities');
    const {models}=await (await fetch('../data/results.json')).json();
    const chosen=()=>[...doc().querySelectorAll('[data-chart-model][aria-pressed="true"]')].map(el=>el.dataset.chartModel);
    assert(chosen().length===models.length,'Default comparison should contain every model');
    assert(!query('#capabilities select'),'Chart selection uses a dropdown');
    assert(doc().querySelectorAll('[data-chart-model] img').length===models.length,'Every chip needs its model image');
    const chart=query('.capability-svg'),scroll=win().scrollY;
    query('[data-chart-model="pi0"]').focus({preventScroll:true});
    await change(()=>click('[data-chart-model="pi0"]'),()=>!chosen().includes('pi0'));
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
  ['All chart points and accessible table scores match the original aggregate data', async () => {
    await load('leaderboard.html');
    click('[data-chart-select="all"]');
    const {models}=await (await fetch('../data/results.json')).json();
    const rows=[...doc().querySelectorAll('.capability-data tbody tr')];
    for(const m of models){
      const series=query(`[data-series="${m.id}"]`),points=[...series.querySelectorAll('[data-metric]')];
      const expected=[m.scores.base,m.scores.overall,m.scores.dynamic.average,m.scores.static.average];
      const available=['base','overall','dynamic','static'].filter((_,i)=>Number.isFinite(expected[i]));
      assert(points.map(p=>p.dataset.metric).join(',')===available.join(','),'Wrong metric order or missing Base treated as zero');
      points.forEach((point,i)=>assert(Math.abs(Number(point.dataset.value)-expected.filter(Number.isFinite)[i])<1e-10,m.name+' chart point is wrong'));
      const cells=m.cells.filter(c=>c.direction!=='BASE');
      assert(Math.abs(expected[1]-cells.reduce((s,c)=>s+c.rate,0)/cells.length)<1e-10,'Overall no longer averages available cells');
      const row=rows.find(r=>new URL(r.querySelector('a').href).searchParams.get('id')===m.id);
      assert([...row.querySelectorAll('td')].map(c=>c.textContent).join(',')===expected.map(v=>Number.isFinite(v)?(v*100).toFixed(1)+'%':'—').join(','),'Accessible table differs from chart');
    }
    const grid=query('.capability-grid').textContent;
    assert(grid.includes('100%')&&grid.includes('0'),'Shared success-rate scale is missing');
    const labels=[...doc().querySelectorAll('.capability-series:not([hidden]) .capability-end-label text')];
    const ys=labels.map(label=>Number(label.getAttribute('y'))).sort((a,b)=>a-b);
    assert(ys.every((y,i)=>y>=30&&y<query('.capability-svg').viewBox.baseVal.height-30&&(!i||y-ys[i-1]>=21.9)),'Selected model labels overlap or leave the chart');
  }],
  ['Whole lines preview models, accept nearby clicks and open results directly with Back restoring selection', async () => {
    await load('leaderboard.html#capabilities');
    for(const id of ['lingbot-va','molmoact2','cosmos-policy']){
      const series=query(`[data-series="${id}"]`),points=series.querySelectorAll('.capability-point');
      for(let segment=0;segment<points.length-1;segment++){
        const a=points[segment],b=points[segment+1];
        const local=new (win().DOMPoint)(a.cx.baseVal.value*.8+b.cx.baseVal.value*.2,a.cy.baseVal.value*.8+b.cy.baseVal.value*.2);
        let point=local.matrixTransform(series.getScreenCTM());
        win().scrollBy(0,point.y-win().innerHeight/2);
        point=local.matrixTransform(series.getScreenCTM());
        doc().elementFromPoint(point.x,point.y).dispatchEvent(new (win().PointerEvent)('pointermove',{bubbles:true,pointerType:'mouse',clientX:point.x,clientY:point.y}));
        assert(query('[data-series].highlighted')===series,'An overlapping line stole the hover preview');
        assert(doc().elementFromPoint(point.x,point.y)?.closest('[data-series]')===series,'An overlapping line would open the wrong model');
      }
    }
    const crossingLines=['lingbot-va','molmoact2'].map(id=>[...query(`[data-series="${id}"]`).querySelectorAll('.capability-point')].slice(-2));
    const [a,b]=crossingLines;
    const start=a[0].cy.baseVal.value-b[0].cy.baseVal.value,end=a[1].cy.baseVal.value-b[1].cy.baseVal.value,t=start/(start-end);
    const crossing=new (win().DOMPoint)(a[0].cx.baseVal.value+(a[1].cx.baseVal.value-a[0].cx.baseVal.value)*t,a[0].cy.baseVal.value+(a[1].cy.baseVal.value-a[0].cy.baseVal.value)*t).matrixTransform(a[0].getScreenCTM());
    let crossingModel;
    for(let i=0;i<4;i++){
      doc().elementFromPoint(crossing.x,crossing.y).dispatchEvent(new (win().PointerEvent)('pointermove',{bubbles:true,pointerType:'mouse',clientX:crossing.x,clientY:crossing.y}));
      const current=query('[data-series].highlighted').dataset.series;
      if(i)assert(current===crossingModel,'Hover flickers at an exact line crossing');
      crossingModel=current;
    }
    // Touch can land on a lower-painted line before any hover has promoted it.
    await load('leaderboard.html#capabilities');
    const touchSeries=query('[data-series="lingbot-va"]'),touchPoints=touchSeries.querySelectorAll('.capability-point');
    const localTouch=new (win().DOMPoint)(touchPoints[0].cx.baseVal.value*.8+touchPoints[1].cx.baseVal.value*.2,touchPoints[0].cy.baseVal.value*.8+touchPoints[1].cy.baseVal.value*.2);
    let touch=localTouch.matrixTransform(touchSeries.getScreenCTM());
    win().scrollBy(0,touch.y-win().innerHeight/2);
    touch=localTouch.matrixTransform(touchSeries.getScreenCTM());
    doc().elementFromPoint(touch.x,touch.y).dispatchEvent(new (win().MouseEvent)('click',{bubbles:true,cancelable:true,button:0,detail:1,clientX:touch.x,clientY:touch.y}));
    await waitFor(()=>query('.model-title')?.textContent.includes('Lingbot-VA'),'nearest-line touch navigation');
    assert(new URL(win().location).searchParams.get('id')==='lingbot-va','Tap without hover followed the overlapping model');
    await load('leaderboard.html?compare=lingbot-va,pi0#capabilities');
    const card=()=>query('#capability-preview');
    const series=query('[data-series="lingbot-va"]');
    const points=[...series.querySelectorAll('.capability-point')];
    for(let segment=0;segment<points.length-1;segment++){
      for(const fraction of [.2,.5,.8]){
        const a=points[segment],b=points[segment+1];
        const local=new (win().DOMPoint)(a.cx.baseVal.value+(b.cx.baseVal.value-a.cx.baseVal.value)*fraction,a.cy.baseVal.value+(b.cy.baseVal.value-a.cy.baseVal.value)*fraction);
        let point=local.matrixTransform(series.getScreenCTM());
        win().scrollBy(0,point.y-win().innerHeight/2);
        point=local.matrixTransform(series.getScreenCTM());
        // Exercise real SVG hit testing between points, 12px away from the thin visible line.
        const hit=doc().elementFromPoint(point.x,point.y+12);
        assert(hit?.closest('[data-series]')===series,'A line segment is hard to target');
        hit.dispatchEvent(new (win().PointerEvent)('pointerover',{bubbles:true,pointerType:'mouse',clientX:point.x,clientY:point.y+12}));
        assert(!card().hidden&&card().textContent.includes('autoregressive'),'Hover did not show the model introduction');
        assert(doc().elementFromPoint(point.x,point.y+12)?.closest('[data-series]')===series,'The preview intercepted a line click');
      }
    }
    assert(card().textContent.includes('75.0%'),'Missing real model score');
    assert(!card().querySelector('a,button'),'The preview still requires a second interactive target');
    series.dispatchEvent(new (win().KeyboardEvent)('keydown',{bubbles:true,key:'Escape'}));
    assert(card().hidden,'Escape failed to dismiss hover details');
    const pi=query('[data-series="pi0"]');pi.focus({preventScroll:true});
    assert(!card().hidden&&card().textContent.includes('flow-based'),'Keyboard focus did not expose details');
    assert(pi.localName==='a'&&new URL(pi.getAttribute('href'),win().location).searchParams.get('id')==='pi0','The line is not a native model link');
    pi.dispatchEvent(new (win().KeyboardEvent)('keydown',{bubbles:true,key:'Escape'}));
    assert(card().hidden&&doc().activeElement===pi,'Escape moved focus away from the model line');
    pi.dispatchEvent(new (win().PointerEvent)('pointerover',{bubbles:true,pointerType:'touch'}));
    const previous=win().location.href;
    await navigate(()=>click('[data-series="pi0"] .capability-hit'),()=>query('.model-title')?.textContent.includes('π0'));
    assert(new URL(win().location).searchParams.get('id')==='pi0','A single line click did not open the correct profile');
    win().history.back();
    await waitFor(()=>win().location.href===previous&&!!query('.capability-chart'),'chart Back restoration');
    assert(doc().querySelectorAll('[data-chart-model][aria-pressed="true"]').length===2,'Back lost selected models');
    win().history.forward();
    await waitFor(()=>query('.model-title')?.textContent.includes('π0'),'model Forward restoration');
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
    const blueTable=query('#perturbation-rankings .leaderboard-table').innerHTML;
    await change(() => click('#rankings .tab[href*="mode=overall"]'), () => query('#rankings .table-scroll').getAttribute('aria-label').startsWith('Overall'));
    assert(query('[data-query="type"]').value==='World Action Models'&&query('[data-sort="environment"]').closest('th').getAttribute('aria-sort')==='descending','Overall reset the filters');
    assert(query('#perturbation-rankings .leaderboard-table').innerHTML===blueTable,'Overall changed the perturbation table');
    await load(win().location.href);
    assert(query('#rankings .tab.active').textContent.includes('Overall') && query('[data-query="type"]').value === 'World Action Models', 'Deep link did not restore filters');
  }],
  ['All perturbation scores and detail links match the published suite results', async () => {
    const [{models},{perturbations}]=await Promise.all(['results','catalogue'].map(async name=>(await fetch('../data/'+name+'.json')).json()));
    for(const mode of ['static','dynamic']){
      await load('leaderboard.html?perturbationMode='+mode+'#perturbation-rankings');
      const directions=perturbations.filter(p=>p.mode===mode);
      const table=query('.perturbation-table');
      const ids=[...table.querySelectorAll('[data-perturbation-sort]')].map(el=>el.dataset.perturbationSort).slice(1);
      assert(JSON.stringify(ids)===JSON.stringify(directions.map(p=>p.id)), 'Perturbations missing or out of public ID order');
      assert(table.querySelectorAll('tbody tr').length===models.length, 'Missing models');
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
    const reachablePosition=Math.min(position,Math.max(0,doc().documentElement.scrollHeight-win().innerHeight));
    assert(Math.abs(win().scrollY-reachablePosition)<2, 'Page jumped during perturbation selections');
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
  ['Document directory, adjacent documents and Overview update without history noise', async () => {
    await load('docs.html?perturbation=S01');
    const sidebar = query('.docs-sidebar');
    const group = [...doc().querySelectorAll('.doc-nav-group details')].find(el => el.querySelector('summary').textContent === 'Environment');
    group.open = true;
    await change(() => click('.docs-sidebar a[href*="perturbation=S02"]'), () => query('h1')?.textContent === 'Receiver planar pose');
    assert(query('.docs-sidebar') === sidebar && group.open, 'Directory or expanded group was lost');
    await change(() => click('.doc-pagination a:last-child'), () => query('h1')?.textContent === 'Receiver or support height');
    await change(() => click('.docs-sidebar a[href="docs.html"]'), () => !!query('#scoring'));
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
  ['Report and Community share navigation, preserve Back, and accept old Eval bookmarks', async () => {
    await load('report.html');
    const links = [...doc().querySelectorAll('.site-nav a')].map(a => a.textContent);
    assert(links.join(',') === 'Home,Document,Leaderboard,Report', 'Main navigation still includes Eval');
    assert(query('.site-links a').href === 'https://github.com/LIBERO-Pro-Team/LIBERO-Pro2.0', 'Code has the wrong repository');
    assert(query('a[aria-current="page"]').textContent === 'Report', 'Report active link is missing');
    assert(doc().querySelectorAll('.publication-row').length === 2, 'Both paper editions must be present');
    assert(doc().documentElement.scrollWidth <= win().innerWidth, 'Report overflows the viewport');
    click('.site-links a[href="community.html"]');
    await waitFor(() => query('h1')?.textContent === 'Community' && query('a[aria-current="page"]')?.textContent === 'Community');
    assert(query('a[aria-current="page"]').textContent === 'Community', 'Community active link is missing');
    assert(doc().querySelectorAll('.community-section').length === 5, 'Community sections are missing');
    assert(doc().documentElement.scrollWidth <= win().innerWidth, 'Community overflows the viewport');
    if (win().matchMedia('(max-width:760px)').matches) {
      click('.menu-button');
      assert(query('.site-nav').classList.contains('open'), 'Mobile menu failed to open');
      doc().dispatchEvent(new (win().KeyboardEvent)('keydown', {key:'Escape', bubbles:true}));
      assert(query('.menu-button').getAttribute('aria-expanded') === 'false', 'Escape failed to close the mobile menu');
      assert(doc().activeElement === query('.menu-button'), 'Escape did not return keyboard focus');
      click('.menu-button');
    }
    click('.site-nav a[href="report.html"]');
    await waitFor(() => query('h1')?.textContent === 'Report');
    win().history.back();
    await waitFor(() => query('h1')?.textContent === 'Community');
    await load('eval.html');
    await waitFor(() => win().location.pathname.endsWith('/report.html') && query('h1')?.textContent === 'Report');
  }],
];

let failed = 0;
const requested=new URLSearchParams(location.search).get('test');
const selectedTests=requested?tests.filter(([name])=>name.includes(requested)):tests;
for (const [name, run] of selectedTests) {
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
document.querySelector('#status').textContent = `${selectedTests.length - failed}/${selectedTests.length} passed; ${failed} failed.`;
