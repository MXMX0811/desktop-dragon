// Independent tail meshes. The reading root and right arc are fixed; only the
// distal coil bends. Thinking's thick base stays hidden behind lower hair.
const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
export const readingTail={bounds:{x:730,y:810,width:485,height:445},verticesX:49,verticesY:43};
export function readingTailPoint(x,y,curl){
 const weight=smooth((1080-x)/290)*smooth((y-970)/150),angle=.24*curl*weight,dx=x-1070,dy=y-1130;
 return[1070+dx*Math.cos(angle)-dy*Math.sin(angle),1130+dx*Math.sin(angle)+dy*Math.cos(angle)];
}
export const thinkingTail={bounds:{x:1000,y:890,width:260,height:310},verticesX:33,verticesY:41};
export function thinkingTailPoint(x,y,curl){
 const weight=smooth((1180-y)/260),angle=(.45+.17*curl)*weight,dx=x-1110,dy=y-1170;
 return[1110+dx*Math.cos(angle)-dy*Math.sin(angle),1170+dx*Math.sin(angle)+dy*Math.cos(angle)];
}
