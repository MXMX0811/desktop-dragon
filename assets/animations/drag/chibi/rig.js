// Source coordinates: textures/character.png, 1024 × 1536.
// Names are near/far in the three-quarter camera, rather than screen left/right.
export const GRIP = [570, 700];
// Match the standing-thinking head, not the pose's opaque bounding box.
// Crown-to-chin: drag 530 source px; thinking 514 px at reference scale 1128.
export const REFERENCE_HEIGHT = 530 * 1128 / 514;
export const SOURCE = {width:1024, height:1536};
export const PADDING = {x:250, y:180};
export const CANVAS = {width:1524, height:1896};
const smooth = value => {const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const rotate=(x,y,p,a)=>{const c=Math.cos(a),s=Math.sin(a),dx=x-p[0],dy=y-p[1];return [p[0]+dx*c-dy*s,p[1]+dx*s+dy*c];};

// Continuous skinning over the complete texture. Shared vertices keep the
// shoulder/sleeve and hip/hem boundaries connected throughout the small swing.
const regions = [
 {name:'armNear',pivot:[475,731],joint:[515,870],bend:'armNear',start:735,end:870,
  outline:[[439,718],[498,728],[532,823],[599,919],[605,980],[581,1064],[551,1072],[520,1045],[510,978],[466,982],[414,1016],[394,990],[418,926],[449,850],[426,781]]},
 {name:'armFar',pivot:[640,770],joint:[674,900],bend:'armFar',start:775,end:900,
  outline:[[625,747],[663,760],[691,820],[719,883],[753,945],[751,1011],[741,1066],[704,1082],[673,1056],[662,998],[621,1006],[615,956],[642,888],[629,818]]},
 {name:'legNear',pivot:[451,1045],joint:[491,1127],bend:'kneeNear',start:1025,end:1127,
  outline:[[399,995],[482,1023],[542,1053],[558,1112],[545,1154],[502,1196],[440,1250],[429,1303],[390,1378],[338,1386],[291,1363],[280,1320],[308,1278],[345,1238],[374,1193],[402,1151],[431,1119],[395,1089],[377,1045]]},
 {name:'legFar',pivot:[548,1110],joint:[533,1235],bend:'kneeFar',start:1110,end:1235,
  outline:[[527,1109],[573,1141],[603,1196],[583,1251],[554,1315],[540,1371],[527,1430],[477,1485],[422,1491],[390,1460],[386,1427],[419,1381],[447,1330],[457,1268],[453,1232],[496,1194]]},
 {name:'skirtNear',pivot:[459,940],start:940,end:1170,
  outline:[[385,954],[470,968],[489,1024],[435,1100],[403,1180],[378,1220],[286,1210],[224,1175],[136,1149],[124,1102],[177,1046],[273,1010]]},
 {name:'skirtFar',pivot:[611,949],start:955,end:1190,
  outline:[[583,976],[633,975],[704,1037],[757,1103],[794,1175],[808,1211],[779,1244],[704,1276],[635,1287],[584,1244],[579,1180],[561,1103]]},
 {name:'hair',pivot:[330,691],start:700,end:1090,
  outline:[[319,689],[397,719],[427,812],[412,902],[371,972],[315,1071],[276,1138],[206,1107],[125,1068],[37,982],[23,892],[78,845],[141,832],[202,760]]},
 {name:'hair',pivot:[754,629],start:680,end:1040,
  outline:[[746,633],[825,657],[912,733],[1008,802],[999,931],[965,1043],[917,1080],[858,1047],[791,964],[748,830]]},
 {name:'wing',pivot:[346,752],start:735,end:930,
  outline:[[332,731],[373,775],[323,842],[281,904],[206,930],[160,913],[89,953],[36,942],[40,913],[107,842],[205,777]]},
 {name:'wing',pivot:[748,713],start:710,end:825,
  outline:[[740,678],[809,692],[889,748],[967,822],[1011,877],[977,871],[917,832],[863,824],[820,855],[790,818],[751,828]]},
];
const tailOutline=[[795,973],[859,987],[930,1052],[980,1147],[993,1231],[952,1327],[890,1396],[806,1427],[745,1434],[694,1415],[661,1379],[669,1337],[698,1302],[739,1286],[721,1314],[708,1344],[739,1360],[800,1353],[850,1317],[883,1272],[886,1200],[862,1145],[838,1104],[793,1090],[761,1056]];
const tailPath=[[804,1026],[882,1101],[937,1202],[902,1304],[820,1372],[738,1390],[697,1364],[718,1311]];

function edgeWeight(x,y,polygon,feather){
 let inside=false,distance=Infinity;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[j],[bx,by]=polygon[i],vx=bx-ax,vy=by-ay;
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  const t=Math.max(0,Math.min(1,((x-ax)*vx+(y-ay)*vy)/(vx*vx+vy*vy)));
  distance=Math.min(distance,Math.hypot(x-ax-t*vx,y-ay-t*vy));
 }
 return inside?1:smooth(1-distance/feather);
}
function alongTail(x,y){
 let closest=Infinity,along=0,total=0;
 for(let i=1;i<tailPath.length;i++){
  const a=tailPath[i-1],b=tailPath[i],vx=b[0]-a[0],vy=b[1]-a[1],length=Math.hypot(vx,vy);
  const t=Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/(length*length)));
  const d=Math.hypot(x-a[0]-t*vx,y-a[1]-t*vy);
  if(d<closest){closest=d;along=total+t*length;}
  total+=length;
 }
 return along/total;
}

export function bindPoint(x,y){
 const tail=edgeWeight(x,y,tailOutline,120)*smooth((y-985)/75);
 const parts=regions.map(r=>{
  let weight=edgeWeight(x,y,r.outline,120)*smooth((y-r.start)/(r.end-r.start));
  if(r.name==='hair'||r.name.startsWith('skirt'))weight*=1-tail;
  return {region:r,weight,bend:r.joint?smooth((y-r.joint[1]+24)/85):0};
 }).filter(p=>p.weight>0);
 // Give the visible limbs ownership over their overlying cuffs and hems.
 const limbs=parts.filter(p=>p.region.name.startsWith('arm')||p.region.name.startsWith('leg'));
 const limbWeight=Math.min(1,limbs.reduce((sum,p)=>sum+p.weight,0));
 for(const p of parts)if(p.region.name.startsWith('skirt')||p.region.name==='hair')p.weight*=1-limbWeight;
 return {x,y,parts,tail,along:tail?alongTail(x,y):0};
}

export function posePoint(binding,pose){
 const {x,y,parts,tail,along}=binding;
 let dx=0,dy=0,weight=0;
 for(const p of parts){
  const r=p.region;
  let point=[x,y];
  if(r.joint){
   const bend=pose[r.bend]*p.bend*(r.name.startsWith('arm')?.45:1);
   point=rotate(...point,r.joint,bend);
  }
  point=rotate(...point,r.pivot,pose[r.name]);
  dx+=(point[0]-x)*p.weight;dy+=(point[1]-y)*p.weight;weight+=p.weight;
 }
 if(tail){
  const tip=smooth((along-.46)/.54),root=smooth(along/.3);
  let point=rotate(x,y,[906,1278],pose.tailTip*tip);
  point=rotate(...point,tailPath[0],pose.tail*root);
  dx+=(point[0]-x)*tail;dy+=(point[1]-y)*tail;weight+=tail;
 }
 const divisor=Math.max(1,weight);
 return [x+dx/divisor,y+dy/divisor];
}

export function jointMarkers(){return [{name:'后衣领',point:GRIP},...regions.filter(r=>r.joint).flatMap(r=>[{name:r.name,point:r.pivot},{name:'关节',point:r.joint}]),{name:'尾根',point:tailPath[0]}];}
