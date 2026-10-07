const app = document.querySelector('#app');
const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = value => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
const mean = values => { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null; };
const modeLabel = mode => mode === 'dynamic' ? 'Dynamic' : 'Static';
const typeClass = type => type === 'World Action Models' ? 'wam' : type === 'Robustness-oriented' ? 'robust' : 'vla';
const typeLabel = type => type === 'World Action Models' ? 'World Action' : type === 'Robustness-oriented' ? 'Robustness' : 'VLA';
let catalogue, results, tasks, assets, news;
const url = (file, values={}, hash='') => `${file}.html${Object.keys(values).length ? `?${new URLSearchParams(Object.entries(values).filter(([,v])=>v !== null && v !== undefined))}` : ''}${hash ? '#'+hash : ''}`;
const modelUrl = (m, extra={}, hash='') => url('model',{id:m.id,...extra},hash);
const directionUrl = (p, m=null) => m ? modelUrl(m,{perturbation:p.id,mode:p.mode,category:p.category},'rollouts') : url('perturbation',{id:p.id});
const categoryFor = id => catalogue.categories.find(c=>c.id===id);
const directionsFor = (mode, category='all') => catalogue.perturbations.filter(p=>p.mode===mode && (category==='all'||p.category===category));
const modelById = id => results.models.find(m=>m.id===id);
const logo = (m, large=false) => `<img class="logo${large?' large':''}" src="assets/models/${esc(assets[m.id].asset)}" alt="" title="${esc(assets[m.id].credit)}" width="${large?58:28}" height="${large?58:28}">`;
const tag = m => `<span class="type-tag ${typeClass(m.type)}">${esc(typeLabel(m.type))}</span>`;
const domainStyle = c => `style="--domain:var(--${c.id})"`;
const pill = mode => `<span class="mode ${mode}">${modeLabel(mode)}</span>`;
const directionRate = (m,p) => mean(m.cells.filter(c=>c.direction===p.id).map(c=>c.rate));
const selectedMode = () => params.get('mode') === 'dynamic' ? 'dynamic' : 'static';
const selectedCategory = () => categoryFor(params.get('category')) ? params.get('category') : 'all';
const head = (title,desc='',crumb='') => `<header class="page-head">${crumb}<h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</header>`;
const sectionHead = (title,link='') => `<div class="section-head"><h2>${title}</h2>${link}</div>`;
const breadcrumb = links => `<nav class="breadcrumb" aria-label="Breadcrumb">${links.map(([label,href])=>href?`<a href="${esc(href)}">${esc(label)}</a>`:`<span aria-current="page">${esc(label)}</span>`).join('<span aria-hidden="true">/</span>')}</nav>`;
const tabs = (mode,href) => `<div class="tabs" aria-label="Distribution shift">${['static','dynamic'].map(x=>`<a class="tab ${mode===x?'active':''}" ${mode===x?'aria-current="true"':''} href="${esc(href(x))}">${modeLabel(x)} <span class="count-label">${x==='static'?'22':'20'}</span></a>`).join('')}</div>`;
const newsSection = () => `<section class="section news-section" id="news">${sectionHead('News')}${news.entries.map(n=>`<p><time>${esc(n.date)}</time> ${esc(n.title||n.text)}</p>`).join('')}</section>`;

function layout(content, entries) {
  const links=entries.map(([id,name])=>`<a href="#${id}">${name}</a>`).join('');
  return `<details class="toc-mobile"><summary>On this page</summary><nav aria-label="Page sections">${links}</nav></details><div class="page-layout"><aside class="toc"><p>On this page</p><nav aria-label="Page sections">${links}</nav></aside><main id="content">${content}</main></div>`;
}

function baseTaskList() {
  return `<div class="task-list">${tasks.map(t=>`<a class="base-task" href="${url('task',{id:t.id})}"><span class="task-index">${esc(t.suiteName.slice(0,2))}${t.taskId}</span><div><h3>${esc(t.instruction)}</h3><p>LIBERO-${esc(t.suiteName)} · task ${t.taskId}</p></div><span class="arrow" aria-hidden="true">↗</span></a>`).join('')}</div>`;
}

function homePage() {
  return `<main id="content">
    <section class="hero" id="overview"><h1>LIBERO<span>-Pro</span></h1><p class="subtitle">A Benchmark for Evaluating<br>Robust Embodied Intelligence</p><p class="description">Evaluating robot policies under static distribution shifts and runtime interventions across six perturbation domains.</p><div class="actions"><a class="button" href="leaderboard.html">Leaderboard <span aria-hidden="true">↗</span></a><a class="button secondary" href="tasks.html">Explore tasks</a><a class="button secondary" href="docs.html">Documentation</a></div><figure class="hero-figure"><a href="assets/paper/overview.webp" target="_blank" rel="noopener" aria-label="Open full benchmark overview figure"><img src="assets/paper/overview.webp" width="2000" height="1125" alt="LIBERO-Pro benchmark overview: 22 static and 20 dynamic perturbations across six domains"></a></figure></section>
    ${newsSection()}
    <section class="section" id="benchmark">${sectionHead('About the benchmark')}<p class="intro">LIBERO-Pro evaluates how robot policies respond when task conditions change. Static shifts are introduced at reset; dynamic shifts occur during execution. Both preserve the original task goal and the feasibility of completing it.</p><div class="mode-guide" style="margin-top:30px"><div>${pill('static')}<h3>Generalization before execution</h3><p>22 perturbations change object layouts, scene appearance, sensors, robot configuration, timing or language at initialization.</p></div><div>${pill('dynamic')}<h3>Adaptation during execution</h3><p>20 interventions are triggered at task-relevant moments, including approach, grasp, transport and placement.</p></div></div></section>
    <section class="section" id="domains">${sectionHead('Perturbation domains','<a class="text-link" href="tasks.html">Explore all 42 perturbations ↗</a>')}<div class="section-grid"><div><p>Six domains organize the benchmark. Each perturbation has a mechanism illustration and a gallery for the eight evaluation tasks.</p><div class="domain-list">${catalogue.categories.map(c=>`<a class="domain-link" href="${url('tasks',{category:c.id})}" ${domainStyle(c)}><strong class="domain-name">${c.name}</strong><p>${esc(c.description)}</p><span>${c.static.length} static / ${c.dynamic.length} dynamic ↗</span></a>`).join('')}</div></div><figure class="taxonomy-figure"><img src="assets/paper/taxonomy.webp" alt="Paper taxonomy diagram showing the distribution of 42 perturbation types across six domains" width="1200" height="1200" loading="lazy"><figcaption class="caption">Perturbation taxonomy from the current paper.</figcaption></figure></div></section>
    <section class="section" id="evaluation-tasks">${sectionHead('Evaluation tasks','<a class="text-link" href="tasks.html#base-tasks">View task catalogue ↗</a>')}<p style="margin-bottom:15px">Eight held-out tasks, with two tasks from each LIBERO suite.</p>${baseTaskList()}</section>
    <section class="section" id="leaderboard">${sectionHead('Leaderboard','<a class="text-link" href="leaderboard.html">Full leaderboard ↗</a>')}<p class="caption" style="margin:0 0 24px">Top five models in each setting · success rate (%) · all 42 published perturbations</p><div class="chart-grid">${chart('static',5)}${chart('dynamic',5)}</div></section>
    <section class="section" id="resources">${sectionHead('Resources')}<div class="mode-guide"><div><h3>Evaluation protocol</h3><p style="margin:10px 0">Understand the task split, success-rate aggregation and public perturbation numbering.</p><a class="text-link" href="docs.html#protocol">Read the protocol ↗</a></div><div><h3>Results and examples</h3><p style="margin:10px 0">Browse model results and inspect task-level counts where available. Rollout media will be added to the reserved galleries.</p><a class="text-link" href="leaderboard.html">Browse results ↗</a></div></div></section>
  </main>`;
}

function rankedModels(mode, category='all', sort='average', ascending=false) {
  const score=m=>sort==='base'?m.scores.base:sort==='delta'?(m.scores.base===null?null:m.scores[mode].average-m.scores.base):categoryFor(sort)?m.scores[mode].categories[sort]:m.scores[mode].average;
  return results.models.filter(m=>category==='all'||m.type===category).sort((a,b)=>{
    const x=score(a),y=score(b);if(x===null)return y===null?a.name.localeCompare(b.name):1;if(y===null)return -1;
    return (ascending?x-y:y-x)||a.name.localeCompare(b.name);
  });
}

function chart(mode,limit=14,models=null) {
  const entries=(models||rankedModels(mode)).slice(0,limit);
  return `<div class="chart-panel ${mode}"><h3>${modeLabel(mode)} shifts</h3><p class="caption">${mode==='static'?'22 perturbations introduced at reset':'20 interventions during execution'}</p><div class="chart-axis" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div><div class="bar-chart" aria-label="${modeLabel(mode)} success rates">${entries.map(m=>`<a class="bar-row" href="${modelUrl(m,{mode})}" aria-label="${esc(m.name)}, ${mode} success rate ${pct(m.scores[mode].average)}"><span class="bar-name">${logo(m)}${esc(m.name)}</span><span class="bar-track" aria-hidden="true"><i class="bar-fill" style="width:${100*m.scores[mode].average}%"></i></span><span class="bar-value">${(m.scores[mode].average*100).toFixed(1)}</span></a>`).join('')}</div></div>`;
}

function leaderboardTable(mode,models,sort='average',ascending=false) {
  const sortButton=(key,label)=>`<button data-sort="${key}" aria-label="Sort by ${label}">${label}${sort===key?(ascending?' ↑':' ↓'):''}</button>`;
  const delta=m=>m.scores.base===null?'—':`${m.scores[mode].average-m.scores.base>0?'+':''}${((m.scores[mode].average-m.scores.base)*100).toFixed(1)}`;
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="${modeLabel(mode)} leaderboard, horizontally scrollable"><table class="leaderboard-table"><thead><tr><th scope="col">#</th><th scope="col">Model</th><th scope="col">Type</th><th scope="col" ${sort==='average'?`aria-sort="${ascending?'ascending':'descending'}"`:''}>${sortButton('average','Average')}</th>${catalogue.categories.map(c=>`<th scope="col" ${sort===c.id?`aria-sort="${ascending?'ascending':'descending'}"`:''}>${sortButton(c.id,c.name)}<small>${c[mode].join(', ')}</small></th>`).join('')}<th scope="col" ${sort==='base'?`aria-sort="${ascending?'ascending':'descending'}"`:''}>${sortButton('base','Base')}</th><th scope="col" ${sort==='delta'?`aria-sort="${ascending?'ascending':'descending'}"`:''}>${sortButton('delta','Δ (pp)')}</th><th scope="col"><span class="small">Details</span></th></tr></thead><tbody>${models.map((m,i)=>`<tr data-href="${modelUrl(m,{mode})}"><td>${i+1}</td><th scope="row" class="model-cell"><a class="model-link" href="${modelUrl(m,{mode})}">${logo(m)}${esc(m.name)}</a></th><td>${tag(m)}</td><td class="average">${pct(m.scores[mode].average)}</td>${catalogue.categories.map(c=>{const v=m.scores[mode].categories[c.id];return `<td class="score-cell"><a style="--heat:${v===null?0:(.04+v*.22).toFixed(3)}" href="${modelUrl(m,{mode,category:c.id,perturbation:c[mode][0]},'rollouts')}" aria-label="${esc(m.name)}, ${c.name}, ${pct(v)}, view tasks">${pct(v)}</a></td>`;}).join('')}<td>${pct(m.scores.base)}</td><td class="delta">${delta(m)}</td><td><a href="${modelUrl(m,{mode})}" aria-label="View ${esc(m.name)} details">↗</a></td></tr>`).join('')}</tbody></table></div>`;
}

function leaderboardPage() {
  const mode=selectedMode();
  const type=['Mainstream VLA','World Action Models','Robustness-oriented'].includes(params.get('type'))?params.get('type'):'all';
  const sort=['average','base','delta',...catalogue.categories.map(c=>c.id)].includes(params.get('sort'))?params.get('sort'):'average';
  const asc=params.get('order')==='asc';
  const entries=rankedModels(mode,type,sort,asc);
  return layout(`${head('Leaderboard','Success rates under static shifts and dynamic interventions. Select a model or a domain score to inspect its tasks.')}
    ${newsSection()}
    <section class="section" id="capabilities">${sectionHead('Model capabilities')}<div class="chart-grid">${chart('static')}${chart('dynamic')}</div><div class="legend"><span style="--bar:#c99742">Static success rate</span><span style="--bar:#269d92">Dynamic success rate</span><p>Shared 0–100% scale. Click any model to explore its results.</p></div></section>
    <section class="section" id="rankings">${sectionHead('Model comparison',`<span class="count-label">${entries.length} models · success rate (%)</span>`)}<div class="controls">${tabs(mode,m=>url('leaderboard',{mode:m,type},'rankings'))}<label class="control">Model type <select data-query="type" data-anchor="rankings"><option value="all">All models</option>${['Mainstream VLA','World Action Models','Robustness-oriented'].map(t=>`<option ${type===t?'selected':''}>${t}</option>`).join('')}</select></label></div>${leaderboardTable(mode,entries,sort,asc)}<p class="table-note">Average includes every applicable suite × perturbation result in the selected setting. Six domain columns use the paper taxonomy. Δ = Average − Base, in percentage points. Missing values remain blank (—). <a class="text-link" href="docs.html#scoring">Scoring details ↗</a></p></section>
    <section class="section" id="protocol">${sectionHead('Evaluation protocol')}<div class="mode-guide"><div><h3>42 perturbations, 8 base tasks</h3><p style="margin-top:12px">S01–S22 are static; D01–D20 are dynamic. Evaluation uses two held-out tasks from each of four LIBERO suites. A single perturbation is applied to each evaluated case.</p></div><div><h3>Success rate only</h3><p style="margin-top:12px">A rollout succeeds when it satisfies the original task goal. Scores exclude RQ experiments and combined perturbation suites. No additional composite score is used.</p></div></div></section>
    <section class="section" id="data">${sectionHead('Data & sources')}<p>Sheet results were retrieved on October 7, 2026. OpenVLA-OFT_w, OpenVLA-OFT_m, OpenVLA-OFT+ and RIPT-VLA use completed evaluation counts from October 4, 2026.</p><div class="actions" style="justify-content:flex-start"><a class="button secondary" href="data/results.json" download>Download results</a><a class="button secondary" href="docs.html#sources">Data coverage</a></div></section>`,[['news','News'],['capabilities','Capabilities'],['rankings','Model comparison'],['protocol','Protocol'],['data','Data & sources']]);
}

function categoryFilters(mode,category,file='tasks') {
  return `<nav class="domain-filter" aria-label="Perturbation domain"><a class="${category==='all'?'active':''}" href="${url(file,{mode})}">All domains</a>${catalogue.categories.map(c=>`<a class="${category===c.id?'active':''}" href="${url(file,{mode,category:c.id})}">${c.name} <small>${c[mode].length}</small></a>`).join('')}</nav>`;
}

function perturbationCard(p) {
  return `<a class="perturbation-card" href="${directionUrl(p)}"><img src="${p.image}" width="1760" height="510" loading="lazy" alt="${esc(p.name)} mechanism example from the paper"><h3><span class="id">${p.id}</span>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="card-meta"><span class="domain-name" ${domainStyle(categoryFor(p.category))}>${categoryFor(p.category).name}</span><span>8 task slots ↗</span></div></a>`;
}

function tasksPage() {
  const mode=selectedMode(),category=selectedCategory();
  return layout(`${head('Tasks','Explore 42 perturbation types across six domains, with eight held-out manipulation tasks.')}
    <section class="section" id="perturbations">${sectionHead('Perturbation catalogue')}<div class="controls">${tabs(mode,m=>url('tasks',{mode:m,category},'perturbations'))}<span class="count-label">${directionsFor(mode,category).length} perturbations</span></div>${categoryFilters(mode,category)}<div class="catalogue-grid">${directionsFor(mode,category).map(perturbationCard).join('')}</div></section>
    <section class="section" id="base-tasks">${sectionHead('Base tasks')}<p style="margin-bottom:12px">The evaluation split contains two tasks per suite. Task identifiers are zero-based.</p>${baseTaskList()}</section>
    <section class="section" id="taxonomy">${sectionHead('Benchmark taxonomy')}<div class="section-grid"><div><p>The taxonomy follows the current paper. Each domain includes its static shifts and corresponding runtime interventions.</p><div class="domain-list">${catalogue.categories.map(c=>`<a class="domain-link" href="${url('tasks',{category:c.id,mode})}"><strong class="domain-name" ${domainStyle(c)}>${c.name}</strong><p>${esc(c.description)}</p><span>${c.static.length+c.dynamic.length} types ↗</span></a>`).join('')}</div></div><figure class="taxonomy-figure"><img src="assets/paper/taxonomy.webp" width="1200" height="1200" loading="lazy" alt="42 perturbations grouped in the six paper categories"></figure></div></section>`,[['perturbations','Perturbations'],['base-tasks','Base tasks'],['taxonomy','Taxonomy']]);
}

function mediaSlot(task,p,m=null) {
  const count=m?.cases.find(c=>c.task===task.id&&c.direction===p.id);
  const applicable=!(p.id==='S04'&&task.suite==='libero_spatial');
  const rate=count?count.successes/count.episodes:null;
  const media=task.media?.[m?.id]?.[p.id];
  const safeMedia=typeof media==='string'&&/^assets\/rollouts\/[a-zA-Z0-9_./-]+\.(gif|webp|mp4|webm)$/.test(media)&&!media.includes('..')?media:null;
  const visual=safeMedia?(safeMedia.endsWith('.mp4')||safeMedia.endsWith('.webm')?`<video controls preload="none" playsinline aria-label="${esc(task.instruction)} under ${p.id}"><source src="${esc(safeMedia)}"></video>`:`<img class="rollout-media" src="${esc(safeMedia)}" alt="${esc(task.instruction)} under ${p.id}" loading="lazy">`):`<div class="media-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/></svg><span>${applicable?'Rollout coming soon':'Not applicable'}</span></div>`;
  return `<article class="rollout-slot" data-task="${esc(task.id)}">${visual}<h4><a href="${url('task',{id:task.id,...(m?{model:m.id}:{})})}">${esc(task.instruction)} ↗</a></h4><div class="slot-meta"><span>${esc(task.suiteName)} · ${task.taskId}</span><span class="slot-rate">${applicable?pct(rate):'N/A'}</span></div>${count?`<p class="small">${count.successes} / ${count.episodes} successes</p>`:''}</article>`;
}

function catalogueNav(p,m=null) {
  const href=d=>directionUrl(d,m);
  return `<aside class="catalogue-nav" aria-label="Perturbations">${tabs(p.mode,mode=>href(directionsFor(mode,p.category)[0]))}${catalogue.categories.map(c=>`<section class="nav-group"><h3 class="domain-name" ${domainStyle(c)}>${c.name}</h3>${directionsFor(p.mode,c.id).map(d=>`<a class="nav-item ${d.id===p.id?'active':''}" ${d.id===p.id?'aria-current="true"':''} href="${href(d)}"><span>${d.id}</span>${esc(d.name)}</a>`).join('')}</section>`).join('')}</aside>`;
}

function modelSelect(m,p=null) {
  return `<div class="selected-model"><label class="control">Model <select id="model-select" ${p?`data-perturbation="${p.id}"`:''}><option value="">Select a model</option>${results.models.map(x=>`<option value="${x.id}" ${m?.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>${m?`<a class="text-link" href="${modelUrl(m)}">View model profile ↗</a>`:''}</div>`;
}

function rolloutPanel(p,m) {
  return `<div class="rollout-content" id="rollouts"><div class="rollout-title"><div>${pill(p.mode)} <span class="small" style="margin-left:8px">${p.id} · ${categoryFor(p.category).name}</span><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p></div>${m?`<div class="direction-score">${pct(directionRate(m,p))}<small>Success rate · suite average</small></div>`:''}</div><figure class="mechanism-image"><img src="${p.image}" width="1760" height="510" alt="${esc(p.name)}: paper mechanism illustration"><figcaption>Mechanism illustration from the paper, independent of model evaluation rollouts.</figcaption></figure><p class="small">${esc(p.constraint)}</p><div class="section-head" style="margin-top:32px;margin-bottom:18px"><h3>Evaluation task rollouts</h3><span class="count-label">8 tasks</span></div>${m?.source.granularity==='suite'?'<p class="table-note" style="margin:0 0 18px">This model has suite-level results. Individual task success rates and videos have not been supplied.</p>':'<p class="table-note" style="margin:0 0 18px">Videos will be added here. Available task success rates are shown below each reserved slot.</p>'}<div class="rollout-grid">${tasks.map(t=>mediaSlot(t,p,m)).join('')}</div>${m?`<div class="reading" style="margin-top:30px"><h3>Success rate by task suite</h3><table><thead><tr><th>Suite</th><th>Success rate</th></tr></thead><tbody>${['Spatial','Object','Goal','Long'].map(s=>{const task=tasks.find(t=>t.suiteName===s);const c=m.cells.find(x=>x.suite===task.suite&&x.direction===p.id);return `<tr><td>LIBERO-${s}</td><td>${c?pct(c.rate):'N/A'}</td></tr>`;}).join('')}</tbody></table></div>`:''}</div>`;
}

function modelPage() {
  const m=modelById(params.get('id')||params.get('model'));
  if(!m)return notFound('Model','leaderboard.html');
  let p=catalogue.perturbations.find(x=>x.id===params.get('perturbation'));
  if(!p)p=directionsFor(selectedMode(),selectedCategory())[0];
  const mode=p.mode;
  document.title=`${m.name} · LIBERO-Pro`;
  return `<main id="content"><header class="page-head detail-head">${breadcrumb([['Leaderboard','leaderboard.html'],[m.name]])}<div class="model-title">${logo(m,true)}<h1>${esc(m.name)}</h1></div><div class="detail-meta">${tag(m)}<a class="text-link" href="${esc(assets[m.id].project)}" target="_blank" rel="noopener">Official project ↗</a><span class="count-label">Results: ${m.source.date}</span></div><dl class="score-summary"><div><dt>Static success rate</dt><dd style="color:var(--static)">${pct(m.scores.static.average)}</dd></div><div><dt>Dynamic success rate</dt><dd style="color:var(--dynamic)">${pct(m.scores.dynamic.average)}</dd></div><div><dt>Nominal baseline</dt><dd>${pct(m.scores.base)}</dd></div></dl></header>
    <section aria-label="Category success rates">${sectionHead(`${modeLabel(mode)} success by domain`)}<div class="category-scores">${catalogue.categories.map(c=>{const v=m.scores[mode].categories[c.id];return `<a class="category-score ${p.category===c.id?'selected':''}" ${domainStyle(c)} href="${modelUrl(m,{mode,category:c.id,perturbation:c[mode][0]},'rollouts')}"><span class="name domain-name">${c.name}</span><strong>${pct(v)}</strong><span class="mini-track" aria-hidden="true"><i style="width:${(v??0)*100}%"></i></span></a>`;}).join('')}</div></section>
    <div class="detail-layout">${catalogueNav(p,m)}${rolloutPanel(p,m)}</div><section class="section reading" id="source"><h3>Result source</h3><p>${m.source.granularity==='task'?`${m.cases.reduce((n,c)=>n+c.episodes,0).toLocaleString('en-US')} completed episodes across ${m.cases.length} evaluated cases. Each case contains 30 trials.`:'Rates are available for each suite and perturbation; the source does not expose separate counts for the two tasks in a suite.'}</p><a href="${esc(m.source.url)}">${esc(m.source.label)} ↗</a><p class="small">Model image: ${esc(assets[m.id].credit)}.</p></section></main>`;
}

function perturbationPage() {
  const p=catalogue.perturbations.find(x=>x.id===params.get('id'));
  if(!p)return notFound('Perturbation','tasks.html');
  const m=modelById(params.get('model'));
  document.title=`${p.id} ${p.name} · LIBERO-Pro`;
  return `<main id="content">${head('Perturbation details','',breadcrumb([['Tasks','tasks.html'],[p.id+' '+p.name]]))}${modelSelect(m,p)}<div class="detail-layout">${catalogueNav(p,m)}${rolloutPanel(p,m)}</div></main>`;
}

function taskPage() {
  const t=tasks.find(t=>t.id===params.get('id'));
  if(!t)return notFound('Task','tasks.html#base-tasks');
  const mode=selectedMode(),m=modelById(params.get('model'));
  const category=selectedCategory();
  const dirs=directionsFor(mode,category);
  return `<main id="content">${head('Task details',esc(t.instruction),breadcrumb([['Tasks','tasks.html#base-tasks'],[`LIBERO-${t.suiteName} · task ${t.taskId}`]]))}${modelSelect(m)}<div class="controls">${tabs(mode,mode=>url('task',{id:t.id,mode,...(m?{model:m.id}:{})}))}<span class="count-label">${dirs.length} perturbations</span></div><nav class="domain-filter" aria-label="Perturbation domain">${[{id:'all',name:'All domains'},...catalogue.categories].map(c=>`<a class="${c.id===category?'active':''}" href="${url('task',{id:t.id,mode,category:c.id,...(m?{model:m.id}:{})})}">${c.name}</a>`).join('')}</nav><div class="task-detail-grid">${dirs.map(p=>`<div><h3 style="font-size:15px;margin-bottom:12px"><a href="${directionUrl(p,m)}">${p.id} · ${esc(p.name)} ↗</a></h3>${mediaSlot(t,p,m)}</div>`).join('')}</div><p class="table-note">Missing task rates are shown as —. Suite averages are never substituted for an individual task. Rollout media is reserved for future uploads.</p></main>`;
}

function findingsPage() {
  return layout(`${head('Findings','Robustness analysis across static shifts and runtime interventions.')}
    <section class="section" id="static-dynamic">${sectionHead('Static & dynamic robustness')}<div class="empty-section">Analysis coming soon.</div></section>
    <section class="section" id="domain-analysis">${sectionHead('Domain analysis')}<div class="empty-section">Analysis coming soon.</div></section>
    <section class="section" id="failure-analysis">${sectionHead('Failure analysis')}<div class="empty-section">Examples coming soon.</div></section>`,[['static-dynamic','Static & dynamic'],['domain-analysis','Domain analysis'],['failure-analysis','Failure analysis']]);
}

function docsPage() {
  return layout(`${head('Documentation','Benchmark structure, scoring definitions and data sources.')}
    <section class="section reading" id="protocol">${sectionHead('Evaluation protocol')}<p>LIBERO-Pro evaluates robot-policy robustness while preserving the original task goal and feasibility. The held-out evaluation split contains eight tasks: two each from LIBERO-Spatial, LIBERO-Object, LIBERO-Goal and LIBERO-10.</p><p>Static shifts are introduced at reset. Dynamic interventions are triggered during execution at task-relevant phases. Each case applies one perturbation. RQ experiments and combined perturbation suites are excluded from this website’s leaderboard.</p><a href="tasks.html#base-tasks">Explore the eight base tasks ↗</a></section>
    <section class="section reading" id="scoring">${sectionHead('Success-rate calculation')}<p>For results with trial counts, task success rate is successes ÷ episodes. Task counts are pooled within each suite × perturbation pair. The displayed average is the arithmetic mean of available suite × perturbation rates in the selected setting. Domain scores apply the same calculation to that domain.</p><p>The current taxonomy includes S22: there are 87 applicable static suite cells and 80 dynamic suite cells per model. S04 is not applicable to LIBERO-Spatial. Missing and inapplicable observations are not converted to zero. The earlier website excluded S22; its static and overall averages therefore differ.</p><p>Base is the average of available nominal suite rates. Δ = Average − Base, in percentage points; a negative value indicates lower success under perturbation. The website does not introduce a separate capability score.</p></section>
    <section class="section reading" id="taxonomy">${sectionHead('Paper taxonomy')}<div class="table-scroll" tabindex="0" role="region" aria-label="Paper taxonomy, horizontally scrollable"><table><thead><tr><th>Domain</th><th>Static</th><th>Dynamic</th></tr></thead><tbody>${catalogue.categories.map(c=>`<tr><th scope="row">${c.name}</th><td>${c.static.join(', ')}</td><td>${c.dynamic.join(', ')}</td></tr>`).join('')}</tbody></table></div><p>The website uses paper IDs. Paper D19 maps to internal D20 (robot joint displacement); paper D20 maps to internal D21 (instruction restatement). Internal D19 is excluded from the published 42-type catalogue. Static S06 belongs to Environment.</p></section>
    <section class="section reading" id="sources">${sectionHead('Data sources & coverage')}<p>Ten models use the four non-RQ sheets of the <a href="https://docs.google.com/spreadsheets/d/1Lfu3m6Dmh2nj3JeC9hBio1beL1yAJ6GTqXX7jFNuHaE/edit">evaluation spreadsheet</a>, retrieved October 7, 2026. These results are available at suite × perturbation granularity. Individual task rates are not inferred from them.</p><p>OpenVLA-OFT_w, OpenVLA-OFT_m, OpenVLA-OFT+ and RIPT-VLA use <a href="data/completed-evaluations-2026-10-04.json">completed evaluation counts from October 4</a>. Each model has 339 evaluated cases and 10,170 episodes, including nominal cases. These records supply the task-level success rates.</p><p>Images and taxonomy were read from the current paper source on October 7, 2026. Appendix figures illustrate the perturbation mechanism; they are not model rollout evidence. The eight media slots per perturbation remain empty until videos are supplied.</p><p>Model images come from official projects or organizations. OFT variants share the OpenVLA family logo. FastWAM and RIPT-VLA use official project illustrations because a distinct logo was not found. Full source links are preserved in <a href="data/model-assets.json">the image provenance file</a>.</p><p><a href="data/results.json">All model results</a> · <a href="data/catalogue.json">Perturbation catalogue</a> · <a href="data/tasks.json">Base task manifest</a> · <a href="data/sheet-success-rates.json">Sheet source cells</a></p></section>
    <section class="section reading" id="updates">${sectionHead('Updating the website')}<p>The website is a standalone static site. The experimental deployment is maintained in the demo repository. Model results, task media and news are stored as separate JSON data files.</p><p>New rollout files belong in <code>assets/rollouts/</code>. Each task’s media mapping uses the model ID and public perturbation ID. MP4, WebM, GIF and WebP are supported. Add news entries only when there is a confirmed update to publish.</p><a href="https://github.com/racingemperor/demo">View the website repository ↗</a></section>`,[['protocol','Protocol'],['scoring','Success rates'],['taxonomy','Taxonomy'],['sources','Sources & coverage'],['updates','Updates']]);
}

function notFound(kind,href) {
  return `<main id="content">${head(`${kind} not found`)}<p>The requested identifier is not part of the published catalogue.</p><div class="actions" style="justify-content:flex-start"><a class="button" href="${href}">Return to catalogue</a></div></main>`;
}

function bindInteractions() {
  const catalogueNav=document.querySelector('.catalogue-nav');
  const selectedItem=catalogueNav?.querySelector('.nav-item.active');
  if(selectedItem){
    const offset=selectedItem.getBoundingClientRect().top-catalogueNav.getBoundingClientRect().top;
    catalogueNav.scrollTop=Math.max(0,offset-90);
  }
  document.querySelectorAll('[data-query]').forEach(select=>select.addEventListener('change',()=>{
    const u=new URL(location.href);u.searchParams.set(select.dataset.query,select.value);u.hash=select.dataset.anchor||'';location.assign(u);
  }));
  document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{
    const u=new URL(location.href);const previous=u.searchParams.get('sort')||'average';const previousAsc=u.searchParams.get('order')==='asc';
    u.searchParams.set('sort',button.dataset.sort);u.searchParams.set('order',previous===button.dataset.sort&&!previousAsc?'asc':'desc');u.hash='rankings';location.assign(u);
  }));
  document.querySelectorAll('[data-href]').forEach(row=>row.addEventListener('click',event=>{
    if(event.target.closest('a,button')||window.getSelection().toString())return;location.assign(row.dataset.href);
  }));
  document.querySelector('#model-select')?.addEventListener('change',event=>{
    const u=new URL(location.href);if(event.target.value)u.searchParams.set('model',event.target.value);else u.searchParams.delete('model');location.assign(u);
  });
  const sections=[...document.querySelectorAll('main section[id]')];
  if(sections.length&&document.querySelector('.toc')){
    const update=()=>{
      let active=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=160)active=section;}
      if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-5)active=sections.at(-1);
      document.querySelectorAll('.toc a').forEach(a=>{const selected=a.hash==='#'+active.id;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    };
    window.addEventListener('scroll',update,{passive:true});update();
  }
  if(location.hash)requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());
}

document.querySelector('.menu-button').addEventListener('click',event=>{
  const open=event.currentTarget.getAttribute('aria-expanded')!=='true';event.currentTarget.setAttribute('aria-expanded',String(open));document.querySelector('.site-nav').classList.toggle('open',open);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('.site-nav').classList.remove('open');document.querySelector('.menu-button').setAttribute('aria-expanded','false');}});
const navPage=page==='model'?'leaderboard':page==='task'||page==='perturbation'?'tasks':page;
document.querySelector(`.site-nav a[href="${navPage}.html"]`)?.setAttribute('aria-current','page');

try {
  [catalogue,results,{tasks},assets,news]=await Promise.all(['catalogue','results','tasks','model-assets','news'].map(async name=>{
    const response=await fetch(`data/${name}.json`);if(!response.ok)throw new Error(`Unable to load ${name}`);return response.json();
  }));
  // Accept the previous public model deep link while the new profile route settles.
  if(page==='leaderboard'&&params.get('model')){
    const old=results.models.find(m=>m.name===params.get('model')||m.id===params.get('model'));
    if(old){location.replace(modelUrl(old,{mode:params.get('metric')==='dynamic'?'dynamic':'static'}));}
  }
  const renderers={index:homePage,leaderboard:leaderboardPage,tasks:tasksPage,model:modelPage,perturbation:perturbationPage,task:taskPage,findings:findingsPage,docs:docsPage};
  app.innerHTML=(renderers[page]||homePage)();bindInteractions();
} catch(error) {
  console.error(error);
  app.innerHTML='<main id="content"><div class="error"><h1>Results could not be loaded</h1><p>Please reload the page or open the public data files.</p><a class="text-link" href="data/results.json">View result data ↗</a></div></main>';
}
