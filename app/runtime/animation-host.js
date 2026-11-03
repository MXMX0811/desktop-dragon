import {ChibiSceneController} from '../../assets/shared/chibi-controller.js';
import {applyReferenceColor} from '../../assets/shared/reference-palette.mjs';

const labels={standby:'陪伴龙娘',reading:'阅读龙娘',work:'工作龙娘',thinking:'思考龙娘',drawing:'绘图龙娘'};
const supported=new Set(['standby:chibi','reading:chibi','work:chibi','thinking:chibi','drawing:chibi','reading:normal','work:normal','drawing:normal']);

async function loadImages(module,base){
 return Object.fromEntries(await Promise.all(Object.entries(module.assetPaths).map(async([key,path])=>{
  const image=new Image();image.src=new URL(path,base).href;await image.decode();return[key,image];
 })));
}

// Owns only animation time and resources. Session facts and form transitions live
// in the runtime above this host; no pointer action approves a client request.
export class AnimationHost{
 constructor({kind,form,canvas,controller,scene,container,size=320}){
  Object.assign(this,{kind,form,canvas,controller,scene,container});
  this.visible=true;this.suspended=false;this.destroyed=false;this.raf=0;this.last=null;this.feedback=null;
  canvas.style.transformOrigin='50% 90%';
  this.ready=Promise.resolve();
  this.tick=now=>{
   this.raf=0;
   if(!this.active())return;
   if(this.last!==null){
    let elapsed=Math.min(.1,Math.max(0,(now-this.last)/1000));
    while(elapsed>0){const step=Math.min(elapsed,1/60);this.controller.update(step);elapsed-=step;}
   }
   this.last=now;this.render();this.raf=requestAnimationFrame(this.tick);
  };
  this.onVisibility=()=>{if(document.hidden)this.cancelFeedback();this.schedule();};
  document.addEventListener('visibilitychange',this.onVisibility);
  this.resize(size);this.render();this.schedule();
 }
 active(){return !this.destroyed&&this.visible&&!this.suspended&&!document.hidden;}
 render(){if(!this.destroyed)this.scene.render(this.controller.sample());}
 schedule(){
  cancelAnimationFrame(this.raf);this.raf=0;this.last=null;
  if(this.active())this.raf=requestAnimationFrame(this.tick);
 }
 setWaiting(waiting){
  if(!['reading','work','drawing'].includes(this.kind))return false;
  const next=Boolean(waiting);if(this.controller.waiting===next)return true;
  this.controller.setWaiting(next);this.render();return true;
 }
 setSleeping(sleeping){
  if(this.kind!=='standby')return false;
  if(sleeping)this.controller.sleep();
  else if(this.controller.state==='sleeping'||this.controller.state==='falling-asleep'){this.controller.touch();this.rebound();}
  this.render();return true;
 }
 setSuspended(value){const next=Boolean(value);if(this.suspended===next)return;this.suspended=next;if(next)this.cancelFeedback();this.schedule();}
 setVisible(value){const next=Boolean(value);if(this.visible===next)return;this.visible=next;if(!next)this.cancelFeedback();this.canvas.style.visibility=this.visible?'visible':'hidden';this.schedule();}
 touch(){
  if(!this.active())return false;
  if(this.kind==='reading'&&this.form==='normal')this.controller.click();
  else this.controller.touch();
  this.rebound();this.render();return true;
 }
 rebound(){
  if(!this.active()||this.feedback?.playState==='running')return;
  // Only the painted canvas moves; its layout box remains the drag/hit anchor.
  const feedback=this.canvas.animate([
   {offset:0,transform:'scale(1,1)'},
   {offset:.22,transform:'scale(1.008,.982)'},
   {offset:.52,transform:'scale(.996,1.009)'},
   {offset:.78,transform:'scale(1.002,.997)'},
   {offset:1,transform:'scale(1,1)'},
  ].map(frame=>({...frame,easing:'cubic-bezier(.37,0,.63,1)'})),{duration:480});
  this.feedback=feedback;
  feedback.onfinish=()=>{feedback.cancel();if(this.feedback===feedback)this.feedback=null;};
 }
 cancelFeedback(){if(this.feedback){this.feedback.onfinish=null;this.feedback.cancel();this.feedback=null;}}
 resize(size){
  this.scene.resize(size);
  this.container.style.width=this.canvas.style.width;
  this.container.style.height=this.canvas.style.height;
 }
 get frame(){return this.controller.sample();}
 destroy(){
  if(this.destroyed)return;
  this.destroyed=true;this.cancelFeedback();cancelAnimationFrame(this.raf);this.raf=0;
  document.removeEventListener('visibilitychange',this.onVisibility);
  this.scene.destroy();this.canvas.remove();
 }
}

export async function createAnimation(kind,form,container,{size=320}={}){
 if(!supported.has(`${kind}:${form}`))throw new Error(`Unsupported animation: ${kind}/${form}`);
 const canvas=document.createElement('canvas');canvas.style.display='block';
 applyReferenceColor(canvas,`${kind}-${form}`);
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label',labels[kind]);
 container.append(canvas);
 let controller,scene;
 try{
  if(kind==='standby'){
   const [{WakeController},module]=await Promise.all([
    import('../../assets/animations/standby/chibi/controller.js'),
    import('../../assets/animations/standby/chibi/scene.js'),
   ]);
   controller=new WakeController();
   scene=await module.createScene({canvas});
  }else if(form==='chibi'){
   const module=await import(`../../assets/animations/${kind}/chibi/scene.js`);
   controller=new ChibiSceneController(kind);
   scene=await module.createScene({PIXI:globalThis.PIXI,canvas});
  }else if(kind==='drawing'){
   const module=await import('../../assets/animations/drawing/normal/scene.js');
   controller=new ChibiSceneController('drawing');
   scene=await module.createScene({PIXI:globalThis.PIXI,canvas});
  }else{
   const url=new URL(`../../assets/animations/${kind}/normal/scene.js`,import.meta.url);
   const module=await import(url.href),images=await loadImages(module,url);
   controller=new module.Controller();scene=await module.createScene({PIXI:globalThis.PIXI,canvas,images});
  }
  return new AnimationHost({kind,form,container,canvas,controller,scene,size});
 }catch(error){
  if(scene)scene.destroy();canvas.remove();throw error;
 }
}
