const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function homeShowcase(catalogue) {
  const example = id => {
    const p = catalogue.perturbations.find(item => item.id === id);
    return `<a class="hero-example" href="docs.html?perturbation=${id}"><img src="${p.image}" alt="${escape(p.name)} — paper mechanism illustration" width="1760" height="510"><span>${id} · ${escape(p.name)}</span></a>`;
  };
  return `<section class="home-showcase" aria-label="Benchmark highlights" aria-roledescription="carousel">
    <div class="showcase-stage">
      <article class="showcase-slide is-active" role="group" aria-roledescription="slide" aria-label="1 of 3: LIBERO-Pro">
        <div class="showcase-copy"><h1>LIBERO-Pro</h1><p class="showcase-subtitle">A Benchmark for Evaluating Robust Embodied Intelligence</p><p>Static distribution shifts. Runtime interventions. The same task goal.</p><a class="button" href="#benchmark">Explore the benchmark <span aria-hidden="true">↗</span></a></div>
        <figure class="showcase-overview"><img src="assets/paper/overview.webp" width="2000" height="1125" alt="LIBERO-Pro: 22 static and 20 dynamic perturbations across six domains"><figcaption>42 perturbations · 6 domains · 8 evaluation tasks</figcaption></figure>
      </article>
      <article class="showcase-slide" role="group" aria-roledescription="slide" aria-label="2 of 3: Static shifts" aria-hidden="true" inert>
        <div class="showcase-copy"><span class="mode static">22 static perturbations</span><h2>Before the<br>first action.</h2><p class="showcase-subtitle">Generalization under changed conditions</p><p>Layouts, appearance, sensing and robot configuration change at reset.</p><a class="button secondary" href="tasks.html?mode=static">Explore static shifts <span aria-hidden="true">↗</span></a></div>
        <div class="showcase-examples">${['S01','S13','S22'].map(example).join('')}</div>
      </article>
      <article class="showcase-slide" role="group" aria-roledescription="slide" aria-label="3 of 3: Dynamic interventions" aria-hidden="true" inert>
        <div class="showcase-copy"><span class="mode dynamic">20 dynamic perturbations</span><h2>When the<br>scene changes.</h2><p class="showcase-subtitle">Adaptation during execution</p><p>Task-triggered interventions test recovery during approach, grasp, transport and placement.</p><a class="button secondary" href="tasks.html?mode=dynamic">Explore dynamic shifts <span aria-hidden="true">↗</span></a></div>
        <div class="showcase-examples">${['D01','D04','D18'].map(example).join('')}</div>
      </article>
    </div>
    <div class="showcase-controls"><button class="round-control" data-slide-step="-1" aria-label="Previous highlight">‹</button><div class="slide-dots" role="group" aria-label="Choose highlight">${['LIBERO-Pro','Static shifts','Dynamic interventions'].map((label,i)=>`<button data-slide="${i}" aria-label="Show ${label}" aria-pressed="${i===0}"><span></span></button>`).join('')}</div><button class="round-control" data-slide-step="1" aria-label="Next highlight">›</button><span class="slide-count" aria-live="off">1 / 3</span><button class="motion-control" data-carousel-pause aria-pressed="false">Pause slideshow</button></div>
    <p class="sr-only" data-slide-status aria-live="polite"></p>
  </section>`;
}

export function homeGallery(catalogue, mode) {
  const entries = catalogue.perturbations.filter(p=>p.mode===mode);
  return `<section class="section gallery-section" id="${mode}-gallery"><div class="section-head"><div><h2>${mode==='static'?'Static shifts':'Dynamic interventions'}</h2><p class="caption">${entries.length} paper mechanism illustrations · open any example for its design and task gallery</p></div><button class="motion-control" data-gallery-toggle="${mode}" aria-pressed="false">Pause gallery</button></div><div class="gallery-viewport" data-gallery="${mode}" tabindex="0" role="region" aria-label="${mode} perturbation examples, horizontally scrollable"><div class="gallery-track">${entries.map(p=>`<a class="gallery-item" href="docs.html?perturbation=${p.id}"><img src="${p.image}" width="1760" height="510" alt="${escape(p.name)} mechanism" loading="lazy"><span><small>${p.id}</small>${escape(p.name)}<span aria-hidden="true">↗</span></span></a>`).join('')}</div></div><a class="text-link gallery-all" href="tasks.html?mode=${mode}">View all ${entries.length} ${mode} perturbations ↗</a></section>`;
}

export function bindHomeMotion() {
  const root = document.querySelector('.home-showcase');
  if (!root) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const slides = [...root.querySelectorAll('.showcase-slide')];
  const dots = [...root.querySelectorAll('[data-slide]')];
  const pause = root.querySelector('[data-carousel-pause]');
  let current = 0, stopped = preference.matches, elapsed = 0, last = 0;
  const galleries = [...document.querySelectorAll('[data-gallery]')].map(view => ({
    view, button: document.querySelector(`[data-gallery-toggle="${view.dataset.gallery}"]`), stopped: preference.matches,
    visible: false, position: 0
  }));
  const show = (index, manual = false) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===current);slide.inert=i!==current;slide.setAttribute('aria-hidden',String(i!==current));});
    dots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===current)));
    root.querySelector('.slide-count').textContent = `${current+1} / ${slides.length}`;
    if (manual) root.querySelector('[data-slide-status]').textContent = slides[current].getAttribute('aria-label');
    elapsed = 0;
  };
  const sync = () => {
    pause.textContent = stopped ? 'Play slideshow' : 'Pause slideshow';
    pause.setAttribute('aria-pressed',String(stopped));
    for (const gallery of galleries) {
      gallery.button.textContent = gallery.stopped ? 'Play gallery' : 'Pause gallery';
      gallery.button.setAttribute('aria-pressed',String(gallery.stopped));
    }
  };
  dots.forEach(dot=>dot.addEventListener('click',()=>{stopped=true;show(Number(dot.dataset.slide),true);sync();}));
  root.querySelectorAll('[data-slide-step]').forEach(button=>button.addEventListener('click',()=>{stopped=true;show(current+Number(button.dataset.slideStep),true);sync();}));
  pause.addEventListener('click',()=>{stopped=!stopped;elapsed=0;sync();});
  root.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();stopped=true;show(current+(event.key==='ArrowRight'?1:-1),true);sync();
  });
  const observer = new IntersectionObserver(entries=>entries.forEach(entry=>{
    const gallery=galleries.find(g=>g.view===entry.target);if(gallery)gallery.visible=entry.isIntersecting;
  }),{threshold:0.15});
  for (const gallery of galleries) {
    observer.observe(gallery.view);
    gallery.button.addEventListener('click',()=>{gallery.stopped=!gallery.stopped;gallery.position=gallery.view.scrollLeft;sync();});
    // A touch, keyboard or wheel interaction hands scrolling to the visitor.
    for (const event of ['pointerdown','keydown','wheel']) gallery.view.addEventListener(event,()=>{gallery.stopped=true;sync();},{passive:true});
  }
  preference.addEventListener('change',()=>{if(preference.matches){stopped=true;galleries.forEach(g=>g.stopped=true);sync();}});
  const tick = now => {
    const dt = last ? Math.min(now-last,100) : 0;last=now;
    if (!document.hidden) {
      const bounds=root.getBoundingClientRect();
      if (!stopped && bounds.bottom>0 && bounds.top<innerHeight && !root.matches(':hover,:focus-within')) {
        elapsed+=dt;if(elapsed>=6500)show(current+1);
      }
      for (const gallery of galleries) {
        if(gallery.stopped||!gallery.visible||gallery.view.matches(':hover,:focus-within')){gallery.position=gallery.view.scrollLeft;continue;}
        const maximum=gallery.view.scrollWidth-gallery.view.clientWidth;
        if(maximum<=0)continue;
        gallery.position+=dt*0.026;
        if(gallery.position>=maximum)gallery.position=0;
        gallery.view.scrollLeft=gallery.position;
      }
    }
    requestAnimationFrame(tick);
  };
  sync();requestAnimationFrame(tick);
}
