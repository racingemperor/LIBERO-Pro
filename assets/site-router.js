// Keep real HTML URLs (including GitHub Pages subpaths) and native browser history.
const base = new URL('../', import.meta.url);
const pages = new Set(['index','docs','leaderboard','model','perturbation','task','findings','report','community']);
const scrollSelectors = ['.table-scroll','.docs-sidebar','.catalogue-nav','.home-news-scroll'];
const stateKey = 'liberoNavigation';

export function siteRoute(value) {
  const next = new URL(value, location.href);
  if(next.origin!==base.origin||!next.pathname.startsWith(base.pathname))return null;
  const file=next.pathname.slice(base.pathname.length)||'index.html';
  const page=file.endsWith('.html')?file.slice(0,-5):null;
  return pages.has(page)?{page,url:next}:null;
}

export function isSiteLink(event,link) {
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return false;
  const target=link.getAttribute('target');
  return !link.hasAttribute('download')&&(!target||target==='_self')&&!!siteRoute(new URL(link.getAttribute('href'),link.baseURI||location.href));
}

function capturePosition() {
  return {
    left:scrollX,top:scrollY,
    containers:scrollSelectors.flatMap(selector=>[...document.querySelectorAll(selector)].map((node,index)=>({selector,index,left:node.scrollLeft,top:node.scrollTop}))),
    details:[...document.querySelectorAll('#app details')].map(node=>node.open)
  };
}

function restorePosition(position) {
  position.details?.forEach((open,index)=>{const node=document.querySelectorAll('#app details')[index];if(node)node.open=open;});
  for(const item of position.containers||[]){
    const node=document.querySelectorAll(item.selector)[item.index];
    node?.scrollTo({left:item.left,top:item.top,behavior:'instant'});
  }
  window.scrollTo({left:position.left,top:position.top,behavior:'instant'});
}

export function createSiteRouter({prepare,render,anchor}) {
  let revision=0,renderedURL=location.href,scheduled=0;
  const app=document.querySelector('#app');
  const status=()=>document.querySelector('#view-status');
  history.scrollRestoration='manual';
  function remember() {
    // During popstate the URL already belongs to the destination entry.
    if(location.href!==renderedURL)return;
    history.replaceState({...history.state,[stateKey]:{...capturePosition(),entry:history.state?.[stateKey]?.entry||crypto.randomUUID()}},'',location.href);
  }
  function cancel() {
    revision++;app.removeAttribute('aria-busy');
  }
  function updated() {
    renderedURL=location.href;remember();
  }
  async function navigate(value,{pop=false,position=null,replace=false}={}) {
    const route=siteRoute(value);
    if(!route)return;
    const ticket=++revision;
    app.setAttribute('aria-busy','true');
    if(status())status().textContent='Loading page…';
    try {
      const data=await prepare(route);
      if(ticket!==revision)return;
      if(!pop){
        remember();
        history[replace?'replaceState':'pushState']({[stateKey]:{entry:crypto.randomUUID()}},'',route.url);
      }
      render(route,data);
      renderedURL=location.href;
      const heading=document.querySelector('#content h1')||document.querySelector('#content');
      heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
      const place=()=>{
        if(ticket!==revision)return;
        if(position)restorePosition(position);
        else {window.scrollTo({top:0,left:0,behavior:'instant'});anchor(route.url.hash);}
      };
      place();
      // ResizeObservers finish chart/directory layout before restoring nested scroll.
      requestAnimationFrame(()=>{place();remember();});
      if(status())status().textContent=`${document.title} loaded.`;
      return true;
    } catch(error) {
      if(ticket!==revision)return;
      console.error(error);
      if(status())status().textContent='Page could not be loaded. Please try again.';
      if(pop)history.replaceState(history.state,'',renderedURL);
      return false;
    } finally {
      if(ticket===revision)app.removeAttribute('aria-busy');
    }
  }
  window.addEventListener('popstate',event=>navigate(location.href,{pop:true,position:event.state?.[stateKey]||{left:0,top:0}}));
  document.addEventListener('scroll',event=>{
    if(event.target!==document&&!scrollSelectors.some(selector=>event.target.matches?.(selector)))return;
    if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;remember();});
  },{capture:true,passive:true});
  window.addEventListener('pagehide',remember);
  remember();
  return {navigate,cancel,updated};
}
