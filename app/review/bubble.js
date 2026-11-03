import {createAnimation} from '../runtime/animation-host.js';
import {displaySize,dualFormScenes} from '../runtime/display-policy.js';
import {taskEye,createDrag,createPeek} from '../runtime/interaction-scenes.js';
import {SubagentCompanions} from '../../assets/shared/subagents/scene.js';
import {DIALOGUES,EASTER_EGGS} from '../runtime/dialogue-lines.js';

const $=id=>document.getElementById(id),stage=$('stage'),pet=$('pet'),bubble=$('bubble'),content=$('bubble-content');
const names={standby:'待机',sleep:'休眠',reading:'阅读',work:'工作',drawing:'绘图动作预览',thinking:'思考',drag:'拖动姿态','peek-left':'左侧扒边','peek-right':'右侧扒边'};
const holdMs={info:4000,dialogue:3000};
// Review controls and fictional quota only; no account or session connection.
let loaded=false;
let host,special,container,companions,pose='work',scene='work',form='chibi';
let kind=null,selectedLine=null,caption='',timer=null,effect=null,showing=false,generation=0,disposed=false,dragFrame=0;
const ready=()=>loaded;
const group=()=>special?special.kind:$('waiting').checked?'waiting':$('agents').checked?'subagents':pose;

function position(){
 if(!container)return;
 const width=container.offsetWidth,height=container.offsetHeight;
 stage.style.height=`${Math.max(560,height+64+42+10+(bubble.hidden?0:bubble.offsetHeight))}px`;
 let eye;
 if(special?.kind==='peek'){
  const side=pose==='peek-left'?'left':'right';
  special.scene.place({side,edgeX:side==='left'?0:stage.clientWidth,eyeY:stage.clientHeight-64-height+special.anchor.y});
  pet.style.left=container.style.left;pet.style.top=container.style.top;
  container.style.left=container.style.top='0px';eye=special.scene.eye();
 }else{
  pet.style.left=`${(stage.clientWidth-width)/2}px`;pet.style.top=`${stage.clientHeight-64-height}px`;
  if(special){eye={x:pet.offsetLeft+special.anchor.x,y:pet.offsetTop+special.anchor.y};}
  else eye=taskEye({scene,form},pet,stage);
 }
 if(bubble.hidden)return;
 const r=pet.getBoundingClientRect(),s=stage.getBoundingClientRect();
 const left=Math.max(12,Math.min(stage.clientWidth-bubble.offsetWidth-12,eye.x-bubble.offsetWidth/2));
 bubble.style.left=`${left}px`;bubble.style.top=`${Math.max(42,r.top-s.top-bubble.offsetHeight-10)}px`;
 bubble.style.setProperty('--tail-x',`${Math.max(19,Math.min(bubble.offsetWidth-19,eye.x-left))}px`);
}
function updateStatus(){
 $('status').textContent=!kind?'气泡已收起 · 再次点击显示信息':`${caption} · ${$('pin').checked?'已固定':`${holdMs[kind]/1000}秒后收起`}`;
 for(const [index,button] of [...$('line-options').children].entries())button.setAttribute('aria-pressed',String(kind==='dialogue'&&selectedLine===index));
}
function armTimer(){
 clearTimeout(timer);timer=null;
 if(kind&&!showing&&!$('pin').checked)timer=setTimeout(hide,holdMs[kind]);
 updateStatus();
}
function currentAppearance(){
 const style=getComputedStyle(bubble);
 return {opacity:style.opacity,transform:style.transform};
}
function animateBubble(frames,duration,easing,finish){
 effect?.cancel();
 const animation=bubble.animate(frames,{
  duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:duration,
  easing,fill:'both',
 });
 effect=animation;
 animation.onfinish=()=>{
  if(effect!==animation)return;
  // Keep the last frame applied until the next animation or hidden state is ready.
  finish();
  if(effect===animation){effect=null;animation.cancel();}
 };
}
function present(nextKind,render){
 const opening=bubble.hidden,from=opening?null:currentAppearance();
 clearTimeout(timer);timer=null;kind=nextKind;showing=true;updateStatus();
 const enter=()=>{
  render();bubble.hidden=false;position();
  // Reposition while invisible; growing from the tail keeps the response attached to the pet.
  animateBubble([
   {opacity:0,transform:'translateY(7px) scale(.9)',offset:0},
   {opacity:1,transform:'translateY(-1px) scale(1.025)',offset:.7},
   {opacity:1,transform:'translateY(0) scale(1)',offset:1},
  ],300,'cubic-bezier(.22,.7,.3,1)',()=>{showing=false;armTimer();});
 };
 if(opening)enter();
 else animateBubble([from,{opacity:0,transform:'translateY(4px) scale(.94)'}],140,'ease-in',enter);
}
function hide(){
 clearTimeout(timer);timer=null;kind=null;showing=false;selectedLine=null;
 animateBubble([currentAppearance(),{opacity:0,transform:'translateY(7px) scale(.9)'}],210,'cubic-bezier(.4,0,.8,.4)',()=>{bubble.hidden=true;});updateStatus();
}
function showInfo(){
 if(!ready())return;
 selectedLine=null;caption='剩余额度示例';const sample=$('sample').value;
 const heading='<span class="title quota-title">剩余额度<span class="sample-tag">示例</span></span>';
 let markup;
 if(sample==='missing')markup=`<div class="bubble-heading">${heading}</div><p class="no-data">账户用量暂无数据</p>`;
 else{
  const remaining=sample==='low'?12:72;
  markup=`<div class="bubble-heading">${heading}<span class="amount">${remaining}<small>%</small></span></div><div class="meter" style="--remaining:${remaining}%" aria-label="剩余${remaining}%"><span></span></div><p class="reset">${sample==='low'?'38 分钟':'2 小时 12 分钟'}后重置</p>`;
 }
 present('info',()=>{bubble.classList.toggle('low',sample==='low');content.innerHTML=markup;});
}
function showText(text){
 const p=document.createElement('p');p.className='dialogue';
 // Short clauses stay together; longer clauses still wrap within the narrow bubble.
 for(const phrase of text.match(/[^，。！？～…]+[，。！？～…]*|[，。！？～…]+/gu)){
  const span=document.createElement('span');span.className='phrase';span.textContent=phrase;p.append(span);
 }
 present('dialogue',()=>{content.replaceChildren(p);bubble.classList.remove('low');});
}
function showLine(index){
 if(!ready())return;
 const entry=DIALOGUES[group()];selectedLine=index;
 caption=`${entry.label} · 台词 ${index+1}/${entry.lines.length}`;showText(entry.lines[index]);
}
function showRandomLine(){
 const count=DIALOGUES[group()].lines.length;
 if(count===1){showLine(0);return;}
 const previous=kind==='dialogue'?selectedLine:null;
 // Choose uniformly from the current group, excluding the last selected line.
 let index=Math.floor(Math.random()*(count-(previous===null?0:1)));
 if(previous!==null&&index>=previous)index++;
 showLine(index);
}
function reviewLines(){
 const entry=DIALOGUES[group()];$('dialogue-label').textContent=`${entry.label} · ${entry.lines.length}句预置对话`;
 $('line-options').style.setProperty('--line-count',entry.lines.length);
 $('context-note').textContent=$('waiting').checked&&$('agents').checked?'待确认台词优先，小云朵继续陪伴':`正在检视${entry.label}台词`;
 $('line-options').replaceChildren(...entry.lines.map((text,index)=>{
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed','false');
  const number=document.createElement('span');number.className='line-number';number.textContent=String(index+1);
  const line=document.createElement('span');line.textContent=text;button.append(number,line);button.onclick=()=>showLine(index);return button;
 }));
}
function syncContext(){
 if(!ready())return;
 if(host)host.setWaiting($('waiting').checked);
 if(companions){companions.setActive($('agents').checked);}
 selectedLine=null;reviewLines();showRandomLine();
}
function feedback(){
 if(host){
  if(pose==='sleep'){
   host.setSleeping(false);pose='standby';$('scene').value='standby';$('scale-label').textContent='当前桌面尺寸 · Q 版 · 待机';
   selectedLine=null;reviewLines();
  }else host.touch();
 }else if(special.kind==='drag')special.scene.move(10,-4,.1);
 companions?.triggerOrbit();
}
function clickPet(){
 if(!ready())return;
 feedback();if(!kind)showInfo();else showRandomLine();
}
function runDrag(){
 cancelAnimationFrame(dragFrame);dragFrame=0;
 if(special?.kind!=='drag'||document.hidden)return;
 let last=null;
 const tick=now=>{
  if(disposed||special?.kind!=='drag'||document.hidden)return;
  special.scene.tick(last===null?0:Math.min(.1,(now-last)/1000));last=now;dragFrame=requestAnimationFrame(tick);
 };dragFrame=requestAnimationFrame(tick);
}
async function load(){
 const id=++generation;loaded=false;clearTimeout(timer);effect?.cancel();effect=null;showing=false;cancelAnimationFrame(dragFrame);kind=null;selectedLine=null;bubble.hidden=true;
 $('error').hidden=true;$('loading').hidden=false;
 for(const key of ['next','show-info','show-easter'])$(key).disabled=true;
 $('line-options').replaceChildren();companions?.destroy();companions=null;host?.destroy();host=null;special?.scene.destroy();special=null;container=null;pet.replaceChildren();
 pose=$('scene').value;scene=pose==='sleep'?'standby':pose;
 const task=dualFormScenes.has(scene),agents=task||scene==='thinking';
 $('form').disabled=!task;if(!task)$('form').value='chibi';form=$('form').value;
 $('waiting-control').hidden=!task;$('agents-control').hidden=!agents;
 if(!task)$('waiting').checked=false;if(!agents)$('agents').checked=false;
 const nextPose=pose,nextScene=scene,nextForm=form,element=document.createElement('div');
 // Each pending load owns its layout until selected; stale loads cannot resize the visible pet.
 try{
  if(nextScene==='drag'||nextScene.startsWith('peek-')){
   const isDrag=nextScene==='drag',animation=await(isDrag?createDrag(element):createPeek(element));
   if(id!==generation||disposed){animation.destroy();return;}
   element.style.position='relative';
   if(isDrag)animation.place({x:0,y:0});
   else animation.place({side:nextPose==='peek-left'?'left':'right',edgeX:0,eyeY:0});
   const eye=animation.eye(),anchor={x:eye.x-parseFloat(element.style.left),y:eye.y-parseFloat(element.style.top)};
   special={kind:isDrag?'drag':'peek',scene:animation,anchor};
   if(isDrag){animation.place(anchor);animation.begin();}
  }else{
   const next=await createAnimation(nextScene,nextForm,element,{size:displaySize(nextScene,nextForm)});
   if(id!==generation||disposed){next.destroy();return;}host=next;
   if(nextPose==='sleep')host.setSleeping(true);
  }
  container=element;pet.replaceChildren(element);pet.style.width=element.style.width;pet.style.height=element.style.height;position();runDrag();
  if(agents){
   const helpers=new SubagentCompanions(stage);companions=helpers;await helpers.ready;
   if(id!==generation||disposed){helpers.destroy();return;}helpers.setAnchor(pet,{scene:nextScene,form:nextForm});
  }
  $('scale-label').textContent=`当前桌面尺寸 · ${nextForm==='chibi'?'Q 版':'正比'} · ${names[nextPose]}`;
  $('stage-scroll').scrollLeft=nextPose==='peek-left'?0:nextPose==='peek-right'?stage.clientWidth-$('stage-scroll').clientWidth:(stage.clientWidth-$('stage-scroll').clientWidth)/2;
  $('stage-hint').textContent=special?'姿态定点预览 · 点击随机回应':'点击龙娘 · 随机回应当前状态';
  $('loading').hidden=true;loaded=true;for(const key of ['next','show-info','show-easter'])$(key).disabled=false;syncContext();
 }catch(error){if(id!==generation||disposed)return;$('loading').hidden=true;$('error').hidden=false;$('error').textContent=`预览加载失败：${error.message}`;}
}
$('easter').replaceChildren(...EASTER_EGGS.map((item,index)=>new Option(item.label,String(index))));
$('show-easter').onclick=()=>{
 if(!ready())return;
 const item=EASTER_EGGS[Number($('easter').value)];selectedLine=null;caption=`彩蛋文案 · ${item.label}`;showText(item.text);
};
$('scene').onchange=load;$('form').onchange=load;$('sample').onchange=showInfo;
$('waiting').onchange=syncContext;$('agents').onchange=syncContext;
$('show-info').onclick=showInfo;$('next').onclick=clickPet;pet.onclick=clickPet;
pet.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();clickPet();}};
$('pin').onchange=armTimer;
$('background').onclick=()=>{$('background').textContent=stage.classList.toggle('night')?'浅色背景':'深色背景';};
const resize=new ResizeObserver(position);resize.observe(stage);
const visibility=()=>{if(document.hidden)cancelAnimationFrame(dragFrame);else runDrag();};document.addEventListener('visibilitychange',visibility);
addEventListener('pagehide',()=>{disposed=true;generation++;clearTimeout(timer);effect?.cancel();cancelAnimationFrame(dragFrame);document.removeEventListener('visibilitychange',visibility);resize.disconnect();companions?.destroy();host?.destroy();special?.scene.destroy();},{once:true});
load();
