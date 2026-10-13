// Keep media locations explicit; only NORA is hosted in the companion repository.
export function rolloutMediaPaths(model, task, variant) {
  if(typeof model!=='string'||!/^[a-z0-9-]+$/.test(model)||
     typeof task!=='string'||!/^libero_(spatial|object|goal|10)-\d+$/.test(task)||
     typeof variant!=='string'||!/^(BASE|[SD]\d{2})$/.test(variant))return null;
  const base=model==='nora'?'https://racingemperor.github.io/LIBERO-Pro-media/':'';
  const stem=`${base}assets/rollouts/models/${model}/${task}/${variant}`;
  return {src:stem+'.mp4',poster:stem+'.webp'};
}
