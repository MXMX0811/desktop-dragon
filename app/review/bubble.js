import {createAnimation} from '../runtime/animation-host.js';
import {displaySize,dualFormScenes} from '../runtime/display-policy.js';
import {taskEye} from '../runtime/interaction-scenes.js';
import {SubagentCompanions} from '../../assets/shared/subagents/scene.js';

const $=id=>document.getElementById(id),stage=$('stage'),pet=$('pet'),bubble=$('bubble'),content=$('bubble-content');
const names={standby:'陪伴',reading:'阅读',work:'工作',drawing:'绘图动作预览',thinking:'思考'};
const lines={
 standby:['要不要一起歇一会儿？','我就在这里陪着你。','忙完了，也记得伸个懒腰。'],
 reading:['等我把这一页看完。','这一段，好像有点意思。','书借你一半，尾巴可不借。'],
 work:['我在呢，继续忙你的吧。','键盘有点忙，翅膀也不闲着。','等这一小段结束，一起歇会儿。'],
 drawing:['这一笔画在这里怎么样？','再添一点点紫色。','灵感刚刚从尾巴尖溜过去了。'],
 thinking:['让我再想一小会儿。','唔……换个角度看看。','别急，我还在琢磨呢。'],
};
// Fixtures only. This preview never reads account, hook or conversation data.
const previewAgents=new Set(['reading','work','thinking']);
let host,companions,scene='work',form='chibi',kind=null,line=0,timer=null,effect=null,generation=0,disposed=false;

function position(){
 if(!host)return;
 const width=host.container.offsetWidth,height=host.container.offsetHeight;
 stage.style.height=`${Math.max(560,height+64+42+10+(bubble.hidden?0:bubble.offsetHeight))}px`;
 pet.style.left=`${(stage.clientWidth-width)/2}px`;
 pet.style.top=`${stage.clientHeight-64-height}px`;
 if(bubble.hidden)return;
 const eye=taskEye({scene,form},pet,stage),r=pet.getBoundingClientRect(),s=stage.getBoundingClientRect();
 const left=Math.max(12,Math.min(stage.clientWidth-bubble.offsetWidth-12,eye.x-bubble.offsetWidth/2));
 bubble.style.left=`${left}px`;
 bubble.style.top=`${Math.max(42,r.top-s.top-bubble.offsetHeight-10)}px`;
 bubble.style.setProperty('--tail-x',`${Math.max(19,Math.min(bubble.offsetWidth-19,eye.x-left))}px`);
}
function updateStatus(){
 $('status').textContent=!kind?'气泡已收起 · 再次点击显示信息':$('pin').checked?'已固定 · 可直接切换状态和台词检视':kind==='info'?'信息展示中 · 6秒后收起':'预置台词 · 5秒后收起';
}
function armTimer(){
 clearTimeout(timer);timer=null;
 if(kind&&!$('pin').checked)timer=setTimeout(hide,kind==='info'?6000:5000);
 updateStatus();
}
function show(markup,nextKind){
 const opening=bubble.hidden;
 effect?.cancel();clearTimeout(timer);
 content.innerHTML=markup;kind=nextKind;bubble.hidden=false;position();
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 effect=(opening?bubble:content).animate(opening?[
  {opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}
 ]:[{opacity:.35},{opacity:1}],{duration:reduced?0:opening?180:100,easing:'cubic-bezier(.2,.7,.3,1)'});
 armTimer();
}
function hide(){
 clearTimeout(timer);timer=null;kind=null;line=0;effect?.cancel();
 const animation=bubble.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(3px)'}],{duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:160,easing:'ease-out'});
 effect=animation;animation.onfinish=()=>{if(effect!==animation)return;bubble.hidden=true;animation.cancel();effect=null;};
 updateStatus();
}
function showInfo(){
 if(!host)return;
 line=0;const sample=$('sample').value;
 bubble.classList.toggle('low',sample==='low');
 const heading='<span class="title quota-title">剩余额度<span class="sample-tag">示例</span></span>';
 if(sample==='missing')show(`<div class="bubble-heading">${heading}</div><p class="no-data">账户用量暂无数据</p>`,'info');
 else{
  const remaining=sample==='low'?12:72;
  show(`<div class="bubble-heading">${heading}<span class="amount">${remaining}<small>%</small></span></div><div class="meter" style="--remaining:${remaining}%" aria-label="剩余${remaining}%"><span></span></div><p class="reset">${sample==='low'?'38 分钟':'2 小时 12 分钟'}后重置</p>`,'info');
 }
}
function clickPet(){
 if(!host)return;
 host.touch();companions?.triggerOrbit();
 if(!kind){showInfo();return;}
 bubble.classList.remove('low');
 const text=lines[scene][line++%lines[scene].length];
 show(`<div class="bubble-heading"><span class="title"><span class="spark" aria-hidden="true">✧</span>小龙娘</span><span class="sample-tag">预置台词</span></div><p class="dialogue">${text}</p>`,'dialogue');
}
async function load(){
 const id=++generation;clearTimeout(timer);effect?.cancel();kind=null;line=0;bubble.hidden=true;
 $('error').hidden=true;$('loading').hidden=false;$('next').disabled=$('show-info').disabled=true;
 companions?.destroy();companions=null;host?.destroy();host=null;pet.replaceChildren();
 scene=$('scene').value;$('form').disabled=!dualFormScenes.has(scene);
 if($('form').disabled)$('form').value='chibi';form=$('form').value;
 const nextScene=scene,nextForm=form;
 // Pending loads own their layout, so discarded scenes cannot resize the visible pet.
 const container=document.createElement('div');
 try{
  const next=await createAnimation(nextScene,nextForm,container,{size:displaySize(nextScene,nextForm)});
  if(id!==generation||disposed){next.destroy();return;}
  host=next;pet.replaceChildren(container);
  pet.style.width=container.style.width;pet.style.height=container.style.height;position();
  if(nextScene!=='standby'){
   const helpers=new SubagentCompanions(stage);companions=helpers;await helpers.ready;
   if(id!==generation||disposed){helpers.destroy();return;}
   helpers.setAnchor(pet,{scene:nextScene,form:nextForm});helpers.setActive(previewAgents.has(nextScene));
  }
  $('scale-label').textContent=`当前桌面尺寸 · ${nextForm==='chibi'?'Q 版':'正比'} · ${names[nextScene]}`;
  $('stage-scroll').scrollLeft=(stage.clientWidth-$('stage-scroll').clientWidth)/2;
  $('loading').hidden=true;$('next').disabled=$('show-info').disabled=false;showInfo();
 }catch(error){if(id!==generation||disposed)return;$('loading').hidden=true;$('error').hidden=false;$('error').textContent=`预览加载失败：${error.message}`;}
}
$('scene').onchange=load;$('form').onchange=load;$('sample').onchange=showInfo;
$('show-info').onclick=showInfo;$('next').onclick=clickPet;pet.onclick=clickPet;
pet.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();clickPet();}};
$('pin').onchange=armTimer;
$('background').onclick=()=>{$('background').textContent=stage.classList.toggle('night')?'浅色背景':'深色背景';};
const resize=new ResizeObserver(position);resize.observe(stage);
addEventListener('pagehide',()=>{disposed=true;generation++;clearTimeout(timer);effect?.cancel();resize.disconnect();companions?.destroy();host?.destroy();},{once:true});
load();
