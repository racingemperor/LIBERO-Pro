const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function homeShowcase(catalogue) {
  const example = id => {
    const p = catalogue.perturbations.find(item => item.id === id);
    return `<a class="hero-example" href="docs.html?perturbation=${id}"><img src="assets/home-examples/${id}.webp" alt="${id}: ${escape(p.name)} — paper mechanism illustration" width="1740" height="420"></a>`;
  };
  const collageIds = ['S01','S10','S15','D01','D04','D18'];
  const collage = `<figure class="showcase-collage" aria-label="Selected LIBERO-Pro perturbation examples"><div class="collage-canvas">${collageIds.map(id=>{const p=catalogue.perturbations.find(item=>item.id===id);return `<div class="collage-card"><img src="${p.image}" alt="${escape(p.id+' '+p.name)}" width="1760" height="510"></div>`;}).join('')}<div class="collage-tint" aria-hidden="true"></div><figcaption><span>LIBERO-Pro</span><small>Static shifts · Runtime interventions</small></figcaption></div></figure>`;
  return `<section class="home-showcase" aria-label="Benchmark highlights" aria-roledescription="carousel">
    <div class="showcase-stage">
      <article class="showcase-slide is-active" role="group" aria-roledescription="slide" aria-label="1 of 3: LIBERO-Pro">
        ${collage}<div class="showcase-copy"><h1>LIBERO-Pro</h1><p class="showcase-subtitle">A Benchmark for Evaluating Robust Embodied Intelligence</p><p>Static distribution shifts. Runtime interventions. The same task goal.</p><a class="button" href="docs.html#protocol">Explore the benchmark <span aria-hidden="true">↗</span></a></div>
      </article>
      <article class="showcase-slide showcase-static" role="group" aria-roledescription="slide" aria-label="2 of 3: Static shifts" aria-hidden="true" inert>
        <div class="showcase-copy"><span class="mode static">22 static perturbations</span><h2>Before the<br>first action.</h2><p class="showcase-subtitle">Generalization under changed conditions</p><p>Layouts, appearance, sensing and robot configuration change at reset.</p><a class="button secondary" href="docs.html#static-perturbations">Explore static shifts <span aria-hidden="true">↗</span></a></div>
        <div class="showcase-examples">${['S01','S13','S22'].map(example).join('')}</div>
      </article>
      <article class="showcase-slide showcase-dynamic" role="group" aria-roledescription="slide" aria-label="3 of 3: Dynamic interventions" aria-hidden="true" inert>
        <div class="showcase-copy"><span class="mode dynamic">20 dynamic perturbations</span><h2>When the<br>scene changes.</h2><p class="showcase-subtitle">Adaptation during execution</p><p>Task-triggered interventions test recovery during approach, grasp, transport and placement.</p><a class="button secondary" href="docs.html#dynamic-perturbations">Explore dynamic shifts <span aria-hidden="true">↗</span></a></div>
        <div class="showcase-examples">${['D01','D04','D18'].map(example).join('')}</div>
      </article>
    </div>
    <div class="showcase-controls"><button class="round-control" data-slide-step="-1" aria-label="Previous highlight">‹</button><div class="slide-dots" role="group" aria-label="Choose highlight">${['LIBERO-Pro','Static shifts','Dynamic interventions'].map((label,i)=>`<button data-slide="${i}" aria-label="Show ${label}" aria-pressed="${i===0}"><span></span></button>`).join('')}</div><button class="round-control" data-slide-step="1" aria-label="Next highlight">›</button><span class="slide-count" aria-live="off">1 / 3</span></div>
    <p class="sr-only" data-slide-status aria-live="polite"></p>
  </section>`;
}

export function homeGallery(catalogue, mode, media) {
  const entries = catalogue.perturbations.filter(p=>p.mode===mode);
  const card = (p, duplicate) => {
    const clip = media.clips.find(c=>c.perturbation===p.id);
    return `<a class="gallery-item" href="docs.html?perturbation=${p.id}" ${duplicate?'tabindex="-1"':''} aria-label="${p.id}: ${escape(p.name)} — open perturbation design"><video class="gallery-video" data-src="${escape(clip.src)}" poster="${escape(clip.poster)}" width="256" height="256" muted loop playsinline preload="none" aria-hidden="true" disablepictureinpicture></video></a>`;
  };
  // Keep each perturbation once in the reading order. Two visual copies cover
  // the full viewport through the seam even for the shortest six-card row.
  let offset = 0;
  const rows = Array.from({length:3}, (_,i)=>{
    const count = Math.ceil((entries.length-offset)/(3-i));
    const items = entries.slice(offset,offset+count);offset+=count;
    return `<div class="gallery-viewport" data-gallery-row data-direction="${i===1?'left':'right'}" tabindex="0" role="region" aria-label="${mode} examples, row ${i+1}, scroll to explore"><div class="gallery-track">${[false,true,true].map(duplicate=>`<div class="gallery-group" ${duplicate?'aria-hidden="true"':''}>${items.map(p=>card(p,duplicate)).join('')}</div>`).join('')}</div></div>`;
  }).join('');
  return `<section class="section gallery-section" id="${mode}-gallery" data-gallery="${mode}"><div class="section-head"><h2>${mode==='static'?'Static shifts':'Dynamic interventions'}</h2></div><div class="gallery-rows">${rows}</div><a class="text-link gallery-all" href="docs.html#${mode}-perturbations">View all ${entries.length} ${mode} perturbations ↗</a></section>`;
}

export function homeModels(models, upcoming, assets, modelUrl) {
  const tested = [...models].sort((a,b)=>(b.scores.overall??-1)-(a.scores.overall??-1));
  const planned = upcoming.filter(model=>!models.some(tested=>tested.id===model.id));
  const label = model => {
    const asset = assets[model.id];
    const image = asset.asset ? `<img src="assets/models/${escape(asset.asset)}" width="32" height="32" alt="" aria-hidden="true" title="${escape(asset.credit)}" loading="lazy">` : '<span class="home-model-logo-pending" aria-hidden="true"></span>';
    return `${image}<span>${escape(model.name)}</span>`;
  };
  return `<section class="section home-models" id="models">
    <div class="section-head"><h2 id="tested-models-heading">Tested models</h2><span class="count-label">${tested.length} models</span></div>
    <ul class="home-model-list" aria-labelledby="tested-models-heading">${tested.map(model=>`<li><a class="home-model-chip" href="${modelUrl(model)}">${label(model)}</a></li>`).join('')}</ul>
    <div class="home-models-upcoming"><h3 id="upcoming-models-heading">Upcoming models</h3>
      ${planned.length?`<ul class="home-model-list" aria-labelledby="upcoming-models-heading">${planned.map(model=>`<li><span class="home-model-chip is-upcoming">${label(model)}</span></li>`).join('')}</ul>`:'<p class="home-models-empty">To be announced.</p>'}
    </div>
  </section>`;
}

export function bindHomePresentation() {
  if (!document.querySelector('.home-showcase')) return;
  const copy = document.querySelector('[data-copy-citation]');
  copy?.addEventListener('click', async () => {
    const text = document.querySelector('.citation-code code')?.textContent.trim();
    if (!text) return;
    const status = document.querySelector('[data-copy-status]');
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
      status.textContent = 'Citation copied to clipboard.';
      setTimeout(() => { copy.textContent = 'Copy'; status.textContent = ''; }, 2500);
    } catch {
      status.classList.remove('sr-only');
      status.classList.add('caption');
      status.textContent = 'Select the citation text and copy it manually.';
    }
  });

  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  // Content remains visible if motion is disabled or observation is unavailable.
  if (preference.matches || !('IntersectionObserver' in window)) return;
  const blocks = [...document.querySelectorAll('#content > .section, .paper-intro > h2, .paper-meta')];
  const reveal = block => { block.classList.add('is-revealed'); observer.unobserve(block); };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
  }, {rootMargin: '0px 0px -40px 0px', threshold: 0});
  for (const block of blocks) {
    block.classList.add('home-reveal');
    observer.observe(block);
  }
  // Keyboard focus must never land on transparent content.
  document.querySelector('#content').addEventListener('focusin', event => {
    const block = event.target.closest('.home-reveal');
    if (block) reveal(block);
  });
  preference.addEventListener('change', event => {
    if (event.matches) { blocks.forEach(reveal); observer.disconnect(); }
  });
}

export function bindHomeMotion() {
  const root = document.querySelector('.home-showcase');
  if (!root) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const slides = [...root.querySelectorAll('.showcase-slide')];
  const dots = [...root.querySelectorAll('[data-slide]')];
  let current = 0, elapsed = 0, last = 0;
  const galleries = [...document.querySelectorAll('[data-gallery]')].map(section => ({
    rows: [...section.querySelectorAll('[data-gallery-row]')].map(view=>({view, visible:false, position:0, span:0, holdUntil:0})),
    videos: [...section.querySelectorAll('video')].map(video=>({video, visible:false, requested:false}))
  }));
  const syncVideos = () => {
    for (const gallery of galleries) for (const item of gallery.videos) {
      const play = item.visible && !preference.matches && !document.hidden;
      if (play && !item.requested) {
        item.requested=true;
        if (!item.video.getAttribute('src')) item.video.src=item.video.dataset.src;
        item.video.muted=true;
        item.video.play()?.catch(()=>{item.requested=false;});
      } else if (!play && item.requested) {
        item.requested=false;item.video.pause();
      }
    }
  };
  const show = (index, manual = false) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===current);slide.inert=i!==current;slide.setAttribute('aria-hidden',String(i!==current));});
    dots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===current)));
    root.querySelector('.slide-count').textContent = `${current+1} / ${slides.length}`;
    if (manual) root.querySelector('[data-slide-status]').textContent = slides[current].getAttribute('aria-label');
    elapsed = 0;
  };
  dots.forEach(dot=>dot.addEventListener('click',()=>show(Number(dot.dataset.slide),true)));
  root.querySelectorAll('[data-slide-step]').forEach(button=>button.addEventListener('click',()=>show(current+Number(button.dataset.slideStep),true)));
  root.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();show(current+(event.key==='ArrowRight'?1:-1),true);
  });
  const rows=galleries.flatMap(g=>g.rows), videos=galleries.flatMap(g=>g.videos);
  const observer = new IntersectionObserver(entries=>{
    for (const entry of entries) {
      const row=rows.find(r=>r.view===entry.target);
      if(row)row.visible=entry.isIntersecting;
      const item=videos.find(v=>v.video===entry.target);
      if(item)item.visible=entry.isIntersecting;
    }
    syncVideos();
  },{threshold:0});
  const measure = row => {
    const span=row.view.querySelector('.gallery-group').getBoundingClientRect().width;
    if(!span)return;
    row.position=row.span?row.position/row.span*span:(row.view.dataset.direction==='right'?span:0);
    row.span=span;row.view.scrollLeft=row.position;
  };
  const resize=new ResizeObserver(entries=>entries.forEach(entry=>measure(rows.find(r=>r.view===entry.target))));
  for (const gallery of galleries) {
    gallery.videos.forEach(item=>observer.observe(item.video));
    for(const row of gallery.rows) {
      measure(row);observer.observe(row.view);resize.observe(row.view);
      // Hold only the row being browsed, then resume automatically. Videos
      // keep playing; vertical page scrolling does not interrupt either loop.
      const hold=()=>{row.holdUntil=performance.now()+1800;};
      row.view.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key))hold();});
      row.view.addEventListener('wheel',event=>{if(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))hold();},{passive:true});
      let gesture=null;
      row.view.addEventListener('pointerdown',event=>{gesture={x:event.clientX,y:event.clientY};},{passive:true});
      row.view.addEventListener('pointermove',event=>{
        if(gesture&&Math.abs(event.clientX-gesture.x)>12&&Math.abs(event.clientX-gesture.x)>Math.abs(event.clientY-gesture.y))hold();
      },{passive:true});
      for(const event of ['pointerup','pointercancel','pointerleave'])row.view.addEventListener(event,()=>{gesture=null;},{passive:true});
    }
  }
  document.addEventListener('visibilitychange',syncVideos);
  preference.addEventListener('change',()=>{elapsed=0;syncVideos();});
  const tick = now => {
    const dt = last ? Math.min(now-last,100) : 0;last=now;
    if (!document.hidden) {
      const bounds=root.getBoundingClientRect();
      if (!preference.matches && bounds.bottom>0 && bounds.top<innerHeight && !root.matches(':hover,:focus-within')) {
        elapsed+=dt;if(elapsed>=6500)show(current+1);
      }
      for (const gallery of galleries) {
        for(const row of gallery.rows) {
          if(preference.matches||!row.visible||now<row.holdUntil||row.view.matches(':hover,:focus-within')){row.position=row.view.scrollLeft;continue;}
          if(!row.span)continue;
          row.position+=dt*.022*(row.view.dataset.direction==='right'?-1:1);
          row.position=(row.position+row.span)%row.span;
          row.view.scrollLeft=row.position;
        }
      }
    }
    requestAnimationFrame(tick);
  };
  syncVideos();requestAnimationFrame(tick);
}
