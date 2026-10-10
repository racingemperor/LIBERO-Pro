// Exercise the real Home DOM without requiring a test runner or external dependencies.
const frame=document.querySelector('iframe');
const width=Number(new URLSearchParams(location.search).get('width'))||1200;
frame.style.width=`${width}px`;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const waitFor=async predicate=>{
  const deadline=Date.now()+8000;
  while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,30));}
  throw new Error('Timed out waiting for taxonomy interaction');
};
const doc=()=>frame.contentDocument,win=()=>frame.contentWindow,q=selector=>doc().querySelector(selector);
const all=selector=>[...doc().querySelectorAll(selector)];
const pointer=(selector,type='pointerover',pointerType='mouse')=>q(selector).dispatchEvent(new (win().PointerEvent)(type,{bubbles:true,pointerType}));
const key=(selector,key)=>q(selector).dispatchEvent(new (win().KeyboardEvent)('keydown',{bubbles:true,key}));
const click=selector=>q(selector).dispatchEvent(new (win().MouseEvent)('click',{bubbles:true,button:0}));
const reset=()=>{doc().activeElement?.blur();key('.home-domains','Escape');};
const expectedOrder=[...Array.from({length:22},(_,i)=>`S${String(i+1).padStart(2,'0')}`),...Array.from({length:20},(_,i)=>`D${String(i+1).padStart(2,'0')}`)];
const codeOrder=()=>all('[data-ring-task]').map(link=>link.dataset.ringTask);
let initialDocument,initialHistory;
const tests=[
  ['The continuous ring runs clockwise S01–S22, then D01–D20, with horizontal labels',async()=>{
    await waitFor(()=>q('[data-ring-task="S01"]'));
    initialDocument=doc();initialHistory=win().history.length;
    const catalogue=await fetch('../data/catalogue.json').then(r=>r.json());
    assert(JSON.stringify(codeOrder())===JSON.stringify(expectedOrder),'Public ID order changed');
    assert(!q('.taxonomy-domain,.taxonomy-sector,[data-domain-preview]'),'Grouped category sectors remain');
    for(const category of catalogue.categories){
      const actual=all(`[data-ring-domain="${category.id}"]`).map(a=>a.dataset.ringTask).sort();
      assert(JSON.stringify(actual)===JSON.stringify([...category.static,...category.dynamic].sort()),`Incorrect ${category.id} membership`);
    }
    let lastAngle=-1;
    for(const label of all('.taxonomy-task text').filter(el=>win().getComputedStyle(el).display!=='none')){
      const matrix=label.getCTM();assert(Math.abs(matrix.b)<.001&&Math.abs(matrix.c)<.001,'A code is rotated');
      const angle=(Math.atan2(Number(label.getAttribute('y')),Number(label.getAttribute('x')))*180/Math.PI+450)%360;
      assert(angle>lastAngle,'Visual clockwise order differs from public ID order');lastAngle=angle;
    }
  }],
  ['Domain previews lift matching codes without grouping, reordering or navigation',async()=>{
    const bounds=q('.taxonomy-ring').getBoundingClientRect();
    for(const card of all('.home-domain')){
      const id=card.dataset.homeDomain;
      pointer(`[data-home-domain="${id}"]`);
      const matching=all(`[data-ring-domain="${id}"]`);
      await waitFor(()=>matching.every(link=>link.classList.contains('is-active')));
      if(!win().matchMedia('(prefers-reduced-motion: reduce)').matches){
        await waitFor(()=>{
          const matrix=new (win().DOMMatrix)(win().getComputedStyle(matching[0].querySelector('.taxonomy-lift')).transform);
          return Math.hypot(matrix.e,matrix.f)>5;
        });
      }
      assert(all('.taxonomy-task.is-active').length===matching.length,'Unrelated codes lifted');
      assert(JSON.stringify(codeOrder())===JSON.stringify(expectedOrder),'Preview reordered the codes');
      assert(q('.taxonomy-ring').getBoundingClientRect().width===bounds.width,'Chart layout changed');
    }
    assert(doc()===initialDocument&&win().history.length===initialHistory,'Hover navigated or added history');
    reset();
  }],
  ['Perturbation hover exposes the full name; fixed hit area prevents lost selection',async()=>{
    pointer('[data-ring-task="D13"]');
    assert(q('[data-taxonomy-value]').textContent==='D13','Wrong hovered code');
    assert(q('[data-taxonomy-name]').textContent==='Arm–gripper desynchronization','Missing full name');
    assert(all('.taxonomy-task.is-active').length===1,'Individual hover lifts unrelated codes');
    pointer('[data-ring-task="D13"] .taxonomy-hit');
    assert(q('.taxonomy-task.is-active')?.dataset.ringTask==='D13','Selection flickered at original hit area');
    pointer('.home-domains','pointerleave');
    assert(!q('.taxonomy-task.is-active'),'Hover did not reset after leaving');
    reset();
  }],
  ['Lifted domain faces stay above neighboring sectors, including Observation on the left',async()=>{
    q('.taxonomy-ring').scrollIntoView({block:'center'});
    for(const domain of ['observation','condition','environment','execution','robot','language']){
      pointer(`[data-home-domain="${domain}"]`);
      await new Promise(resolve=>setTimeout(resolve,320));
      for(const link of all('.taxonomy-task.is-active')){
        const face=link.querySelector('.taxonomy-face'),matrix=face.getScreenCTM();
        const index=expectedOrder.indexOf(link.dataset.ringTask);
        // Sample just inside both radial edges, where raised sectors used to be covered.
        for(const edge of [.45,360/42-.45])for(const radius of [190,215,245,265]){
          const angle=(-90+index*360/42+edge)*Math.PI/180;
          const local=new (win().DOMPoint)(radius*Math.cos(angle),radius*Math.sin(angle));
          assert(face.isPointInFill(local),'Probe is outside the face');
          const screen=local.matrixTransform(matrix);
          const top=doc().elementsFromPoint(screen.x,screen.y).find(el=>el.classList.contains('taxonomy-face')&&win().getComputedStyle(el.closest('.taxonomy-lift')).opacity!=='0')?.closest('[data-ring-task],[data-preview-task]');
          const code=top?.dataset.ringTask||top?.dataset.previewTask;
          assert(code===link.dataset.ringTask,`${domain}: ${link.dataset.ringTask} is covered by ${code||'another element'}`);
          const hit=doc().elementFromPoint(screen.x,screen.y)?.closest('a');
          assert(hit?.getAttribute('href')===link.getAttribute('href'),`${domain}: visible ${link.dataset.ringTask} clicks a neighboring code`);
        }
      }
      assert(JSON.stringify(codeOrder())===JSON.stringify(expectedOrder),'Preview changed keyboard link order');
    }
    reset();
  }],
  ['The inner ring has only Static 22 and Dynamic 20 aligned with the outer IDs',async()=>{
    assert(all('[data-ring-mode]').length===2,'Inner ring does not have exactly two parts');
    for(const [mode,count]of [['static',22],['dynamic',20]]){
      const selector=`[data-ring-mode="${mode}"]`;
      assert(q(selector).querySelector('.taxonomy-mode-count').textContent===String(count),'Wrong inner count');
      assert(q(selector).getAttribute('href')===`docs.html#${mode}-perturbations`,'Wrong inner ring destination');
      pointer(selector);
      assert(all('.taxonomy-task.is-active').length===count,'Inner preview highlights the wrong number of codes');
      assert(all('.taxonomy-task.is-active').every(link=>link.classList.contains(mode)),'Inner preview includes the other mode');
      assert(JSON.stringify(codeOrder())===JSON.stringify(expectedOrder),'Inner preview changed outer order');
    }
    reset();
  }],
  ['Keyboard focus previews categories and individual codes; touch does not leave a stale hover',async()=>{
    q('[data-home-domain="condition"]').focus();
    assert(all('.taxonomy-task.is-active').length===14,'Keyboard category preview misses codes');
    q('[data-ring-task="S06"]').focus();
    assert(q('[data-taxonomy-name]').textContent==='Instance replacement','Keyboard focus lacks task name');
    assert(all('.taxonomy-task.is-active').length===1,'Keyboard task preview lifts unrelated codes');
    reset();assert(!q('.taxonomy-task.is-active'),'Escape did not clear preview');
    pointer('[data-ring-task="D20"]','pointerover','touch');
    assert(!q('.taxonomy-task.is-active'),'Touch creates a stale hover preview');
  }],
  ['Visible labels do not overlap, and the page fits the viewport',async()=>{
    await waitFor(()=>all('.taxonomy-lift').every(el=>win().getComputedStyle(el).transform==='matrix(1, 0, 0, 1, 0, 0)'));
    const labels=all('.taxonomy-task text').filter(el=>win().getComputedStyle(el).display!=='none');
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
      const a=labels[i].getBoundingClientRect(),b=labels[j].getBoundingClientRect();
      assert(!(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top),`Overlapping ${labels[i].textContent}/${labels[j].textContent}`);
    }
    assert(doc().documentElement.scrollWidth<=win().innerWidth,'Horizontal page overflow');
  }],
  ['Reduced-motion chart styles keep the preview visible without displacement or animation',async()=>{
    const rules=[...doc().styleSheets].flatMap(sheet=>[...sheet.cssRules]);
    const reduced=rules.find(rule=>rule.conditionText==='(prefers-reduced-motion: reduce)'&&rule.cssText.includes('.taxonomy-lift'));
    assert(reduced,'Missing reduced-motion rules');
    // Apply the exact media block to verify its behavior without changing OS preferences.
    const style=doc().createElement('style');
    style.textContent=[...reduced.cssRules].map(rule=>rule.cssText).join('\n');
    doc().head.append(style);
    try{
      pointer('[data-ring-task="S01"]');
      const lift=win().getComputedStyle(q('[data-ring-task="S01"] .taxonomy-lift'));
      assert(lift.transform==='none'&&lift.transitionDuration==='0s','Reduced motion still moves the chart');
      assert(win().getComputedStyle(q('[data-ring-task="S01"] .taxonomy-face')).transitionDuration==='0s','Reduced motion still animates color');
      assert(q('.taxonomy-task.is-active')&&q('[data-taxonomy-value]').textContent==='S01','Reduced motion removed preview content');
    }finally{reset();style.remove();}
  }],
  ['Clicking an SVG code opens its design with all eight tasks and 42 documents available',async()=>{
    for(const mode of ['static','dynamic']){
      click(`[data-ring-mode="${mode}"]`);
      await waitFor(()=>q(`#${mode}-perturbations`));
      assert(win().location.hash===`#${mode}-perturbations`,'Inner ring did not locate the full index');
      assert(all('.docs-sidebar a[href*="perturbation="]').length===42,'Mode link filtered the directory');
      win().history.back();
      await waitFor(()=>q('[data-ring-task="S06"]'));
    }
    pointer('[data-ring-task="S06"]');
    await new Promise(resolve=>setTimeout(resolve,320));
    q('.taxonomy-ring').scrollIntoView({block:'center',behavior:'instant'});
    const face=q('[data-ring-task="S06"] .taxonomy-face'),index=expectedOrder.indexOf('S06');
    const angle=(-90+(index+.5)*360/42)*Math.PI/180;
    const screen=new (win().DOMPoint)(232*Math.cos(angle),232*Math.sin(angle)).matrixTransform(face.getScreenCTM());
    const hit=doc().elementFromPoint(screen.x,screen.y);
    assert(hit?.closest('a')?.getAttribute('href')==='docs.html?perturbation=S06','Raised face has the wrong click destination');
    hit.dispatchEvent(new (win().PointerEvent)('pointerdown',{bubbles:true,cancelable:true,pointerType:'mouse',button:0}));
    assert(doc().activeElement===q('[data-ring-task="S06"]'),'Raised face did not retain the original keyboard focus target');
    hit.dispatchEvent(new (win().MouseEvent)('click',{bubbles:true,button:0}));
    await waitFor(()=>q('h1')?.textContent==='Instance replacement');
    assert(win().location.search==='?perturbation=S06','Wrong document destination');
    assert(all('.docs-sidebar a[href*="perturbation="]').length===42,'Document was filtered');
    assert(all('.docs-sidebar a[href*="task="]').length===8,'Task directory was filtered');
  }]
];
let passed=0;
for(const [name,test]of tests){
  const row=document.createElement('li');
  try{await test();passed++;row.className='pass';row.textContent=`PASS: ${name}`;}
  catch(error){row.className='fail';row.textContent=`FAIL: ${name} — ${error.message}`;}
  document.querySelector('#results').append(row);
}
document.querySelector('#status').textContent=`${passed}/${tests.length} checks passed at ${width}px`;
