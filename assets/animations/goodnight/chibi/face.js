import {clamp} from '../../../shared/greetings/motion.js';
const load=name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=new URL('textures/'+name+'.png',import.meta.url).href;});
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function ink(image,path){
 const c=surface(image.width,image.height),x=c.getContext('2d');x.drawImage(image,0,0);x.globalCompositeOperation='destination-in';x.fill(new Path2D(path));
 const data=x.getImageData(0,0,c.width,c.height);for(let i=0;i<data.data.length;i+=4){const b=data.data;const luminance=.2126*b[i]+.7152*b[i+1]+.0722*b[i+2];b[i+3]*=clamp((190-luminance)/55);}x.putImageData(data,0,0);return c;
}
export async function createNightFace(){
 const plate=await load('night-face-plate');
 const original=new Image();original.src=new URL('textures/character.png',import.meta.url).href;await original.decode();
 const closed=new Image();closed.src=new URL('textures/closed.png',import.meta.url).href;await closed.decode();
 const c=surface(420,260),x=c.getContext('2d'),origin=[400,420];
 // Preserve the first illustration's already-closed eye. The other lid uses
 // the first closed keyframe's downward curve, including its tapered lashes.
 const right=ink(closed,'M640 537 L652 526 Q708 524 742 502 L755 486 L755 496 L784 482 L769 505 L755 522 Q698 546 640 549Z');
 const mask=new Path2D('M625 489 Q670 457 779 445 L791 462 L780 539 Q729 569 659 559 L626 538Z');
 let oldClose=-1;
 return{canvas:c,origin,draw(baseClose,reaction){
  const close=baseClose+(1-baseClose)*reaction.eyes;
  if(Math.abs(close-oldClose)<.00001)return;oldClose=close;
  x.clearRect(0,0,420,260);x.drawImage(plate,-400,-420);x.save();x.translate(-400,-420);
  // The iris stays in place while both lid edges meet continuously.
  const mix=(a,b)=>a+(b-a)*close;
  x.save();x.beginPath();x.moveTo(650,mix(515,542));
  x.bezierCurveTo(mix(684,689),mix(497,544),mix(735,738),mix(484,531),764,mix(479,511));
  x.bezierCurveTo(mix(765,738),mix(543,531),mix(695,689),mix(580,544),650,mix(515,542));
  x.closePath();x.clip();x.drawImage(original,0,0);x.restore();
  // Bend one complete ink strip from open to closed; no swapping or fading.
  for(let px=639;px<785;px++){
   const u=clamp((px-642)/140),travel=28+10*Math.sin(Math.PI*u);
   x.drawImage(right,px,480,1,72,px,480-travel*(1-close),1,72);
  }
  x.restore();x.globalCompositeOperation='destination-in';x.save();x.translate(-400,-420);x.fill(mask);x.restore();x.globalCompositeOperation='source-over';
 }};
}
