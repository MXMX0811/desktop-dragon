export function union(rects) {
 const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));
 return {x,y,width:Math.max(...rects.map(r=>r.x+r.width))-x,height:Math.max(...rects.map(r=>r.y+r.height))-y};
}
export function contains(rect,point) {
 return point.x>=rect.x&&point.y>=rect.y&&point.x<rect.x+rect.width&&point.y<rect.y+rect.height;
}
export function sameDisplayLayout(before,after) {
 return before.length===after.length&&before.every(display=>{
  const next=after.find(item=>item.id===display.id);
  return next&&['x','y','width','height'].every(key=>display.workArea[key]===next.workArea[key]);
 });
}
export function validRect(r) {
 return r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0;
}
export function clipBounds(rect,desktop) {
 const x=Math.max(desktop.x,Math.floor(rect.x)),y=Math.max(desktop.y,Math.floor(rect.y));
 const right=Math.min(desktop.x+desktop.width,Math.ceil(rect.x+rect.width));
 const bottom=Math.min(desktop.y+desktop.height,Math.ceil(rect.y+rect.height));
 return {x,y,width:Math.max(1,right-x),height:Math.max(1,bottom-y)};
}
export function initialPosition(displays,saved) {
 if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&displays.some(d=>contains(d.workArea,saved)))return saved;
 const a=displays[0].workArea;
 return {x:a.x+a.width-240,y:a.y+a.height-230};
}
