// Galleries are click-to-play. Keep detached, off-screen and background media quiet.
let release=()=>{};

export function bindRolloutPlayers() {
  release();
  const videos=[...document.querySelectorAll('video[data-rollout]')];
  if(!videos.length)return;
  const controller=new AbortController();
  const options={signal:controller.signal};
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries)if(!entry.isIntersecting)entry.target.pause();
  },{threshold:0});
  const pauseAll=()=>videos.forEach(video=>video.pause());
  for(const video of videos){
    observer.observe(video);
    video.addEventListener('play',()=>{
      for(const other of videos)if(other!==video)other.pause();
    },options);
    const failed=()=>{
      video.pause();video.hidden=true;
      video.parentElement.querySelector('.rollout-error').hidden=false;
    };
    video.addEventListener('error',failed,options);
    video.querySelector('source').addEventListener('error',failed,options);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAll();},options);
  window.addEventListener('pagehide',pauseAll,options);
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
