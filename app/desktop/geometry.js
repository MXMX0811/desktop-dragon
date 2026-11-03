export function areaAt(point,areas){
 return areas.reduce((best,area)=>{
  const distance=a=>Math.hypot(Math.max(a.x-point.x,0,point.x-a.x-a.width),Math.max(a.y-point.y,0,point.y-a.y-a.height));
  return !best||distance(area)<distance(best)?area:best;
 },null);
}
export function outsideEdge(point,area,areas,margin){
 const side=point.x<=area.x+margin?'left':point.x>=area.x+area.width-margin?'right':null;
 if(!side)return null;
 const x=side==='left'?area.x:area.x+area.width;
 const neighbour=areas.some(other=>other!==area&&Math.abs((side==='left'?other.x+other.width:other.x)-x)<=1&&point.y>=other.y&&point.y<other.y+other.height);
 return neighbour?null:side;
}
export function union(rects,padding=0){
 const x=Math.min(...rects.map(r=>r.x))-padding,y=Math.min(...rects.map(r=>r.y))-padding;
 return{x,y,width:Math.max(...rects.map(r=>r.x+r.width))-x+padding,height:Math.max(...rects.map(r=>r.y+r.height))-y+padding};
}
