// Autoplay every visible rollout, while keeping user pauses and off-screen media quiet.
let release=()=>{};
const preferences=new WeakMap();

export function bindRolloutPlayers() {
  release();
  const videos=[...document.querySelectorAll('video[data-rollout]')];
  if(!videos.length)return;
  const controller=new AbortController();
  const options={signal:controller.signal};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const players=new Map(videos.map(video=>{
    if(!preferences.has(video)){
      preferences.set(video,{userPaused:false});
      video.defaultPlaybackRate=2;
      video.playbackRate=2;
    }
    return [video,{visible:false,pending:false,managedPauses:0,preference:preferences.get(video)}];
  }));
  const pause=video=>{
    if(!video.paused){players.get(video).managedPauses++;video.pause();}
  };
  const sync=video=>{
    if(controller.signal.aborted||!video.isConnected)return;
    const player=players.get(video);
    if(!player.visible||document.hidden||reducedMotion.matches||video.hidden){pause(video);return;}
    if(player.preference.userPaused||player.pending||!video.paused)return;
    video.muted=true;
    player.pending=true;
    let interrupted=false;
    video.play().catch(error=>{interrupted=error.name==='AbortError';}).finally(()=>{
      player.pending=false;
      // Scrolling out and back can interrupt a play request before it settles.
      if(interrupted)sync(video);
    });
  };
  const syncAll=()=>videos.forEach(sync);
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      players.get(entry.target).visible=entry.isIntersecting;
      sync(entry.target);
    }
  },{threshold:0});
  const pauseAll=()=>videos.forEach(pause);
  for(const video of videos){
    observer.observe(video);
    video.addEventListener('play',()=>{
      players.get(video).preference.userPaused=false;
    },options);
    video.addEventListener('pause',()=>{
      const player=players.get(video);
      if(player.managedPauses)player.managedPauses--;
      else player.preference.userPaused=true;
    },options);
    video.addEventListener('canplay',()=>sync(video),options);
    const failed=()=>{
      pause(video);video.hidden=true;
      video.parentElement.querySelector('.rollout-error').hidden=false;
    };
    video.addEventListener('error',failed,options);
    video.querySelector('source').addEventListener('error',failed,options);
  }
  document.addEventListener('visibilitychange',syncAll,options);
  reducedMotion.addEventListener('change',syncAll,options);
  window.addEventListener('pagehide',pauseAll,options);
  window.addEventListener('pageshow',syncAll,options);
  release=()=>{
    observer.disconnect();controller.abort();
    for(const video of videos)if(!video.isConnected){
      video.pause();video.removeAttribute('src');
      video.querySelectorAll('source').forEach(source=>source.removeAttribute('src'));
      video.load();
    }
    release=()=>{};
  };
}
