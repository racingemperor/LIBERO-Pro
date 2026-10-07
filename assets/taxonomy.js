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
  const entries = new Map(catalogue.perturbations.map(p => [p.id,p]));
  let angle = -90, slot = 0;
  // Keep Condition in the upper left, matching the paper and flanking descriptions.
  const sectors = [...catalogue.categories].reverse().map(category => {
    const ids = [...category.static,...category.dynamic];
    const start = angle, end = angle += ids.length / total * 360, middle = (start+end)/2;
    const [dx,dy] = point(20,middle);
    const countAt = point(147,middle);
    return `<g class="taxonomy-domain" data-ring-domain="${category.id}" style="--domain:var(--${category.id});--lift-x:${dx}px;--lift-y:${dy-9}px">
      <path class="taxonomy-hit" d="${arc(115,274,start,end)}" aria-hidden="true"/>
      <g class="taxonomy-lift">
        <g class="taxonomy-sector" role="button" tabindex="0" aria-pressed="false" aria-label="Preview ${category.name}, ${ids.length} perturbations" data-domain-preview="${category.id}">
          <path d="${arc(115,177,start+.6,end-.6)}"/>
          <text x="${countAt[0]}" y="${countAt[1]}" aria-hidden="true">${ids.length}</text>
        </g>
        ${ids.map((id,i) => {
          const p=entries.get(id),a=start+i/total*360,b=start+(i+1)/total*360;
          const label=point(232,(a+b)/2),compact=point(slot++%2===0?218:252,(a+b)/2);
          const [x,y]=point(6,(a+b)/2);
          return `<a class="taxonomy-task ${p.mode}" href="docs.html?perturbation=${id}" data-ring-task="${id}" aria-label="${escape(id+' '+p.name+' — '+category.name+', '+p.mode)}" style="--task-x:${x}px;--task-y:${y-2}px">
            <path d="${arc(182,272,a+.22,b-.22)}"/>
            <text class="taxonomy-id" x="${label[0]}" y="${label[1]}" aria-hidden="true">${id}</text>
            <text class="taxonomy-id-compact" x="${compact[0]}" y="${compact[1]}" aria-hidden="true">${id}</text>
          </a>`;
        }).join('')}
      </g>
    </g>`;
  }).join('');
  return `<figure class="home-taxonomy" aria-label="Interactive perturbation taxonomy">
    <div class="taxonomy-stage">
      <svg class="taxonomy-ring" viewBox="-310 -310 620 620" role="group" aria-labelledby="taxonomy-title taxonomy-description">
        <title id="taxonomy-title">42 perturbations across six domains</title>
        <desc id="taxonomy-description">Preview a domain with its inner sector or a side description. Each horizontal S or D code links to its full design. Sector size represents the number of perturbations.</desc>
        ${sectors}
      </svg>
      <div class="taxonomy-center" aria-hidden="true"><strong data-taxonomy-value>42</strong><span data-taxonomy-name>Perturbations</span><small data-taxonomy-meta>22 static · 20 dynamic</small></div>
    </div>
    <figcaption class="caption">Hover or tap a sector. Select a code to read its design.</figcaption>
    <p class="sr-only" data-taxonomy-status role="status"></p>
  </figure>`;
}

export function bindTaxonomy(catalogue) {
  const root=document.querySelector('.home-domains');
  if(!root)return;
  const domains=new Map(catalogue.categories.map(c=>[c.id,c]));
  const entries=new Map(catalogue.perturbations.map(p=>[p.id,p]));
  const groups=[...root.querySelectorAll('.taxonomy-domain')];
  const cards=[...root.querySelectorAll('.home-domain')];
  const buttons=[...root.querySelectorAll('[data-domain-preview]')];
  const value=root.querySelector('[data-taxonomy-value]');
  const name=root.querySelector('[data-taxonomy-name]');
  const meta=root.querySelector('[data-taxonomy-meta]');
  let hovered=null,focused=null,pinned=null;
  const selection=target=>{
    if(!(target instanceof Element))return null;
    const source=target.closest('[data-ring-domain],[data-home-domain]');
    return source?{domain:source.dataset.ringDomain||source.dataset.homeDomain,task:target.closest('[data-ring-task]')?.dataset.ringTask}:null;
  };
  const render=()=>{
    const active=hovered||focused||pinned,c=domains.get(active?.domain),p=entries.get(active?.task);
    root.classList.toggle('has-active-domain',!!c);
    groups.forEach(group=>group.classList.toggle('is-active',group.dataset.ringDomain===c?.id));
    cards.forEach(card=>card.classList.toggle('is-active',card.dataset.homeDomain===c?.id));
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.domainPreview===pinned?.domain)));
    root.querySelectorAll('[data-ring-task]').forEach(link=>link.classList.toggle('is-current',link.dataset.ringTask===p?.id));
    value.textContent=p?p.id:c?c.static.length+c.dynamic.length:catalogue.perturbations.length;
    name.textContent=p?p.name:c?c.name:'Perturbations';
    meta.textContent=p?`${p.mode==='static'?'Static':'Dynamic'} · ${c.name}`:c?`${c.static.length} static · ${c.dynamic.length} dynamic`:'22 static · 20 dynamic';
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
  const preview=button=>{
    const id=button.dataset.domainPreview;
    pinned=pinned?.domain===id?null:{domain:id};
    hovered=null;focused=null;render();
    root.querySelector('[data-taxonomy-status]').textContent=pinned?`${domains.get(id).name}: ${domains.get(id).static.length} static and ${domains.get(id).dynamic.length} dynamic perturbations.`:'All 42 perturbations.';
  };
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-domain-preview]')||event.target.closest('.taxonomy-hit')?.parentElement.querySelector('[data-domain-preview]');
    if(button)preview(button);
  });
  root.addEventListener('keydown',event=>{
    const button=event.target.closest('[data-domain-preview]');
    if(button&&['Enter',' '].includes(event.key)){event.preventDefault();preview(button);}
    if(event.key==='Escape'){hovered=null;focused=null;pinned=null;render();}
  });
}
