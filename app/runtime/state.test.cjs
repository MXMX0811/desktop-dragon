const test=require('node:test');
const assert=require('node:assert/strict');
const moduleReady=import('./state.js');
async function setup(){const {SessionState}=await moduleReady;const model=new SessionState({source:'test',sessionId:'s1'});let revision=0;return {model,send:(type,data={},now=0)=>model.apply({source:'test',sessionId:'s1',turnId:'t1',revision:revision++,type,...data},now)};}
const snapshot=(data={})=>({source:'test',sessionId:'s1',revision:0,connection:'connected',phase:'idle',turnId:null,outcome:null,reason:'',reasoning:false,tools:[],requests:[],...data});

test('unknown and disconnected do not imply idle or allow sleep',async()=>{const {model}=await setup();assert.equal(model.presentation().phase,'unknown');assert.equal(model.presentation().suspended,true);assert.equal(model.setSleeping(true),false);});
test('known idle, running, activity, waiting, resume, and final result form a complete lifecycle',async()=>{
 const {model,send}=await setup();send('session/idle');assert.equal(model.presentation().scene,'standby');assert.equal(model.setSleeping(true),true);
 send('turn/start');assert.equal(model.presentation().scene,'thinking');assert.equal(model.sleeping,false);
 send('tool/start',{callId:'r',kind:'read',name:'read'});assert.equal(model.presentation().scene,'reading');
 send('tool/end',{callId:'r'});send('tool/start',{callId:'w',kind:'edit',name:'edit'});assert.equal(model.presentation().scene,'work');
 send('request/open',{requestId:'a',kind:'approval',blocking:true,callId:'w'});assert.equal(model.presentation().waiting,true);
 send('request/resolve',{requestId:'a'});assert.equal(model.presentation().waiting,false);assert.equal(model.presentation().scene,'work');
 send('turn/end',{outcome:'completed'});assert.equal(model.presentation().scene,'standby');assert.equal(model.unread,true);model.markRead();assert.equal(model.unread,false);
});
test('concurrent tools finish independently, and a tool failure is not a turn failure',async()=>{
 const {model,send}=await setup();send('turn/start');send('tool/start',{callId:'a',kind:'read'});send('tool/start',{callId:'b',kind:'command'});
 send('tool/end',{callId:'b',isError:true});assert.equal(model.presentation().scene,'reading');assert.equal(model.presentation().toolCount,1);assert.equal(model.phase,'running');assert.equal(model.outcome,null);
 send('tool/end',{callId:'a'},100);assert.equal(model.presentation(200).scene,'reading');assert.equal(model.presentation(200).label,'处理中');assert.equal(model.presentation(1100).scene,'thinking');assert.equal(model.setSleeping(true),false);
});
test('nonblocking questions keep work running; only the matching request resolves',async()=>{
 const {model,send}=await setup();send('turn/start');send('tool/start',{callId:'w',kind:'write'});
 send('request/open',{requestId:'q',kind:'question',blocking:false});assert.equal(model.presentation().waiting,false);assert.equal(model.presentation().requestCount,1);
 send('request/open',{requestId:'a',kind:'approval',blocking:true,callId:'w'});send('request/resolve',{requestId:'q'});assert.equal(model.presentation().waiting,true);
 send('request/resolve',{requestId:'a'});assert.equal(model.presentation().waiting,false);
});
test('stale events and foreign sessions do not steal the selected session',async()=>{
 const {model,send}=await setup();send('turn/start');send('tool/start',{callId:'old',kind:'read'});send('turn/start',{turnId:'t2'});send('tool/start',{turnId:'t2',callId:'new',kind:'edit'});
 assert.equal(send('tool/end',{turnId:'t1',callId:'new'}),false);assert.equal(send('turn/end',{turnId:'t1',outcome:'completed'}),false);assert.equal(send('turn/start',{turnId:'t1'}),false);
 assert.equal(model.apply({type:'turn/end',source:'other',sessionId:'s1',turnId:'t2',revision:100,outcome:'completed'}),false);
 assert.equal(model.apply({type:'turn/end',source:'test',sessionId:'else',turnId:'t2',revision:100,outcome:'completed'}),false);
 assert.equal(model.apply({type:'turn/end',source:'test',sessionId:'s1',turnId:'t2',revision:1,outcome:'completed'}),false);assert.equal(model.presentation().toolCount,1);assert.equal(model.unread,false);
});
test('a closed turn cannot be reopened by late tools or a late running snapshot',async()=>{
 const {model,send}=await setup();send('turn/start');send('turn/end',{outcome:'completed'});
 assert.equal(send('tool/start',{callId:'late-child',kind:'command'}),false);
 assert.equal(model.applySnapshot(snapshot({revision:50,phase:'running',turnId:'t1',tools:[{callId:'late',kind:'command'}]})),false);assert.equal(model.phase,'ended');
 send('turn/start',{turnId:'t2'});assert.equal(model.applySnapshot(snapshot({revision:51,phase:'ended',turnId:'t1',outcome:'completed'})),false);assert.equal(model.turnId,'t2');assert.equal(model.phase,'running');
});
test('cancellation, explicit failure, and disconnection have distinct truthful feedback',async()=>{
 for(const outcome of ['cancelled','blocked','error','limit']){const {model,send}=await setup();send('turn/start');send('tool/start',{callId:'w',kind:'edit'});send('turn/end',{outcome});const p=model.presentation();assert.equal(p.unread,false);assert.equal(p.outcome,outcome);assert.equal(p.suspended,outcome !== 'cancelled');assert.equal(p.scene,outcome === 'cancelled'?'standby':'work');}
 const {model,send}=await setup();send('turn/start');send('tool/start',{callId:'w',kind:'edit'});send('connection',{connection:'disconnected'});assert.equal(model.presentation().scene,'work');assert.equal(model.presentation().suspended,true);assert.equal(model.setSleeping(true),false);
 send('connection',{connection:'connected'});assert.equal(model.presentation().suspended,true);assert.equal(model.presentation().label,'等待状态同步');
 model.applySnapshot(snapshot({revision:100,phase:'running',turnId:'t1',tools:[{callId:'r',kind:'read'}]}));assert.equal(model.presentation().scene,'reading');assert.equal(model.presentation().suspended,false);
});
test('snapshots are complete and revisioned, keep request context, and do not invent new results',async()=>{
 const {model}=await setup();const value=snapshot({revision:2,phase:'running',turnId:'t1',lastToolKind:'search',requests:[{requestId:'a',kind:'approval',blocking:true}]});
 assert.equal(model.applySnapshot(value,0),true);assert.equal(model.presentation().scene,'reading');assert.equal(model.presentation().waitingPose,true);assert.equal(model.applySnapshot(value),false);
 model.applySnapshot(snapshot({revision:3,phase:'ended',turnId:'t1',outcome:'completed'}));assert.equal(model.unread,true);model.markRead();model.applySnapshot(snapshot({revision:4,phase:'ended',turnId:'t1',outcome:'completed'}));assert.equal(model.unread,false);
 const {model:late}=await setup();late.applySnapshot(snapshot({phase:'ended',turnId:'old',outcome:'completed'}));assert.equal(late.unread,false);
});
test('unknown tools and context-free confirmation do not claim a command or unimplemented waiting pose',async()=>{
 const {model,send}=await setup();send('turn/start');send('tool/start',{callId:'u',kind:'unknown',name:'some_tool'});assert.equal(model.presentation().scene,'thinking');assert.equal(model.presentation().label,'工具处理中');send('request/open',{requestId:'q',kind:'question',blocking:true});assert.equal(model.presentation().waiting,true);assert.equal(model.presentation().waitingPose,false);assert.equal(model.presentation().suspended,true);
});
test('ending a blocking request derives the current live tools instead of returning to stale work',async()=>{
 const {model,send}=await setup();send('turn/start');send('tool/start',{callId:'w',kind:'edit'});send('request/open',{requestId:'a',kind:'approval',blocking:true,scene:'work'});send('tool/end',{callId:'w'});send('tool/start',{callId:'r',kind:'read'});assert.equal(model.presentation().scene,'work');send('request/resolve',{requestId:'a'});assert.equal(model.presentation().scene,'reading');
});
test('only explicit reasoning changes the generic processing label',async()=>{const {model,send}=await setup();send('turn/start');assert.equal(model.presentation().label,'处理中');send('reasoning',{active:true});assert.equal(model.presentation().label,'思考中');send('reasoning',{active:false});assert.equal(model.presentation().label,'处理中');});
test('invalid snapshot payloads do not consume revisions or partially replace state',async()=>{const {model}=await setup();assert.throws(()=>model.applySnapshot(snapshot({revision:5,phase:'running',turnId:'t1',tools:[{callId:'x',kind:'invented'}]})),TypeError);assert.equal(model.revision,-1);assert.equal(model.phase,'unknown');assert.equal(model.applySnapshot(snapshot({revision:5})),true);});

test('explicit image tool enters drawing, waits, resumes and completes; viewing an image remains reading',async()=>{
 const {model,send}=await setup();send('turn/start');send('tool/start',{callId:'picture',kind:'image'});
 assert.equal(model.presentation().scene,'drawing');assert.equal(model.presentation().label,'绘制图像中');
 send('request/open',{requestId:'image-approval',kind:'approval',blocking:true,callId:'picture'});
 assert.equal(model.presentation().waitingPose,true);assert.equal(model.presentation().suspended,false);
 send('request/resolve',{requestId:'image-approval'});assert.equal(model.presentation().waiting,false);
 send('tool/end',{callId:'picture'},100);assert.equal(model.presentation(500).scene,'drawing');
 send('tool/start',{callId:'view',kind:'read'});assert.equal(model.presentation().scene,'reading');
 send('turn/end',{outcome:'completed'});assert.equal(model.presentation().scene,'standby');
});
