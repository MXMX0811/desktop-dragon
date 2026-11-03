// Face coordinates measured on dragon-thinking-standing-chibi-v2.png (1024×1536).
// Left/right names are the character's own sides.
export const standingFaceBounds={x:330,y:410,width:380,height:205};
export const standingEyes=[
 {name:'right',
  upper:[[363,552],[380,540],[400,531],[420,526],[440,524],[456,526],[468,533],[474,544]],
  lower:[[363,552],[380,570],[400,582],[421,587],[443,585],[461,577],[471,562],[474,544]],
  area:[329,564,340,544,348,526,366,518,387,508,414,504,443,503,468,511,481,527,486,550,477,577,455,592,426,597,399,594,372,584,351,572],
  lash:[334,562,347,549,356,539,352,532,366,532,372,526,372,518,381,525,393,518,412,513,432,512,452,514,470,523,476,530,459,527,440,527,420,530,400,538,380,549,366,560,378,575,354,564]},
 {name:'left',
  upper:[[565,482],[583,467],[605,457],[626,451],[647,450],[663,453],[667,470]],
  lower:[[565,482],[578,510],[595,524],[616,529],[639,521],[656,504],[667,470]],
  area:[550,490,556,469,572,453,594,440,622,430,643,423,653,424,663,417,672,424,692,429,681,448,676,474,673,496,660,522,639,536,611,541,584,531,566,513],
  lash:[558,488,566,468,580,453,601,439,621,430,635,427,639,420,647,426,657,424,662,416,663,426,690,430,679,443,675,468,670,475,670,456,658,451,639,451,619,457,600,466,579,479]}
];
export const standingFringe=[
 [330,410,350,410,350,475,354,501,363,521,386,535,373,528,362,518,355,504,355,539,355,570,360,589,375,605,399,614,412,614,392,623,372,620,350,609,330,591],
 [360,410,543,410,545,454,541,481,550,493,568,505,550,510,539,507,546,516,533,522,517,520,501,530,480,535,490,525,482,520,467,512,453,499,442,485,452,505,467,519,451,514,435,503,416,486,399,467,386,444,374,420],
 [654,410,710,410,710,615,680,600,652,594,636,580,654,574,668,562,682,543,688,520,673,533,655,538,644,540,662,527,674,509,681,486,683,461,679,439,667,424]
];
export function standingFacePolygon(c,points,dx=0,dy=0){c.moveTo(points[0]+dx,points[1]+dy);for(let i=2;i<points.length;i+=2)c.lineTo(points[i]+dx,points[i+1]+dy);c.closePath();}
export function standingClosedEyeY(x,t){return 545-.40*(x-420)+2.5*Math.sin(Math.PI*t);}
const b=standingFaceBounds;
const make=()=>{const c=document.createElement('canvas');c.width=b.width;c.height=b.height;return c;};
function line(points,x){if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],q=points[i];return a[1]+(q[1]-a[1])*(x-a[0])/(q[0]-a[0]);}return points.at(-1)[1];}
export const standingFaceFiles=['eye-original','eye-user-original','eye-skin','eye-foreground','eye-foreground-mask',...standingEyes.flatMap(e=>['iris-'+e.name,'iris-'+e.name+'-user','lash-'+e.name])];
export async function createThinkingStandingBlink(){
 const images=Object.fromEntries(await Promise.all(standingFaceFiles.map(async name=>{const image=new Image();image.src=new URL('./textures/'+name+'.png',import.meta.url).href;await image.decode();return [name,image];})));
 return createThinkingStandingBlinkFromImages(images);
}
export function createThinkingStandingBlinkFromImages(images){
 const canvas=make(),p=canvas.getContext('2d'),moving=make(),m=moving.getContext('2d');
 const parts=standingEyes.map(e=>{const lash=images['lash-'+e.name],c=make(),ctx=c.getContext('2d');ctx.drawImage(lash,0,0);const data=ctx.getImageData(0,0,b.width,b.height).data,center=[],weight=[];for(let x=0;x<b.width;x++){let sum=0,n=0;for(let y=0;y<b.height;y++){const alpha=data[(y*b.width+x)*4+3];sum+=(y+.5+b.y)*alpha;n+=alpha;}center[x]=n?sum/n:0;weight[x]=n;}return {e,lash,center,weight};});
 function draw(amount,attention=0){
  const atUser=attention>=.5,open=images[atUser?'eye-user-original':'eye-original'],a=Math.max(0,Math.min(1,amount));p.clearRect(0,0,b.width,b.height);
  if(!a){p.drawImage(open,0,0);return;}
  p.drawImage(images['eye-skin'],0,0);m.clearRect(0,0,b.width,b.height);
  for(const {e,lash,center,weight} of parts){
   const left=e.upper[0][0],right=e.upper.at(-1)[0],closed=x=>standingClosedEyeY(x,Math.max(0,Math.min(1,(x-left)/(right-left)))),at=(points,x)=>line(points,x)*(1-a)+closed(x)*a;
   if(a<1){m.save();m.beginPath();m.moveTo(left-b.x,at(e.upper,left)-b.y-3*(1-a));for(let x=left+1;x<=right;x++)m.lineTo(x-b.x,at(e.upper,x)-b.y-3*(1-a));for(let x=right;x>=left;x--)m.lineTo(x-b.x,at(e.lower,x)-b.y);m.closePath();m.clip();m.drawImage(images['iris-'+e.name+(atUser?'-user':'')],0,0);m.restore();}
   for(let x=0;x<b.width;x++)if(weight[x]){const thick=1-.45*a,delta=(closed(x+b.x)-center[x])*a;m.drawImage(lash,x,0,1,b.height,x,delta+(center[x]-b.y)*(1-thick),1,b.height*thick);}
  }
  m.save();m.globalCompositeOperation='destination-out';m.drawImage(images['eye-foreground-mask'],0,0);m.restore();p.drawImage(moving,0,0);p.drawImage(images['eye-foreground'],0,0);
 }
 draw(0);return {canvas,bounds:b,draw};
}
