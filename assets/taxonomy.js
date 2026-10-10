const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const point = (radius, angle) => {
  const radians = angle * Math.PI / 180;
  return [radius * Math.cos(radians), radius * Math.sin(radians)].map(n => +n.toFixed(3));
};
const arc = (inner, outer, start, end) => {
  const large = end - start > 180 ? 1 : 0;
  return `M${point(outer,start)} A${outer},${outer} 0 ${large} 1 ${point(outer,end)} L${point(inner,end)} A${inner},${inner} 0 ${large} 0 ${point(inner,start)} Z`;
};

export function taxonomyFigure(catalogue) {
  const total = catalogue.perturbations.length;
  const domains = new Map(catalogue.categories.map(c => [c.id,c]));
  // Public IDs define the circle's order; category membership only controls highlighting.
  const ordered = ['static','dynamic'].flatMap(mode => catalogue.perturbations
    .filter(p => p.mode===mode).sort((a,b) => Number(a.id.slice(1))-Number(b.id.slice(1))));
  let modeStart=-90;
  const modeSectors=['static','dynamic'].map(mode=>{
    const count=ordered.filter(p=>p.mode===mode).length,end=modeStart+count/total*360;
    const label=point(145,(modeStart+end)/2);
    const markup=`<a class="taxonomy-mode ${mode}" data-ring-mode="${mode}" href="docs.html#${mode}-perturbations" aria-label="${mode==='static'?'Static':'Dynamic'}: ${count} perturbations">
      <path d="${arc(111,178,modeStart+.6,end-.6)}"/>
      <text x="${label[0]}" y="${label[1]-10}" aria-hidden="true">${mode==='static'?'Static':'Dynamic'}</text>
      <text class="taxonomy-mode-count" x="${label[0]}" y="${label[1]+13}" aria-hidden="true">${count}</text>
    </a>`;
    modeStart=end;return markup;
  }).join('');
  const sectors = ordered.map((p,i) => {
    const start=-90+i/total*360,end=-90+(i+1)/total*360,middle=(start+end)/2;
    const label=point(232,middle),compact=point(i%2===0?218:252,middle);
    const [dx,dy]=point(16,middle);
    return `<a class="taxonomy-task taxonomy-slice ${p.mode}" href="docs.html?perturbation=${p.id}" data-ring-task="${p.id}" data-ring-domain="${p.category}" aria-label="${escape(p.id+' '+p.name+' — '+domains.get(p.category).name+', '+p.mode)}" style="--domain:var(--${p.category});--lift-x:${dx}px;--lift-y:${dy-5}px">
      <path class="taxonomy-hit" d="${arc(182,274,start,end)}" aria-hidden="true"/>
      <g class="taxonomy-lift" aria-hidden="true">
        <path class="taxonomy-face" d="${arc(182,272,start+.18,end-.18)}"/>
        <text class="taxonomy-id" x="${label[0]}" y="${label[1]}">${p.id}</text>
        <text class="taxonomy-id-compact" x="${compact[0]}" y="${compact[1]}">${p.id}</text>
      </g>
    </a>`;
  }).join('');
  return `<figure class="home-taxonomy" aria-label="Interactive perturbation taxonomy">
    <div class="taxonomy-stage">
      <svg class="taxonomy-ring" viewBox="-310 -310 620 620" role="group" aria-labelledby="taxonomy-title taxonomy-description">
        <title id="taxonomy-title">42 perturbations in public ID order</title>
        <desc id="taxonomy-description">The inner ring has two parts: 22 static and 20 dynamic perturbations. The outer ring runs clockwise from the top: S01 through S22, then D01 through D20. Each code links to its full design. Side descriptions highlight matching codes without changing their order.</desc>
        ${modeSectors}${sectors}
      </svg>
      <div class="taxonomy-center" aria-hidden="true"><strong data-taxonomy-value>42</strong><span data-taxonomy-name>Perturbations</span><small data-taxonomy-meta>22 static · 20 dynamic</small></div>
    </div>
    <figcaption class="caption">S01–S22, then D01–D20 · clockwise. Select a code to read its design.</figcaption>
  </figure>`;
}

export function bindTaxonomy(catalogue) {
  const root=document.querySelector('.home-domains');
  if(!root)return;
  const domains=new Map(catalogue.categories.map(c=>[c.id,c]));
  const entries=new Map(catalogue.perturbations.map(p=>[p.id,p]));
  const links=[...root.querySelectorAll('[data-ring-task]')];
  // SVG paints later siblings on top. Keep the real links in public/keyboard order
  // and draw raised faces in a final layer, above every stationary face and hit area.
  const foreground=document.createElementNS('http://www.w3.org/2000/svg','g');
  foreground.setAttribute('aria-hidden','true');
  const previews=links.map(link=>{
    const preview=link.cloneNode(true);
    preview.classList.replace('taxonomy-task','taxonomy-preview');
    preview.dataset.previewTask=link.dataset.ringTask;
    preview.removeAttribute('data-ring-task');
    preview.removeAttribute('data-ring-domain');
    preview.removeAttribute('aria-label');
    preview.setAttribute('tabindex','-1');
    preview.setAttribute('focusable','false');
    preview.querySelector('.taxonomy-hit').remove();
    // Pointer clicks retain the original accessible link as the focus target.
    preview.addEventListener('pointerdown',event=>{
      if(event.button===0){event.preventDefault();link.focus({preventScroll:true});}
    });
    foreground.append(preview);
    return preview;
  });
  root.querySelector('.taxonomy-ring').append(foreground);
  const cards=[...root.querySelectorAll('.home-domain')];
  const modes=[...root.querySelectorAll('[data-ring-mode]')];
  const value=root.querySelector('[data-taxonomy-value]');
  const name=root.querySelector('[data-taxonomy-name]');
  const meta=root.querySelector('[data-taxonomy-meta]');
  let hovered=null,focused=null;
  const selection=target=>{
    if(!(target instanceof Element))return null;
    const preview=entries.get(target.closest('[data-preview-task]')?.dataset.previewTask);
    if(preview)return {domain:preview.category,task:preview.id};
    const source=target.closest('[data-ring-domain],[data-home-domain],[data-ring-mode]');
    return source?{domain:source.dataset.ringDomain||source.dataset.homeDomain,task:target.closest('[data-ring-task]')?.dataset.ringTask,mode:source.dataset.ringMode}:null;
  };
  const render=()=>{
    const active=hovered||focused,c=domains.get(active?.domain),p=entries.get(active?.task),mode=active?.mode;
    const modeCount=mode?catalogue.perturbations.filter(p=>p.mode===mode).length:0;
    root.classList.toggle('has-active-domain',!!c);
    links.forEach((link,i)=>{
      const selected=p?link.dataset.ringTask===p.id:c?link.dataset.ringDomain===c.id:!!mode&&link.classList.contains(mode);
      link.classList.toggle('is-active',selected);
      previews[i].classList.toggle('is-active',selected);
      previews[i].classList.toggle('is-focused',link.matches(':focus-visible'));
    });
    cards.forEach(card=>card.classList.toggle('is-active',card.dataset.homeDomain===c?.id));
    modes.forEach(link=>link.classList.toggle('is-active',link.dataset.ringMode===(p?.mode||mode)));
    value.textContent=p?p.id:c?c.static.length+c.dynamic.length:mode?modeCount:catalogue.perturbations.length;
    name.textContent=p?p.name:c?c.name:mode?mode==='static'?'Static shifts':'Dynamic interventions':'Perturbations';
    meta.textContent=p?`${p.mode==='static'?'Static':'Dynamic'} · ${c.name}`:c?`${c.static.length} static · ${c.dynamic.length} dynamic`:mode?mode==='static'?'S01–S22':'D01–D20':'22 static · 20 dynamic';
  };
  root.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch')return;
    const next=selection(event.target);
    if(next){hovered=next;render();}
  });
  // The unmoving hit area and retained selection across small gaps prevent hover flicker.
  root.addEventListener('pointerleave',()=>{hovered=null;render();});
  root.addEventListener('focusin',event=>{focused=selection(event.target);hovered=null;render();});
  root.addEventListener('focusout',event=>{focused=selection(event.relatedTarget);render();});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){hovered=null;focused=null;render();}
  });
}
