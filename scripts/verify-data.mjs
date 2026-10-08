import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => JSON.parse(fs.readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const {categories,perturbations}=read('catalogue');
const {models}=read('results');
const {tasks}=read('tasks');
const assets=read('model-assets');
const profiles=read('model-profiles');
const designs=read('task-designs').tasks;
const people=read('people');
const completed=read('completed-evaluations-2026-10-08');
const sheet=read('sheet-success-rates');
const avg=vs=>vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null;
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
assert.equal(models.length,18);assert.equal(tasks.length,8);assert.equal(perturbations.length,42);
assert.equal(new Set(models.map(m=>m.id)).size,models.length);
assert.deepEqual(completed.models.map(m=>m.model).sort(),['OpenVLA','OpenVLA-OFT_w','OpenVLA-OFT_m','OpenVLA-OFT+','RIPT-VLA','NORA','UniVLA','π0-FAST'].sort());
assert(!models.some(m=>/worldvla/i.test(m.name)));
const sortedCases=cases=>[...cases].sort((a,b)=>JSON.stringify([a.suite,a.taskId,a.direction]).localeCompare(JSON.stringify([b.suite,b.taskId,b.direction])));
const priorModels=read('completed-evaluations-2026-10-04').models;
const expectedCaseKeys=priorModels[0].cases.map(c=>`${c.suite}-${c.taskId}/${({'D20':'D19','D21':'D20'})[c.direction]||c.direction}`).sort();
for(const prior of priorModels){
  assert.deepEqual(sortedCases(completed.models.find(m=>m.model===prior.model).cases),sortedCases(prior.cases),'Previously published case counts changed');
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
    assert(models.every(m=>!m.cases.some(c=>c.task===task.id&&c.direction===id)),`Inapplicable ${task.id}/${id} has recorded counts`);
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
  assert(profiles[m.id]?.description&&/^https:\/\//.test(profiles[m.id].source),`Missing sourced model introduction ${m.id}`);
  assert(assets[m.id],`Missing model image ${m.id}`);
  assert(fs.existsSync(new URL('../assets/models/'+assets[m.id].asset,import.meta.url)));
  assert.equal(m.scores.static.cells,87);assert.equal(m.scores.dynamic.cells,80);
  assert.equal(new Set(m.cells.map(c=>c.suite+'/'+c.direction)).size,m.cells.length);
  close(m.scores.base,avg(m.cells.filter(c=>c.direction==='BASE').map(c=>c.rate)));
  close(m.scores.overall,avg(m.cells.filter(c=>c.direction!=='BASE').map(c=>c.rate)));
  for(const mode of ['static','dynamic']){
    const group=perturbations.filter(p=>p.mode===mode).map(p=>p.id);
    close(m.scores[mode].average,avg(m.cells.filter(c=>group.includes(c.direction)).map(c=>c.rate)));
    for(const category of categories){close(m.scores[mode].categories[category.id],avg(m.cells.filter(c=>category[mode].includes(c.direction)).map(c=>c.rate)));}
  }
  assert(m.cells.every(c=>c.rate>=0&&c.rate<=1));
  const raw=completed.models.find(c=>c.model===m.name);
  if(raw){
    assert.equal(m.cells.length,171);
    assert.equal(m.cases.length,339);assert.equal(m.cases.reduce((n,c)=>n+c.episodes,0),10170);
    assert.equal(raw.completedEpisodes,10170);
    assert.equal(m.source.url,'data/completed-evaluations-2026-10-08.json');
    assert.equal(m.source.date,'2026-10-08');
    assert.deepEqual(m.cases.map(c=>c.task+'/'+c.direction).sort(),expectedCaseKeys,'Completed models must use the same evaluated task/case scope');
    for(const c of m.cases){
      assert.equal(c.episodes,30);
      assert(Number.isInteger(c.successes)&&c.successes>=0&&c.successes<=30);
      const task=tasks.find(t=>t.id===c.task),internal=perturbations.find(p=>p.id===c.direction)?.sourceId||'BASE';
      const source=raw.cases.find(r=>r.suite===task.suite&&r.taskId===task.taskId&&r.direction===internal);
      assert(source);assert.equal(c.successes,source.successes);assert.equal(c.episodes,source.episodes);
    }
    // Independently pool original internal-ID counts and check every public cell.
    for(const cell of m.cells){
      const internal=perturbations.find(p=>p.id===cell.direction)?.sourceId||'BASE';
      const cases=raw.cases.filter(c=>c.suite===cell.suite&&c.direction===internal);
      close(cell.rate,cases.reduce((s,c)=>s+c.successes,0)/cases.reduce((s,c)=>s+c.episodes,0));
    }
  } else {
    assert.equal(m.cases.length,0,'Do not infer task rates from suite rates');
    for(const cell of m.cells){const raw=sheet.cells.find(c=>c.model===m.name&&c.suite===cell.suite&&c.direction===cell.direction);assert(raw);close(cell.rate,raw.rate);}
  }
}
// Independent displayed-value controls transcribed from the supplied paper table.
for(const [name,s,d] of [['OpenVLA-OFT',58.9,64.6],['Lingbot-VA',68.7,81.8],['MolmoAct2',71.2,76.9],['Cosmos Policy',70.8,72.2],['FastWAM',55.9,70.1]]){
  const m=models.find(m=>m.name===name);assert.equal((m.scores.static.average*100).toFixed(1),s.toFixed(1));assert.equal((m.scores.dynamic.average*100).toFixed(1),d.toFixed(1));
}
assert.equal(read('news').entries.length,0);
const clips=read('home-rollouts').clips;
assert.equal(clips.length,42);
assert.deepEqual(clips.map(c=>c.perturbation).sort(),perturbations.map(p=>p.id).sort());
for(const clip of clips){
  assert.equal(clip.rotationDegrees,180);
  assert.equal(clip.internalVariant,perturbations.find(p=>p.id===clip.perturbation).sourceId);
  assert.equal(clip.archive,clip.task.startsWith('libero_spatial-')?'0913spatial 全量rollout.zip':'0911rollout.zip');
  assert(clip.duration>0&&/^[a-f0-9]{64}$/.test(clip.sourceSha256));
  for(const path of [clip.src,clip.poster])assert(fs.existsSync(new URL('../'+path,import.meta.url)),`Missing Home media ${path}`);
}
for(const file of ['results','catalogue','tasks','sheet-success-rates','home-rollouts','completed-evaluations-2026-10-08'])assert(!JSON.stringify(read(file)).match(/(?:[CD]:\\|\/data[0-9]*\/|PRIVATE KEY|ghp_)/i));
console.log('PASS: 18 model images; eight complete count sources; 42 paper IDs and latest Home rollouts; eight tasks; all aggregate/source cells; task counts; paper controls; empty news.');
