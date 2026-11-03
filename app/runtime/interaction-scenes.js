import {createScene as createDragScene} from '../../assets/animations/drag/chibi/scene.js';
import {DragController} from '../../assets/animations/drag/chibi/controller.js';
import {GRIP,PADDING,CANVAS,REFERENCE_HEIGHT} from '../../assets/animations/drag/chibi/rig.js';
import {createFlightScene} from '../../assets/animations/flight/chibi/scene.js';
import {createEdgeScene} from '../../assets/animations/peek/chibi/scene.js';
import {applyReferenceColor} from '../../assets/shared/reference-palette.mjs';
import {displaySize} from './display-policy.js';

const DRAG_SIZE=displaySize('drag','chibi'),DRAG_EYES=[475,562];
// Release-anchor distance from either outer screen edge, in CSS pixels.
export const DRAG_EDGE_WIDTH=80;
// Eye anchors are measured in each actual padded canvas, never alpha bounds.
const eyes={
 'standby:chibi':[695.5,635.5,1414,1414],
 'thinking:chibi':[598,595,1184,1696],
 'reading:chibi':[670,590,1374,1374],
 'work:chibi':[860,605,1754,1480],
 'drawing:chibi':[860,605,1754,1404],
 'reading:normal':[446,278,1024,1536],
 'work:normal':[690,469,1254,1254],
 'drawing:normal':[585,312,1304,1600],
};
export function taskEye(view,element,stage){
 const [x,y,w,h]=eyes[`${view.scene}:${view.form}`];
 // The canvas can rebound on click; its untransformed container owns position.
 const r=element.getBoundingClientRect(),s=stage.getBoundingClientRect();
 return {x:r.left-s.left-stage.clientLeft+x*r.width/w,y:r.top-s.top-stage.clientTop+y*r.height/h};
}
export async function createDrag(element){
 const canvas=document.createElement('canvas');canvas.dataset.petHit='';canvas.setAttribute('aria-label','可拖动的龙娘');canvas.setAttribute('role','img');
 element.append(canvas);applyReferenceColor(canvas,'drag-chibi');
 const scene=await createDragScene({PIXI:globalThis.PIXI,canvas}),controller=new DragController();
 scene.resize(DRAG_SIZE);const scale=DRAG_SIZE/REFERENCE_HEIGHT;
 Object.assign(element.style,{width:`${CANVAS.width*scale}px`,height:`${CANVAS.height*scale}px`});
 let origin={x:0,y:0};
 return {
  place(eye){origin={x:eye.x-(PADDING.x+DRAG_EYES[0])*scale,y:eye.y-(PADDING.y+DRAG_EYES[1])*scale};Object.assign(element.style,{left:`${origin.x}px`,top:`${origin.y}px`});scene.render(controller.sample());},
  eye(){const a=controller.sample().body,dx=DRAG_EYES[0]-GRIP[0],dy=DRAG_EYES[1]-GRIP[1];return {x:origin.x+(PADDING.x+GRIP[0]+dx*Math.cos(a)-dy*Math.sin(a))*scale,y:origin.y+(PADDING.y+GRIP[1]+dx*Math.sin(a)+dy*Math.cos(a))*scale};},
  begin(){controller.begin();},move(dx,dy,dt){controller.move(dx/DRAG_SIZE,dy/DRAG_SIZE,dt);},release(){controller.release();},
  tick(dt){scene.render(controller.update(dt));},destroy(){scene.destroy();},
 };
}
export async function createFlight(element,onEnded){
 const video=document.createElement('video');video.setAttribute('aria-label','龙娘飞向屏幕边缘');element.append(video);
 const scene=await createFlightScene({video,onEnded});let eye;
 return {
  place(options){const r=scene.layout({size:displaySize('flight','chibi'),...options});eye=r.eye;Object.assign(element.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});video.style.left=video.style.top='0px';},
  eye(){return eye;},play:()=>scene.play(),pause:()=>scene.pause(),resume:()=>scene.resume(),destroy:()=>scene.destroy(),
 };
}
export async function createPeek(element){
 const canvas=document.createElement('canvas');element.append(canvas);
 const scene=await createEdgeScene({canvas,PIXI:globalThis.PIXI});let bounds;
 return {
  place(options){
   bounds=scene.layout({size:displaySize('peek','chibi'),...options});
   const cropLeft=bounds.visible.left-bounds.left,cropRight=bounds.width-cropLeft-bounds.visible.width;
   Object.assign(element.style,{left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`,clipPath:`inset(0px ${cropRight}px 0px ${cropLeft}px)`});
   canvas.style.left=canvas.style.top='0px';
  },
  eye(){return bounds.eye;},touch:()=>scene.touch(),setPaused:value=>scene.setPaused(value),destroy:()=>scene.destroy(),
 };
}
