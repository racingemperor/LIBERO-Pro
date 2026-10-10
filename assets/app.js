import {homeShowcase, homeGallery, homeModels, homeNews, perturbationClip, bindHomeNews, bindHomeMotion, bindHomePresentation} from './home.js';
import {taxonomyFigure, bindTaxonomy} from './taxonomy.js';
import {updateView, isLocalViewLink} from './navigation.js';
import {createCapabilities} from './capabilities.js';

const app = document.querySelector('#app');
const page = document.body.dataset.page;
let params = new URLSearchParams(location.search);
const defaultTitle = document.title;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = value => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
const mean = values => { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null; };
const modeLabel = mode => mode === 'overall' ? 'Overall' : mode === 'dynamic' ? 'Dynamic' : 'Static';
const typeClass = type => type === 'World Action Models' ? 'wam' : type === 'Robustness-oriented' ? 'robust' : 'vla';
const typeLabel = type => type === 'World Action Models' ? 'World Action' : type === 'Robustness-oriented' ? 'Robustness' : 'VLA';
let catalogue, results, tasks, assets, news, leaderboardNews, designs, people, publication, upcomingModels;
let capabilities;
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
const tabs = (mode,href,modes=['static','dynamic']) => `<div class="tabs" aria-label="Distribution shift">${modes.map(x=>`<a class="tab ${mode===x?'active':''}" ${mode===x?'aria-current="true"':''} href="${esc(href(x))}">${modeLabel(x)} <span class="count-label">${x==='overall'?'42':x==='static'?'22':'20'}</span></a>`).join('')}</div>`;

function layout(content, entries) {
  const links=entries.map(([id,name])=>`<a href="#${id}">${name}</a>`).join('');
  return `<details class="toc-mobile"><summary>On this page</summary><nav aria-label="Page sections">${links}</nav></details><div class="page-layout"><aside class="toc"><p>On this page</p><nav aria-label="Page sections">${links}</nav></aside><main id="content">${content}</main></div>`;
}

function baseTaskList() {
  return `<div class="task-list">${tasks.map(t=>`<a class="base-task" href="${url('task',{id:t.id})}"><span class="task-index">${esc(t.suiteName.slice(0,2))}${t.taskId}</span><div><h3>${esc(t.instruction)}</h3><p>LIBERO-${esc(t.suiteName)} · task ${t.taskId}</p></div><span class="arrow" aria-hidden="true">↗</span></a>`).join('')}</div>`;
}

function homePage() {
  const domainLink=c=>`<a class="home-domain" data-home-domain="${c.id}" href="docs.html#domain-${c.id}" ${domainStyle(c)}><h3 class="domain-name">${c.name}</h3><p>${esc(c.description)}</p><span>${c.static.length} static / ${c.dynamic.length} dynamic <span aria-hidden="true">↗</span></span></a>`;
  return `<main id="content">
    ${homeShowcase(catalogue)}
    <section class="paper-intro" id="overview"><h2>LIBERO-Pro: A Benchmark for Evaluating<br>Robust Embodied Intelligence</h2>${peopleSection()}</section>
    ${homeNews(news.entries)}
    <section class="section home-centered" id="benchmark">${sectionHead('Beyond familiar scenes')}<div class="home-summary"><p>High success rates on LIBERO do not always reveal how a policy will behave when familiar conditions change. The original LIBERO-Pro study highlighted that models can rely on memorized action sequences and scene layouts, leaving weaknesses in visual grounding and instruction understanding hidden by standard evaluation.</p><p>LIBERO-Pro evaluates robustness under 42 controlled perturbations: 22 static shifts at reset and 20 dynamic interventions during execution. Across eight tasks from four LIBERO suites, it varies conditions, environments, observations, execution, robot state and language while preserving the original task goals. This tests both generalization to changed scenes and recovery when an ongoing task is disturbed.</p></div></section>
    <section class="section paper-overview home-centered" id="paper-overview">${sectionHead('Benchmark overview')}<figure><a href="assets/paper/overview.webp" target="_blank" rel="noopener" aria-label="Open the full LIBERO-Pro overview figure"><img src="assets/paper/overview.webp" width="2000" height="1125" loading="lazy" alt="LIBERO-Pro overview showing 22 static and 20 dynamic perturbations across six domains"></a><figcaption class="caption">LIBERO-Pro evaluates robustness across 22 static shifts and 20 runtime interventions in six perturbation domains.</figcaption></figure></section>
    <section class="section home-centered" id="domains">${sectionHead('Perturbation domains')}<p class="home-section-intro">Six domains organize the benchmark. Each perturbation has a mechanism illustration and a gallery for the eight evaluation tasks.</p><div class="home-domains"><div class="home-domain-column home-domain-left">${catalogue.categories.slice(0,3).map(domainLink).join('')}</div>${taxonomyFigure(catalogue)}<div class="home-domain-column home-domain-right">${catalogue.categories.slice(3).map(domainLink).join('')}</div></div><a class="text-link home-domains-explore" href="docs.html#taxonomy">Explore all 42 perturbations ↗</a></section>
    ${homeGallery(catalogue,'static')}${homeGallery(catalogue,'dynamic')}
    <section class="section home-evaluation-tasks" id="evaluation-tasks">${sectionHead('Evaluation tasks','<a class="text-link" href="docs.html#task-designs">Read task designs ↗</a>')}${documentTaskList({compact:true})}</section>
    <section class="section home-leaderboard" id="leaderboard">${sectionHead('Leaderboard','<a class="text-link" href="leaderboard.html">Full leaderboard ↗</a>')}<div class="chart-grid">${chart('static',10)}${chart('dynamic',10)}</div></section>
    ${homeModels(results.models,upcomingModels.models,assets,modelUrl)}
    ${citationSection()}
  </main>`;
}

function peopleSection() {
  // Keep the metadata layout visible while unconfirmed values remain empty.
  const institutions=people.affiliations.filter(a=>/^assets\/institutions\/[\w./-]+\.(svg|png|webp|jpg)$/.test(a.logo||'')&&!a.logo.includes('..'));
  const row=(label,content,kind='')=>`<div class="paper-meta-row ${kind}"><dt>${label}</dt><dd${content?'':' class="paper-meta-empty"'}>${content||'<span class="sr-only">To be announced</span>'}</dd></div>`;
  const authors=people.authors.length?`<p class="authors">${people.authors.map(a=>`${esc(a.name)}${a.affiliations?.length?`<sup>${a.affiliations.map(id=>institutions.findIndex(i=>i.id===id)+1).filter(Boolean).join(', ')}</sup>`:''}`).join(', ')}</p>`:'';
  const affiliations=institutions.length?`<div class="institution-logos">${institutions.map((a,i)=>`<figure><img src="${esc(a.logo)}" alt="${esc(a.name)}" loading="lazy"><figcaption><sup>${i+1}</sup> ${esc(a.name)}</figcaption></figure>`).join('')}</div>`:'';
  const report=/^https:\/\//.test(publication.report?.url||'')?`<a href="${esc(publication.report.url)}" target="_blank" rel="noopener">${esc(publication.report.label||'Read the paper')} ↗</a>`:'';
  const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publication.email||'')?`<a href="mailto:${esc(publication.email)}">${esc(publication.email)}</a>`:'';
  const repositories=`<div class="repository-links">${[['LIBERO-PRO','Previous','previous'],['LIBERO-Pro2.0','Latest','latest']].map(([name,label,version])=>`<a class="repository-link" href="https://github.com/Zxy-MLlab/${name}" target="_blank" rel="noopener"><img src="assets/icons/github.svg" width="20" height="20" alt="" aria-hidden="true"><span class="repository-name">Zxy-MLlab/${name}</span><span class="repository-status ${version}">${label}</span></a>`).join('')}</div>`;
  return `<dl class="paper-meta" aria-label="Paper information">${row('Authors',authors,'paper-meta-authors')}${row('Affiliations',affiliations,'paper-meta-affiliations')}${row('Published',esc(publication.published))}${row('Report',report)}${row('Repository',repositories,'paper-meta-repositories')}${row('Leaderboard','<a href="leaderboard.html">View leaderboard ↗</a>')}${row('Email',email,'paper-meta-contact')}</dl>`;
}

function citationSection() {
  const bibtex=publication.bibtex?.trim()||'';
  return `<section class="section citation-section" id="citation">${sectionHead('Citation')}<div class="citation-card"><div class="citation-header"><h3>LIBERO-Pro</h3><button class="citation-copy" data-copy-citation aria-label="Copy BibTeX"${bibtex?'':' disabled'}>Copy</button></div><pre class="citation-code"${bibtex?' tabindex="0" aria-label="BibTeX citation"':' aria-label="Citation reserved for the forthcoming paper"'}><code>${esc(bibtex)}</code></pre></div>${bibtex?'':'<p class="caption">Citation details will be added with the paper.</p>'}<p class="sr-only" data-copy-status role="status"></p></section>`;
}

const overallScores = new WeakMap();
function rankingScores(model, mode) {
  if(mode!=='overall')return model.scores[mode];
  if(!overallScores.has(model)){
    // Match the published Overall weighting: average applicable cells across both settings.
    overallScores.set(model,{
      average:model.scores.overall,
      categories:Object.fromEntries(catalogue.categories.map(category=>{
        const directions=new Set([...category.static,...category.dynamic]);
        return [category.id,mean(model.cells.filter(cell=>directions.has(cell.direction)).map(cell=>cell.rate))];
      }))
    });
  }
  return overallScores.get(model);
}

function rankedModels(mode, category='all', sort='average', ascending=false) {
  const perturbation=catalogue.perturbations.find(p=>p.id===sort&&p.mode===mode);
  const score=m=>{
    const scores=rankingScores(m,mode);
    return perturbation?directionRate(m,perturbation):sort==='base'?m.scores.base:sort==='delta'?(Number.isFinite(m.scores.base)&&Number.isFinite(scores.average)?scores.average-m.scores.base:null):categoryFor(sort)?scores.categories[sort]:scores.average;
  };
  return results.models.filter(m=>category==='all'||m.type===category).sort((a,b)=>{
    const x=score(a),y=score(b);if(!Number.isFinite(x))return !Number.isFinite(y)?a.name.localeCompare(b.name):1;if(!Number.isFinite(y))return -1;
    return (ascending?x-y:y-x)||a.name.localeCompare(b.name);
  });
}

function chart(mode,limit=14,models=null) {
  const entries=(models||rankedModels(mode)).slice(0,limit);
  return `<div class="chart-panel ${mode}"><h3>${modeLabel(mode)} shifts</h3><div class="chart-axis" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div><div class="bar-chart" aria-label="${modeLabel(mode)} success rates">${entries.map(m=>`<a class="bar-row" href="${modelUrl(m,{mode})}" aria-label="${esc(m.name)}, ${mode} success rate ${pct(m.scores[mode].average)}"><span class="bar-name">${logo(m)}${esc(m.name)}</span><span class="bar-track" aria-hidden="true"><i class="bar-fill" style="width:${100*m.scores[mode].average}%"></i></span><span class="bar-value">${(m.scores[mode].average*100).toFixed(1)}</span></a>`).join('')}</div></div>`;
}

function leaderboardTable(mode,models,sort='average',ascending=false) {
  const sortButton=(key,label)=>`<button data-sort="${key}" aria-label="Sort by ${label}">${label}${sort===key?(ascending?' ↑':' ↓'):''}</button>`;
  const domainHeaders=catalogue.categories.map(c=>`<th scope="col" ${sort===c.id?`aria-sort="${ascending?'ascending':'descending'}"`:''}>${sortButton(c.id,c.name)}</th>`).join('');
  // Model details retain their two settings; Overall links open the model's default view.
  const detailMode=mode==='overall'?'static':mode;
  const profile=m=>modelUrl(m,mode==='overall'?{}:{mode});
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="${modeLabel(mode)} leaderboard, horizontally scrollable"><table class="leaderboard-table"><thead><tr><th scope="col">#</th><th scope="col">Model</th><th scope="col">Type</th><th scope="col" ${sort==='average'?`aria-sort="${ascending?'ascending':'descending'}"`:''}>${sortButton('average','Average')}</th>${domainHeaders}<th scope="col" ${sort==='base'?`aria-sort="${ascending?'ascending':'descending'}"`:''}>${sortButton('base','Base')}</th><th scope="col" ${sort==='delta'?`aria-sort="${ascending?'ascending':'descending'}"`:''}>${sortButton('delta','Δ (pp)')}</th><th scope="col">Details</th></tr></thead><tbody>${models.map((m,i)=>{
    const scores=rankingScores(m,mode);
    const delta=Number.isFinite(m.scores.base)&&Number.isFinite(scores.average)?scores.average-m.scores.base:null;
    return `<tr data-href="${profile(m)}"><td>${i+1}</td><th scope="row" class="model-cell"><a class="model-link" href="${profile(m)}">${logo(m)}${esc(m.name)}</a></th><td>${tag(m)}</td><td class="average">${pct(scores.average)}</td>${catalogue.categories.map(c=>{
      const v=scores.categories[c.id];
      return `<td class="score-cell"><a style="--heat:${Number.isFinite(v)?(.04+v*.22).toFixed(3):0}" href="${modelUrl(m,{mode:detailMode,category:c.id,perturbation:c[detailMode][0]},'rollouts')}" aria-label="${esc(m.name)}, ${c.name}, ${pct(v)}, view tasks">${pct(v)}</a></td>`;
    }).join('')}<td>${pct(m.scores.base)}</td><td class="delta">${delta===null?'—':`${delta>0?'+':''}${(delta*100).toFixed(1)}`}</td><td><a href="${profile(m)}" aria-label="View ${esc(m.name)} details">↗</a></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function leaderboardPage() {
  const mode=params.get('mode')==='overall'?'overall':selectedMode();
  const type=['Mainstream VLA','World Action Models','Robustness-oriented'].includes(params.get('type'))?params.get('type'):'all';
  const sort=['average','base','delta',...catalogue.categories.map(c=>c.id)].includes(params.get('sort'))?params.get('sort'):'average';
  const asc=params.get('order')==='asc';
  const entries=rankedModels(mode,type,sort,asc);
  return layout(`${head('Leaderboard','Success rates under static shifts and dynamic interventions. Select a model or a domain score to inspect its tasks.')}
    ${homeNews(leaderboardNews.entries)}
    <section class="section" id="capabilities">${sectionHead('Model capabilities')}${capabilities.render(params)}</section>
    <section class="section" id="rankings">${sectionHead('Model comparison',`<span class="count-label">${entries.length} models · success rate (%)</span>`)}<div class="controls">${tabs(mode,m=>url('leaderboard',{...Object.fromEntries(params),mode:m,type,sort,order:asc?'asc':'desc'},'rankings'),['overall','static','dynamic'])}<label class="control">Model type <select data-query="type" data-anchor="rankings"><option value="all">All models</option>${['Mainstream VLA','World Action Models','Robustness-oriented'].map(t=>`<option ${type===t?'selected':''}>${t}</option>`).join('')}</select></label></div>${leaderboardTable(mode,entries,sort,asc)}</section>
    ${perturbationRankings()}`,[['news','News'],['capabilities','Capabilities'],['rankings','Model comparison'],['perturbation-rankings','By perturbation']]);
}

function perturbationRankings() {
  const mode=params.get('perturbationMode')==='dynamic'?'dynamic':'static';
  const perturbations=directionsFor(mode);
  const selected=perturbations.find(p=>p.id===params.get('perturbationSort'));
  const sort=selected?.id||'average',asc=params.get('perturbationOrder')==='asc';
  const types=['Mainstream VLA','World Action Models','Robustness-oriented'];
  const type=types.includes(params.get('perturbationType'))?params.get('perturbationType'):'all';
  const entries=rankedModels(mode,type,sort,asc);
  const heading=(key,label,name=label)=>`<th scope="col" ${sort===key?`aria-sort="${asc?'ascending':'descending'}"`:''}><button data-perturbation-sort="${key}" title="${esc(name)}" aria-label="Sort by ${esc(name)}">${label}${sort===key?(asc?' ↑':' ↓'):''}</button></th>`;
  const profile=m=>selected?directionUrl(selected,m):modelUrl(m,{mode});
  const modeHref=nextMode=>url('leaderboard',{
    ...Object.fromEntries(params),perturbationMode:nextMode,perturbationType:type,
    perturbationSort:nextMode===mode?sort:'average',perturbationOrder:nextMode===mode?(asc?'asc':'desc'):'desc'
  },'perturbation-rankings');
  return `<section class="section" id="perturbation-rankings">
    ${sectionHead('Perturbation comparison',`<span class="count-label">${entries.length} models · ${perturbations.length} perturbations · success rate (%)</span>`)}
    <div class="controls">${tabs(mode,modeHref)}
      <label class="control">Model type <select data-query="perturbationType" data-anchor="perturbation-rankings"><option value="all">All models</option>${types.map(t=>`<option ${type===t?'selected':''}>${t}</option>`).join('')}</select></label>
    </div>
    <div class="table-scroll" tabindex="0" role="region" aria-label="${modeLabel(mode)} perturbation leaderboard, horizontally scrollable"><table class="leaderboard-table perturbation-table">
      <caption class="sr-only">${modeLabel(mode)} success rates by perturbation. Sorted by ${selected?esc(selected.id+' '+selected.name):'Average'}, ${asc?'ascending':'descending'}. Select a column heading to rank models or a score to view task details.</caption>
      <thead><tr><th scope="col" class="rank-column">#</th><th scope="col" class="model-column">Model</th><th scope="col">Type</th>${heading('average','Average')}${perturbations.map(p=>heading(p.id,p.id,p.id+' · '+p.name)).join('')}<th scope="col">Details</th></tr></thead>
      <tbody>${entries.map((m,i)=>`<tr data-model="${m.id}" data-href="${profile(m)}"><td class="rank-column">${i+1}</td><th scope="row" class="model-cell model-column"><a class="model-link" href="${profile(m)}">${logo(m)}${esc(m.name)}</a></th><td>${tag(m)}</td><td class="average">${pct(m.scores[mode].average)}</td>${perturbations.map(p=>{const v=directionRate(m,p);return `<td class="score-cell" data-perturbation="${p.id}"><a style="--heat:${v===null?0:(.04+v*.22).toFixed(3)}" href="${directionUrl(p,m)}" aria-label="${esc(m.name)}, ${p.id} ${esc(p.name)}, ${pct(v)}, view tasks">${pct(v)}</a></td>`;}).join('')}<td><a href="${profile(m)}" aria-label="View ${esc(m.name)} ${selected?selected.id:mode} details">↗</a></td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
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
  const rate=m?.taskRates.find(c=>c.task===task.id&&c.direction===p.id)?.rate??null;
  const applicable=!designs.tasks[task.id].excluded.includes(p.id);
  const media=task.media?.[m?.id]?.[p.id];
  const safeMedia=typeof media==='string'&&/^assets\/rollouts\/[a-zA-Z0-9_./-]+\.(gif|webp|mp4|webm)$/.test(media)&&!media.includes('..')?media:null;
  const visual=safeMedia?(safeMedia.endsWith('.mp4')||safeMedia.endsWith('.webm')?`<video controls preload="none" playsinline aria-label="${esc(task.instruction)} under ${p.id}"><source src="${esc(safeMedia)}"></video>`:`<img class="rollout-media" src="${esc(safeMedia)}" alt="${esc(task.instruction)} under ${p.id}" loading="lazy">`):`<div class="media-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/></svg><span>${applicable?'Rollout coming soon':'Not applicable'}</span></div>`;
  return `<article class="rollout-slot" data-task="${esc(task.id)}">${visual}<h4><a href="${url('task',{id:task.id,...(m?{model:m.id}:{})})}">${esc(task.instruction)} ↗</a></h4><div class="slot-meta"><span>${esc(task.suiteName)} · ${task.taskId}</span><span class="slot-rate">${applicable?pct(rate):'N/A'}</span></div></article>`;
}

function catalogueNav(p,m=null) {
  const href=d=>page==='perturbation'?url('perturbation',{id:d.id,...(m?{model:m.id}:{})}):directionUrl(d,m);
  return `<aside class="catalogue-nav" aria-label="Perturbations">${tabs(p.mode,mode=>href(directionsFor(mode,p.category)[0]))}${catalogue.categories.map(c=>`<section class="nav-group"><h3 class="domain-name" ${domainStyle(c)}>${c.name}</h3>${directionsFor(p.mode,c.id).map(d=>`<a class="nav-item ${d.id===p.id?'active':''}" ${d.id===p.id?'aria-current="true"':''} href="${href(d)}"><span>${d.id}</span>${esc(d.name)}</a>`).join('')}</section>`).join('')}</aside>`;
}

function modelSelect(m,p=null) {
  return `<div class="selected-model"><label class="control">Model <select id="model-select" ${p?`data-perturbation="${p.id}"`:''}><option value="">Select a model</option>${results.models.map(x=>`<option value="${x.id}" ${m?.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>${m?`<a class="text-link" href="${modelUrl(m)}">View model profile ↗</a>`:''}</div>`;
}

function rolloutPanel(p,m) {
  return `<div class="rollout-content" id="rollouts"><div class="rollout-title"><div>${pill(p.mode)} <span class="small" style="margin-left:8px">${p.id} · ${categoryFor(p.category).name}</span><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p></div>${m?`<div class="direction-score">${pct(directionRate(m,p))}<small>Success rate · suite average</small></div>`:''}</div><figure class="mechanism-image"><img src="${p.image}" width="1760" height="510" alt="${esc(p.name)}: paper mechanism illustration"><figcaption>Mechanism illustration from the paper, independent of model evaluation rollouts.</figcaption></figure><p class="small">${esc(p.constraint)}</p><div class="section-head" style="margin-top:32px;margin-bottom:18px"><h3>Evaluation task rollouts</h3><span class="count-label">8 tasks</span></div>${m?.granularity==='suite'?'<p class="table-note" style="margin:0 0 18px">This model has suite-level results. Individual task success rates and videos have not been supplied.</p>':'<p class="table-note" style="margin:0 0 18px">Videos will be added here. Available task success rates are shown below each reserved slot.</p>'}<div class="rollout-grid">${tasks.map(t=>mediaSlot(t,p,m)).join('')}</div>${m?`<div class="reading" style="margin-top:30px"><h3>Success rate by task suite</h3><table><thead><tr><th>Suite</th><th>Success rate</th></tr></thead><tbody>${['Spatial','Object','Goal','Long'].map(s=>{const task=tasks.find(t=>t.suiteName===s);const c=m.cells.find(x=>x.suite===task.suite&&x.direction===p.id);return `<tr><td>LIBERO-${s}</td><td>${c?pct(c.rate):'N/A'}</td></tr>`;}).join('')}</tbody></table></div>`:''}</div>`;
}

function modelPage() {
  const m=modelById(params.get('id')||params.get('model'));
  if(!m)return notFound('Model','leaderboard.html');
  let p=catalogue.perturbations.find(x=>x.id===params.get('perturbation'));
  if(!p)p=directionsFor(selectedMode(),selectedCategory())[0];
  const mode=p.mode;
  document.title=`${m.name} · LIBERO-Pro`;
  return `<main id="content"><header class="page-head detail-head">${breadcrumb([['Leaderboard','leaderboard.html'],[m.name]])}<div class="model-title">${logo(m,true)}<h1>${esc(m.name)}</h1></div><div class="detail-meta">${tag(m)}<a class="text-link" href="${esc(assets[m.id].project)}" target="_blank" rel="noopener">Official project ↗</a><span class="count-label">Results: ${m.updated}</span></div><dl class="score-summary"><div><dt>Static success rate</dt><dd style="color:var(--static)">${pct(m.scores.static.average)}</dd></div><div><dt>Dynamic success rate</dt><dd style="color:var(--dynamic)">${pct(m.scores.dynamic.average)}</dd></div><div><dt>Nominal baseline</dt><dd>${pct(m.scores.base)}</dd></div></dl></header>
    <section aria-label="Category success rates">${sectionHead(`${modeLabel(mode)} success by domain`)}<div class="category-scores">${catalogue.categories.map(c=>{const v=m.scores[mode].categories[c.id];return `<a class="category-score ${p.category===c.id?'selected':''}" ${domainStyle(c)} href="${modelUrl(m,{mode,category:c.id,perturbation:c[mode][0]},'rollouts')}"><span class="name domain-name">${c.name}</span><strong>${pct(v)}</strong><span class="mini-track" aria-hidden="true"><i style="width:${(v??0)*100}%"></i></span></a>`;}).join('')}</div></section>
    <div class="detail-layout">${catalogueNav(p,m)}${rolloutPanel(p,m)}</div><section class="section reading" id="source"><h3>Result coverage</h3><p>${m.granularity==='task'?'Success rates are available by task, suite and perturbation.':'Success rates are available by suite and perturbation. Individual task rates are not available.'}</p><a href="docs.html#scoring">How success rates are calculated ↗</a><p class="small">Model image: ${esc(assets[m.id].credit)}.</p></section></main>`;
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
  return `<main id="content">${head('Task details',esc(t.instruction),breadcrumb([['Tasks','tasks.html#base-tasks'],[`LIBERO-${t.suiteName} · task ${t.taskId}`]]))}<p style="margin-bottom:24px"><a class="text-link" href="${url('docs',{task:t.id})}">Read task design & success conditions ↗</a></p>${modelSelect(m)}<div class="controls">${tabs(mode,mode=>url('task',{id:t.id,mode,category,...(m?{model:m.id}:{})}))}<span class="count-label">${dirs.length} perturbations</span></div><nav class="domain-filter" aria-label="Perturbation domain">${[{id:'all',name:'All domains'},...catalogue.categories].map(c=>`<a class="${c.id===category?'active':''}" href="${url('task',{id:t.id,mode,category:c.id,...(m?{model:m.id}:{})})}">${c.name}</a>`).join('')}</nav><div class="task-detail-grid">${dirs.map(p=>`<div><h3 style="font-size:15px;margin-bottom:12px"><a href="${directionUrl(p,m)}">${p.id} · ${esc(p.name)} ↗</a></h3>${mediaSlot(t,p,m)}</div>`).join('')}</div><p class="table-note">Missing task rates are shown as —. Suite averages are never substituted for an individual task. Rollout media is reserved for future uploads.</p></main>`;
}

function findingsPage() {
  return layout(`${head('Findings','Robustness analysis across static shifts and runtime interventions.')}
    <section class="section" id="static-dynamic">${sectionHead('Static & dynamic robustness')}<div class="empty-section">Analysis coming soon.</div></section>
    <section class="section" id="domain-analysis">${sectionHead('Domain analysis')}<div class="empty-section">Analysis coming soon.</div></section>
    <section class="section" id="failure-analysis">${sectionHead('Failure analysis')}<div class="empty-section">Examples coming soon.</div></section>`,[['static-dynamic','Static & dynamic'],['domain-analysis','Domain analysis'],['failure-analysis','Failure analysis']]);
}

function documentTaskList({compact=false}={}) {
  return `<div class="task-list">${tasks.map(t=>`<a class="base-task" href="${url('docs',{task:t.id})}"><span class="task-index">${esc(t.suiteName)}${compact?' ':'<br>'}${t.taskId}</span><div><h3>${esc(compact?designs.tasks[t.id].title:t.instruction)}</h3>${compact?'':`<p>${esc(designs.tasks[t.id].focus)}</p>`}</div><span class="arrow" aria-hidden="true">↗</span></a>`).join('')}</div>`;
}

function documentLayout(content) {
  const taskId=params.get('task'),perturbationId=params.get('perturbation');
  const navLink=(href,label,active=false)=>`<a href="${href}" ${active?'aria-current="page"':''}>${label}</a>`;
  const directory=`<nav aria-label="Document directory"><div class="doc-nav-group"><h2>${navLink('docs.html','Overview',!taskId&&!perturbationId)}</h2></div><div class="doc-nav-group"><h2>Evaluation tasks</h2>${['Spatial','Object','Goal','Long'].map(suite=>`<details ${tasks.find(t=>t.id===taskId)?.suiteName===suite?'open':''}><summary>LIBERO-${suite==='Long'?'10':suite}</summary>${tasks.filter(t=>t.suiteName===suite).map(t=>navLink(url('docs',{task:t.id}),`<small>${t.taskId}</small> ${esc(t.instruction)}`,t.id===taskId)).join('')}</details>`).join('')}</div><div class="doc-nav-group"><h2>Perturbation design</h2>${navLink('tasks.html','Visual catalogue ↗')}${catalogue.categories.map(c=>`<details data-domain="${c.id}" ${catalogue.perturbations.find(p=>p.id===perturbationId)?.category===c.id?'open':''}><summary>${c.name}</summary>${['static','dynamic'].map(mode=>`<p class="doc-nav-mode">${modeLabel(mode)}</p>${directionsFor(mode,c.id).map(p=>navLink(url('docs',{perturbation:p.id}),`<small>${p.id}</small> ${esc(p.name)}`,p.id===perturbationId)).join('')}`).join('')}</details>`).join('')}</div></nav>`;
  return `<div class="docs-layout"><aside class="docs-sidebar"><details class="doc-directory" open><summary class="doc-directory-toggle">Document directory</summary>${directory}</details></aside><main id="content" class="doc-content">${content}</main></div>`;
}

function designFacts(rows) {
  return `<dl class="design-facts">${rows.map(([label,text])=>`<div><dt>${esc(label)}</dt><dd>${text}</dd></div>`).join('')}</dl>`;
}

// Editorial emphasis stays in the document view; source instructions and data
// remain plain text. Escape every segment before inserting semantic markup.
function documentEmphasis(text, phrase) {
  const index=phrase?text.indexOf(phrase):-1;
  if(index<0)return esc(text);
  return `${esc(text.slice(0,index))}<strong>${esc(phrase)}</strong>${esc(text.slice(index+phrase.length))}`;
}

const documentKeyPhrases={
  'libero_spatial-0':'between the plate and the ramekin',
  'libero_spatial-8':'next to the plate',
  'libero_object-1':'cream cheese',
  'libero_object-8':'chocolate pudding',
  'libero_goal-3':'Open the top drawer',
  'libero_goal-6':'onto the black bowl',
  'libero_10-5':'back compartment',
  'libero_10-8':'stove to be switched on',
  S01:'horizontal plane', S02:'placement destination and approach',
  S03:'receiver or support elevation', S04:'Swap the planar positions',
  S05:'constrains approach or transport', S06:'same-class or unseen asset',
  S07:'opening, rim, or receiving region', S08:'uniform or anisotropic target scaling',
  S09:'relative insertion configuration', S10:'irrelevant objects',
  S11:'same class or similar color or shape', S12:'retain a foreground occluder',
  S13:'color, texture, reflectance, or visual surface state', S14:'object-background contrast',
  S15:'fixed camera position/orientation offsets', S16:'field of view, resolution, cropping, or lens distortion',
  S17:'initial joints', S18:'base, tool center point, joint zero, or grasp center',
  S19:'configured observation channels', S20:'fixed delay',
  S21:'semantic paraphrase', S22:'visual texture',
  D01:'updated localization and approach', D02:'without changing the task goal',
  D03:'occupying or blocking object', D04:'then remove it',
  D05:'alternative collision-free path', D06:'exclude the target and receiver',
  D07:'shake, drift, or a persistent offset', D08:'camera observation stream',
  D09:'RGB illumination, shadow, or exposure', D10:'Drop, repeat, or freeze',
  D11:'Offset timestamps or freeze a modality', D12:'Temporarily delay',
  D13:'different delays or timing variations', D14:'repeats the previous action',
  D15:'temporarily executing outdated actions', D16:'respecting joint/workspace limits',
  D17:'possibility of retrying', D18:'do not simulate falling forces',
  D19:'without self-collision', D20:'preserving goal, objects, and required action order',
};

function documentPagination(items,currentId,key) {
  const index=items.findIndex(item=>item.id===currentId);
  const link=(item,label)=>item?`<a href="${url('docs',{[key]:item.id})}"><small>${label}</small><span>${esc(item.title||item.name)}</span></a>`:'<span></span>';
  return `<nav class="doc-pagination" aria-label="Adjacent documents">${link(items[index-1],'Previous')}${link(items[index+1],'Next')}</nav>`;
}

function taskPerturbationChips(t) {
  const excluded=designs.tasks[t.id].excluded;
  return ['static','dynamic'].map(mode=>{
    const entries=directionsFor(mode);
    const supported=entries.filter(p=>!excluded.includes(p.id)).length;
    const chip=p=>excluded.includes(p.id)
      ?`<span class="doc-perturbation-chip is-unavailable" aria-disabled="true" title="${p.id}: not supported for this task">${p.id}<span class="sr-only"> — not supported for this task</span></span>`
      :`<a class="doc-perturbation-chip" href="${url('docs',{perturbation:p.id})}" aria-label="${esc(p.id+': '+p.name)}" title="${esc(p.name)}">${p.id}</a>`;
    return `<div class="doc-perturbation-group"><div class="doc-perturbation-heading"><h3 id="task-${mode}-heading">${modeLabel(mode)}</h3><span class="count-label">${supported} / ${entries.length} supported</span></div><ul class="doc-perturbation-chips" aria-labelledby="task-${mode}-heading">${entries.map(p=>`<li>${chip(p)}</li>`).join('')}</ul></div>`;
  }).join('');
}

function taskDocument(t) {
  const design=designs.tasks[t.id];
  document.title=`${t.instruction} · Document · LIBERO-Pro`;
  return documentLayout(`${head(esc(t.instruction),'',breadcrumb([['Document','docs.html'],['Evaluation tasks','docs.html#task-designs'],[`LIBERO-${t.suiteName} · ${t.taskId}`]]))}
    <figure class="task-demo" id="examples"><video data-task-demo src="assets/rollouts/base/${esc(t.id)}.mp4" poster="assets/rollouts/base/${esc(t.id)}.webp" width="256" height="256" controls muted loop playsinline preload="metadata" aria-label="Unperturbed LIBERO demonstration: ${esc(t.instruction)}"></video></figure>
    <section class="section" id="design">${sectionHead('Task design')}${designFacts([['Instruction',esc(t.instruction)],['Description',documentEmphasis(design.description,documentKeyPhrases[t.id])],['Task suite',`LIBERO-${esc(t.suiteName==='Long'?'10':t.suiteName)} · task ${t.taskId} (zero-based)`],['Design focus',esc(design.focus)]])}</section>
    <section class="section reading" id="success">${sectionHead('Success conditions')}<pre class="goal-predicates" tabindex="0" aria-label="BASE goal predicates"><code>${design.predicates.map(esc).join('\n')}</code></pre></section>
    <section class="section" id="perturbations">${sectionHead('Perturbation design')}${taskPerturbationChips(t)}</section>
    ${documentPagination(tasks.map(task=>({id:task.id,title:task.instruction})),t.id,'task')}`);
}

let releaseDocumentDemo=()=>{};
function bindDocumentDemo() {
  releaseDocumentDemo();
  releaseDocumentDemo=()=>{};
  const video=document.querySelector('[data-task-demo], [data-perturbation-demo]');
  if(!video)return;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,userPaused=false;
  const sync=()=>{
    if(visible&&!document.hidden&&!preference.matches&&!userPaused){
      video.muted=true;
      video.play()?.catch(()=>{});
    }else video.pause();
  };
  const onPause=()=>{if(visible&&!document.hidden&&!preference.matches)userPaused=true;};
  const onPlay=()=>{userPaused=false;};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.15});
  observer.observe(video);
  video.addEventListener('pause',onPause);
  video.addEventListener('play',onPlay);
  document.addEventListener('visibilitychange',sync);
  preference.addEventListener('change',sync);
  releaseDocumentDemo=()=>{
    observer.disconnect();
    video.removeEventListener('pause',onPause);
    video.removeEventListener('play',onPlay);
    document.removeEventListener('visibilitychange',sync);
    preference.removeEventListener('change',sync);
    video.pause();
  };
}

function perturbationTaskChips(p) {
  return `<div class="doc-task-support">${['Spatial','Object','Goal','Long'].map(suite=>`<div><h3 id="coverage-${suite}">${suite}</h3><ul class="doc-perturbation-chips" aria-labelledby="coverage-${suite}">${tasks.filter(t=>t.suiteName===suite).map(t=>{
    const supported=!designs.tasks[t.id].excluded.includes(p.id);
    const status=supported?'Supported':'Not supported';
    return `<li><span class="doc-perturbation-chip doc-task-chip${supported?'':' is-unavailable'}" title="${suite} ${t.taskId}: ${status}">${t.taskId}<span class="sr-only"> — ${suite}, ${status.toLowerCase()}</span></span></li>`;
  }).join('')}</ul></div>`).join('')}</div>`;
}

function perturbationDocument(p) {
  document.title=`${p.id} ${p.name} · Document · LIBERO-Pro`;
  const exclusions=tasks.filter(t=>designs.tasks[t.id].excluded.includes(p.id));
  const clip=perturbationClip(p.id);
  return documentLayout(`${head(esc(p.name),'',breadcrumb([['Document','docs.html'],['Perturbation design','tasks.html'],[p.id]]))}
    <figure class="task-demo" id="examples"><video data-perturbation-demo src="${esc(clip.src)}" poster="${esc(clip.poster)}" width="256" height="256" controls muted loop playsinline preload="metadata" aria-label="${esc(p.id+': '+p.name)} perturbation demonstration"></video></figure>
    <figure class="mechanism-image"><img src="${p.image}" width="1760" height="510" loading="lazy" alt="${esc(p.name)} mechanism illustration"><figcaption>${p.id} · Illustration from the paper. Model-specific rollouts are shown separately.</figcaption></figure>
    <section class="section" id="design">${sectionHead('Perturbation design')}${designFacts([['Public ID',`<code>${p.id}</code>`],['Category',categoryFor(p.category).name],['Intervention',documentEmphasis(p.description,documentKeyPhrases[p.id])],[p.mode==='static'?'Validity constraint':'Trigger & lifetime',documentEmphasis(p.constraint,documentKeyPhrases[p.id])],['Task goal','Preserve the <strong>original goal and success predicate</strong>.'],['Scope','Single <strong>non-physical perturbation</strong>; mass, friction, inertia, stiffness and damping are not varied.']])}</section>
    <section class="section reading" id="mechanism">${sectionHead(p.mode==='static'?'Initialization and validity':'Runtime behavior')}<p>${p.mode==='static'?'Apply the configured change <strong>at reset</strong>. Modified scene geometry or fault settings <strong>persist for the episode</strong>; changing the initial state does not prevent the robot and objects from moving normally.':'Trigger the intervention at the <strong>task phase</strong> defined by the case. Its <strong>onset, duration and release</strong> follow the case configuration. Restoring a sensor or control channel <strong>does not roll back</strong> the complete scene.'}</p><p>Changes must leave a <strong>reachable, collision-free configuration</strong> and a feasible route to task completion. The magnitude, direction, affected objects and event settings are <strong>selected per task</strong>.</p>${exclusions.length?`<p><strong>Not applicable:</strong> ${exclusions.map(t=>`LIBERO-${t.suiteName} task <code>${t.taskId}</code>`).join(', ')}. These combinations are <strong>not treated as failures</strong>.</p>`:''}</section>
    <section class="section" id="evaluation-tasks">${sectionHead('Evaluation tasks')}${perturbationTaskChips(p)}</section>
    ${documentPagination(catalogue.perturbations,p.id,'perturbation')}`);
}

function docsPage() {
  if(params.has('task')){
    const task=tasks.find(t=>t.id===params.get('task'));
    return task?taskDocument(task):notFound('Task document','docs.html#task-designs');
  }
  if(params.has('perturbation')){
    const perturbation=catalogue.perturbations.find(p=>p.id===params.get('perturbation'));
    return perturbation?perturbationDocument(perturbation):notFound('Perturbation document','docs.html');
  }
  return documentLayout(`${head('Document','Task designs, perturbation mechanisms and evaluation definitions.')}
    <section class="section" id="task-designs">${sectionHead('Evaluation task designs')}<p><strong>Eight base tasks</strong> are selected from four LIBERO suites. Each document gives the original instruction, task setup, success condition and supported perturbations. Task IDs are <strong>zero-based</strong>.</p>${documentTaskList()}</section>
    <section class="section reading" id="protocol">${sectionHead('Evaluation protocol')}<p>LIBERO-Pro evaluates robot-policy robustness while preserving the <strong>original task goal and feasibility</strong>. The held-out evaluation split contains <strong>eight tasks</strong>: two each from LIBERO-Spatial, LIBERO-Object, LIBERO-Goal and LIBERO-10.</p><p><strong>Static shifts</strong> are introduced at reset. <strong>Dynamic interventions</strong> are triggered during execution at task-relevant phases. Each case applies <strong>one perturbation</strong>. RQ experiments and combined perturbation suites are excluded from this website’s leaderboard.</p><a href="tasks.html#base-tasks">Explore the eight base tasks ↗</a></section>
    <section class="section reading" id="scoring">${sectionHead('Success-rate calculation')}<p>For results with trial counts, task success rate is <code>successes ÷ episodes</code>. Task counts are <strong>pooled within each suite × perturbation pair</strong>. The displayed average is the <strong>arithmetic mean</strong> of available suite × perturbation rates in the selected setting. Domain scores apply the same calculation to that domain.</p><p>The current taxonomy includes <code>S22</code>: there are <strong>87 applicable static suite cells</strong> and <strong>80 dynamic suite cells</strong> per model. <code>S04</code> is not applicable to LIBERO-Spatial. Missing and inapplicable observations are <strong>not converted to zero</strong>. The earlier website excluded <code>S22</code>; its static and overall averages therefore differ.</p><p><code>Base</code> is the average of available nominal suite rates. <code>Δ = Average − Base</code>, in <strong>percentage points</strong>; a negative value indicates lower success under perturbation. The website does not introduce a separate capability score.</p></section>
    <section class="section reading" id="taxonomy">${sectionHead('Paper taxonomy')}<p>Select any ID to read its intervention design, constraints and task coverage. All <strong>six domains</strong> and all <strong>42 perturbations</strong> remain available in the document directory.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Paper taxonomy, horizontally scrollable"><table><thead><tr><th>Domain</th><th>Static</th><th>Dynamic</th></tr></thead><tbody>${catalogue.categories.map(c=>`<tr id="domain-${c.id}"><th scope="row">${c.name}</th>${['static','dynamic'].map(mode=>`<td>${c[mode].map(id=>`<a href="${url('docs',{perturbation:id})}">${id}</a>`).join(', ')}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>The website uses <strong>paper IDs</strong>. Paper <code>D19</code> maps to internal <code>D20</code> (robot joint displacement); paper <code>D20</code> maps to internal <code>D21</code> (instruction restatement). Internal <code>D19</code> is <strong>excluded</strong> from the published 42-type catalogue. Static <code>S06</code> belongs to Environment.</p></section>
    ${documentPerturbationIndex('static')}${documentPerturbationIndex('dynamic')}
    <section class="section reading" id="sources">${sectionHead('Result coverage')}<p>The leaderboard presents success rates for <strong>18 models</strong> across <strong>22 static and 20 dynamic perturbations</strong>. Open a model to inspect results by domain and task suite, with individual task success rates shown where available.</p><p><strong>Task-level results</strong> are available for OpenVLA, OpenVLA-OFT_w, OpenVLA-OFT_m, OpenVLA-OFT+, RIPT-VLA, NORA, UniVLA and π0-FAST. The remaining models have suite-level rates; individual task results are <strong>not inferred</strong> from them. Missing rates are shown as <code>—</code> and inapplicable tasks as <code>N/A</code>.</p><p>Paper figures illustrate <strong>perturbation mechanisms</strong> and are not model rollout evidence. Model images come from official projects or organizations; credits appear on each model page.</p><a class="text-link" href="leaderboard.html">Explore model results ↗</a></section>
    <section class="section reading" id="design-principles">${sectionHead('Design principles')}<p>The six domains classify each perturbation by its <strong>primary intervention target</strong>. Every type shares a semantic definition across suites, while object choices, magnitudes, directions and event settings are <strong>configured per task</strong>.</p><p><strong>Physical parameters are unchanged</strong>. Geometry and injected states must remain <strong>reachable and collision-free</strong>. Grasp loss and robot displacement are recoverable state or control interventions, not force simulations.</p><p><code>S04</code> is not applicable to Spatial tasks 0 and 8 or Long task 8. <code>S05</code> is not applicable to Goal task 3. <code>D06</code> is not applicable to Long task 8. The task documents and rollout galleries label these <strong>five combinations as not applicable</strong>.</p><a href="tasks.html">Browse the illustrated perturbation catalogue ↗</a></section>`);
}

function documentPerturbationIndex(mode) {
  return `<section class="section" id="${mode}-perturbations">${sectionHead(mode==='static'?'Static shifts':'Dynamic interventions',`<span class="count-label">${directionsFor(mode).length} perturbations</span>`)}<p>${mode==='static'?'Changes applied <strong>at initialization</strong>, before the first policy action.':'Interventions triggered <strong>during execution</strong> at task-relevant moments.'}</p><div class="doc-perturbation-index">${directionsFor(mode).map(p=>`<a href="${url('docs',{perturbation:p.id})}"><span class="id">${p.id}</span><span>${esc(p.name)}</span><span class="index-domain">${categoryFor(p.category).name}</span><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`;
}

function evalPage() {
  return layout(`${head('Eval','Evaluate robustness with a fixed task goal, one perturbation at a time.')}
    <section class="section" id="setup">${sectionHead('Evaluation setup')}<div class="mode-guide"><div><h3>Choose a base task</h3><p>Use the eight-task evaluation split: two tasks each from Spatial, Object, Goal and Long. The task document specifies the instruction and success condition.</p><a class="text-link" href="docs.html#task-designs">Read task designs ↗</a></div><div><h3>Apply one perturbation</h3><p>Select an applicable paper ID, S01–S22 or D01–D20. Keep task semantics and feasibility intact. RQ experiments and combined suites are outside this leaderboard.</p><a class="text-link" href="tasks.html">Browse perturbations ↗</a></div></div></section>
    <section class="section" id="execution">${sectionHead('Run the episode')}<div class="mode-guide"><div>${pill('static')}<h3>Set the condition at reset</h3><p>Apply the configured scene, sensor, robot, timing or language shift before the first policy action. Fixed fault settings remain active while the task executes.</p></div><div>${pill('dynamic')}<h3>Trigger during execution</h3><p>Apply the configured event at approach, grasp, transport or placement. Respect its duration and release rule, then continue toward the original task goal.</p></div></div><p class="table-note">This page documents the evaluation procedure. An online evaluation runner and submission service are not currently available.</p></section>
    <section class="section reading" id="reporting">${sectionHead('Record and report')}<p>Record the task ID, paper perturbation ID, number of successful episodes and total evaluated episodes. Record BASE separately. Mark invalid or inapplicable combinations explicitly; do not record them as zero-success trials.</p>${designFacts([['Task success rate','Successful episodes ÷ evaluated episodes'],['Suite × perturbation','Pool successes and episodes across the available tasks in that suite.'],['Domain success rate','Arithmetic mean of the available suite × perturbation rates within a paper domain.'],['Average success rate','Arithmetic mean of all applicable suite × perturbation rates in the static or dynamic setting.']])}<p>Task-level success rates are displayed where available. Other models have suite-level rates only. Only available observations are used in the displayed aggregates.</p><a href="docs.html#scoring">Read scoring and coverage details ↗</a></section>
    <section class="section" id="results">${sectionHead('Inspect results')}<p>Compare static and dynamic success rates, then select a model, domain or perturbation to inspect the available results.</p><div class="actions" style="justify-content:flex-start"><a class="button" href="leaderboard.html">Open leaderboard</a></div></section>`,[['setup','Setup'],['execution','Execution'],['reporting','Reporting'],['results','Results']]);
}

function notFound(kind,href) {
  return `<main id="content">${head(`${kind} not found`)}<p>The requested identifier is not part of the published catalogue.</p><div class="actions" style="justify-content:flex-start"><a class="button" href="${href}">Return to catalogue</a></div></main>`;
}

const renderers={index:homePage,leaderboard:leaderboardPage,tasks:tasksPage,model:modelPage,perturbation:perturbationPage,task:taskPage,findings:findingsPage,docs:docsPage,eval:evalPage};

function revealSelected(container, selected, inset=0) {
  if(!container||!selected)return;
  const box=container.getBoundingClientRect(),item=selected.getBoundingClientRect();
  if(item.top<box.top+inset)container.scrollTop+=item.top-box.top-inset;
  else if(item.bottom>box.bottom)container.scrollTop+=item.bottom-box.bottom;
}

function prepareDirectories(initial=false) {
  const mobile=matchMedia('(max-width:760px)').matches;
  const directory=document.querySelector('.doc-directory');
  if(directory&&mobile&&initial)directory.open=false;
  const selected=document.querySelector('.docs-sidebar a[aria-current=page]');
  const group=selected?.closest('.doc-nav-group details');
  if(group)group.open=true;
  if(!mobile)revealSelected(document.querySelector('.docs-sidebar'),selected,20);
  revealSelected(document.querySelector('.catalogue-nav'),document.querySelector('.nav-item.active'),50);
}

function updateSectionIndicator() {
  const sections=[...document.querySelectorAll('main section[id]')];
  if(sections.length&&document.querySelector('.toc')){
    let active=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=160)active=section;}
    if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-5)active=sections.at(-1);
    document.querySelectorAll('.toc a').forEach(a=>{const selected=a.hash==='#'+active.id;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  }
}

function scrollToAnchor(hash) {
  if(!hash)return;
  let id;
  try{id=decodeURIComponent(hash.slice(1));}catch{return;}
  const target=document.getElementById(id);
  target?.scrollIntoView({behavior:'instant',block:'start'});
  if(page==='docs'&&id.startsWith('domain-')){
    const group=[...document.querySelectorAll('.docs-sidebar [data-domain]')].find(item=>'domain-'+item.dataset.domain===id);
    if(group){group.open=true;revealSelected(document.querySelector('.docs-sidebar'),group.querySelector('summary'),20);}
  }
  if(id==='content'&&target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
}

function revealPerturbationColumn() {
  const table=document.querySelector('.perturbation-table');
  if(!table)return;
  const scroller=table.closest('.table-scroll'),selected=table.querySelector('thead th[aria-sort]');
  const frozen=table.querySelector('.rank-column').offsetWidth+table.querySelector('.model-column').offsetWidth;
  const left=selected.getBoundingClientRect().left-scroller.getBoundingClientRect().left+scroller.scrollLeft;
  const right=left+selected.offsetWidth;
  if(left<scroller.scrollLeft+frozen)scroller.scrollLeft=Math.max(0,left-frozen);
  else if(right>scroller.scrollLeft+scroller.clientWidth)scroller.scrollLeft=right-scroller.clientWidth;
}

function updateCurrentView(next, {anchor=false, top=false, replace=true}={}) {
  const changed=params.toString()!==next.searchParams.toString();
  const perturbationChanged=['perturbationMode','perturbationSort'].some(key=>params.get(key)!==next.searchParams.get(key));
  const comparisonChanged=params.get('compare')!==next.searchParams.get('compare');
  const position={left:window.scrollX,top:window.scrollY};
  const focused=document.activeElement;
  // A filter/task choice is state of this view, not another stop in Back history.
  if(replace)history.replaceState(history.state,'',next);
  if(changed){
    params=new URLSearchParams(next.search);
    document.title=defaultTitle;
    updateView(app,(renderers[page]||homePage)());
    if(page==='docs')bindDocumentDemo();
    if(page==='leaderboard'&&perturbationChanged)revealPerturbationColumn();
    prepareDirectories();
    if(focused!==document.body&&!focused.isConnected){
      const heading=document.querySelector('#content h1');
      heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
    }
    window.scrollTo({...position,behavior:'instant'});
    const status=document.querySelector('#view-status');
    if(page==='leaderboard'&&comparisonChanged){
      status.textContent=`Model comparison updated. ${document.querySelectorAll('[data-chart-model][aria-pressed="true"]').length} models selected.`;
    }else if(page==='leaderboard'){
      const table=document.querySelector(`${next.hash==='#perturbation-rankings'?'#perturbation-rankings':'#rankings'} .table-scroll`);
      status.textContent=`${table.getAttribute('aria-label').split(',')[0]} updated. ${table.querySelectorAll('tbody tr').length} models.`;
    }else status.textContent=document.querySelector('.nav-item.active')?.textContent||document.querySelector('#content h1')?.textContent||'View updated';
  }
  if(page==='docs'&&changed){
    const directory=document.querySelector('.doc-directory');
    if(directory&&matchMedia('(max-width:760px)').matches)directory.open=false;
    document.querySelector('#content')?.scrollIntoView({behavior:'instant',block:'start'});
  }
  if(anchor)scrollToAnchor(next.hash);
  if(top)window.scrollTo({top:0,left:0,behavior:'instant'});
  updateSectionIndicator();
}

function bindInteractions() {
  prepareDirectories(true);
  const status=document.createElement('div');
  status.id='view-status';status.className='sr-only';status.setAttribute('role','status');status.setAttribute('aria-live','polite');document.body.append(status);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(isLocalViewLink(event,link,location.href)){
      const next=new URL(link.getAttribute('href'),location.href);
      const changed=next.search!==location.search;
      event.preventDefault();
      updateCurrentView(next,{
        anchor:!!next.hash&&!link.closest('.tabs,.catalogue-nav,.domain-filter')&&(!changed||page==='docs'||!!link.closest('.category-scores,.domain-list')),
        top:!!link.closest('.site-nav,.brand')
      });
      return;
    }
    const perturbationSort=event.target.closest('[data-perturbation-sort]');
    if(perturbationSort){
      const next=new URL(location.href),previous=next.searchParams.get('perturbationSort')||'average',ascending=next.searchParams.get('perturbationOrder')==='asc';
      next.searchParams.set('perturbationSort',perturbationSort.dataset.perturbationSort);
      next.searchParams.set('perturbationOrder',previous===perturbationSort.dataset.perturbationSort&&!ascending?'asc':'desc');
      next.hash='perturbation-rankings';updateCurrentView(next);return;
    }
    const sort=event.target.closest('[data-sort]');
    if(sort){
      const next=new URL(location.href),previous=next.searchParams.get('sort')||'average',ascending=next.searchParams.get('order')==='asc';
      next.searchParams.set('sort',sort.dataset.sort);next.searchParams.set('order',previous===sort.dataset.sort&&!ascending?'asc':'desc');next.hash='rankings';
      updateCurrentView(next);return;
    }
    const row=event.target.closest('[data-href]');
    if(row&&!event.target.closest('a,button')&&!window.getSelection().toString())location.assign(row.dataset.href);
  });
  document.addEventListener('change',event=>{
    const select=event.target.closest('[data-query],#model-select');
    if(!select)return;
    const next=new URL(location.href),key=select.dataset.query||'model';
    if(select.value)next.searchParams.set(key,select.value);else next.searchParams.delete(key);
    if(select.dataset.anchor)next.hash=select.dataset.anchor;
    updateCurrentView(next);
  });
  window.addEventListener('popstate',()=>updateCurrentView(new URL(location.href),{replace:false}));
  window.addEventListener('scroll',updateSectionIndicator,{passive:true});
  updateSectionIndicator();
  if(location.hash&&performance.getEntriesByType('navigation')[0]?.type!=='back_forward')requestAnimationFrame(()=>scrollToAnchor(location.hash));
}

document.querySelector('.menu-button').addEventListener('click',event=>{
  const open=event.currentTarget.getAttribute('aria-expanded')!=='true';event.currentTarget.setAttribute('aria-expanded',String(open));document.querySelector('.site-nav').classList.toggle('open',open);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('.site-nav').classList.remove('open');document.querySelector('.menu-button').setAttribute('aria-expanded','false');}});
const navPage=page==='model'?'leaderboard':['task','perturbation','tasks'].includes(page)?'docs':page;
document.querySelector(`.site-nav a[href="${navPage}.html"]`)?.setAttribute('aria-current','page');

try {
  [catalogue,results,{tasks},assets,designs,people,publication]=await Promise.all(['catalogue','results','tasks','model-assets','task-designs','people','publication'].map(async name=>{
    const response=await fetch(`data/${name}.json`);if(!response.ok)throw new Error(`Unable to load ${name}`);return response.json();
  }));
  if(page==='index') {
    [upcomingModels,news]=await Promise.all(['upcoming-models','news'].map(async name=>{
      const response=await fetch(`data/${name}.json`);
      if(!response.ok)throw new Error(`Unable to load ${name}`);
      return response.json();
    }));
  }
  if(page==='leaderboard') {
    const [profiles,announcements]=await Promise.all(['model-profiles','leaderboard-news'].map(async name=>{
      const response=await fetch(`data/${name}.json`);
      if(!response.ok)throw new Error(`Unable to load ${name}`);
      return response.json();
    }));
    leaderboardNews=announcements;
    capabilities=createCapabilities(results.models,assets,profiles,{esc,pct,modelUrl,updateView});
  }
  // Accept the previous public model deep link while the new profile route settles.
  if(page==='leaderboard'&&params.get('model')){
    const old=results.models.find(m=>m.name===params.get('model')||m.id===params.get('model'));
    if(old){location.replace(modelUrl(old,{mode:params.get('metric')==='dynamic'?'dynamic':'static'}));}
  }
  app.innerHTML=(renderers[page]||homePage)();bindInteractions();bindHomeMotion();bindHomePresentation();bindHomeNews();bindTaxonomy(catalogue);
  if(page==='docs')bindDocumentDemo();
  if(page==='leaderboard'){
    capabilities.bind(ids=>{
      const next=new URL(location.href);next.searchParams.set('compare',ids.join(','));
      updateCurrentView(next);
    });
    revealPerturbationColumn();
  }
} catch(error) {
  console.error(error);
  app.innerHTML='<main id="content"><div class="error"><h1>Results could not be loaded</h1><p>Please reload the page to try again.</p><a class="text-link" href="leaderboard.html">Return to the leaderboard ↗</a></div></main>';
}
