import {clamp} from '../../../shared/greetings/motion.js';
const load=name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=new URL('textures/'+name+'.png',import.meta.url).href;});
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function ink(image,path){
 const c=surface(image.width,image.height),x=c.getContext('2d');x.drawImage(image,0,0);x.globalCompositeOperation='destination-in';x.fill(new Path2D(path));
 const data=x.getImageData(0,0,c.width,c.height);for(let i=0;i<data.data.length;i+=4){const b=data.data;const luminance=.2126*b[i]+.7152*b[i+1]+.0722*b[i+2];b[i+3]*=clamp((190-luminance)/55);}x.putImageData(data,0,0);return c;
}
export async function createCoffeeFace(){
 const [plate,mouth,closed]=await Promise.all([load('coffee-face-plate'),load('coffee-open-mouth'),load('coffee-closed-smile')]);
 const original=new Image();original.src=new URL('textures/original.png',import.meta.url).href;await original.decode();
 const c=surface(400,240),x=c.getContext('2d'),origin=[320,400];let oldSmile=-1,oldEyes=-1;
 const left=ink(closed,'M330 553 L354 543 L358 525 L373 531 L377 507 L389 517 Q432 501 478 535 L473 544 Q429 523 393 551 L366 569Z');
 const right=ink(closed,'M562 516 L562 490 Q578 466 625 457 L644 440 L643 454 L666 443 L665 461 L700 458 L675 492 Q625 469 570 517Z');
 const mask=new Path2D('M329 540 L348 519 L359 489 Q413 472 468 500 L499 528 L496 584 Q433 597 383 581 L345 576 L327 566Z M556 475 Q575 434 635 417 L677 418 L716 436 L696 486 L689 525 Q653 552 602 546 L561 528Z M500 560 Q536 540 572 556 L580 607 Q539 636 502 612Z');
 const faceSlope=Math.tan(.32);
 // Each lid travels along the face normal, not the canvas Y axis.
 const target=(px,openY,closedY)=>[px+(closedY-openY)*faceSlope,closedY];
 const leftEnd=[[365,532,560],[395,499,525],[440,495,520],[472,516,539]].map(p=>target(...p));
 const rightEnd=[[570,474,516],[600,440,476],[640,440,472],[672,460,495]].map(p=>target(...p));
 function lashes(image,from,to,top,height,travel,close){
  const point=px=>{const distance=travel(px);return[px+(distance+5)*faceSlope*close,top-distance+(distance+5)*close];};
  for(let px=from;px<to;px+=4){
   const step=Math.min(4,to-px),a=point(px),b=point(px+step);
   x.save();x.transform((b[0]-a[0])/step,(b[1]-a[1])/step,0,1,a[0],a[1]);
   x.drawImage(image,px-.25,top,step+.5,height,-.25,0,step+.5,height);x.restore();
  }
 }
 return{canvas:c,origin,draw(amount,close){
  if(Math.abs(amount-oldSmile)<.00001&&Math.abs(close-oldEyes)<.00001)return;oldSmile=amount;oldEyes=close;
  x.clearRect(0,0,400,240);x.drawImage(plate,-320,-400);x.save();x.translate(-320,-400);
  const mix=(a,b)=>a+(b-a)*close;
  const p=(px,py,end)=>[mix(px,end[0]),mix(py,end[1])];
  x.save();x.beginPath();x.moveTo(...p(365,532,leftEnd[0]));
  x.bezierCurveTo(...p(395,499,leftEnd[1]),...p(440,495,leftEnd[2]),...p(472,516,leftEnd[3]));
  x.bezierCurveTo(...p(481,575,leftEnd[2]),...p(403,602,leftEnd[1]),...p(365,532,leftEnd[0]));x.closePath();x.clip();x.drawImage(original,0,0);x.restore();
  x.save();x.beginPath();x.moveTo(...p(570,474,rightEnd[0]));
  x.bezierCurveTo(...p(600,440,rightEnd[1]),...p(640,440,rightEnd[2]),...p(672,460,rightEnd[3]));
  x.bezierCurveTo(...p(670,525,rightEnd[2]),...p(590,559,rightEnd[1]),...p(570,474,rightEnd[0]));x.closePath();x.clip();x.drawImage(original,0,0);x.restore();
  lashes(left,329,479,500,75,px=>22+3*Math.sin(Math.PI*clamp((px-335)/140)),close);
  lashes(right,560,701,438,83,px=>29+7*Math.sin(Math.PI*clamp((px-564)/130)),close);
  if(amount===0)x.drawImage(original,500,550,80,76,500,550,80,76);
  else{
   // Both expressions share the original horizontal center; there is no lip drift.
   // The visible mouth bounds are centered at x=29.5 inside the cropped asset.
   const sy=.04+.96*amount,angle=-.32;
   x.save();x.translate(538,580-10*amount);x.transform(1,(1-sy)*Math.tan(angle),0,sy,0,0);x.drawImage(mouth,-29.5,-11);x.restore();
  }
  x.restore();x.globalCompositeOperation='destination-in';x.save();x.translate(-320,-400);x.fill(mask);x.restore();x.globalCompositeOperation='source-over';
 }};
}
