import test from 'node:test';
import assert from 'node:assert/strict';
import {DIALOGUES,dialogueGroup,randomLine} from './dialogue-lines.js';
import {SpeechBubble,resetLabel,bubblePlacement} from './bubble.js';

test('dialogue follows the displayed pose and keeps sleep, standby, drag and peek separate',()=>{
 assert.deepEqual(DIALOGUES.standby,['诶？主人在叫我吗？','嘿嘿，我在这里哦～']);
 assert.deepEqual(DIALOGUES.sleep,['呼噜……再睡五分钟……']);
 assert.deepEqual(DIALOGUES.drag,['哇哇！要飞起来啦！']);
 assert.deepEqual(DIALOGUES.peek,['嘿嘿，被发现啦！','我就在这里偷偷看着～']);
 assert.equal(dialogueGroup({scene:'work',mode:'peek',waiting:true,hasAgents:true}),'peek');
 assert.equal(dialogueGroup({scene:'standby',sleeping:true,hasAgents:true}),'sleep');
 assert.equal(dialogueGroup({scene:'reading',waiting:true,hasAgents:true}),'waiting');
 assert.equal(dialogueGroup({scene:'reading',hasAgents:true}),'subagents');
 assert.equal(dialogueGroup({scene:'standby',hasAgents:true}),'standby');
});

test('random dialogue excludes the previous line while retaining the only line in single-line groups',()=>{
 for(const random of [0,.4,.999])assert.notEqual(randomLine('reading',DIALOGUES.reading[1],()=>random),DIALOGUES.reading[1]);
 assert.equal(randomLine('reading',DIALOGUES.reading[1],()=>0),DIALOGUES.reading[0]);
 assert.equal(randomLine('reading',DIALOGUES.reading[1],()=>.999),DIALOGUES.reading[2]);
 assert.equal(randomLine('sleep',DIALOGUES.sleep[0],()=>.9),DIALOGUES.sleep[0]);
});

test('reset text uses seconds, preserves unknown data, and never reports restored quota at expiry',()=>{
 const now=Date.parse('2030-01-01T12:00:00Z');
 assert.equal(resetLabel(now/1000+7920,now).relative,'2小时12分钟后重置');
 assert.equal(resetLabel(now/1000+20,now).relative,'1分钟后重置');
 assert.equal(resetLabel(now/1000+2*86400+3600,now).relative,'2天1小时后重置');
 assert.deepEqual(resetLabel(null,now),{relative:'重置时间暂无数据',absolute:''});
 assert.equal(resetLabel(now/1000-1,now).relative,'已到重置时间，请再次查询');
 assert.ok(resetLabel(now/1000+60,now).absolute.length>0);
});

test('bubble stays inside its display and moves beside a head near the top',()=>{
 const area={x:0,y:0,width:1000,height:700};
 const above=bubblePlacement({eye:{x:500,y:450},body:{x:420,y:350,width:160,height:200},area},184,120);
 assert.deepEqual(above,{x:408,y:220,tail:'bottom',tailX:92,tailY:101});
 const beside=bubblePlacement({eye:{x:900,y:65},body:{x:830,y:0,width:160,height:200},area},184,120);
 assert.equal(beside.tail,'right');assert.equal(beside.x,636);assert.equal(beside.y,8);
 const edge=bubblePlacement({eye:{x:995,y:450},body:{x:940,y:350,width:160,height:200},area},184,120);
 assert.equal(edge.x,808);assert.equal(edge.tailX,165);
});

// A minimal DOM for controller lifetimes; real layout and animation are checked in Electron.
class Element{
 constructor(){
  this.children=[];this.hidden=false;this.dataset={};this.offsetWidth=184;this.offsetHeight=120;
  this.style={setProperty:(key,value)=>{this.style[key]=value;}};
  this.classList={add:()=>{},remove:()=>{},toggle:()=>{}};
 }
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 setAttribute(key,value){this[key]=value;}
 animate(_frames,options){return{duration:options.duration,cancel(){this.cancelled=true;},onfinish:null};}
 remove(){this.removed=true;}
}
function text(element){return [element.textContent||'',...element.children.map(text)].join('');}
function byClass(element,className){return [element,...element.children.flatMap(child=>byClass(child,className))].filter(el=>el.className===className);}
function setup(t,readQuota){
 const saved={document:globalThis.document,matchMedia:globalThis.matchMedia,getComputedStyle:globalThis.getComputedStyle};
 globalThis.document={createElement:()=>new Element()};
 globalThis.matchMedia=()=>({matches:false});
 globalThis.getComputedStyle=()=>({opacity:'1',transform:'none'});
 t.after(()=>{for(const [key,value] of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
 const onChange=t.mock.fn(),stage=new Element();
 const bubble=new SpeechBubble(stage,{readQuota,onChange,getPlacement:()=>({eye:{x:500,y:450},body:{x:420,y:350,width:160,height:200},area:{x:0,y:0,width:1000,height:700}})});
 t.after(()=>bubble.destroy());
 return {bubble,onChange};
}
const context={scene:'reading',mode:'normal',form:'chibi'};
const quota={status:'ready',windows:[{label:'7天',remainingPercent:72,resetsAt:2000000000}],fetchedAt:1900000000000};
const finish=bubble=>bubble.effect.onfinish();

test('slow quota reads keep loading open and only start the four-second hold after results expand',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let resolve;const {bubble}=setup(t,()=>new Promise(done=>{resolve=done;}));
 bubble.click(context);finish(bubble);t.mock.timers.tick(6000);
 assert.equal(bubble.visible,true);assert.match(text(bubble.content),/正在查询/);
 resolve(quota);await Promise.resolve();finish(bubble);finish(bubble);
 assert.match(text(bubble.content),/72%/);t.mock.timers.tick(3999);assert.equal(bubble.kind,'info');
 t.mock.timers.tick(1);assert.equal(bubble.kind,null);finish(bubble);assert.equal(bubble.visible,false);
});

test('switching to dialogue while a quota request is pending discards its late response',async t=>{
 let resolve;const {bubble}=setup(t,()=>new Promise(done=>{resolve=done;}));
 bubble.click(context);finish(bubble);bubble.click(context);finish(bubble);finish(bubble);
 const line=text(bubble.content);assert.ok(DIALOGUES.reading.includes(line));
 resolve(quota);await Promise.resolve();assert.equal(bubble.kind,'dialogue');assert.equal(text(bubble.content),line);
});

test('hide cancels a pending result and the next click starts a fresh quota cycle',async t=>{
 const pending=[];const {bubble}=setup(t,()=>new Promise(resolve=>pending.push(resolve)));
 bubble.click(context);bubble.hide({immediate:true});pending[0](quota);await Promise.resolve();
 assert.equal(bubble.visible,false);bubble.click(context);assert.equal(pending.length,2);
 assert.equal(bubble.kind,'info');pending[1](quota);await Promise.resolve();
 finish(bubble);finish(bubble);assert.match(text(bubble.content),/72%/);
});

test('dialogue follows a new displayed state and a repeated state does not restart its timer',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const {bubble}=setup(t,()=>Promise.resolve(quota));
 bubble.setContext(context);bubble.showRandomLine();finish(bubble);
 t.mock.timers.tick(2000);bubble.setContext({...context});t.mock.timers.tick(999);assert.equal(bubble.kind,'dialogue');
 t.mock.timers.tick(1);finish(bubble);assert.equal(bubble.visible,false);
 bubble.showRandomLine();finish(bubble);bubble.setContext({...context,mode:'peek'});finish(bubble);finish(bubble);
 assert.ok(DIALOGUES.peek.includes(text(bubble.content)));
});

test('third-click hide cancels the deferred second-click dialogue',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const {bubble}=setup(t,()=>new Promise(()=>{}));
 bubble.click(context);finish(bubble);bubble.click(context,{count:2,canChangeForm:true});
 t.mock.timers.tick(300);bubble.hide({immediate:true});t.mock.timers.tick(1000);
 assert.equal(bubble.visible,false);assert.equal(bubble.kind,null);
});

test('unknown percentages do not create a meter or show zero; every returned window is rendered',t=>{
 const {bubble}=setup(t,()=>Promise.resolve(quota));
 bubble.renderQuota({status:'ready',windows:[{label:'7天',remainingPercent:null,resetsAt:null},{label:'5小时',remainingPercent:0,resetsAt:0}]});
 assert.equal(byClass(bubble.content,'quota-window').length,2);
 assert.equal(byClass(bubble.content,'quota-meter').length,1);
 assert.equal(byClass(bubble.content,'quota-amount')[0].textContent,'—');
 assert.match(text(bubble.content),/重置时间暂无数据/);
});

test('repeated hide calls neither restart the exit animation nor schedule idle callbacks',t=>{
 const {bubble,onChange}=setup(t,()=>new Promise(()=>{}));
 bubble.hide({immediate:true});bubble.hide({immediate:true});assert.equal(onChange.mock.callCount(),0);
 bubble.click(context);finish(bubble);bubble.hide();const exit=bubble.effect;bubble.hide();assert.equal(bubble.effect,exit);
 finish(bubble);const count=onChange.mock.callCount();bubble.hide({immediate:true});assert.equal(onChange.mock.callCount(),count);
});
