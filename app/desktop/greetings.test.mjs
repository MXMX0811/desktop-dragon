import test from 'node:test';
import assert from 'node:assert/strict';
import {GreetingSchedule,greetingPeriod,nextGreetingBoundary} from './greetings.js';
import {GreetingController} from '../../assets/shared/greetings/controller.js';
const at=(day,hour,minute=0)=>new Date(2026,10,day,hour,minute).getTime();
const ready={allowed:true,ready:true};

test('day and night use local hours; midnight is not another greeting',()=>{
 assert.equal(greetingPeriod(at(17,5,59)).scene,'goodnight');
 assert.equal(greetingPeriod(at(17,6)).scene,'coffee');
 assert.equal(greetingPeriod(at(17,17,59)).scene,'coffee');
 assert.equal(greetingPeriod(at(17,18)).scene,'goodnight');
 assert.equal(greetingPeriod(at(17,23)).key,greetingPeriod(at(18,0)).key);
 for(const [hour,nextDay,nextHour] of [[5,17,6],[6,17,18],[17,17,18],[18,18,6],[23,18,6]])
  assert.equal(nextGreetingBoundary(at(17,hour)),at(nextDay,nextHour));
});
test('startup, reappearance and wake greet once per period, including app restart',()=>{
 const s=new GreetingSchedule();assert.equal(s.select(ready,at(17,9)),'coffee');
 s.finish();assert.equal(s.select(ready,at(17,10)),null);
 assert.equal(new GreetingSchedule(s.lastPeriod).select(ready,at(17,11)),null);
 assert.equal(s.select(ready,at(17,18)),'goodnight');
 s.finish();assert.equal(s.select(ready,at(18,1)),null);
 assert.equal(s.select(ready,at(18,6)),'coffee');
});
test('busy, sleep, waiting, hidden and edge postpone greetings; cancellation does not replay',()=>{
 const s=new GreetingSchedule();
 assert.equal(s.select({allowed:false,ready:true},at(17,9)),null);
 assert.equal(s.lastPeriod,null);
 assert.equal(s.select({allowed:true,ready:false},at(17,9)),null);
 assert.equal(s.select(ready,at(17,9)),'coffee');
 assert.equal(s.select({allowed:true,ready:false},at(17,9)),'coffee');
 assert.equal(s.select({allowed:false,ready:true},at(17,9)),null);
 assert.equal(s.select(ready,at(17,9)),null);
 // A period missed while parked at the edge is selected on return, not queued.
 assert.equal(s.select({allowed:false,ready:true},at(17,18)),null);
 assert.equal(s.select(ready,at(18,7)),'coffee');
});
test('manual greeting consumes the automatic visit without keeping a stale override',()=>{
 const s=new GreetingSchedule();s.dismiss(at(17,10));
 assert.equal(s.active,null);assert.equal(s.select(ready,at(17,10)),null);
});
function advance(c,seconds){for(let t=0;t<seconds;t+=1/120)c.update(1/120);}
test('uninterrupted greeting clips complete and click feedback is preserved',()=>{
 for(const [name,duration] of [['coffee',6.4],['goodnight',7.2]]){
  const c=new GreetingController(name);advance(c,duration-.05);assert.equal(c.finished,false);
  advance(c,.1);assert.equal(c.finished,true);assert.equal(c.touch(),false);
 }
 const c=new GreetingController('coffee');advance(c,1);c.touch();advance(c,.5);
 assert.ok(c.sample().click.eyes>.99);assert.ok(c.sample().click.smile>.99);
 assert.equal(c.touch(),false); // repeated clicks cannot restart an ongoing smile
 advance(c,2);assert.equal(c.sample().click.smile,0);
 const n=new GreetingController('goodnight');n.touch();advance(n,.6);
 assert.ok(n.sample().click.eyes>.99);assert.equal(n.sample().click.smile,0);
});
test('repeated clicks cannot keep a greeting on screen indefinitely',()=>{
 for(const name of ['coffee','goodnight']){
  const c=new GreetingController(name);
  for(let t=0;t<12.2;t+=1/120){c.touch();c.update(1/120);}
  assert.equal(c.finished,true);assert.equal(c.reaction,null);
 }
});
