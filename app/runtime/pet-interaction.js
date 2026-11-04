import {SceneFade} from './scene-fade.js';
import {animationKey} from './presenter.js';
import {TransformationCloud} from '../../assets/shared/transformation-cloud.js';

export const DRAG_THRESHOLD=6;
export function releasedEdge(x,width,edgeWidth){return x<=edgeWidth?'left':x>=width-edgeWidth?'right':null;}

// Desktop gestures own only presentation and position. Session facts remain in
// the existing presenter policy; setTarget keeps the latest view during a drag.
export class PetInteraction {
 constructor({stage,presenter,createDrag,createFlight,createPeek,taskEye,edgeWidth,onClick,onChange=()=>{},onError=()=>{},pointFromEvent,workAreaAt,edgeAt}){
  Object.assign(this,{stage,presenter,createDrag,createFlight,createPeek,taskEye,edgeWidth,onClick,onChange,onError,pointFromEvent,workAreaAt,edgeAt});
  stage.style.setProperty('--edge-width',`${edgeWidth}px`);
  this.target=null;this.desired={kind:'normal'};this.current=null;this.pending=null;this.outgoing=null;this.pointer=null;
  this.position={x:0,y:0};this.taskOffset={x:0,y:0};this.busy=false;this.destroyed=false;
  this.clickCount=0;this.clickAt=0;this.paused=false;this.hidden=document.hidden;
  this.fade=new SceneFade();this.cloudElement=document.createElement('div');
  this.cloudElement.id='interaction-cloud';this.cloudElement.className='interaction-cloud';this.cloudElement.hidden=true;stage.append(this.cloudElement);
  this.cloud=new TransformationCloud(this.cloudElement);this.raf=0;this.last=null;
  this.handlers={pointerdown:e=>this.down(e),pointermove:e=>this.move(e),pointerup:e=>this.up(e),pointercancel:()=>this.cancel(),lostpointercapture:()=>this.cancel(),click:e=>{
   if(e.target.closest('[data-pet-hit],.character canvas')){e.preventDefault();e.stopPropagation();}
  }};
  for(const [type,handler]of Object.entries(this.handlers))stage.addEventListener(type,handler,type==='click');
  this.onBlur=()=>this.cancel();window.addEventListener('blur',this.onBlur);
  this.onVisibility=()=>{this.hidden=document.hidden;if(this.hidden)this.cancel();this.suspend();};
  document.addEventListener('visibilitychange',this.onVisibility);
  this.resizeObserver=new ResizeObserver(()=>{
   if(this.current?.kind==='peek')this.layout(this.current);
  });this.resizeObserver.observe(stage);
 }
 get mode(){return this.desired.kind;}
 get active(){return this.mode!=='normal'||this.current!==null||this.busy;}
 setTarget(view){this.target=view;if(!this.active)this.presenter.update(view);}
 matches(entry,wanted=this.desired){
  return entry.kind===wanted.kind&&entry.side===wanted.side&&
   (entry.kind!=='normal'||entry.view.scene===this.target.scene&&entry.view.form===this.target.form);
 }
 setPaused(value){this.paused=value;this.suspend();}
 workArea(point){return this.workAreaAt?this.workAreaAt(point):{x:0,y:0,width:this.stage.clientWidth,height:this.stage.clientHeight};}
 point(e){if(this.pointFromEvent)return this.pointFromEvent(e);const r=this.stage.getBoundingClientRect();return {x:e.clientX-r.left-this.stage.clientLeft,y:e.clientY-r.top-this.stage.clientTop};}
 eye(entry=this.presenter.current){return this.taskEye(entry.view,entry.element,this.stage);}
 moveTask(eye,entry=this.presenter.current){
  const old=this.eye(entry);this.taskOffset.x+=eye.x-old.x;this.taskOffset.y+=eye.y-old.y;
  this.presenter.stage.style.transform=`translate(${this.taskOffset.x}px,${this.taskOffset.y}px)`;
 }
 placePreparedTask(entry,eye){
  const before=this.eye(entry),fitted=this.fitTaskEye(eye,entry);
  entry.element.style.transform=`translate(${fitted.x-before.x}px,${fitted.y-before.y}px)`;
 }
 fitTaskEye(eye,entry){
  const canvas=entry.element.getBoundingClientRect();
  const stage=this.stage.getBoundingClientRect(),current=this.eye(entry);
  const area=this.workArea(eye);
  const anchor={x:current.x-(canvas.left-stage.left-this.stage.clientLeft),y:current.y-(canvas.top-stage.top-this.stage.clientTop)};
  return {
   x:Math.max(area.x+8+anchor.x,Math.min(area.x+area.width-8-canvas.width+anchor.x,eye.x)),
   y:Math.max(area.y+8+anchor.y,Math.min(area.y+area.height-8-canvas.height+anchor.y,eye.y)),
  };
 }
 down(e){
  if(e.button!==0||this.pointer||!e.target.closest('[data-pet-hit],.character canvas'))return;
  // The flight clip owns its path until ended; the edge portrait is draggable.
  if(this.mode==='flight'||!this.presenter.current)return;
  e.preventDefault();const p=this.point(e),eye=this.current?.eye()||this.eye();
  this.pointer={id:e.pointerId,start:p,last:p,time:e.timeStamp,eye,dragged:false};
  this.stage.setPointerCapture(e.pointerId);this.onChange();
 }
 move(e){
  const g=this.pointer;if(!g||g.id!==e.pointerId)return;
  const p=this.point(e),dx=p.x-g.last.x,dy=p.y-g.last.y,dt=(e.timeStamp-g.time)/1000;
  if(!g.dragged&&Math.hypot(p.x-g.start.x,p.y-g.start.y)>=DRAG_THRESHOLD){
   g.dragged=true;this.clickCount=0;this.clickAt=0;
   if(this.current?.kind==='drag')this.current.begin();
   this.position={...g.eye};this.desired={kind:'drag'};this.onChange();this.pump();
  }
  if(g.dragged){
   this.position={x:g.eye.x+p.x-g.start.x,y:g.eye.y+p.y-g.start.y};
   if(this.current?.kind==='drag'){
    this.current.place(this.position);if(dt>0)this.current.move(dx,dy,dt);
   }else if(!this.current)this.moveTask(this.position);
   if(this.pending?.kind==='drag')this.pending.place(this.position);
   if(!this.cloudElement.hidden&&this.transitionPair)this.cloud.fit(this.transitionPair);
  }
  g.last=p;g.time=e.timeStamp;if(g.dragged)this.onChange();
 }
 releaseCapture(){const g=this.pointer;this.pointer=null;if(g&&this.stage.hasPointerCapture(g.id))this.stage.releasePointerCapture(g.id);return g;}
 up(e){
  if(!this.pointer||this.pointer.id!==e.pointerId)return;
  this.move(e);const g=this.releaseCapture();
  if(g.dragged){
   const anchor={...(this.current?.kind==='drag'?this.current.eye():this.position)};
   this.current?.release?.();const area=this.workArea(this.position);
   const side=this.edgeAt?this.edgeAt(this.position,area):releasedEdge(this.position.x-area.x,area.width,this.edgeWidth);
   this.desired=side?{kind:'flight',side,anchor,area}:{kind:'normal'};this.onChange();this.pump();
  }else if(this.mode==='normal'){
   this.clickCount=e.timeStamp-this.clickAt<=420?this.clickCount+1:1;this.clickAt=e.timeStamp;
   this.onClick(this.clickCount);this.onChange();
  }else if(this.mode==='peek'&&this.current?.kind==='peek'&&!this.busy&&!this.paused&&!this.hidden){
   this.current.touch();this.onChange();
  }
 }
 cancel(){
  const g=this.releaseCapture();if(!g)return;
  this.clickCount=0;this.clickAt=0;if(!g.dragged)return;
  this.current?.release?.();this.desired={kind:'normal'};this.onChange();this.pump();
 }
 resetPosition(point){
  this.releaseCapture();this.current?.pause?.();this.current?.release?.();
  this.clickCount=0;this.clickAt=0;this.position={...point};this.desired={kind:'normal'};this.onChange();this.pump();
 }
 updateLayout(offset){
  const shift=point=>({x:point.x+offset.x,y:point.y+offset.y});
  this.position=shift(this.position);
  // Task canvases share one parent, including an incoming return transition.
  this.moveTask(shift(this.eye()));
  if(this.pointer)for(const key of ['start','last','eye'])this.pointer[key]=shift(this.pointer[key]);
  // A display update changes coordinates, not the user's chosen interaction.
  // Include the desired object: an asset may still be loading asynchronously.
  for(const entry of new Set([this.desired,this.current,this.pending,this.outgoing])){
   if(!entry)continue;
   if(entry.anchor)entry.anchor=shift(entry.anchor);
   if(entry.area)entry.area=this.workArea(this.position);
   if(entry.element&&entry.kind!=='normal')this.layout(entry);
  }
  if(!this.active){this.position=this.fitTaskEye(this.position,this.presenter.current);this.moveTask(this.position);}
  if(!this.cloudElement.hidden&&this.transitionPair)this.cloud.fit(this.transitionPair);
  this.onChange();
 }
 async prepare(wanted){
  if(wanted.kind==='normal'){
   let entry;
   while(true){
    const view=this.target;
    // The presenter retains its task scene while dragging. Resume that same
    // controller and painted canvas whenever the requested scene still matches.
    entry=this.presenter.current.key===animationKey(view)?this.presenter.current:await this.presenter.prepare(view);
    if(this.destroyed||entry.key===animationKey(this.target))break;
    if(entry!==this.presenter.current)this.presenter.release(entry);
   }
   this.presenter.apply(entry,this.target);
   entry.element.style.opacity='0';this.moveTask(this.fitTaskEye(this.position,entry),entry);
   return Object.assign(entry,{kind:'normal',form:this.target.form});
  }
  const element=document.createElement('div');element.className=`interaction-pet ${wanted.kind}`;
  element.style.opacity='0';this.stage.append(element);
  let scene;
  try{
   if(wanted.kind==='drag')scene=await this.createDrag(element);
   if(wanted.kind==='flight')scene=await this.createFlight(element,()=>{
    if(this.current?.element!==element||this.destroyed)return;
    this.desired={kind:'peek',side:wanted.side,area:this.current.area};this.onChange();this.pump();
   });
   if(wanted.kind==='peek')scene=await this.createPeek(element);
   const entry={...scene,element,kind:wanted.kind,side:wanted.side,anchor:wanted.anchor,area:wanted.area,form:'chibi'};
   this.layout(entry);
   if(entry.kind==='peek')entry.setPaused(this.hidden||this.paused);
   return entry;
  }catch(error){scene?.destroy();element.remove();throw error;}
 }
 layout(entry){
  if(entry.kind==='drag')entry.place(this.position);
  if(entry.kind==='flight')entry.place({side:entry.side,eye:entry.anchor});
  if(entry.kind==='peek'){
   const area=entry.area||this.workArea(this.position);
   entry.place({side:entry.side,edgeX:entry.side==='left'?area.x:area.x+area.width,eyeY:Math.max(area.y+110,Math.min(area.y+area.height-120,this.position.y))});
  }
 }
 dispose(entry){
  if(!entry)return;
  if(entry.kind==='normal'){if(entry!==this.presenter.current)this.presenter.release(entry);}
  else{entry.destroy();entry.element.remove();}
 }
 async pump(){
  if(this.busy||this.destroyed||!this.target)return;
  this.busy=true;
  try{
   await this.presenter.whenIdle();
   while(!this.destroyed){
    const wanted=this.desired;
    if(!this.current&&wanted.kind==='normal'){
     const view=this.target;this.presenter.update(view);await this.presenter.whenIdle();
     if(this.destroyed)break;
     if(this.desired.kind!=='normal'||view.scene!==this.target.scene||view.form!==this.target.form)continue;
     this.presenter.update(this.target);
     this.moveTask(this.fitTaskEye(this.position,this.presenter.current));break;
    }
    if(this.current&&this.matches(this.current,wanted))break;
    this.pending=await this.prepare(wanted);
    if(this.destroyed){this.dispose(this.pending);this.pending=null;break;}
    if(!this.matches(this.pending)){this.dispose(this.pending);this.pending=null;continue;}
    const previous=this.current,source=previous?.element||this.presenter.current.element;
    const sourceForm=previous?.form||this.presenter.current.view.form;
    this.presenter.current.animation.setSuspended(true);
    let cloud=sourceForm!==this.pending.form;
    if(cloud){
     this.transitionPair=[source,this.pending.element];this.cloud.fit(this.transitionPair);
     await this.cloud.cover(source);
     while(!this.destroyed&&!this.matches(this.pending)){
      this.dispose(this.pending);this.pending=null;
      this.pending=await this.prepare(this.desired);
     }
     if(this.destroyed){this.dispose(this.pending);this.pending=null;break;}
     this.transitionPair=[source,this.pending.element];this.cloud.fit(this.transitionPair);
    }
    const next=this.pending;this.pending=null;
    const incoming=next.element;
    this.outgoing=previous;
    if(next.kind==='normal'){
     this.presenter.apply(next,this.target);
     this.presenter.desired=next.view;this.presenter.install(next);this.presenter.setVisible(!this.hidden);
     this.current=null;
    }else{
     this.current=next;
     if(next.kind==='drag'){if(this.pointer?.dragged)next.begin();else next.release();this.startClock();}
    }
    incoming.style.opacity='1';
    if(cloud)await this.cloud.reveal(incoming);else await this.fade.play(source,incoming);
    this.transitionPair=null;
    this.dispose(this.outgoing);this.outgoing=null;
    if(this.destroyed)break;
    if(this.current)this.presenter.setVisible(false);
    if(this.current?.kind==='flight'&&this.desired.kind==='flight'&&!this.hidden&&!this.paused)await this.current.play();
    if(!this.current){this.presenter.update(this.target);await this.presenter.whenIdle();}
    this.onChange();
   }
  }catch(error){this.dispose(this.pending);this.pending=null;if(!this.destroyed)this.onError(error);}
  finally{this.busy=false;this.transitionPair=null;this.onChange();}
 }
 startClock(){
  cancelAnimationFrame(this.raf);this.last=null;
  const tick=now=>{
   this.raf=0;if(this.destroyed||this.hidden||this.paused||this.current?.kind!=='drag')return;
   const dt=this.last===null?0:Math.min(.1,(now-this.last)/1000);this.last=now;
   this.current.tick(dt);this.raf=requestAnimationFrame(tick);
  };this.raf=requestAnimationFrame(tick);
 }
 suspend(){
  const pause=this.hidden||this.paused;
  for(const animation of [...this.fade.animations,...this.cloud.animations])pause?animation.pause():animation.play();
  for(const entry of [this.current,this.pending,this.outgoing])if(entry?.kind==='peek')entry.setPaused(pause);
  if(this.current?.kind==='flight'){
   if(pause)this.current.pause();else this.current.resume().catch(this.onError);
  }
  if(pause){cancelAnimationFrame(this.raf);this.last=null;}else if(this.current?.kind==='drag')this.startClock();
 }
 destroy(){
  this.destroyed=true;this.releaseCapture();cancelAnimationFrame(this.raf);
  for(const [type,handler]of Object.entries(this.handlers))this.stage.removeEventListener(type,handler,type==='click');
  window.removeEventListener('blur',this.onBlur);document.removeEventListener('visibilitychange',this.onVisibility);
  this.resizeObserver.disconnect();this.fade.destroy();this.cloud.destroy();this.dispose(this.current);this.current=null;
  this.dispose(this.pending);this.pending=null;this.dispose(this.outgoing);this.outgoing=null;this.cloudElement.remove();
 }
}
