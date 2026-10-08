// The three axes are categorical success rates, all on the same 0–100% scale.
const metrics = ['Overall', 'Dynamic', 'Static'];
const values = model => [model.scores.overall, model.scores.dynamic.average, model.scores.static.average];
const colors = {
  'lingbot-va':'#2064ce', 'molmoact2':'#b74379', 'cosmos-policy':'#25856c',
  'pi0-5':'#965616', 'xvla':'#7753b5', 'fastwam':'#007e9b', 'gr00t-n1-7':'#677c19',
  'openvla-oft-m':'#ad4a3a', 'openvla-oft':'#5365a1', 'openvla-oft-plus':'#866440',
  'anchor-align':'#ac5a00', 'openvla-oft-w':'#537b7f', 'ript-vla':'#a03949', 'pi0':'#586371'
};

export function createCapabilities(models, assets, profiles, {esc, pct, modelUrl, updateView}) {
  const ordered = [...models].sort((a,b)=>(b.scores.overall??-1)-(a.scores.overall??-1));
  const defaults = ordered.slice(0,3).map(m=>m.id);
  let selected = new Set(defaults), width = 960, active = null, pinned = false, hideTimer;
  let position = {left:12,top:60};
  const mark = m => `<img src="assets/models/${esc(assets[m.id].asset)}" width="24" height="24" alt="">`;
  const scoreText = m => values(m).map((v,i)=>`${metrics[i]} ${pct(v)}`).join(', ');

  function svg() {
    const compact = width < 620, left = compact?42:54, right = width-(compact?28:210);
    const x = [left,(left+right)/2,right], top = 30, bottom = compact?274:334;
    const y = v => bottom-v*(bottom-top);
    const labelPositions = new Map();
    const endpoints = ordered.filter(m=>selected.has(m.id)&&Number.isFinite(values(m)[2])).sort((a,b)=>values(b)[2]-values(a)[2]);
    endpoints.forEach((m,i)=>labelPositions.set(m.id,Math.max(y(values(m)[2]),i?labelPositions.get(endpoints[i-1].id)+22:top)));
    for(let i=endpoints.length-1;i>=0;i--){
      const limit=i===endpoints.length-1?bottom:labelPositions.get(endpoints[i+1].id)-22;
      labelPositions.set(endpoints[i].id,Math.min(labelPositions.get(endpoints[i].id),limit));
    }
    return `<svg class="capability-svg" width="100%" height="${bottom+52}" viewBox="0 0 ${width} ${bottom+52}" role="group" aria-label="Model success rates: Overall, Dynamic, Static" aria-describedby="capability-help">
      <g class="capability-grid" aria-hidden="true">${[0,.2,.4,.6,.8,1].map(v=>`<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">${Math.round(v*100)}${v===1?'%':''}</text>`).join('')}${x.map((v,i)=>`<line x1="${v}" x2="${v}" y1="${top}" y2="${bottom}"/><text class="capability-axis" x="${v}" y="${bottom+30}" text-anchor="${compact?(i===0?'start':i===2?'end':'middle'):'middle'}">${metrics[i]}</text>`).join('')}</g>
      ${ordered.map((m,index)=>{
        const vs=values(m),visible=selected.has(m.id),path=vs.map((v,i)=>Number.isFinite(v)?`${i&&Number.isFinite(vs[i-1])?'L':'M'}${x[i]},${y(v)}`:'').join(' ');
        const labelY=labelPositions.get(m.id)??y(vs[2]),dash=index<7?'':index<11?'8 4':'2 5';
        return `<g class="capability-series${active&&active!==m.id?' muted':''}${active===m.id?' highlighted':''}" data-series="${m.id}" style="--series:${colors[m.id]}" ${visible?'':'hidden'} tabindex="${visible?0:-1}" role="button" aria-label="${esc(m.name)}, ${scoreText(m)}. Show model introduction." aria-expanded="${active===m.id}" aria-controls="capability-preview">
          <path class="capability-line" d="${path}" stroke-dasharray="${dash}"/>
          <path class="capability-hit" d="${path}"/>
          ${vs.map((v,i)=>Number.isFinite(v)?`<circle class="capability-point" data-metric="${metrics[i].toLowerCase()}" data-value="${v}" cx="${x[i]}" cy="${y(v)}" r="5"/><text class="capability-value" x="${x[i]}" y="${y(v)-14}" text-anchor="${compact?(i===0?'start':i===2?'end':'middle'):'middle'}" aria-hidden="true">${pct(v)}</text>`:'').join('')}
          ${!compact&&Number.isFinite(vs[2])?`<g class="capability-end-label" aria-hidden="true"><path class="capability-connector" d="M${right+8},${y(vs[2])} L${right+24},${labelY} H${right+31}"/><image href="assets/models/${esc(assets[m.id].asset)}" x="${right+36}" y="${labelY-9}" width="18" height="18"/><text x="${right+62}" y="${labelY+4}">${esc(m.name)}</text></g>`:''}
        </g>`;
      }).join('')}
    </svg>`;
  }

  function previewContent() {
    const m=ordered.find(m=>m.id===active);
    if(!m)return '';
    return `<div class="capability-preview-head">${mark(m)}<div><strong>${esc(m.name)}</strong><span>${esc(m.type)}</span></div><button type="button" data-close-preview aria-label="Close model introduction">×</button></div>
      <p>${esc(profiles[m.id]?.description||m.type)}</p>
      <dl>${values(m).map((v,i)=>`<div><dt>${metrics[i]}</dt><dd>${pct(v)}</dd></div>`).join('')}</dl>
      <div class="capability-preview-links"><a href="${modelUrl(m)}">Model results ↗</a><a href="${esc(profiles[m.id]?.source||assets[m.id].project)}" target="_blank" rel="noopener">Official project ↗</a></div>`;
  }

  function content() {
    return `<div class="capability-selection-head"><span id="capability-model-label">Models <span class="capability-count">${selected.size} / ${ordered.length}</span></span><div><button type="button" data-chart-select="all">Select all</button><button type="button" data-chart-select="none">Clear</button></div></div>
      <div class="capability-models" role="group" aria-labelledby="capability-model-label">${ordered.map(m=>`<button type="button" class="model-chip" data-chart-model="${m.id}" style="--series:${colors[m.id]}" aria-pressed="${selected.has(m.id)}">${mark(m)}<span>${esc(m.name)}</span><span class="chip-check" aria-hidden="true">${selected.has(m.id)?'✓':'+'}</span></button>`).join('')}</div>
      <div class="capability-plot-head"><span>Success rate (%)</span><span>Higher is better</span></div>
      <div class="capability-plot">${svg()}<p class="capability-empty" ${selected.size?'hidden':''}>Select a model above to compare its success rates.</p>
        <aside id="capability-preview" class="capability-preview" aria-label="Model introduction" style="left:${position.left}px;top:${position.top}px" ${active?'':'hidden'}>${previewContent()}</aside>
      </div>
      <p class="capability-help" id="capability-help">Select models to compare. Hover, focus or tap a line for model details.</p>
      <div class="capability-foot"><p>Overall averages all available static and dynamic suite × perturbation results. <a href="docs.html#scoring">Scoring details ↗</a></p>
      <details class="capability-data"><summary>View scores as a table</summary><div class="table-scroll"><table><caption class="sr-only">Selected models, success rates (%)</caption><thead><tr><th scope="col">Model</th>${metrics.map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${ordered.filter(m=>selected.has(m.id)).map(m=>`<tr><th scope="row"><a href="${modelUrl(m)}">${esc(m.name)}</a></th>${values(m).map(v=>`<td>${pct(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></div>
      `;
  }

  function render(params) {
    selected=new Set(params.has('compare')?params.get('compare').split(',').filter(id=>ordered.some(m=>m.id===id)):defaults);
    if(!selected.has(active)){active=null;pinned=false;}
    return `<div class="capability-chart">${content()}</div>`;
  }

  function bind(onSelect) {
    const root=document.querySelector('.capability-chart');
    if(!root)return;
    const preview=()=>root.querySelector('#capability-preview');
    function hide() {
      clearTimeout(hideTimer); active=null;pinned=false;
      preview().hidden=true;
      root.querySelectorAll('[data-series]').forEach(el=>{el.classList.remove('muted','highlighted');el.setAttribute('aria-expanded','false');});
    }
    function locate(event,series) {
      const plot=root.querySelector('.capability-plot').getBoundingClientRect(),card=preview();
      const bounds=series.getBoundingClientRect();
      const px=event?.clientX??bounds.left+bounds.width/2,py=event?.clientY??bounds.top;
      let left=px-plot.left+20,top=py-plot.top+20;
      if(left+card.offsetWidth>plot.width-8)left=px-plot.left-card.offsetWidth-20;
      if(top+card.offsetHeight>plot.height-8)top=py-plot.top-card.offsetHeight-20;
      position={left:Math.max(8,Math.min(left,plot.width-card.offsetWidth-8)),top:Math.max(8,Math.min(top,plot.height-card.offsetHeight-8))};
      Object.assign(card.style,{left:position.left+'px',top:position.top+'px'});
    }
    function show(id,event) {
      clearTimeout(hideTimer);
      if(!selected.has(id))return;
      if(pinned&&active!==id&&event)return;
      active=id;
      const card=preview();
      updateView(card,previewContent());card.hidden=false;
      root.querySelectorAll('[data-series]').forEach(el=>{el.classList.toggle('muted',el.dataset.series!==id);el.classList.toggle('highlighted',el.dataset.series===id);el.setAttribute('aria-expanded',String(el.dataset.series===id));});
      locate(event,root.querySelector(`[data-series="${id}"]`));
    }
    function laterHide() {
      clearTimeout(hideTimer);
      if(!pinned)hideTimer=setTimeout(()=>{
        if(!preview().contains(document.activeElement)&&!root.querySelector('[data-series]:focus'))hide();
      },180);
    }
    root.addEventListener('pointerover',event=>{
      if(event.pointerType==='touch')return;
      if(event.target.closest('.capability-preview')){clearTimeout(hideTimer);return;}
      const series=event.target.closest('[data-series]');
      if(series&&series.dataset.series!==event.relatedTarget?.closest?.('[data-series]')?.dataset.series)show(series.dataset.series,event);
    });
    root.addEventListener('pointerout',event=>{
      if(event.pointerType==='touch')return;
      if(event.target.closest('[data-series],.capability-preview')&&!event.relatedTarget?.closest?.('[data-series],.capability-preview'))laterHide();
    });
    root.addEventListener('focusin',event=>{
      const series=event.target.closest('[data-series]');
      if(series){pinned=false;show(series.dataset.series);}
      else if(event.target.closest('.capability-preview'))clearTimeout(hideTimer);
    });
    root.addEventListener('focusout',event=>{
      if(!event.relatedTarget?.closest?.('[data-series],.capability-preview')){pinned=false;laterHide();}
    });
    root.addEventListener('click',event=>{
      const chip=event.target.closest('[data-chart-model]'),batch=event.target.closest('[data-chart-select]');
      if(chip||batch){
        const ids=new Set(selected);
        if(chip){const id=chip.dataset.chartModel;ids.has(id)?ids.delete(id):ids.add(id);}
        hide();onSelect(batch?(batch.dataset.chartSelect==='all'?ordered.map(m=>m.id):[]):ordered.filter(m=>ids.has(m.id)).map(m=>m.id));return;
      }
      if(event.target.closest('[data-close-preview]')){
        const series=root.querySelector(`[data-series="${active}"]`);
        series?.focus({preventScroll:true});hide();return;
      }
      const series=event.target.closest('[data-series]');
      if(series){pinned=false;show(series.dataset.series,event.detail?event:undefined);pinned=true;}
    });
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        if(event.target.closest('.capability-preview'))root.querySelector(`[data-series="${active}"]`)?.focus({preventScroll:true});
        hide();return;
      }
      const series=event.target.closest('[data-series]');
      if(series&&['Enter',' '].includes(event.key)){
        event.preventDefault();pinned=false;show(series.dataset.series);pinned=true;
        preview().querySelector('a').focus({preventScroll:true});
      }
    });
    document.addEventListener('pointerdown',event=>{if(!event.target.closest('.capability-plot'))hide();});
    function resize() {
      const next=Math.round(root.getBoundingClientRect().width);
      if(next>0&&next!==width){width=next;hide();updateView(root,content());}
    }
    resize();
    if('ResizeObserver' in window)new ResizeObserver(resize).observe(root);
    else window.addEventListener('resize',resize);
  }
  return {render,bind};
}
