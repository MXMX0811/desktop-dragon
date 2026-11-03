export const eyeBounds={x:390,y:225,width:160,height:105};
export const eyes=[
 {name:'R',upper:[[8,62],[17,56],[28,52],[39,51],[49,52],[58,56]],lower:[[8,62],[18,71],[34,76],[47,72],[55,64],[58,56]],region:[2,64,5,55,14,48,27,44,40,45,55,46,64,56,62,69,49,81,29,83,12,76]},
 {name:'L',upper:[[83,39],[94,30],[105,24],[117,21],[129,18],[137,15]],lower:[[83,39],[94,49],[106,51],[119,44],[129,33],[137,15]],region:[79,43,80,32,92,22,105,16,120,10,138,6,144,13,139,34,128,47,112,57,96,57,83,49]}
];
export function line(points,x){if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++){if(x<=points[i][0]){const a=points[i-1],b=points[i],t=(x-a[0])/(b[0]-a[0]);return a[1]+t*(b[1]-a[1]);}}return points.at(-1)[1];}
export function polygon(c,points){c.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);c.closePath();}
export function closedLine(eye,x){const p=Math.max(0,Math.min(1,(x-eye.upper[0][0])/(eye.upper.at(-1)[0]-eye.upper[0][0])));return 68-.36*(x-30)+1.8*Math.sin(Math.PI*p);}
const scale=4;
export function createEyesFromImages(images){
 const make=()=>{const c=document.createElement('canvas');c.width=640;c.height=420;return c;};
 const canvas=make(),ctx=canvas.getContext('2d'),moving=make(),m=moving.getContext('2d');
 const parts=eyes.map(eye=>{
  const c=make(),p=c.getContext('2d');p.drawImage(images['lash'+eye.name],0,0);
  const pixels=p.getImageData(0,0,640,420).data,center=new Float64Array(640),weight=new Float64Array(640);
  for(let x=0;x<640;x++){for(let y=0;y<420;y++){const i=(y*640+x)*4,w=pixels[i+3]*(255-(pixels[i]+pixels[i+1]+pixels[i+2])/3);center[x]+=(y+.5)*w;weight[x]+=w;}if(weight[x])center[x]/=weight[x];}
  return {eye,center,weight,lash:images['lash'+eye.name]};
 });
 function draw(amount,attention){
  const open=attention>=.5?images.gaze:images.original,c=Math.max(0,Math.min(1,amount));
  ctx.clearRect(0,0,640,420);ctx.drawImage(open,0,0);if(c===0)return;
  ctx.drawImage(images.skin,0,0);m.clearRect(0,0,640,420);
  for(const {eye,center,weight,lash} of parts){
   if(c<1){
    m.save();m.scale(scale,scale);m.beginPath();const lo=eye.upper[0][0],hi=eye.upper.at(-1)[0];
    const at=(points,x)=>line(points,x)*(1-c)+closedLine(eye,x)*c;
    m.moveTo(lo,at(eye.upper,lo)-1*(1-c));
    for(let x=lo;x<=hi;x+=.25)m.lineTo(x,at(eye.upper,x)-1*(1-c));
    for(let x=hi;x>=lo;x-=.25)m.lineTo(x,at(eye.lower,x));m.closePath();m.clip();m.drawImage(open,0,0,160,105);m.restore();
   }
   for(let x=0;x<640;x++)if(weight[x]){const dy=(closedLine(eye,x/scale)*scale-center[x])*c,s=1-.20*c;m.drawImage(lash,x,0,1,420,x,dy+center[x]*(1-s),1,420*s);}
  }
  m.save();m.globalCompositeOperation='destination-out';m.drawImage(images.fringe,0,0);m.restore();ctx.drawImage(moving,0,0);
  if(c<.10){ctx.globalAlpha=1-c/.10;ctx.drawImage(open,0,0);ctx.globalAlpha=1;}
 }
 draw(0,0);return {canvas,draw,bounds:eyeBounds};
}
export async function createEyes(){
 const images=Object.fromEntries(await Promise.all(['original','gaze','skin','lashR','lashL','fringe'].map(async name=>{const im=new Image();im.src=new URL(`./textures/eye-${name}.png`,import.meta.url).href;await im.decode();return[name,im];})));
 return createEyesFromImages(images);
}
