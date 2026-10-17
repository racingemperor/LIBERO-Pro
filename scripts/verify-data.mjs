import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {rolloutMediaPaths} from '../assets/rollout-media.js';
import {baseScore, summaryScore, deltaScore} from '../assets/scores.js';
const read = name => JSON.parse(fs.readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const {categories,perturbations}=read('catalogue');
const {models}=read('results');
const {tasks}=read('tasks');
const assets=read('model-assets');
const profiles=read('model-profiles');
const designs=read('task-designs').tasks;
const people=read('people');
const privateArg=process.argv.indexOf('--private-data');
assert(privateArg<0||process.argv[privateArg+1],'--private-data requires a directory');
const privateRoot=privateArg<0?null:path.resolve(process.argv[privateArg+1]);
const manifestArg=process.argv.indexOf('--task-manifest');
assert(manifestArg<0||process.argv[manifestArg+1],'--task-manifest requires a file');
const publishedTasks=manifestArg<0?null:JSON.parse(fs.readFileSync(process.argv[manifestArg+1],'utf8')).tasks;
const readPrivate=name=>JSON.parse(fs.readFileSync(path.join(privateRoot,'data',name+'.json'),'utf8'));
const completed=privateRoot?readPrivate('completed-evaluations-2026-10-08'):null;
const sheet=privateRoot?readPrivate('sheet-success-rates'):null;
const taskModels=['OpenVLA','OpenVLA-OFT_w','OpenVLA-OFT_m','OpenVLA-OFT+','RIPT-VLA','NORA','UniVLA','π0-FAST'];
const avg=vs=>vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null;
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
assert.equal(models.length,18);assert.equal(tasks.length,8);assert.equal(perturbations.length,42);
assert.equal(new Set(models.map(m=>m.id)).size,models.length);
assert.deepEqual(models.filter(m=>m.granularity==='task').map(m=>m.name).sort(),taskModels.sort());
assert(!models.some(m=>/worldvla/i.test(m.name)));
const sortedCases=cases=>[...cases].sort((a,b)=>JSON.stringify([a.suite,a.taskId,a.direction]).localeCompare(JSON.stringify([b.suite,b.taskId,b.direction])));
if(privateRoot){
  const priorModels=readPrivate('completed-evaluations-2026-10-04').models;
  for(const prior of priorModels)assert.deepEqual(sortedCases(completed.models.find(m=>m.model===prior.model).cases),sortedCases(prior.cases),'Private case counts changed');
}
assert.equal(new Set(perturbations.map(p=>p.id)).size,42);
assert.deepEqual(perturbations.filter(p=>p.mode==='static').map(p=>p.id),Array.from({length:22},(_,i)=>`S${String(i+1).padStart(2,'0')}`));
assert.deepEqual(perturbations.filter(p=>p.mode==='dynamic').map(p=>p.id),Array.from({length:20},(_,i)=>`D${String(i+1).padStart(2,'0')}`));
assert.equal(perturbations.find(p=>p.id==='D19').sourceId,'D20');
assert.equal(perturbations.find(p=>p.id==='D20').sourceId,'D21');
assert.equal(perturbations.find(p=>p.id==='S06').category,'environment');
assert.equal(new Set(categories.flatMap(c=>[...c.static,...c.dynamic])).size,42);
for(const p of perturbations){
  assert(categories.find(c=>c.id===p.category)[p.mode].includes(p.id));
  assert(fs.existsSync(new URL('../'+p.image,import.meta.url)));
}
assert.deepEqual(tasks.map(t=>t.id),['libero_spatial-0','libero_spatial-8','libero_object-1','libero_object-8','libero_goal-3','libero_goal-6','libero_10-5','libero_10-8']);
assert.deepEqual(Object.keys(designs).sort(),tasks.map(t=>t.id).sort(),'Every task needs a design document');
for(const task of tasks){
  assert(designs[task.id].predicates.length,'Every task needs its BASE success condition');
  for(const extension of ['mp4','webp'])assert(fs.existsSync(new URL(`../assets/rollouts/base/${task.id}.${extension}`,import.meta.url)),`Missing nominal demonstration for ${task.id}`);
  if(publishedTasks){
    const supported=new Set(publishedTasks.filter(entry=>entry.suite===task.suite&&entry.base_task_id===task.taskId).map(entry=>entry.case_id));
    const excluded=perturbations.filter(p=>!supported.has(p.sourceId||p.id)).map(p=>p.id);
    assert.deepEqual([...designs[task.id].excluded].sort(),excluded.sort(),`Incomplete or incorrect perturbation support for ${task.id}`);
  }
  for(const id of designs[task.id].excluded){
    assert(perturbations.some(p=>p.id===id));
    assert(models.every(m=>!m.taskRates.some(c=>c.task===task.id&&c.direction===id)),`Inapplicable ${task.id}/${id} has a displayed rate`);
  }
}
assert(designs['libero_10-8'].predicates.includes('Turnon(flat_stove_1)'));
for(const institution of people.affiliations){
  assert(/^assets\/institutions\/[\w./-]+\.(svg|png|webp|jpg)$/.test(institution.logo)&&!institution.logo.includes('..'));
  assert(fs.existsSync(new URL('../'+institution.logo,import.meta.url)),'Use actual institution image assets');
  assert(/^https:\/\//.test(institution.source),'Preserve the official logo source');
}
for(const author of people.authors)for(const id of author.affiliations||[])assert(people.affiliations.some(a=>a.id===id));
for(const m of models){
  assert.deepEqual(Object.keys(m).sort(),['id','name','type','scores','cells','taskRates','updated','granularity',...(m.reportedScores?['reportedScores']:[])].sort(),'Unexpected public model fields');
  assert(profiles[m.id]?.description&&/^https:\/\//.test(profiles[m.id].source),`Missing sourced model introduction ${m.id}`);
  assert(assets[m.id],`Missing model image ${m.id}`);
  assert(fs.existsSync(new URL('../assets/models/'+assets[m.id].asset,import.meta.url)));
  assert.equal(m.scores.static.cells,87);assert.equal(m.scores.dynamic.cells,80);
  assert.equal(new Set(m.cells.map(c=>c.suite+'/'+c.direction)).size,m.cells.length);
  assert(m.scores.base===null||(Number.isFinite(m.scores.base)&&m.scores.base>=0&&m.scores.base<=1));
  assert(m.cells.every(c=>c.direction!=='BASE'),'Do not distribute unrendered nominal suite records');
  close(m.scores.overall,avg(m.cells.filter(c=>c.direction!=='BASE').map(c=>c.rate)));
  for(const mode of ['static','dynamic']){
    const group=perturbations.filter(p=>p.mode===mode).map(p=>p.id);
    close(m.scores[mode].average,avg(m.cells.filter(c=>group.includes(c.direction)).map(c=>c.rate)));
    for(const category of categories){close(m.scores[mode].categories[category.id],avg(m.cells.filter(c=>category[mode].includes(c.direction)).map(c=>c.rate)));}
  }
  assert(m.cells.every(c=>c.rate>=0&&c.rate<=1));
  for(const cell of m.cells)assert.deepEqual(Object.keys(cell).sort(),['direction','rate','suite']);
  assert.equal(new Set(m.taskRates.map(c=>c.task+'/'+c.direction)).size,m.taskRates.length);
  for(const rate of m.taskRates){
    assert.deepEqual(Object.keys(rate).sort(),['direction','rate','task']);
    assert(tasks.some(t=>t.id===rate.task)&&perturbations.some(p=>p.id===rate.direction));
    assert(Number.isFinite(rate.rate)&&rate.rate>=0&&rate.rate<=1);
  }
  assert.equal(m.taskRates.length,m.granularity==='task'?331:0,'Keep only available, displayed task rates');
  if(!privateRoot)continue;
  const raw=completed.models.find(c=>c.model===m.name);
  if(raw){
    assert.equal(m.cells.length,167);
    assert.equal(raw.completedEpisodes,10170);
    const nominalSuites=[...new Set(raw.cases.filter(c=>c.direction==='BASE').map(c=>c.suite))];
    close(m.scores.base,avg(nominalSuites.map(suite=>{
      const cases=raw.cases.filter(c=>c.direction==='BASE'&&c.suite===suite);
      return cases.reduce((sum,c)=>sum+c.successes,0)/cases.reduce((sum,c)=>sum+c.episodes,0);
    })));
    assert.equal(m.updated,'2026-10-08');
    for(const c of m.taskRates){
      const task=tasks.find(t=>t.id===c.task),internal=perturbations.find(p=>p.id===c.direction)?.sourceId||'BASE';
      const source=raw.cases.find(r=>r.suite===task.suite&&r.taskId===task.taskId&&r.direction===internal);
      assert(source);close(c.rate,source.successes/source.episodes);
    }
    // Independently pool original internal-ID counts and check every public cell.
    for(const cell of m.cells){
      const internal=perturbations.find(p=>p.id===cell.direction)?.sourceId||'BASE';
      const cases=raw.cases.filter(c=>c.suite===cell.suite&&c.direction===internal);
      close(cell.rate,cases.reduce((s,c)=>s+c.successes,0)/cases.reduce((s,c)=>s+c.episodes,0));
    }
  } else {
    assert.equal(m.taskRates.length,0,'Do not infer task rates from suite rates');
    const nominal=avg(sheet.cells.filter(c=>c.model===m.name&&c.direction==='BASE').map(c=>c.rate));
    if(nominal===null)assert.equal(m.scores.base,null);else close(m.scores.base,nominal);
    for(const cell of m.cells){const raw=sheet.cells.find(c=>c.model===m.name&&c.suite===cell.suite&&c.direction===cell.direction);assert(raw);close(cell.rate,raw.rate);}
  }
}
// Independently transcribed active release tables; verify all 306 summary values.
const paper=JSON.parse(fs.readFileSync(new URL('./paper-scores.json',import.meta.url),'utf8'));
assert.equal(paper.rows.length,34);
assert.equal(models.filter(m=>m.reportedScores).length,17);
for(const row of paper.rows){
  const model=models.find(m=>m.id===row.id);assert(model?.reportedScores);
  assert.deepEqual(Object.keys(model.reportedScores).sort(),['base','dynamic','static']);
  const summary=summaryScore(model,row.mode);
  assert.deepEqual(Object.keys(summary).sort(),['average','categories','delta']);
  assert.deepEqual(Object.keys(summary.categories).sort(),categories.map(c=>c.id).sort());
  const actual={...summary.categories,average:summary.average,base:baseScore(model),delta:deltaScore(model,row.mode)};
  for(const [field,value] of Object.entries(actual)){
    assert(Number.isFinite(value));
    assert.equal((value*100).toFixed(1),row[field].toFixed(1),`${row.id}/${row.mode}/${field} differs from release paper`);
  }
}
assert.equal(baseScore(models.find(m=>m.id==='nora')),models.find(m=>m.id==='nora').scores.base);
// Independent displayed-value controls transcribed from the supplied paper table.
for(const [name,s,d] of [['OpenVLA-OFT',58.9,64.6],['Lingbot-VA',68.7,81.8],['MolmoAct2',71.2,76.9],['Cosmos Policy',70.8,72.2],['FastWAM',55.9,70.1]]){
  const m=models.find(m=>m.name===name);assert.equal((m.scores.static.average*100).toFixed(1),s.toFixed(1));assert.equal((m.scores.dynamic.average*100).toFixed(1),d.toFixed(1));
}
for(const name of ['news','leaderboard-news']){
  const announcements=read(name).entries;
  for(const [index,entry] of announcements.entries()){
    assert(/^\d{4}-\d{2}-\d{2}$/.test(entry.date)&&Number.isFinite(Date.parse(entry.date)),`Invalid News date: ${entry.date}`);
    assert((entry.title||entry.text)?.trim(),'News entries need readable text');
    if(index)assert(announcements[index-1].date>=entry.date,'News must be newest first');
    if(entry.link){assert(entry.link.label?.trim());assert(['https:','http:'].includes(new URL(entry.link.url).protocol),'News links must use HTTP(S)');}
    if(entry.textAfterLink!==undefined)assert(typeof entry.textAfterLink==='string'&&entry.link,'News textAfterLink requires a link and plain text');
  }
}
const clips=read('home-rollouts').clips;
if(privateRoot){
  const internal=readPrivate('home-rollouts-internal').clips;
  assert.deepEqual(clips,internal.map(c=>({perturbation:c.perturbation,src:c.src,poster:c.poster})),'Home media changed during private metadata removal');
  for(const clip of internal){
    assert.equal(clip.rotationDegrees,180);
    assert(clip.duration>0&&/^[a-f0-9]{64}$/.test(clip.sourceSha256));
  }
}
assert.equal(clips.length,42);
assert.deepEqual(clips.map(c=>c.perturbation).sort(),perturbations.map(p=>p.id).sort());
for(const clip of clips){
  assert.deepEqual(Object.keys(clip).sort(),['perturbation','poster','src'],'Internal rollout metadata must stay private');
  for(const path of [clip.src,clip.poster])assert(fs.existsSync(new URL('../'+path,import.meta.url)),`Missing Home media ${path}`);
  for(const extension of ['mp4','webp'])assert(fs.existsSync(new URL(`../assets/rollouts/documents/${clip.perturbation}.${extension}`,import.meta.url)),`Missing mirrored Document demonstration for ${clip.perturbation}`);
}
const upcoming=read('upcoming-models');
assert.deepEqual(Object.keys(upcoming),['models'],'Upcoming models contain only public names and IDs');
assert(Array.isArray(upcoming.models));
assert.equal(new Set(upcoming.models.map(m=>m.id)).size,upcoming.models.length,'Duplicate upcoming models');
for(const model of upcoming.models){
  assert.deepEqual(Object.keys(model).sort(),['id','name'],'Do not publish internal evaluation plans');
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(model.id)&&typeof model.name==='string'&&model.name.trim());
  assert(assets[model.id]&&/^https:\/\//.test(assets[model.id].source),'Upcoming models need a public provenance source');
  if(assets[model.id].kind==='pending'){
    assert.equal(assets[model.id].asset,null,'Unverified logos must not use unrelated imagery');
    continue;
  }
  assert(/^[\w-]+\.(webp|png|jpg|svg)$/.test(assets[model.id].asset));
  assert(fs.existsSync(new URL('../assets/models/'+assets[model.id].asset,import.meta.url)),'Missing upcoming model image');
}
const rollouts=read('model-rollouts');
assert.deepEqual(Object.keys(rollouts),['models'],'Only public media mappings may be distributed');
assert(Object.keys(rollouts.models).length>0,'Model gallery index is empty');
const indexedMedia=[];
let remoteMediaCount=0;
for(const [model,gallery] of Object.entries(rollouts.models)){
  assert(models.some(m=>m.id===model),'Unknown rollout model');
  assert.deepEqual(Object.keys(gallery).sort(),tasks.map(t=>t.id).sort());
  const baseCount=tasks.filter(task=>gallery[task.id].BASE).length;
  assert(baseCount===8||(['openvla-oft-m','nora'].includes(model)&&baseCount===0),'Require all eight Base videos when supplied; OFT_m and NORA currently have perturbation recordings only');
  let count=0;
  for(const task of tasks){
    const expected=[...(baseCount?['BASE']:[]),...perturbations.filter(p=>!designs[task.id].excluded.includes(p.id)).map(p=>p.id)];
    assert.deepEqual(Object.keys(gallery[task.id]).sort(),expected.sort(),`Missing or unsupported video: ${model}/${task.id}`);
    for(const [variant,media] of Object.entries(gallery[task.id])){
      assert.deepEqual(Object.keys(media).sort(),['poster','src'],'Do not publish internal video metadata');
      const expected=rolloutMediaPaths(model,task.id,variant);
      assert.deepEqual(media,expected,'Media must use the exact approved model/task/perturbation URL');
      for(const file of [media.src,media.poster]){
        if(model==='nora'){
          remoteMediaCount++;
          if(process.env.LIBERO_MEDIA_ROOT){
            const relative=`assets/rollouts/models/${model}/${task.id}/${variant}${file.endsWith('.mp4')?'.mp4':'.webp'}`;
            assert(fs.statSync(path.join(process.env.LIBERO_MEDIA_ROOT,relative)).size>0,`Missing companion media ${relative}`);
          }
        }else{
          assert(fs.statSync(new URL('../'+file,import.meta.url)).size>0,`Missing rollout ${file}`);
          indexedMedia.push(file);
        }
      }
      count++;
    }
  }
  assert.equal(count,331+baseCount,'Each imported model must retain all 331 applicable perturbation videos');
}
assert.equal(remoteMediaCount,rollouts.models.nora?662:0,'NORA needs all 331 remote video/poster pairs');
assert.equal(rolloutMediaPaths('nora','../private','S01'),null);
assert.equal(rolloutMediaPaths('https://example.com','libero_spatial-0','S01'),null);
assert.equal(rolloutMediaPaths('nora','libero_spatial-0','S01?redirect=1'),null);
const mediaRoot=new URL('../assets/rollouts/models/',import.meta.url);
const actualMedia=fs.readdirSync(mediaRoot,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()).map(entry=>path.relative(fileURLToPath(new URL('../',import.meta.url)),path.join(entry.parentPath||entry.path,entry.name)).replaceAll('\\','/'));
assert.deepEqual(actualMedia.sort(),indexedMedia.sort(),'Unexpected or unindexed public media files');
const publicFiles=['catalogue','home-rollouts','leaderboard-news','model-assets','model-profiles','model-rollouts','news','people','publication','results','task-designs','tasks','upcoming-models'];
const dataFiles=fs.readdirSync(new URL('../data/',import.meta.url),{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile());
assert.deepEqual(dataFiles.map(entry=>entry.name).sort(),publicFiles.map(name=>name+'.json').sort(),'Only display data may be distributed');
for(const file of publicFiles)assert(!JSON.stringify(read(file)).match(/(?:[CD]:\\|\/data[0-9]*\/|PRIVATE KEY|ghp_|docs\.google\.com\/spreadsheets)/i));
assert(!/"(?:cases|successes|episodes|sourceRow|sourceColumn|seed|sourceSha256|outcome|archive)"\s*:/.test(JSON.stringify(read('results'))+JSON.stringify(read('home-rollouts'))),'Internal evaluation fields leaked');
for(const file of ['assets/app.js',...['index','docs','leaderboard','report','community','eval','findings','model','perturbation','task'].map(p=>p+'.html')]){
  const content=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert(!/href=["']data\/|\sdownload(?:[\s=>])/.test(content),`Data download link remains in ${file}`);
}
const officialRepository='https://github.com/LIBERO-Pro-Team/LIBERO-Pro2.0';
for(const page of ['index','docs','leaderboard','model','perturbation','task','findings','report','community']){
  const html=fs.readFileSync(new URL('../'+page+'.html',import.meta.url),'utf8');
  const projectLinks=html.match(/<nav class="site-links"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  const footer=html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
  assert(projectLinks?.includes(`href="${officialRepository}"`),`${page}: Code must use the official repository`);
  assert(footer?.includes(`href="${officialRepository}"`),`${page}: footer GitHub must use the official repository`);
  assert.equal(footer?.match(/<span>([^<]*)<\/span>/)?.[1],'LIBEROpro 2.0',`${page}: footer brand`);
  const footerLinks=[...footer.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([,href,label])=>({href,label}));
  assert.deepEqual(footerLinks,[
    {href:officialRepository,label:'GitHub'},
    {href:'https://huggingface.co/datasets/zhouxueyang/LIBERO-Pro2.0-Eval',label:'Eval'},
    {href:'https://huggingface.co/datasets/zhouxueyang/LIBERO-Pro2.0-Train',label:'Train'}
  ],`${page}: footer must show only the three plain text links in order`);
  assert(!/<(?:svg|img|i)\b|Evaluation protocol|Sources|&nbsp;|\s\/\s/.test(footer),`${page}: no footer icons, old links or separators`);
  assert(!html.includes('https://github.com/Zxy-MLlab/LIBERO-Pro2.0'),`${page}: obsolete 2.0 repository link`);
}
const appSource=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
assert(appSource.includes(`class="repository-link" href="${officialRepository}"`),'Home repository link is outdated');
assert(appSource.includes('class="repository-name">LIBERO-Pro-Team/LIBERO-Pro2.0</span>'),'Home repository label is outdated');
assert(read('publication').bibtex.includes(`url = {${officialRepository}}`),'Citation must use the official repository');
const bibtex=read('publication').bibtex;
assert.equal((bibtex.match(/^@\w+\{/gm)||[]).length,2,'Citation must retain both paper editions');
assert(bibtex.indexOf('@misc{zhou2026liberopro2,')<bibtex.indexOf('@article{zhou2025liberopro,'),'Show the 2.0 citation before 1.0');
const earlierCitation=bibtex.slice(bibtex.indexOf('@article{zhou2025liberopro,'));
for(const field of [
  'title = {LIBERO-PRO: Towards Robust and Fair Evaluation of Vision-Language-Action Models Beyond Memorization}',
  'author = {Xueyang Zhou and Yangming Xu and Guiyao Tie and Yongchao Chen and Guowen Zhang and Duanfeng Chu and Pan Zhou and Lichao Sun}',
  'journal = {arXiv preprint arXiv:2510.03827}',
  'year = {2025}',
  'url = {https://arxiv.org/abs/2510.03827}'
])assert(earlierCitation.includes(field),'1.0 citation differs from the official README: '+field);
assert.equal(read('news').entries.find(entry=>entry.link?.label==='leaderboards')?.link.url,officialRepository,'News must link to the new repository without a missing anchor');
console.log('PASS: display-only fields; no snapshots or data download links; 18 models; 42 perturbations and Home clips; eight tasks; aggregate rates; paper controls; official repository links.'+(privateRoot?' Private source comparisons passed.':''));
