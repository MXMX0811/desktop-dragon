// A restrained hand-drawn line boil: four held poses over 2.4 seconds.
// The symbol stays in place; only the inner loops change between drawings.
export const BUSY_COLOR=0x9985b2;
export function busyDrawingAt(time){return [0,1,2,1][Math.floor(time/.6)%4];}

export function traceBusyScribble(path,variant){
 const d=[0,2,-2][variant];
 path.moveTo(-32,-24);
 path.bezierCurveTo(-26,-33,42+d,23,30,30);
 path.bezierCurveTo(22,38,-40,-16+d,-32,-24);
 path.moveTo(-26,28);
 path.bezierCurveTo(-39,21,20+d,-39,29,-28);
 path.bezierCurveTo(39,-15,-16,40+d,-26,28);
 path.moveTo(-8,-35);
 path.bezierCurveTo(10,-42,22+d,30,6,36);
 path.bezierCurveTo(-12,42,-24,-27+d,-8,-35);
 path.moveTo(-36,4);
 path.bezierCurveTo(-42,-20,33,-29+d,39,-4);
 path.bezierCurveTo(43,22,-24+d,29,-36,4);
 path.moveTo(15,-29);
 path.bezierCurveTo(41,-14+d,9,38,-14,27);
 path.bezierCurveTo(-40,11,-11+d,-42,15,-29);
 // A short loose end points back toward the character.
 path.moveTo(18,38);
 path.bezierCurveTo(28,43,15,49,25,54);
 path.bezierCurveTo(33,59,26,63,34,67);
}

export function createBusyScribble(P){
 const container=new P.Container({label:'busy-scribble'});
 const drawings=[0,1,2].map(variant=>{
  const line=new P.Graphics();traceBusyScribble(line,variant);
  line.stroke({color:BUSY_COLOR,width:4,cap:'round',join:'round'});
  container.addChild(line);return line;
 });
 function render(frame){
  const amount=Math.min(1,Math.max(0,frame.waitAmount/.35));
  container.alpha=1-amount*amount*(3-2*amount);
  container.visible=container.alpha>.001;
  const selected=busyDrawingAt(frame.time);
  drawings.forEach((drawing,index)=>{drawing.visible=index===selected;});
 }
 return {container,render};
}
