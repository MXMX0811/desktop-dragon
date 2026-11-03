import {createAnimation} from './animation-host.js';
import {SubagentCompanions} from '../../assets/shared/subagents/scene.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const scenes=['standby','reading','work','drawing','thinking'];
if(scenes.includes(params.get('scene'))) $('scene').value=params.get('scene');
if(params.get('form')==='normal') $('form').value='normal';
const companions=new SubagentCompanions($('stage'));
await companions.ready;
$('subagents').checked=sessionStorage.getItem('dragon.preview.subagents')==='true';
const syncCompanions=()=>{const task=$('scene').value!=='standby';$('subagent-control').hidden=!task;companions.setActive(task&&$('subagents').checked);companions.setPaused(paused);};
let host,waiting=false,sleeping=false,paused=false,generation=0;
async function load(){
 const id=++generation;
 companions.setPaused(true);companions.setActive(false);$('subagents').disabled=true;
 host?.destroy();host=null;waiting=sleeping=paused=false;
 const kind=$('scene').value;
 const dual=['reading','work','drawing'].includes(kind);
 $('form').disabled=!dual;if(!dual)$('form').value='chibi';
 for(const key of ['waiting','sleep','touch','pause'])$(key).disabled=true;
 $('waiting').textContent='等待确认';$('sleep').textContent='休眠';$('pause').textContent='暂停';
 $('status').textContent='正在加载…';
 try{
  const next=await createAnimation(kind,$('form').value,$('pet'),{size:Number($('size').value)});
  if(id!==generation){next.destroy();return;}
  host=next;
  $('stage').style.padding=Math.max(24,Number($('size').value)*.21)+'px';
  if(kind!=='standby')companions.setAnchor(host.canvas,{scene:kind,form:$('form').value});
  $('subagents').disabled=false;syncCompanions();
  $('waiting').disabled=!dual;$('sleep').disabled=kind!=='standby';$('touch').disabled=false;$('pause').disabled=false;
  $('status').textContent='已加载 · 点击角色或按钮检查互动';
 }catch(error){if(id===generation)$('status').textContent=error.message;}
}
for(const key of ['scene','form'])$(key).onchange=load;
$('size').onchange=()=>{if(!host)return;companions.setPaused(true);$('stage').style.padding=Math.max(24,Number($('size').value)*.21)+'px';host.resize(Number($('size').value));if(host.kind!=='standby')companions.setAnchor(host.canvas,{scene:host.kind,form:host.form});syncCompanions();};
$('subagents').onchange=()=>{sessionStorage.setItem('dragon.preview.subagents',String($('subagents').checked));syncCompanions();};
$('waiting').onclick=()=>{waiting=!waiting;host.setWaiting(waiting);$('waiting').textContent=waiting?'继续动作':'等待确认';};
$('sleep').onclick=()=>{sleeping=!sleeping;host.setSleeping(sleeping);$('sleep').textContent=sleeping?'唤醒':'休眠';};
const touch=()=>{if(!host)return;if(sleeping){sleeping=false;host.setSleeping(false);$('sleep').textContent='休眠';}else if(host.touch())companions.triggerOrbit();};
$('pet').onclick=touch;$('touch').onclick=touch;
$('pause').onclick=()=>{paused=!paused;host.setSuspended(paused);companions.setPaused(paused);$('pause').textContent=paused?'继续':'暂停';};
$('background').onclick=()=>{$('background').textContent=$('stage').classList.toggle('light')?'深色背景':'浅色背景';};
addEventListener('pagehide',()=>{generation++;companions.destroy();host?.destroy();},{once:true});
load();
