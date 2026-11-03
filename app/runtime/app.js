import {SessionState} from './state.js';
import {PetPresenter} from './presenter.js';
import {DisplayPolicy,dualFormScenes} from './display-policy.js';
import {DemoDriver} from './demo.js';
import {SubagentCompanions} from '../../assets/shared/subagents/scene.js';

const $=id=>document.getElementById(id);
let mode='demo',demo,local=null,transportError='',polling=false,epoch=0,idleSince=null,lastLocalActivity='',paused=false;
const preference=localStorage.getItem('dragon.taskForm');
const policy=new DisplayPolicy(preference==='chibi'?'chibi':'normal');
const companions=new SubagentCompanions($('stage'));
const subagentScenes=new Set(['thinking','reading','work','drawing']);
$('subagents').checked=sessionStorage.getItem('dragon.preview.subagents')==='true';
companions.ready.then(()=>{
 $('subagents').disabled=false;
 refresh();
}).catch(error=>{$('error').hidden=false;$('error').textContent=`小助手素材未能载入：${error.message}`;});
const presenter=new PetPresenter($('characters'),$('cloud'),{
 onChange:view=>{
  if(subagentScenes.has(view.scene))companions.setAnchor(presenter.current.element,{scene:view.scene,form:view.form});
  $('form-label').textContent=view.form==='chibi'?'Q版':'正比';$('error').hidden=true;
  $('review-current').href=`./inspect.html?scene=${view.scene}&form=${view.form}`;
 },
 onError:error=>{$('error').hidden=false;$('error').textContent=`动画未能载入：${error.message}`;}
});
function log(event,accepted=true){
 const item=document.createElement('li');item.textContent=`${new Date().toLocaleTimeString('zh-CN',{hour12:false})} · ${accepted?'':'忽略 · '}${event.type} ${event.callId||event.requestId||''}`;
 $('events').prepend(item);while($('events').children.length>40)$('events').lastChild.remove();
}
const currentState=()=>mode==='demo'?demo?.state:local;
function refresh(){
 const state=currentState();
 let facts=state?.presentation();
 if(!facts){
  facts={source:'local',sessionId:'unconnected',turnId:null,phase:'unknown',scene:'standby',waiting:false,waitingPose:false,suspended:true,sleeping:false,connection:'disconnected',canSleep:false,unread:false,tools:[],requests:[],toolCount:0,requestCount:0,blockingCount:0,label:'等待本地会话接入'};
 }
 if(mode==='local'&&transportError)facts={...facts,connection:'disconnected',suspended:true,sleeping:false,canSleep:false,label:transportError};
 if(facts.canSleep&&!facts.sleeping){
  idleSince??=Date.now();
  if(mode==='local'&&Date.now()-idleSince>=120000){state.setSleeping(true);facts=state.presentation();}
 }else if(!facts.canSleep)idleSince=null;
 const view=policy.select(facts);presenter.update({...view,suspended:view.suspended||paused});
 const subagentsAvailable=mode==='demo'&&facts.phase==='running'&&facts.connection==='connected'&&!facts.suspended&&subagentScenes.has(facts.scene);
 $('subagent-control').hidden=!subagentsAvailable;$('helper-review').hidden=!subagentsAvailable;
 const helpersActive=subagentsAvailable&&$('subagents').checked;
 if(companions.active!==helpersActive||!subagentsAvailable&&companions.review){
  companions.setActive(helpersActive);$('helper-frame-label').textContent='';
 }
 companions.setPaused(subagentsAvailable&&(view.suspended||paused));
 const sceneNames={standby:'待机陪伴',thinking:'站立思考',reading:'阅读',work:'工作',drawing:'绘图'};
 const companion=view.scene==='standby'&&presenter.current?.animation.kind==='standby'?presenter.current.animation.frame:null;
 $('scene-title').textContent=companion?.state==='waking'?'唤醒 · 掩嘴哈欠':facts.sleeping?'休眠与唤醒':`${sceneNames[view.scene]}${facts.waitingPose?' · 待确认':''}`;
 $('status').textContent=facts.label;
 $('mode-badge').textContent=mode==='demo'?'演练':facts.connection==='connected'?'本地会话':'未连接';
 $('read-result').hidden=!facts.unread;
 $('facts').textContent=`活动工具 ${facts.toolCount} · 未决请求 ${facts.requestCount} · 阻塞请求 ${facts.blockingCount}${facts.turnId?` · 轮次 ${facts.turnId}`:''}`;
 for(const button of $('demo-panel').querySelectorAll('button[data-state]')){
  const name=facts.sleeping?'sleep':facts.waiting?`${facts.scene}-wait`:facts.scene;
  button.setAttribute('aria-pressed',String(button.dataset.state===name));
 }
 $('touch').disabled=facts.suspended||paused;
 $('touch').textContent=facts.sleeping?'唤醒她':'摸摸她';
 $('switch-form').hidden=!dualFormScenes.has(view.scene);
 $('switch-form').disabled=!dualFormScenes.has(view.scene);
 $('switch-form').textContent=view.form==='normal'?'切换为Q版':'切换为正比';
 $('pause').textContent=paused?'继续动画':'暂停动画';$('pause').setAttribute('aria-pressed',String(paused));
 $('hint').textContent=paused?'动画已暂停，点击“继续动画”从当前动作继续。'
  :companion?.state==='waking'?`${companion.stage} · 动作结束后会自然回到陪伴。`
  :facts.sleeping?'点击她：先微微睁眼，再掩嘴打哈欠，醒来后回到陪伴。'
  :view.scene==='standby'?'点击她会眨眼并轻轻振翅；选择休眠，可以观看完整的掩嘴唤醒动作。'
  :dualFormScenes.has(view.scene)?'点击回应；也可右键或快速三连击切换Q版与正比。':'点击她，看看她的回应。';
}
demo=new DemoDriver(refresh,log,(text,running)=>{$('progress').textContent=text;$('stop').disabled=!running;$('run').textContent=running?'重新播放':'播放流程';});
refresh();

async function poll(){
 if(mode!=='local'||polling)return;
 const thisEpoch=epoch;polling=true;
 try{
  const response=await fetch('./bridge/session.json',{cache:'no-store'});
  if(!response.ok)throw new Error(response.status===404?'等待本地会话接入':`接入文件读取失败（${response.status}）`);
  const snapshot=await response.json();
  if(mode!=='local'||thisEpoch!==epoch)return;
  if(!local)local=new SessionState({source:snapshot.source,sessionId:snapshot.sessionId});
  if(local.source!==snapshot.source||local.sessionId!==snapshot.sessionId)throw new Error('接入文件已切换会话，请重新选择“本地会话”以跟随');
  if(snapshot.source==='codex-replay')throw new Error('该文件来自事件回放，不能作为实时会话');
  if(!Number.isFinite(snapshot.heartbeatAt))throw new Error('接入文件缺少来源心跳');
  if(snapshot.revision<local.revision)throw new Error('来源快照已过期 · 等待新的状态同步');
  const accepted=local.applySnapshot(snapshot);
  const activity=JSON.stringify([snapshot.phase,snapshot.outcome,snapshot.connection,snapshot.tools,snapshot.requests]);
  if(accepted&&activity!==lastLocalActivity){log({type:`snapshot · ${snapshot.source} / ${snapshot.phase}`});lastLocalActivity=activity;}
  transportError=snapshot.connection==='connected'&&Date.now()-snapshot.heartbeatAt>5000?'来源心跳已停止 · 当前状态不可确认':'';
  $('session-label').textContent=`${snapshot.source} · ${snapshot.sessionId}`;
 }catch(error){if(mode==='local'&&thisEpoch===epoch)transportError=error.message;}
 finally{polling=false;if(mode==='local'&&thisEpoch===epoch)refresh();}
}
$('source').onchange=()=>{
 mode=$('source').value;epoch++;demo.stop();local=null;transportError='';idleSince=null;lastLocalActivity='';policy.task=null;
 $('demo-panel').hidden=mode!=='demo';$('local-panel').hidden=mode!=='local';$('events').replaceChildren();
 if(mode==='demo')demo.enter('standby');else poll();refresh();
};
$('subagents').onchange=()=>{
 sessionStorage.setItem('dragon.preview.subagents',String($('subagents').checked));
 companions.resumeReview();$('helper-frame-label').textContent='';
 refresh();
};
for(let i=0;i<16;i++){
 const button=document.createElement('button');button.textContent=String(i+1).padStart(2,'0');
 button.onclick=()=>{
  const action=$('helper-action').value;
  if(action!=='entry'){
   companions.setOrbitReviewTime(i/15);
   $('helper-frame-label').textContent=`第 ${i+1}/16 帧 · 双云同步环绕`;
   return;
  }
  const progress=i<=5?i/5:i<=10?1:(15-i)/5;
  const seconds=i<=5?0:i<=10?(i-5)*.9:4.5;
  companions.setReviewTime(progress,seconds);
  $('helper-frame-label').textContent=`第 ${i+1}/16 帧 · ${i<=5?'飘出':i<=10?'漂浮':'退出'}`;
 };
 $('helper-frames').append(button);
}
$('helper-action').onchange=()=>$('helper-frames').firstElementChild.click();
$('helper-resume').onclick=()=>{companions.resumeReview();$('helper-frame-label').textContent='';};
$('background').onclick=()=>{const light=$('stage').classList.toggle('light');$('background').textContent=light?'深色背景':'浅色背景';};
function touch(){
 const state=currentState();idleSince=Date.now();
 if(state?.sleeping){state.setSleeping(false);refresh();}
 else if(presenter.touch())companions.triggerOrbit();
}
$('touch').onclick=touch;
$('pause').onclick=()=>{paused=!paused;refresh();};
function changeForm(){
 if(presenter.busy||!dualFormScenes.has(presenter.desired?.scene))return;
 policy.toggle();localStorage.setItem('dragon.taskForm',policy.taskForm);$('menu').hidden=true;refresh();
}
$('characters').addEventListener('click',event=>{
 if(event.target.tagName!=='CANVAS')return;
 // Native click counting respects the OS double-click interval. Only click 3
 // transforms; later clicks in the same burst cannot flip the form again.
 if(event.detail===3&&dualFormScenes.has(presenter.desired?.scene))changeForm();
 else if(event.detail<3)touch();
});
$('characters').addEventListener('contextmenu',event=>{
 if(!dualFormScenes.has(presenter.desired?.scene))return;
 event.preventDefault();$('menu').hidden=false;
 $('change-form').textContent=policy.taskForm==='normal'?'变成 Q 版小龙娘':'变成正比龙娘';
 $('menu').style.left=`${Math.min(event.clientX,innerWidth-220)}px`;
 $('menu').style.top=`${Math.min(event.clientY,innerHeight-70)}px`;
 $('change-form').focus();
});
$('change-form').onclick=changeForm;
$('switch-form').onclick=changeForm;
document.addEventListener('pointerdown',event=>{if(!$('menu').contains(event.target))$('menu').hidden=true;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')$('menu').hidden=true;});
$('demo-panel').onclick=event=>{const name=event.target.closest('button[data-state]')?.dataset.state;if(name)demo.enter(name);};
$('run').onclick=()=>demo.run($('scenario').value);
$('stop').onclick=()=>demo.stop();
$('read-result').onclick=()=>{currentState()?.markRead();refresh();};
document.addEventListener('visibilitychange',()=>presenter.setVisible(!document.hidden));
const ticker=setInterval(refresh,100),poller=setInterval(poll,400);
addEventListener('pagehide',()=>{clearInterval(ticker);clearInterval(poller);demo.stop();companions.destroy();presenter.destroy();},{once:true});
