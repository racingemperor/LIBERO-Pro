import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
  assert.deepEqual(Object.keys(m).sort(),['id','name','type','scores','cells','taskRates','updated','granularity'].sort(),'Unexpected public model fields');
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
// Independent displayed-value controls transcribed from the supplied paper table.
for(const [name,s,d] of [['OpenVLA-OFT',58.9,64.6],['Lingbot-VA',68.7,81.8],['MolmoAct2',71.2,76.9],['Cosmos Policy',70.8,72.2],['FastWAM',55.9,70.1]]){
  const m=models.find(m=>m.name===name);assert.equal((m.scores.static.average*100).toFixed(1),s.toFixed(1));assert.equal((m.scores.dynamic.average*100).toFixed(1),d.toFixed(1));
}
assert.equal(read('news').entries.length,0);
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
}
const publicFiles=['catalogue','home-rollouts','model-assets','model-profiles','news','people','publication','results','task-designs','tasks'];
const dataFiles=fs.readdirSync(new URL('../data/',import.meta.url),{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile());
assert.deepEqual(dataFiles.map(entry=>entry.name).sort(),publicFiles.map(name=>name+'.json').sort(),'Only display data may be distributed');
for(const file of publicFiles)assert(!JSON.stringify(read(file)).match(/(?:[CD]:\\|\/data[0-9]*\/|PRIVATE KEY|ghp_|docs\.google\.com\/spreadsheets)/i));
assert(!/"(?:cases|successes|episodes|sourceRow|sourceColumn|seed|sourceSha256|outcome|archive)"\s*:/.test(JSON.stringify(read('results'))+JSON.stringify(read('home-rollouts'))),'Internal evaluation fields leaked');
for(const file of ['assets/app.js',...['index','docs','leaderboard','eval','findings','model','perturbation','task','tasks'].map(p=>p+'.html')]){
  const content=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert(!/href=["']data\/|\sdownload(?:[\s=>])/.test(content),`Data download link remains in ${file}`);
}
console.log('PASS: display-only fields; no snapshots or data download links; 18 models; 42 perturbations and Home clips; eight tasks; aggregate rates; paper controls.'+(privateRoot?' Private source comparisons passed.':''));
