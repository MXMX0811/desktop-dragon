import test from 'node:test';
import assert from 'node:assert/strict';
import {IDLE_SLEEP_DELAY_MS,IdleSleep} from './idle-sleep.js';

test('sleep starts only after two full minutes of eligible idle time',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const onSleep=t.mock.fn(),idle=new IdleSleep(onSleep);
 assert.equal(IDLE_SLEEP_DELAY_MS,120000);
 idle.restart();
 t.mock.timers.tick(240000);
 assert.equal(onSleep.mock.callCount(),0);
 idle.setEligible(true);
 t.mock.timers.tick(119999);
 assert.equal(onSleep.mock.callCount(),0);
 t.mock.timers.tick(1);
 assert.equal(onSleep.mock.callCount(),1);
});

test('repeated idle snapshots neither postpone nor duplicate sleep',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const onSleep=t.mock.fn(),idle=new IdleSleep(onSleep);
 idle.setEligible(true);
 for(let elapsed=0;elapsed<119000;elapsed+=1000){
  t.mock.timers.tick(1000);
  idle.setEligible(true);
 }
 t.mock.timers.tick(999);
 assert.equal(onSleep.mock.callCount(),0);
 t.mock.timers.tick(1);
 assert.equal(onSleep.mock.callCount(),1);
 t.mock.timers.tick(240000);
 assert.equal(onSleep.mock.callCount(),1);
});

test('user activity restarts the full two-minute idle period',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const onSleep=t.mock.fn(),idle=new IdleSleep(onSleep);
 idle.setEligible(true);
 t.mock.timers.tick(90000);
 idle.restart();
 t.mock.timers.tick(30000);
 assert.equal(onSleep.mock.callCount(),0);
 t.mock.timers.tick(89999);
 assert.equal(onSleep.mock.callCount(),0);
 t.mock.timers.tick(1);
 assert.equal(onSleep.mock.callCount(),1);
 t.mock.timers.tick(120000);
 assert.equal(onSleep.mock.callCount(),1);
});

test('active work or dragging cancels sleep until idle eligibility returns',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const onSleep=t.mock.fn(),idle=new IdleSleep(onSleep);
 idle.setEligible(true);
 t.mock.timers.tick(119999);
 idle.setEligible(false);
 idle.restart();
 t.mock.timers.tick(600000);
 assert.equal(onSleep.mock.callCount(),0);
 idle.setEligible(true);
 t.mock.timers.tick(119999);
 assert.equal(onSleep.mock.callCount(),0);
 t.mock.timers.tick(1);
 assert.equal(onSleep.mock.callCount(),1);
});

test('becoming asleep in the callback prevents further sleep requests',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const onSleep=t.mock.fn(()=>idle.setEligible(false)),idle=new IdleSleep(onSleep);
 idle.setEligible(true);
 t.mock.timers.tick(120000);
 assert.equal(onSleep.mock.callCount(),1);
 idle.setEligible(false);
 idle.restart();
 t.mock.timers.tick(600000);
 assert.equal(onSleep.mock.callCount(),1);
});

test('destroy cancels a pending sleep and leaves restart inactive',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const onSleep=t.mock.fn(),idle=new IdleSleep(onSleep);
 idle.setEligible(true);
 t.mock.timers.tick(119999);
 idle.destroy();
 idle.restart();
 t.mock.timers.tick(1);
 assert.equal(onSleep.mock.callCount(),0);
 t.mock.timers.tick(600000);
 assert.equal(onSleep.mock.callCount(),0);
});
