const clamp01=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp01(value);return t*t*(3-2*t);};

// One clock owns the base loop, task waiting and click response. Each scene
// binds the sampled values to its own complete parts and contact points.
export class ChibiSceneController {
 constructor(kind,random=Math.random){
  this.kind=kind;this.random=random;this.time=0;
  this.blinkStart=null;this.nextBlink=1.8;this.touchStart=null;
  this.attentionProgress=0;this.attentionVelocity=0;
  this.waiting=false;this.waitAmount=0;this.waitVelocity=0;this.waitRaiseAt=0;
  this.question=0;this.questionVelocity=0;
  this.pageRound=null;this.nextPageAt=1;
 }
 touch(){if(this.touchStart!==null)return false;this.touchStart=this.time;return true;}
 setWaiting(waiting){
  if(this.kind==='thinking'||this.waiting===waiting)return;
  this.waiting=waiting;this.nextPageAt=Infinity;this.waitRaiseAt=this.time;
  if(waiting&&this.kind==='reading'&&this.pageRound){
   const round=this.pageRound;
   // Keep only the leaves already in flight. Future leaves in this four-page
   // burst are cancelled, and the book stays still until the final leaf lands.
   round.leaves=round.leaves.filter(({start})=>start<this.time&&start+.48>this.time);
   if(round.leaves.length){round.endAt=Math.max(...round.leaves.map(leaf=>leaf.start))+.48;if(this.waitAmount===0)this.waitRaiseAt=round.endAt;}
   else this.pageRound=null;
  }
  if(!waiting&&this.waitAmount===0&&this.waitVelocity===0&&!this.pageRound)this.nextPageAt=this.time+.8;
 }
 update(dt){
  const previous=this.time;this.time+=dt;this.advanceWaiting(previous);
  if(this.blinkStart!==null&&this.time-this.blinkStart>=.3){this.blinkStart=null;this.nextBlink=this.time+3+this.random()*2.2;}
  if(this.blinkStart===null&&this.time>=this.nextBlink)this.blinkStart=this.time;
  if(this.touchStart!==null&&this.time-this.touchStart>=3.1)this.touchStart=null;
  this.advanceAttention(dt);
  if(this.kind==='reading'){
   if(this.pageRound&&this.time>=this.pageRound.endAt){
    const end=this.pageRound.endAt;this.pageRound=null;
    if(!this.waiting&&this.waitAmount===0&&this.waitVelocity===0)this.nextPageAt=end+2.7;
   }
   if(!this.pageRound&&!this.waiting&&this.waitAmount===0&&this.waitVelocity===0&&this.time>=this.nextPageAt){
    const start=this.time;this.pageRound={leaves:[0,1,2,3].map(index=>({index,start:start+index*.14})),endAt:start+.9};this.nextPageAt=Infinity;
   }
  }
  return this.sample();
 }
 advanceAttention(dt){
  const clicked=this.touchStart!==null&&this.time-this.touchStart<1.65;
  const target=(this.waiting&&this.time>=this.waitRaiseAt)||clicked?1:0;
  const rate=8,offset=this.attentionProgress-target,term=this.attentionVelocity+rate*offset,decay=Math.exp(-rate*dt);
  this.attentionProgress=target+(offset+term*dt)*decay;
  this.attentionVelocity=(this.attentionVelocity-rate*term*dt)*decay;
  if(Math.abs(this.attentionProgress-target)<.001&&Math.abs(this.attentionVelocity)<.01){this.attentionProgress=target;this.attentionVelocity=0;}
 }
 advanceWaiting(previous){
  const dt=Math.max(0,this.time-Math.max(previous,this.waitRaiseAt)),target=this.waiting?1:0;
  if(dt>0&&(this.waitAmount!==target||this.waitVelocity!==0)){
   // Exact critically damped spring integration, following the established
   // reading controller. Retargeting preserves position and velocity.
   const rate=5.2*(this.waiting?1:2/3),offset=this.waitAmount-target;
   const term=this.waitVelocity+rate*offset,decay=Math.exp(-rate*dt);
   this.waitAmount=target+(offset+term*dt)*decay;
   this.waitVelocity=(this.waitVelocity-rate*term*dt)*decay;
   if(this.waitAmount<0||this.waitAmount>1){this.waitAmount=clamp01(this.waitAmount);this.waitVelocity=0;}
   if(Math.abs(this.waitAmount-target)<.001&&Math.abs(this.waitVelocity)<.01){
    this.waitAmount=target;this.waitVelocity=0;
    if(!target&&!this.pageRound)this.nextPageAt=this.time+.8;
   }
  }
  const questionTarget=this.waiting&&this.waitAmount>.72?1:0,qdt=this.time-previous;
  const offset=this.question-questionTarget,damping=11.7,frequency=Math.sqrt(18**2-damping**2),phase=frequency*qdt,decay=Math.exp(-damping*qdt),velocity=this.questionVelocity;
  this.question=questionTarget+decay*(offset*Math.cos(phase)+(velocity+damping*offset)/frequency*Math.sin(phase));
  this.questionVelocity=decay*(velocity*Math.cos(phase)-(damping*velocity+18**2*offset)/frequency*Math.sin(phase));
  if(!questionTarget&&this.question<0){this.question=0;this.questionVelocity=0;}
  if(Math.abs(this.question-questionTarget)<.001&&Math.abs(this.questionVelocity)<.01){this.question=questionTarget;this.questionVelocity=0;}
 }
 sample(){
  const t=this.time,breath=(1-Math.cos(t*Math.PI*2/4.5))/2;
  let blink=0,wing=0;
  if(this.blinkStart!==null){const age=t-this.blinkStart;blink=age<.1?smooth(age/.1):age<.15?1:1-smooth((age-.15)/.15);}
  const touchAge=this.touchStart===null?null:t-this.touchStart;
  if(touchAge!==null&&touchAge<1.3){const phase=touchAge/1.3;wing=Math.sin(Math.PI*phase)**2*Math.sin(6*Math.PI*phase);}
  const attention=smooth((this.attentionProgress-.4)/.12);
  const attentionBlink=smooth((this.attentionProgress-.18)/.2)*(1-smooth((this.attentionProgress-.54)/.22));
  const waitingCurl=.48*smooth(this.waitAmount)*(.96+.04*Math.sin(t*1.7));
  const clickCurl=touchAge===null?0:smooth(touchAge/.65)*(1-smooth((touchAge-1.65)/1.15));
  const tailCurl=waitingCurl+(1-waitingCurl)*clickCurl;
  const pages=[];
  if(this.pageRound)for(const{index,start}of this.pageRound.leaves){const age=t-start;if(age>=0&&age<.48)pages.push({index,progress:smooth(age/.48)});}
  const press=phase=>phase<.17?smooth(phase/.17):phase<.24?1:phase<.52?1-smooth((phase-.24)/.28):0;
  const typing=this.kind==='work',typingFreedom=(1-smooth(this.waitAmount/.24))*(1-smooth(this.attentionProgress/.24));
  return {time:t,kind:this.kind,blink,wing,scaleX:1+.014*breath,scaleY:1+.028*breath,
   attention,attentionProgress:this.attentionProgress,attentionBlink,tailCurl,
   responding:this.touchStart!==null,pages,waiting:this.waiting,waitAmount:this.waitAmount,
   questionAlpha:clamp01(this.question*1.5),questionScale:Math.max(0,this.question),questionAngle:Math.sin(t*Math.PI/.6)*.11+Math.sin(t*Math.PI*20)*.009,
   typingLeft:typing?press((t%.72)/.72)*typingFreedom:0,
   typingRight:typing&&t>=.32?press(((t-.32)%.86)/.86)*typingFreedom:0,
   screenGlow:typing?.52+.12*Math.sin(t*1.9)+.06*Math.sin(t*4.3):0};
 }
}
