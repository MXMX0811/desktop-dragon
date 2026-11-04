import {dialogueGroup,randomLine} from './dialogue-lines.js';

const holdMs={info:4000,dialogue:3000};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function resetLabel(resetsAt,now=Date.now()){
 if(!Number.isFinite(resetsAt))return {relative:'重置时间暂无数据',absolute:''};
 const date=new Date(resetsAt*1000),minutes=Math.ceil((date.getTime()-now)/60000);
 const absolute=date.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
 if(minutes<=0)return {relative:'已到重置时间，请再次查询',absolute};
 const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
 const duration=days?`${days}天${hours?`${hours}小时`:''}`:hours?`${hours}小时${mins?`${mins}分钟`:''}`:`${mins}分钟`;
 return {relative:`${duration}后重置`,absolute};
}

// All coordinates are in the desktop stage, not screen or viewport coordinates.
export function bubblePlacement({eye,body,area},width,height){
 const minX=area.x+8,maxX=area.x+area.width-width-8,minY=area.y+8,maxY=area.y+area.height-height-8;
 let x=clamp(eye.x-width/2,minX,maxX),y=body.y-height-10,tail='bottom';
 if(y<minY){
  const right=area.x+area.width-(body.x+body.width),left=body.x-area.x;
  if(Math.max(right,left)>=width+18){
   const onRight=right>=left;
   x=onRight?body.x+body.width+10:body.x-width-10;
   y=clamp(eye.y-height/2,minY,maxY);tail=onRight?'left':'right';
  }else{y=clamp(body.y+body.height+10,minY,maxY);tail='top';}
 }
 return {x:clamp(x,minX,maxX),y:clamp(y,minY,maxY),tail,
  tailX:clamp(eye.x-x,19,width-19),tailY:clamp(eye.y-y,19,height-19)};
}

function node(tag,className,text){
 const element=document.createElement(tag);element.className=className;
 if(text!==undefined)element.textContent=text;
 return element;
}

export class SpeechBubble{
 constructor(stage,{readQuota,getPlacement,onChange}){
  this.readQuota=readQuota;this.getPlacement=getPlacement;this.onChange=onChange;
  this.element=node('aside','speech-bubble');this.element.hidden=true;
  this.element.setAttribute('role','status');this.element.setAttribute('aria-live','polite');
  this.content=node('div','speech-content');this.element.append(this.content);stage.append(this.element);
  this.kind=null;this.context=null;this.lastLine=null;this.timer=null;this.clickTimer=null;
  this.effect=null;this.generation=0;this.request=0;this.disposed=false;
 }
 get visible(){return !this.element.hidden;}
 setContext(context){
  const changed=this.context&&dialogueGroup(this.context)!==dialogueGroup(context);
  this.context={...context};
  if(changed){this.lastLine=null;if(this.kind==='dialogue')this.showRandomLine();}
 }
 click(context,{count=1,canChangeForm=false}={}){
  if(this.disposed)return;
  this.setContext(context);clearTimeout(this.clickTimer);
  if(count===2&&canChangeForm){this.clickTimer=setTimeout(()=>this.advance(),420);return;}
  this.advance();
 }
 advance(){if(this.disposed)return;if(!this.kind)this.showInfo();else this.showRandomLine();}
 position(){
  if(!this.visible)return;
  const anchor=this.getPlacement();if(!anchor)return;
  const p=bubblePlacement(anchor,this.element.offsetWidth,this.element.offsetHeight);
  Object.assign(this.element.style,{left:`${p.x}px`,top:`${p.y}px`});
  this.element.dataset.tail=p.tail;
  this.element.style.setProperty('--tail-x',`${p.tailX}px`);
  this.element.style.setProperty('--tail-y',`${p.tailY}px`);
 }
 appearance(){const style=getComputedStyle(this.element);return {opacity:style.opacity,transform:style.transform};}
 animate(frames,duration,easing,finish){
  this.effect?.cancel();
  const effect=this.element.animate(frames,{duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:duration,easing,fill:'both'});
  this.effect=effect;
  effect.onfinish=()=>{
   if(this.effect!==effect||this.disposed)return;
   finish();
   if(this.effect===effect){this.effect=null;effect.cancel();}
  };
 }
 present(kind,render,{hold=true}={}){
  if(this.disposed)return;
  const opening=this.element.hidden,from=opening?null:this.appearance(),generation=++this.generation;
  clearTimeout(this.timer);this.timer=null;this.kind=kind;
  const enter=()=>{
   if(this.disposed||generation!==this.generation)return;
   render();this.element.hidden=false;this.position();this.onChange();
   this.animate([
    {opacity:0,transform:'translateY(7px) scale(.9)',offset:0},
    {opacity:1,transform:'translateY(-1px) scale(1.025)',offset:.7},
    {opacity:1,transform:'translateY(0) scale(1)',offset:1},
   ],300,'cubic-bezier(.22,.7,.3,1)',()=>{
    if(hold)this.timer=setTimeout(()=>this.hide(),holdMs[kind]);
   });
  };
  if(opening)enter();
  else this.animate([from,{opacity:0,transform:'translateY(4px) scale(.94)'}],140,'ease-in',enter);
 }
 async showInfo(){
  const request=++this.request;
  this.present('info',()=>this.renderQuota({status:'loading',windows:[]}),{hold:false});
  let quota;
  try{quota=await this.readQuota();}
  catch{quota={status:'error',windows:[],message:'账户用量读取失败，请稍后再试'};}
  if(this.disposed||request!==this.request||this.kind!=='info')return;
  this.present('info',()=>this.renderQuota(quota));
 }
 renderQuota(quota){
  const title=node('strong','quota-title','剩余额度');this.content.replaceChildren(title);
  this.element.classList.remove('dialogue-bubble');
  if(quota.status==='loading'){
   this.content.append(node('p','quota-message','正在查询…'));return;
  }
  if(quota.status!=='ready'||!quota.windows.length){
   this.content.append(node('p','quota-message',quota.message||'账户用量暂无数据'));return;
  }
  for(const window of quota.windows){
   const section=node('section','quota-window'),heading=node('div','quota-heading');
   heading.append(node('span','quota-label',window.label));
   const remaining=Number.isFinite(window.remainingPercent)?clamp(window.remainingPercent,0,100):null;
   const amount=node('span','quota-amount',remaining===null?'—':String(Math.round(remaining)));
   if(remaining!==null)amount.append(node('small','','%'));
   heading.append(amount);section.append(heading);
   if(remaining!==null){
    const meter=node('div','quota-meter');meter.setAttribute('aria-label',`剩余${remaining}%`);
    meter.style.setProperty('--remaining',`${remaining}%`);meter.append(node('span',''));section.append(meter);
    section.classList.toggle('low',remaining<=15);
   }
   const reset=resetLabel(window.resetsAt);
   section.append(node('p','quota-reset',reset.relative));
   if(reset.absolute)section.append(node('p','quota-date',`${reset.absolute} 重置`));
   this.content.append(section);
  }
  if(quota.fetchedAt){
   const date=new Date(quota.fetchedAt);
   this.content.append(node('p','quota-updated',`更新于 ${date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}`));
  }
 }
 showRandomLine(){
  const group=dialogueGroup(this.context),line=randomLine(group,this.lastLine);this.lastLine=line;this.showLine(line);
 }
 showLine(text){
  ++this.request;
  this.present('dialogue',()=>{
   const paragraph=node('p','bubble-dialogue');
   for(const phrase of text.match(/[^，。！？～…]+[，。！？～…]*|[，。！？～…]+/gu))paragraph.append(node('span','phrase',phrase));
   this.content.replaceChildren(paragraph);this.element.classList.add('dialogue-bubble');
  });
 }
 hide({immediate=false}={}){
  const wasVisible=this.visible,closing=this.kind===null;
  clearTimeout(this.timer);clearTimeout(this.clickTimer);this.timer=null;this.clickTimer=null;
  ++this.generation;++this.request;this.kind=null;this.lastLine=null;
  if(!wasVisible){this.effect?.cancel();this.effect=null;return;}
  if(closing&&!immediate)return;
  const finish=()=>{this.element.hidden=true;this.onChange();};
  if(immediate){this.effect?.cancel();this.effect=null;finish();return;}
  this.animate([this.appearance(),{opacity:0,transform:'translateY(7px) scale(.9)'}],210,'cubic-bezier(.4,0,.8,.4)',finish);
 }
 destroy(){this.hide({immediate:true});this.disposed=true;this.element.remove();}
}
