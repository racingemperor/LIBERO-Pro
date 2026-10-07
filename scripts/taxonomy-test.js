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
let initialDocument,initialHistory;
const tests=[
  ['All 42 horizontal codes match the six published domain groups',async()=>{
    await waitFor(()=>q('[data-ring-task="S01"]'));
    initialDocument=doc();initialHistory=win().history.length;
    const catalogue=await fetch('../data/catalogue.json').then(r=>r.json());
    assert(all('[data-ring-task]').length===42,'Missing or duplicate perturbations');
    for(const category of catalogue.categories){
      const group=q(`[data-ring-domain="${category.id}"]`);
      const actual=[...group.querySelectorAll('[data-ring-task]')].map(a=>a.dataset.ringTask).sort();
      assert(JSON.stringify(actual)===JSON.stringify([...category.static,...category.dynamic].sort()),`Incorrect ${category.id} membership`);
    }
    for(const label of all('.taxonomy-task text').filter(el=>win().getComputedStyle(el).display!=='none')){
      const matrix=label.getCTM();assert(Math.abs(matrix.b)<.001&&Math.abs(matrix.c)<.001,'A code is rotated');
    }
  }],
  ['Each side description lifts the matching sector without navigation or layout shift',async()=>{
    const bounds=q('.taxonomy-ring').getBoundingClientRect();
    for(const card of all('.home-domain')){
      const id=card.dataset.homeDomain;
      pointer(`[data-home-domain="${id}"]`);
      await waitFor(()=>q('.taxonomy-domain.is-active')?.dataset.ringDomain===id);
      if(!win().matchMedia('(prefers-reduced-motion: reduce)').matches){
        await waitFor(()=>Math.abs(new (win().DOMMatrix)(win().getComputedStyle(q(`[data-ring-domain="${id}"] .taxonomy-lift`)).transform).e)>1);
      }
      assert(all('.taxonomy-domain.is-active').length===1,'More than one domain lifted');
      assert(q('.taxonomy-ring').getBoundingClientRect().width===bounds.width,'Chart layout changed');
    }
    assert(doc()===initialDocument&&win().history.length===initialHistory,'Hover navigated or added history');
    reset();
  }],
  ['Perturbation hover exposes the full name; fixed hit area prevents lost selection',async()=>{
    pointer('[data-ring-task="D13"]');
    assert(q('[data-taxonomy-value]').textContent==='D13','Wrong hovered code');
    assert(q('[data-taxonomy-name]').textContent==='Arm–gripper desynchronization','Missing full name');
    pointer('[data-ring-domain="observation"] .taxonomy-hit');
    assert(q('.taxonomy-domain.is-active')?.dataset.ringDomain==='observation','Selection flickered at original hit area');
    pointer('.home-domains','pointerleave');
    assert(!q('.taxonomy-domain.is-active'),'Hover did not reset after leaving');
    click('[data-ring-domain="observation"] .taxonomy-hit');
    assert(q('[data-domain-preview="observation"]').getAttribute('aria-pressed')==='true','Original hit area could not pin a raised sector');
    reset();
  }],
  ['Keyboard and touch can pin, switch and clear a domain preview',async()=>{
    q('[data-domain-preview="condition"]').focus();key('[data-domain-preview="condition"]','Enter');
    pointer('.home-domains','pointerleave');
    assert(q('[data-domain-preview="condition"]').getAttribute('aria-pressed')==='true','Enter did not pin');
    pointer('[data-domain-preview="robot"]','pointerover','touch');click('[data-domain-preview="robot"]');
    assert(q('.taxonomy-domain.is-active')?.dataset.ringDomain==='robot','Tap did not switch domain');
    assert(q('[data-domain-preview="condition"]').getAttribute('aria-pressed')==='false','Previous pin not cleared');
    key('[data-domain-preview="robot"]',' ');
    assert(!q('.taxonomy-domain.is-active'),'Space did not toggle preview off');
    q('[data-ring-task="S06"]').focus();
    assert(q('[data-taxonomy-name]').textContent==='Instance replacement','Keyboard focus lacks task name');
    reset();assert(!q('.taxonomy-domain.is-active'),'Escape did not clear preview');
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
      for(const el of [q('[data-ring-domain="condition"] .taxonomy-lift'),q('[data-ring-task="S01"]')]){
        const computed=win().getComputedStyle(el);
        assert(computed.transform==='none'&&computed.transitionDuration==='0s','Reduced motion still moves the chart');
      }
      assert(q('.taxonomy-domain.is-active')&&q('[data-taxonomy-value]').textContent==='S01','Reduced motion removed preview content');
    }finally{reset();style.remove();}
  }],
  ['Clicking an SVG code opens its design with all eight tasks and 42 documents available',async()=>{
    click('[data-ring-task="S06"]');
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
