// Reading-specific eye geometry in the 1254px master. The glasses and fringe
// remain in front of moving native lashes; both eyes close on one face axis.
export const READING_EYE_BOUNDS={x:420,y:430,width:390,height:195};
export const READING_EYES=[
 {name:'R',upper:[[455,551],[469,542],[488,534],[506,530],[525,530],[545,531],[560,538],[568,548],[570,563]],
  lower:[[455,551],[468,572],[485,584],[506,590],[529,588],[550,582],[564,573],[570,563]],
  region:[430,572,436,547,445,526,466,512,489,512,518,513,544,520,565,533,579,549,582,574,567,590,541,604,508,610,478,605,458,591],
  lash:[431,561,446,545,443,538,449,534,448,528,461,530,469,522,471,514,480,520,492,518,509,517,529,519,547,525,563,536,544,532,527,530,507,532,487,537,468,547,454,558,457,568,471,577,445,570]},
 {name:'L',upper:[[650,504],[670,490],[691,480],[714,474],[736,471],[755,473],[764,482],[765,501]],
  lower:[[650,504],[663,523],[682,538],[703,543],[725,540],[744,531],[757,516],[765,501]],
  region:[644,512,647,489,661,474,687,460,710,449,720,439,736,439,749,442,770,438,798,441,798,486,790,520,762,536,743,549,711,555,684,550,663,536],
  lash:[649,502,658,484,674,473,692,463,710,456,718,444,725,452,738,448,743,441,744,451,761,453,781,454,771,468,767,486,763,495,758,476,740,472,718,475,699,481,680,489,661,502]}
];
export const READING_FRINGE=[
 [420,480,445,480,447,518,447,546,451,568,459,587,474,599,492,604,478,610,457,608,438,600,420,587],
 [460,430,477,430,481,464,490,488,507,506,526,519,548,526,560,530,541,528,523,521,503,510,487,493,477,469],
 [484,430,636,430,634,476,632,496,643,509,632,510,613,502,622,509,635,516,623,522,608,523,592,519,600,523,583,528,565,526,551,518,532,507,516,491,502,470],
 [786,430,810,430,810,558,791,572,770,582,748,584,765,572,778,553,786,529,790,502]
];
export function traceReadingPolygon(ctx,points,dx=0,dy=0) {
 ctx.moveTo(points[0]+dx,points[1]+dy);for(let i=2;i<points.length;i+=2)ctx.lineTo(points[i]+dx,points[i+1]+dy);ctx.closePath();
}
function line(points,x) {if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++){if(x<=points[i][0]){const a=points[i-1],b=points[i],t=(x-a[0])/(b[0]-a[0]);return a[1]+t*(b[1]-a[1]);}}return points.at(-1)[1];}
function closedY(eye,x) {const t=Math.max(0,Math.min(1,(x-eye.upper[0][0])/(eye.upper.at(-1)[0]-eye.upper[0][0])));return 567-.31*(x-520)+2*Math.sin(Math.PI*t);}
function canvas(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}

export function createReadingBlinkFromImages(images) {
 const b=READING_EYE_BOUNDS,output=canvas(b.width,b.height),paint=output.getContext('2d');
 const moving=canvas(b.width,b.height),ctx=moving.getContext('2d');
 const onset=canvas(b.width,b.height),onsetPaint=onset.getContext('2d');
 const pieces=READING_EYES.map(eye=>{
  const lashes=images[`lashes${eye.name}`],c=canvas(b.width,b.height),p=c.getContext('2d');p.drawImage(lashes,0,0);
  const pixels=p.getImageData(0,0,b.width,b.height).data,centers=new Float64Array(b.width),weights=new Float64Array(b.width);
  for(let x=0;x<b.width;x++){for(let y=0;y<b.height;y++){const i=(y*b.width+x)*4,w=pixels[i+3]*(255-(pixels[i]+pixels[i+1]+pixels[i+2])/3);centers[x]+=(y+.5+b.y)*w;weights[x]+=w;}if(weights[x])centers[x]/=weights[x];}
  return {eye,lashes,iris:images[`iris${eye.name}`],taskIris:images[`taskIris${eye.name}`],centers,weights};
 });
 function draw(amount,attention=1) {
  const lookingAtUser=attention>=.5,open=lookingAtUser?images.original:images.taskOriginal;
  amount=Math.max(0,Math.min(1,amount));paint.clearRect(0,0,b.width,b.height);
  if(amount===0){paint.drawImage(open,0,0);return;}
  paint.drawImage(images.skin,0,0);ctx.clearRect(0,0,b.width,b.height);
  for(const {eye,iris,taskIris,lashes,centers,weights} of pieces){
   if(amount<1){
    const left=eye.upper[0][0],right=eye.upper.at(-1)[0];
    const at=(points,x)=>line(points,x)*(1-amount)+closedY(eye,x)*amount;
    ctx.save();ctx.beginPath();ctx.moveTo(left-b.x,at(eye.upper,left)-b.y-4*(1-amount));
    for(let x=left+1;x<=right;x++)ctx.lineTo(x-b.x,at(eye.upper,x)-b.y-4*(1-amount));
    for(let x=right;x>=left;x--)ctx.lineTo(x-b.x,at(eye.lower,x)-b.y);
    ctx.closePath();ctx.clip();ctx.drawImage(lookingAtUser?iris:taskIris,0,0);ctx.restore();
   }
   for(let x=0;x<b.width;x++){if(!weights[x])continue;const delta=(closedY(eye,x+b.x)-centers[x])*amount,thickness=1-.25*amount;ctx.drawImage(lashes,x,0,1,b.height,x,delta+(centers[x]-b.y)*(1-thickness),1,b.height*thickness);}
  }
  ctx.save();ctx.globalCompositeOperation='destination-out';ctx.drawImage(images.foregroundMask,0,0);ctx.restore();
  paint.drawImage(moving,0,0);paint.drawImage(images.foreground,0,0);
  // In the master the upper frame is painted into the lashes. Reveal the
  // repaired hidden rim continuously during the first small eyelid movement.
  // The iris is still clipped by the moving lid, never scaled or translated.
  if(amount<.12){const p=amount/.12,mix=p*p*(3-2*p);onsetPaint.clearRect(0,0,b.width,b.height);onsetPaint.drawImage(output,0,0);paint.clearRect(0,0,b.width,b.height);paint.drawImage(open,0,0);paint.globalAlpha=mix;paint.drawImage(onset,0,0);paint.globalAlpha=1;}

 }
 draw(0);return {bounds:b,canvas:output,draw};
}
export async function createReadingBlink() {
 const files={original:'eye-original.png',taskOriginal:'eye-task-original.png',taskIrisR:'eye-R-iris-task.png',taskIrisL:'eye-L-iris-task.png',skin:'eye-skin.png',irisR:'eye-R-iris.png',irisL:'eye-L-iris.png',lashesR:'eye-R-lashes.png',lashesL:'eye-L-lashes.png',foreground:'eye-foreground.png',foregroundMask:'eye-foreground-mask.png'};
 const images=Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,file])=>{const image=new Image();image.src=new URL(`../animations/reading/chibi/textures/${file}`,import.meta.url).href;await image.decode();return [key,image];})));
 return createReadingBlinkFromImages(images);
}
