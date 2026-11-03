const test=require('node:test'),assert=require('node:assert/strict');
const facts=(scene,extra={})=>({source:'demo',sessionId:'one',turnId:'turn-1',phase:'running',scene,waiting:false,waitingPose:false,suspended:false,...extra});
test('normal task keeps its set during a generic gap and returns to Q only at the end',async()=>{
 const {DisplayPolicy}=await import('./display-policy.js');const p=new DisplayPolicy();
 assert.equal(p.select(facts('reading')).form,'normal');
 const gap=p.select(facts('thinking',{label:'处理中'}));
 assert.equal(gap.scene,'reading');assert.equal(gap.form,'normal');assert.equal(gap.suspended,true);assert.equal(gap.label,'处理中');
 assert.equal(p.select(facts('work')).scene,'work');
 const end=p.select(facts('standby',{phase:'ended'}));assert.equal(end.form,'chibi');assert.equal(end.suspended,false);
 assert.equal(p.select(facts('thinking',{turnId:'turn-2'})).scene,'thinking');
});
test('form choice never resolves a pending request and applies to both task scenes',async()=>{
 const {DisplayPolicy}=await import('./display-policy.js');const p=new DisplayPolicy();p.toggle();
 const waiting=p.select(facts('reading',{waiting:true,waitingPose:true,blockingCount:1}));
 assert.equal(waiting.form,'chibi');assert.equal(waiting.waiting,true);assert.equal(waiting.blockingCount,1);
 assert.equal(p.select(facts('work')).form,'chibi');assert.equal(p.select(facts('thinking')).scene,'thinking');
});
test('the cloud is required exactly when the character proportions change',async()=>{
 const {needsTransformation}=await import('./presenter.js');
 const views=['standby','reading','work','thinking','drawing'].map(scene=>({scene,form:'chibi'})).concat(['reading','work','drawing'].map(scene=>({scene,form:'normal'})));
 assert.equal(needsTransformation(null,views[0]),false);
 for(const before of views)for(const after of views)assert.equal(needsTransformation(before,after),before.form!==after.form);
});

test('drawing supports both forms, holds its set through gaps and keeps pending requests',async()=>{
 const {DisplayPolicy}=await import('./display-policy.js');const p=new DisplayPolicy();
 p.select(facts('work'));const drawing=p.select(facts('drawing',{waiting:true,waitingPose:true,blockingCount:1}));
 assert.equal(drawing.form,'normal');assert.equal(drawing.scene,'drawing');assert.equal(drawing.blockingCount,1);
 assert.equal(p.select(facts('thinking')).scene,'drawing');
 p.toggle();assert.equal(p.select(facts('drawing')).form,'chibi');
 assert.equal(p.select(facts('reading')).form,'chibi');
});
