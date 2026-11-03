// Eye contours measured on the accepted 1024×1536 edge portrait.
export const FACE={x:290,y:395,width:335,height:265};
export const EYES=[
 {name:'right',upper:[[315,591],[330,576],[350,564],[372,557],[393,554],[412,559],[427,571],[432,586]],lower:[[315,591],[331,608],[351,620],[377,624],[400,619],[419,608],[431,594],[432,586]],
 area:[300,615,302,595,312,576,329,559,349,549,372,542,398,541,419,550,433,566,440,590,430,611,410,626,382,632,350,625,326,616],
 lash:[302,608,315,589,311,583,323,580,330,567,340,564,343,555,351,560,366,553,383,548,401,548,419,553,428,563,409,559,392,558,375,563,355,572,335,585,325,597,337,610,317,605]},
 {name:'left',upper:[[501,484],[512,466],[528,452],[548,441],[570,435],[589,434],[601,444],[605,464]],lower:[[501,484],[513,508],[536,522],[560,524],[582,514],[599,492],[605,464]],
 area:[492,500,494,475,508,453,529,434,551,421,568,414,574,404,584,414,602,410,611,432,614,464,606,496,587,519,562,532,536,531,512,520],
 lash:[495,493,501,471,515,452,534,437,552,426,562,424,566,416,571,421,578,408,584,418,602,415,609,425,610,440,604,466,601,450,591,438,576,438,556,444,538,453,522,467,508,482]},
];
export const FRINGE=[
 [290,395,304,395,306,479,311,527,325,553,344,575,327,563,315,550,316,581,322,607,341,625,359,632,379,630,362,641,340,643,318,640,300,633,290,624],
 [313,395,469,395,478,471,484,500,500,510,485,522,463,520,467,533,454,542,444,553,435,548,416,546,394,538,371,523,350,501,332,469],
 [602,395,625,395,625,534,608,548,588,559,593,545,605,531,613,510,615,484,613,452],
];
export function polygon(c,points,dx=0,dy=0){c.moveTo(points[0]+dx,points[1]+dy);for(let i=2;i<points.length;i+=2)c.lineTo(points[i]+dx,points[i+1]+dy);c.closePath();}
function line(points,x){if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return points.at(-1)[1];}
const clamp=v=>Math.max(0,Math.min(1,v));
export function closedY(x,left,right){return 588-.60*(x-382)+2.5*Math.sin(Math.PI*clamp((x-left)/(right-left)));}
export function createBlink(images,make=()=>{const c=document.createElement('canvas');c.width=FACE.width;c.height=FACE.height;return c;}){
 const b=FACE,canvas=make(),p=canvas.getContext('2d'),moving=make(),m=moving.getContext('2d');
 const pieces=EYES.map(eye=>{const lash=images['lash-'+eye.name],c=make(),x=c.getContext('2d');x.drawImage(lash,0,0);const d=x.getImageData(0,0,b.width,b.height).data,center=[],weight=[];for(let i=0;i<b.width;i++){let sum=0,w=0;for(let j=0;j<b.height;j++){const q=(j*b.width+i)*4,n=d[q+3]*(255-(d[q]+d[q+1]+d[q+2])/3);sum+=(j+b.y+.5)*n;w+=n;}center[i]=w?sum/w:0;weight[i]=w;}return{eye,lash,center,weight};});
 function draw(amount){
  const a=clamp(amount);p.clearRect(0,0,b.width,b.height);if(!a){p.drawImage(images.original,0,0);return;}
  p.drawImage(images.skin,0,0);m.clearRect(0,0,b.width,b.height);
  for(const {eye,lash,center,weight}of pieces){const l=eye.upper[0][0],r=eye.upper.at(-1)[0],closed=x=>closedY(x,l,r),at=(points,x)=>line(points,x)*(1-a)+closed(x)*a;
   if(a<1){m.save();m.beginPath();m.moveTo(l-b.x,at(eye.upper,l)-b.y-3*(1-a));for(let x=l+1;x<=r;x++)m.lineTo(x-b.x,at(eye.upper,x)-b.y-3*(1-a));for(let x=r;x>=l;x--)m.lineTo(x-b.x,at(eye.lower,x)-b.y);m.closePath();m.clip();m.drawImage(images['iris-'+eye.name],0,0);m.restore();}
   for(let x=0;x<b.width;x++)if(weight[x]){const thickness=1-.35*a,dy=(closed(x+b.x)-center[x])*a+(center[x]-b.y)*(1-thickness);m.drawImage(lash,x,0,1,b.height,x,dy,1,b.height*thickness);}
  }
  m.save();m.globalCompositeOperation='destination-out';m.drawImage(images['front-mask'],0,0);m.restore();p.drawImage(moving,0,0);p.drawImage(images.front,0,0);
 }
 return{canvas,draw};
}
