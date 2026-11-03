import {createAnimation} from './animation-host.js';
import {TransformationCloud} from '../../assets/shared/transformation-cloud.js';
import {SceneFade} from './scene-fade.js';
import {displaySize} from './display-policy.js';

export function animationKey(view){return `${view.form}:${view.scene}`;}
export function needsTransformation(before,after){return !!before&&before.form!==after.form;}

export class PetPresenter {
 constructor(stage,cloud,{onChange=()=>{},onError=()=>{},positionEntry=()=>{}}={}){
  this.stage=stage;this.cloud=new TransformationCloud(cloud);this.fade=new SceneFade();this.outgoing=null;
  this.onChange=onChange;this.onError=onError;this.positionEntry=positionEntry;this.current=null;this.desired=null;
  this.idleWaiters=[];this.busy=false;this.destroyed=false;this.hidden=document.hidden;this.failedKey=null;
 }
 update(view){
  this.desired=view;
  if(this.current&&animationKey(view)===this.current.key)this.apply(this.current,view);
  this.pump();
 }
 apply(entry,view){
  entry.view=view;entry.animation.setWaiting(view.waitingPose??view.waiting);
  entry.animation.setSleeping(view.sleeping);
  entry.animation.setSuspended(view.suspended);
 }
 async prepare(view){
  const element=document.createElement('div');element.className='character';
  element.style.visibility='hidden';this.stage.append(element);
  try{
   const animation=await createAnimation(view.scene,view.form,element,{size:displaySize(view.scene,view.form)});
   animation.setVisible(false);
   const entry={element,animation,key:animationKey(view),view};this.positionEntry(entry);this.apply(entry,view);return entry;
  }catch(error){element.remove();throw error;}
 }
 release(entry){if(entry){entry.animation.destroy();entry.element.remove();}}
 install(entry,retainPrevious=false){
  // prepare() already sized and painted the canvas; resizing here clears the
  // first visible frame immediately before the crossfade.
  if(!retainPrevious&&this.current!==entry)this.release(this.current);this.current=entry;
  entry.element.style.visibility='visible';entry.animation.setVisible(!this.hidden);
  this.apply(entry,this.desired);this.onChange(entry.view);
 }
 whenIdle(){return this.busy?new Promise(resolve=>this.idleWaiters.push(resolve)):Promise.resolve();}
 async pump(){
  if(this.busy||this.destroyed||!this.desired||this.failedKey===animationKey(this.desired))return;
  this.busy=true;let next=null,covered=false,attemptKey=null;
  try{
   while(!this.destroyed&&this.desired&&this.current?.key!==animationKey(this.desired)){
    attemptKey=animationKey(this.desired);next=await this.prepare(this.desired);
    if(this.destroyed){this.release(next);next=null;break;}
    if(next.key!==animationKey(this.desired)){this.release(next);next=null;continue;}
    if(needsTransformation(this.current?.view,this.desired)){
     this.cloud.fit([this.current.element,next.element]);
     await this.cloud.cover(this.current.element);covered=true;
     // Events keep arriving while the puff grows. Load the latest scene behind
     // the cloud, so a finished tool or an old approval is never replayed.
     while(!this.destroyed&&next.key!==animationKey(this.desired)){
      this.release(next);attemptKey=animationKey(this.desired);next=await this.prepare(this.desired);
     }
    }
    if(this.destroyed){this.release(next);next=null;break;}
    if(covered)this.cloud.fit([this.current.element,next.element]);
    if(this.current&&!covered){
     this.outgoing=this.current;
     this.outgoing.element.style.pointerEvents='none';
     this.outgoing.element.setAttribute('aria-hidden','true');
     this.install(next,true);next=null;this.failedKey=null;
     await this.fade.play(this.outgoing.element,this.current.element);
     this.release(this.outgoing);this.outgoing=null;
    }else{
     this.install(next);next=null;this.failedKey=null;
     if(covered){await this.cloud.reveal(this.current.element);covered=false;}
    }
   }
   if(this.current&&!this.destroyed)this.apply(this.current,this.desired);
  }catch(error){this.failedKey=attemptKey;this.release(next);if(covered)this.cloud.destroy();if(attemptKey===animationKey(this.desired))this.onError(error);}
  finally{this.release(this.outgoing);this.outgoing=null;this.busy=false;for(const resolve of this.idleWaiters.splice(0))resolve();}
 }
 touch(){return this.current?.animation.touch();}
 setVisible(visible){this.hidden=!visible;this.current?.animation.setVisible(visible);this.outgoing?.animation.setVisible(visible);}
 destroy(){this.destroyed=true;this.cloud.destroy();this.fade.destroy();this.release(this.current);this.release(this.outgoing);this.current=null;this.outgoing=null;}
}
