export const drawingSize={width:1304,height:1600,offsetX:140,offsetY:40};
export const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export const pieces={
 leftWing:{bounds:{x:60,y:325,width:295,height:325},path:'M 65 644 L 143 485 Q 232 383 310 340 Q 326 342 315 369 L 345 405 L 305 484 L 237 554 L 213 594 Q 204 568 182 578 Q 160 589 138 615 Z',pivot:[313,364]},
 rightWing:{bounds:{x:694,y:320,width:330,height:475},path:'M 709 329 Q 724 325 755 348 Q 944 494 998 689 Q 1019 755 1003 774 Q 987 790 977 752 Q 933 584 888 572 Q 872 567 864 597 L 792 570 L 729 473 Z',pivot:[724,356]},
 arm:{bounds:{x:255,y:355,width:165,height:270},paths:['M 394 364 Q 407 363 416 376 Q 418 405 397 443 L 390 469 Q 376 497 382 533 L 388 582 L 341 589 Q 343 600 324 601 Q 306 605 283 598 Q 264 594 264 578 Q 261 566 270 550 L 279 540 Q 307 517 316 478 Q 326 441 358 433 Z','M 269 467 Q 273 458 281 466 L 342 619 L 333 612 Z']},
 tail:{bounds:{x:558,y:808,width:466,height:728},path:'M 850 817 Q 952 835 992 937 L 980 962 L 1007 1008 L 995 1020 L 1020 1068 L 1007 1073 L 1024 1121 L 1010 1125 Q 1017 1225 970 1294 Q 935 1359 828 1366 Q 752 1366 683 1338 Q 618 1340 619 1415 Q 624 1469 690 1477 Q 751 1492 775 1441 Q 765 1429 744 1416 L 716 1412 L 739 1398 L 718 1380 Q 764 1371 790 1394 Q 840 1428 822 1473 Q 797 1515 716 1524 Q 622 1534 586 1478 Q 558 1436 576 1389 Q 570 1323 627 1290 L 617 1278 L 644 1275 L 651 1261 Q 700 1273 757 1261 Q 853 1264 888 1168 Q 903 1038 851 948 Z'}
};
// One smooth deformation across the head, neck and torso. The desktop and
// lower body stay grounded; no head cutout can expose a neck seam.
export function bodyPoint(x,y,frame){
 const w=1-smooth((y-350)/235),bx=(frame.scaleX-1)*.20,by=(frame.scaleY-1)*.25;
 return [x+(x-500)*bx*w,y+(y-585)*by*w];
}
export function penStroke(t,attention,waiting){
 const p=(t%4.8)/4.8,e=smooth(p/.10)*(1-smooth((p-.73)/.13));
 const a=e*(1-smooth(attention/.7))*(1-smooth(waiting/.3));
 return {x:9*Math.sin(p*Math.PI*6)*a,y:2.7*Math.sin(p*Math.PI*10)*a,angle:.014*Math.sin(p*Math.PI*4)*a};
}
export function armPoint(x,y,frame,stroke){
 const contact=Math.max(smooth((y-490)/60),1-smooth((x-292)/26));
 const body=bodyPoint(x,y,frame),angle=stroke.angle*contact,dx=x-304,dy=y-564;
 return [x+(body[0]-x)*(1-contact)+(stroke.x+dx*(Math.cos(angle)-1)-dy*Math.sin(angle))*contact,
 y+(body[1]-y)*(1-contact)+(stroke.y+dx*Math.sin(angle)+dy*(Math.cos(angle)-1))*contact];
}
export function wingPoint(part,x,y,frame){
 const [px,py]=part.pivot,w=smooth(Math.hypot(x-px,y-py)/220);
 const direction=px<500?1:-1,angle=direction*(.007*Math.sin(frame.time*1.6)+frame.wing*.022)*w;
 const dx=x-px,dy=y-py;return [px+dx*Math.cos(angle)-dy*Math.sin(angle),py+dx*Math.sin(angle)+dy*Math.cos(angle)];
}
export function tailPoint(x,y,curl){
 const w=smooth((y-1240)/200)*smooth((870-x)/170),angle=-.17*curl*w;
 const dx=x-709,dy=y-1390;return [709+dx*Math.cos(angle)-dy*Math.sin(angle),1390+dx*Math.sin(angle)+dy*Math.cos(angle)-10*curl*w];
}
