const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export const drawingSize={width:1754,height:1404,offsetX:250,offsetY:75};
export const penTip=[513,805];
export function drawingStroke(time,attention=0,waiting=0){
 const phase=((time%4.8)+4.8)%4.8/4.8;
 const envelope=smooth(phase/.09)*(1-smooth((phase-.73)/.13));
 const activity=(1-smooth(attention/.7))*(1-smooth(waiting/.3));
 return {x:16*Math.sin(phase*Math.PI*6)*envelope*activity,y:7*Math.sin(phase*Math.PI*10)*envelope*activity,angle:.025*Math.sin(phase*Math.PI*4)*envelope*activity};
}
export function drawingArmPoint(x,y,stroke,scaleX,scaleY,moving=true){
 // Shoulder follows the breathing torso. Contact with the paper is pinned;
 // the complete hand and pencil undergo one rigid transform.
 const contact=Math.max(smooth((y-679)/63),moving?smooth((528-x)/50):0);
 const breathX=(x-630)*(scaleX-1)*(1-contact),breathY=(y-915)*(scaleY-1)*(1-contact);
 const dx=x-455,dy=y-762,a=moving?stroke.angle:0;
 return [x+breathX+contact*(moving?stroke.x+dx*(Math.cos(a)-1)-dy*Math.sin(a):0),y+breathY+contact*(moving?stroke.y+dx*Math.sin(a)+dy*(Math.cos(a)-1):0)];
}
export function floatingSheet(time,index){
 const elapsed=time<index*2?-1:(time-index*2)%12,life=3.7,p=Math.max(0,elapsed/life);
 const active=elapsed>=0&&elapsed<life;
 return {alpha:active?.8*smooth(p/.18)*(1-smooth((p-.65)/.35)):0,
  x:index%2?1348:410,y:820-420*Math.min(1,p),scale:1.04+.14*Math.min(1,p),angle:(index%2?1:-1)*(.08+.025*Math.sin(p*Math.PI)),kind:index%3};
}

// Extend only the leg shafts; the work surface and hand contacts stay fixed.
export function drawingTablePoint(x,y){return [x,y+95*smooth((y-900)/215)];}
