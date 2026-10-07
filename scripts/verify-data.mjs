import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => JSON.parse(fs.readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const {categories,perturbations}=read('catalogue');
const {models}=read('results');
const {tasks}=read('tasks');
const assets=read('model-assets');
const completed=read('completed-evaluations-2026-10-04');
const sheet=read('sheet-success-rates');
const avg=vs=>vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null;
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
assert.equal(models.length,14);assert.equal(tasks.length,8);assert.equal(perturbations.length,42);
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
for(const m of models){
  assert(assets[m.id],`Missing model image ${m.id}`);
  assert(fs.existsSync(new URL('../assets/models/'+assets[m.id].asset,import.meta.url)));
  assert.equal(m.scores.static.cells,87);assert.equal(m.scores.dynamic.cells,80);
  for(const mode of ['static','dynamic']){
    const group=perturbations.filter(p=>p.mode===mode).map(p=>p.id);
    close(m.scores[mode].average,avg(m.cells.filter(c=>group.includes(c.direction)).map(c=>c.rate)));
    for(const category of categories){close(m.scores[mode].categories[category.id],avg(m.cells.filter(c=>category[mode].includes(c.direction)).map(c=>c.rate)));}
  }
  assert(m.cells.every(c=>c.rate>=0&&c.rate<=1));
  const raw=completed.models.find(c=>c.model===m.name);
  if(raw){
    assert.equal(m.cases.length,339);assert.equal(m.cases.reduce((n,c)=>n+c.episodes,0),10170);
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
for(const file of ['results','catalogue','tasks','sheet-success-rates'])assert(!JSON.stringify(read(file)).match(/(?:[CD]:\\|\/data\/zxy|PRIVATE KEY|ghp_)/i));
console.log('PASS: 14 model images; 42 paper IDs and six domains; eight tasks; all aggregate/source cells; task counts; paper controls; empty news.');
