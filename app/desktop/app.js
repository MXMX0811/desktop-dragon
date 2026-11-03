import {PetPresenter} from '../runtime/presenter.js';
import {PetInteraction} from '../runtime/pet-interaction.js';
import {dualFormScenes} from '../runtime/display-policy.js';
import {DRAG_EDGE_WIDTH,taskEye,createDrag,createFlight,createPeek} from '../runtime/interaction-scenes.js';
import {areaAt,outsideEdge,union} from './geometry.js';
import {SubagentCompanions} from '../../assets/shared/subagents/scene.js';

const $=id=>document.getElementById(id),bridge=window.dragon;
const stage=$('stage'),characters=$('characters');
let companions;
let layout,areas=[],interaction,presenter,view={scene:'standby',form:'chibi',waiting:false,sleeping:false,suspended:false};
let eye,frame=0,lastReport='',snapshot=null,following=true,disposed=false;
let form=localStorage.getItem('dragon.taskForm')==='normal'?'normal':'chibi';

function positionPanel(){
 if($('panel').hidden||!presenter?.current)return;
 const area=areaAt(eye,areas),r=$('panel').getBoundingClientRect();
 const body=rect(presenter.current.element),gap=18;
 let x,y;
 if(area.x+area.width-body.x-body.width>=r.width+gap){
  x=body.x+body.width+gap;y=body.y;
 }else if(body.x-area.x>=r.width+gap){
  x=body.x-r.width-gap;y=body.y;
 }else{
  x=eye.x-r.width/2;
  y=body.y-area.y>=r.height+gap?body.y-r.height-gap:body.y+body.height+gap;
 }
 $('panel').style.left=`${Math.max(area.x+8,Math.min(area.x+area.width-r.width-8,x))}px`;
 $('panel').style.top=`${Math.max(area.y+8,Math.min(area.y+area.height-r.height-8,y))}px`;
}
function closePanel(){$('panel').hidden=true;scheduleReport();}
function eventTime(value){return value?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'暂无';}
function renderConnection(){
 const connection=snapshot?.connection,registration=snapshot?.registration;
 $('connection-status').textContent=connection?.enabled===true?'已开启':connection?.enabled===false?'已关闭':'状态未知';
 $('connection-hint').textContent=connection?.enabled===true
  ?connection.lastObservedAt?`本次最近事件：${eventTime(connection.lastObservedAt)}`:'等待新事件；已打开的聊天可能需要重新打开以加载钩子。'
  :connection?.enabled===false?'可通过右键菜单启用采集。':'采集状态暂不可用。';
 $('connection-received').textContent=eventTime(connection?.lastReceivedAt);
 $('connection-count').textContent=Number.isFinite(connection?.receivedCount)?`${connection.receivedCount} 条`:'未知';
 $('connection-registration').textContent=Number.isFinite(registration?.eventCount)&&Number.isFinite(registration?.total)?`${registration.eventCount} / ${registration.total}`:'未知';
 $('connection-error').hidden=!connection?.error;
 $('connection-error').textContent=connection?.error?`采集设置失败：${connection.error}`:'';
 $('registration-error').hidden=!registration?.error;
 $('registration-error').textContent=registration?.error?`注册检查失败：${registration.error}`:'';
}
function renderPanel(){
 renderConnection();
 $('panel-mode').textContent=following?'跟随已观察到的 Codex 活动':'正在审阅本地动作 · 未改变会话状态';
 const list=$('sessions');list.replaceChildren();
 if(snapshot?.error){const p=document.createElement('p');p.textContent=`状态读取失败：${snapshot.error}`;list.append(p);}
 const sessions=snapshot?.sessions||[];
 if(snapshot?.activity){const p=document.createElement('p');p.textContent=`已观察活动会话 ${snapshot.activity.activeCount} · 工具 ${snapshot.activity.toolCount} · 子代理 ${snapshot.activity.agentCount}`;list.append(p);}
 if(!sessions.length){const p=document.createElement('p');p.textContent='暂无可显示的会话记录。';list.append(p);}
 const stateNames={activity_observed:'观察到本轮活动',tool_running:'执行工具',agent_running:'子代理活动',permission_requested:'观察到权限请求，结果未知',compacting:'整理上下文',session_ended:'会话已结束',unknown:'当前状态未知',interrupted:'已中断',stop_observed:'观察到停止事件，完成状态未知'};
 for(const session of sessions){
  const item=document.createElement('div');item.className='session';
  const title=document.createElement('strong');title.textContent=`Codex · ${session.session_id.slice(0,12)}`;
  const detail=document.createElement('span');
  detail.textContent=session.history?'历史记录 · 当前状态未知':`${stateNames[session.state]||session.state} · 工具 ${session.active_tools??0} · 子代理 ${session.active_agents??0}`;
  item.append(title,detail);list.append(item);
 }
 positionPanel();scheduleReport();
}
function openPanel(){if(interaction.active)return;$('panel').hidden=false;renderPanel();}
function touch(count){
 if(count===3&&dualFormScenes.has(view.scene)){changeForm();return;}
 if(count>3)return;
 if(view.sleeping){view={...view,sleeping:false};interaction.setTarget(view);return;}
 presenter.touch();companions.triggerOrbit();
}
function changeForm(){
 if(!dualFormScenes.has(view.scene)||interaction.active||presenter.busy)return;
 closePanel();form=form==='normal'?'chibi':'normal';localStorage.setItem('dragon.taskForm',form);setView({...view,form});
}
function setView(next){
 view={...next,form:dualFormScenes.has(next.scene)?(next.form||form):'chibi'};
 interaction.setTarget(view);scheduleReport();
}
function followSnapshot(){
 if(!following||!snapshot)return;
 scheduleReport();
 const activity=snapshot.activity;
 const next={scene:activity.scene,form:dualFormScenes.has(activity.scene)?form:'chibi',waiting:false,sleeping:false,suspended:activity.suspended};
 if(next.scene!==view.scene||next.form!==view.form||next.suspended!==view.suspended||view.sleeping||view.waiting)setView(next);
}
function showError(error){
 $('error').textContent=`动画载入失败：${error.message}`;$('error').hidden=false;
 if(layout){Object.assign($('error').style,{left:`${eye.x-100}px`,top:`${eye.y}px`});report();}
 console.error(error);
}
function rect(element){
 const r=element.getBoundingClientRect(),s=stage.getBoundingClientRect();
 return{x:r.left-s.left,y:r.top-s.top,width:r.width,height:r.height};
}
// The visual canvas includes transparent rig padding; only the body receives clicks.
const bodyBoxes={
 'standby:chibi':[.23,.13,.56,.78], 'thinking:chibi':[.20,.13,.60,.81],
 'reading:chibi':[.22,.12,.56,.80], 'work:chibi':[.29,.18,.44,.71],
 'drawing:chibi':[.29,.17,.44,.72], 'reading:normal':[.22,.08,.58,.84],
 'work:normal':[.30,.08,.51,.76], 'drawing:normal':[.26,.07,.51,.83],
};
function bodyHit(element,kind,form){
 const r=rect(element),b=bodyBoxes[`${kind}:${form}`];
 return{x:r.x+r.width*b[0],y:r.y+r.height*b[1],width:r.width*b[2],height:r.height*b[3]};
}
function refreshCompanions(){
 const current=presenter.current;
 const active=following&&snapshot?.activity.agentCount>0&&!interaction.active&&!presenter.busy&&current.view.scene!=='standby';
 if(active)companions.setAnchor(current.element,current.view);
 companions.setActive(active);
 companions.setPaused(view.suspended||interaction.active);
}
function report(){
 cancelAnimationFrame(frame);frame=0;if(disposed||!layout)return;
 if(!presenter?.current){
  if(!$('error').hidden){const r=rect($('error'));bridge.report({bounds:union([r],18),hitRegions:[r],position:eye,mode:'normal',pointerDown:false});}
  return;
 }
 refreshCompanions();
 const visuals=[],hitRegions=[];
 const current=interaction.current;
 if(!interaction.active||!current){
  visuals.push(rect(presenter.current.element));
  hitRegions.push(bodyHit(presenter.current.element,presenter.current.view.scene,presenter.current.view.form));
 }
 for(const entry of [interaction.current,interaction.pending,interaction.outgoing,presenter.outgoing]){
  if(entry?.element?.isConnected)visuals.push(rect(entry.element));
 }
 if(current?.kind==='drag'){
  const r=rect(current.element);hitRegions.push({x:r.x+r.width*.22,y:r.y+r.height*.12,width:r.width*.54,height:r.height*.78});
 }else if(current?.kind==='peek'){
  const r=rect(current.element),area=current.area;
  const left=Math.max(r.x,area.x),right=Math.min(r.x+r.width,area.x+area.width);
  hitRegions.push({x:left,y:r.y,width:Math.max(0,right-left),height:r.height});
 }
 for(const el of [$('cloud'),interaction.cloudElement,$('panel'),$('error')]){
  if(!el.hidden){const r=rect(el);visuals.push(r);if(el===$('panel')||el===$('error'))hitRegions.push(r);}
 }
 if(companions.active){const r=rect(presenter.current.element);visuals.push({x:r.x-55,y:r.y-55,width:r.width+110,height:r.height+110});}
 if(current?.kind==='flight')hitRegions.length=0;
 if(!interaction.pointer&&!interaction.busy&&!presenter.busy){
  eye=current?current.eye():interaction.eye();
 }
 const payload={bounds:union(visuals,18),hitRegions:hitRegions.filter(r=>r.width>0&&r.height>0),position:eye,mode:interaction.mode,pointerDown:Boolean(interaction.pointer)};
 const serial=JSON.stringify(payload,(_k,v)=>typeof v==='number'?Math.round(v*10)/10:v);
 if(serial!==lastReport){bridge.report(JSON.parse(serial));lastReport=serial;}
 if(interaction.busy||presenter.busy||interaction.pointer)frame=requestAnimationFrame(report);
}
function scheduleReport(){if(!frame&&!disposed)frame=requestAnimationFrame(report);}
function applyLayout(next){
 layout=next;
 areas=next.displays.map(d=>({x:d.workArea.x-next.desktop.x,y:d.workArea.y-next.desktop.y,width:d.workArea.width,height:d.workArea.height}));
 Object.assign(stage.style,{left:'0px',top:'0px',width:`${next.desktop.width}px`,height:`${next.desktop.height}px`});
 scheduleReport();
}

try{
 layout=await bridge.bootstrap();companions=new SubagentCompanions(stage);companions.ready.then(scheduleReport).catch(showError);eye={...layout.position};applyLayout(layout);
 presenter=new PetPresenter(characters,$('cloud'),{
  positionEntry:entry=>interaction.placePreparedTask(entry,eye),
  onChange:()=>{
   if(!interaction.active){eye=interaction.eye();interaction.position={...eye};}
   $('error').hidden=true;report();
  },onError:showError,
 });
 interaction=new PetInteraction({stage,presenter,createDrag,createFlight,createPeek,taskEye,edgeWidth:DRAG_EDGE_WIDTH,onClick:touch,
  pointFromEvent:e=>({x:e.screenX-layout.desktop.x,y:e.screenY-layout.desktop.y}),
  workAreaAt:p=>areaAt(p,areas),edgeAt:(p,a)=>outsideEdge(p,a,areas,DRAG_EDGE_WIDTH),
  onChange:()=>{if(interaction.pointer?.dragged){closePanel();eye={...interaction.position};}scheduleReport();},onError:showError,
 });
 interaction.position={...eye};interaction.setTarget(view);
 const resize=new ResizeObserver(scheduleReport);resize.observe(characters);resize.observe($('panel'));
 const offLayout=bridge.onLayout(applyLayout);
 const offAction=bridge.onAction(action=>{
  if(action.type==='form')changeForm();
  else if(action.type==='scene'){closePanel();following=false;setView({scene:action.scene,form,waiting:Boolean(action.waiting),waitingPose:Boolean(action.waiting),sleeping:Boolean(action.sleeping),suspended:false});}
  else if(action.type==='follow'){following=true;followSnapshot();if(!$('panel').hidden)renderPanel();}
  else if(action.type==='panel')openPanel();
  else if(action.type==='visible'){presenter.setVisible(action.visible);interaction.setPaused(!action.visible);}
  else if(action.type==='reset'){
   closePanel();eye={...layout.position};interaction.resetPosition(eye);scheduleReport();
  }
 });
 const offSessions=bridge.onSessions(value=>{snapshot=value;followSnapshot();if(!$('panel').hidden)renderPanel();});
 snapshot=await bridge.sessions();followSnapshot();
 $('close-panel').onclick=closePanel;
 stage.addEventListener('contextmenu',event=>{event.preventDefault();closePanel();bridge.menu();});
 stage.addEventListener('pointerdown',event=>{
  if(!event.target.closest('#panel'))closePanel();
 },true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closePanel();});
 document.addEventListener('visibilitychange',()=>presenter.setVisible(!document.hidden));
 addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();offLayout();offAction();offSessions();companions.destroy();interaction.destroy();presenter.destroy();},{once:true});
}catch(error){showError(error);}
