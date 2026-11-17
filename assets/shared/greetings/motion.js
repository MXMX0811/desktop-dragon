export const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const ramp=(t,a,b)=>ease((t-a)/(b-a));
const hold=(t,a,b,c,d)=>ramp(t,a,b)*(1-ramp(t,c,d));
export const scenes={
 coffee:{label:'白天 · 递咖啡',duration:6.4,width:1024,height:1536,head:508,ground:[513,1401],neck:[538,650]},
 goodnight:{label:'晚上 · 晚安',duration:7.2,width:1254,height:1254,head:545,ground:[625,1240],neck:[640,660]},
};
export const reactionDuration={coffee:2.1,goodnight:1.25};
export function reactionAt(name,t){
 if(t===null)return{smile:0,wing:0,eyes:0};
 if(name==='coffee')return{smile:hold(t,0,.28,1.65,2.1),wing:.075*hold(t,0,.16,1.20,1.6)*Math.sin(t*Math.PI*2/.6),eyes:hold(t,0,.32,1.65,2.1)};
 const soft=x=>{x=clamp(x);return x*x*(3-2*x);};
 return{smile:0,wing:0,eyes:soft(t/.58)*(1-soft((t-.67)/.58))};
}
export function poseAt(name,t,{sleep=false,clickTime=null}={}){
 const p={time:t,hug:0,nod:0,close:0,breath:0,angle:0,click:reactionAt(name,clickTime)};
 if(name==='goodnight'){
  p.hug=ramp(t,.65,2.1)*(sleep?1:1-ramp(t,4.5,6.4));
  p.nod=ramp(t,1.4,3.4)*(sleep?1:1-ramp(t,4.5,6.4));
  p.close=ramp(t,2.1,3.05)*(sleep?1:1-ramp(t,4.65,5.5));
  p.angle=.021*p.nod;p.breath=Math.sin(t*1.35)*.003;
 }
 return p;
}
const band=(v,a,b,m)=>ease((v-a+m)/m)*ease((b+m-v)/m);
export function pointAt(name,x,y,p){
 // Coffee is one fixed body. Wings and facial features react independently.
 if(name!=='goodnight')return[x,y];
 const s=scenes[name],upper=1-ease((y-s.neck[1]+15)/390),a=p.angle;
 const dx=upper*((x-s.neck[0])*(Math.cos(a)-1)-(y-s.neck[1])*Math.sin(a));
 let dy=upper*((x-s.neck[0])*Math.sin(a)+(y-s.neck[1])*(Math.cos(a)-1)+9*p.nod-4*p.breath/.003);
 const pillow=band(x,411,833,110)*band(y,743,1036,88);dy-=14*p.hug*pillow;
 return[x+dx,y+dy];
}
