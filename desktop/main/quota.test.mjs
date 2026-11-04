import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createQuotaReader,quotaSnapshot} from './quota.mjs';

const limits=(used=40,resetsAt=2_000_000_000)=>({rateLimitsByLimitId:{codex:{
 primary:{usedPercent:used,windowDurationMins:10_080,resetsAt},secondary:null,
}}});
function server(){
 const child=new EventEmitter();
 child.stdin=new PassThrough();child.stdout=new PassThrough();
 child.requests=[];child.kills=0;
 child.stdin.on('data',chunk=>child.requests.push(...chunk.toString().trim().split('\n').map(JSON.parse)));
 child.kill=()=>{child.kills++;child.emit('exit',0);return true;};
 child.reply=message=>child.stdout.write(`${JSON.stringify(message)}\n`);
 child.complete=result=>{child.reply({id:0,result:{}});child.reply({id:1,result});};
 return child;
}

test('quota labels follow real durations and buckets, with no legacy window substitution',()=>{
 const result=limits(66);
 result.rateLimits={primary:{usedPercent:0,windowDurationMins:300}};
 result.rateLimitsByLimitId.codex.secondary={usedPercent:125,windowDurationMins:300,resetsAt:null};
 result.rateLimitsByLimitId.other={limitName:'Code review',primary:{usedPercent:-3,windowDurationMins:1440,resetsAt:1234}};
 const snapshot=quotaSnapshot(result,1000);
 assert.deepEqual(snapshot,{status:'ready',fetchedAt:1000,windows:[
  {label:'Codex · 每周',remainingPercent:34,resetsAt:2_000_000_000},
  {label:'Codex · 5小时',remainingPercent:0,resetsAt:null},
  {label:'Code review · 1天',remainingPercent:100,resetsAt:1234},
 ]});
 assert.equal(quotaSnapshot({rateLimits:result.rateLimits}).status,'unavailable');
});

test('unknown percentages and reset times stay unknown, while elapsed reset does not refill usage',()=>{
 assert.deepEqual(quotaSnapshot({rateLimitsByLimitId:{codex:{primary:{usedPercent:null,windowDurationMins:null,resetsAt:null}}}},1000).windows,
  [{label:'Codex · 额度窗口',remainingPercent:null,resetsAt:null}]);
 assert.equal(quotaSnapshot(limits(66,1),10_000).windows[0].remainingPercent,34);
 assert.equal(quotaSnapshot({rateLimitsByLimitId:{codex:{primary:null,secondary:null}}}).status,'unavailable');
});

test('concurrent reads share one query that only initializes and reads limits, then closes its own process',async()=>{
 const child=server();let launches=0;
 const reader=createQuotaReader({executable:'/chosen/codex',spawnProcess:(executable,args,options)=>{
  launches++;assert.equal(executable,'/chosen/codex');assert.deepEqual(args,['app-server','--stdio']);assert.equal(options.windowsHide,true);return child;
 }});
 const first=reader.read(),second=reader.read();
 assert.equal(first,second);assert.equal(launches,1);
 child.reply({method:'unrelated/notification',params:{}});
 child.complete(limits());
 assert.equal((await first).windows[0].remainingPercent,60);
 assert.deepEqual(child.requests.map(item=>item.method),['initialize','initialized','account/rateLimits/read']);
 assert.equal(child.kills,1);assert.equal(child.stdin.writableEnded,true);
 reader.close();assert.equal(child.kills,1);
});

test('cache lasts 30 seconds but expires at the recorded reset without inventing a refill',async t=>{
 const start=1_000_000_000_000;
 t.mock.timers.enable({apis:['Date'],now:start});
 const children=[];
 const reader=createQuotaReader({spawnProcess:()=>{const child=server();children.push(child);return child;}});
 try{
  let pending=reader.read();children[0].complete(limits(40,(start+20_000)/1000));
  const initial=await pending;
  t.mock.timers.setTime(start+10_000);assert.equal(await reader.read(),initial);assert.equal(children.length,1);
  t.mock.timers.setTime(start+20_000);pending=reader.read();assert.equal(children.length,2);
  children[1].complete(limits(45,(start+100_000)/1000));assert.equal((await pending).windows[0].remainingPercent,55);
  t.mock.timers.setTime(start+50_000);pending=reader.read();assert.equal(children.length,3);
  children[2].complete(limits(50,(start+100_000)/1000));assert.equal((await pending).windows[0].remainingPercent,50);
 }finally{reader.close();t.mock.timers.reset();}
});

test('missing executable and authentication errors give safe actionable messages, without caching failures',async()=>{
 const children=[];
 const reader=createQuotaReader({spawnProcess:()=>{const child=server();children.push(child);return child;}});
 let pending=reader.read();children[0].emit('error',Object.assign(Error('/private/executable'),{code:'ENOENT'}));
 let result=await pending;
 assert.equal(result.status,'unavailable');assert.match(result.message,/选择 Codex/);assert.doesNotMatch(result.message,/private/);
 pending=reader.read();children[1].reply({id:0,result:{}});
 children[1].reply({id:1,error:{code:-32000,message:'codex account authentication required /private/account'}});
 result=await pending;
 assert.equal(result.status,'unavailable');assert.match(result.message,/登录/);assert.doesNotMatch(result.message,/private/);
 pending=reader.read();children[2].complete(limits());assert.equal((await pending).status,'ready');
 reader.close();
});

test('timeout and close settle callers and terminate only their query child',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const children=[];
 const reader=createQuotaReader({spawnProcess:()=>{const child=server();children.push(child);return child;}});
 try{
  let pending=reader.read();t.mock.timers.tick(20_000);
  assert.match((await pending).message,/超时/);assert.equal(children[0].kills,1);
  pending=reader.read();reader.close();assert.equal((await pending).status,'unavailable');assert.equal(children[1].kills,1);
  assert.equal((await reader.read()).status,'unavailable');assert.equal(children.length,2);
 }finally{reader.close();t.mock.timers.reset();}
});

test('malformed protocol and early process exit fail without exposing process output',async()=>{
 for(const reply of [child=>child.stdout.write('private malformed output\n'),child=>child.reply(null),child=>child.emit('exit',1)]){
  const child=server(),reader=createQuotaReader({spawnProcess:()=>child});
  const pending=reader.read();reply(child);
  const result=await pending;assert.equal(result.status,'error');assert.doesNotMatch(result.message,/private/);
  reader.close();
 }
});
