import {createDrawingSheet} from '../../../shared/drawing-effects.js';
import {floatingSheet} from '../../../shared/drawing-motion.js';
import {createQuestionBubble} from '../../../shared/question-bubble.js';
import {createEyes} from './eyes.js';
import {drawingSize,pieces,bodyPoint,armPoint,penStroke,wingPoint,tailPoint} from './rig.js';
const load=async name=>{const im=new Image();im.src=new URL(`./textures/${name}.png`,import.meta.url).href;await im.decode();return im;};
export async function createScene({PIXI:P,canvas}){
 const {width,height,offsetX:ox,offsetY:oy}=drawingSize;
 const app=new P.Application();await app.init({canvas,width,height,resolution:1,antialias:true,backgroundAlpha:0,autoStart:false,sharedTicker:false,preference:'webgl'});
 const effects=new P.Container();app.stage.addChild(effects);
 const sheets=Array.from({length:6},(_,i)=>{const g=createDrawingSheet(P,i%3);effects.addChild(g);return g;});
 const root=new P.Container();root.position.set(ox,oy);app.stage.addChild(root);
 const mesh=async(name,bounds,nx=41,ny=49)=>{const m=new P.MeshPlane({texture:P.Texture.from(await load(name)),verticesX:nx,verticesY:ny});m.position.set(bounds.x,bounds.y);root.addChild(m);const buffer=m.geometry.getAttribute('aPosition').buffer;return {m,buffer,rest:new Float32Array(buffer.data),bounds};};
 const wings=await Promise.all(['leftWing','rightWing'].map(name=>mesh(name,pieces[name].bounds,29,35)));
 const body=await mesh('body',{x:0,y:0},65,97);
 const tail=await mesh('tail',pieces.tail.bounds,49,61);
 const arm=await mesh('arm',pieces.arm.bounds,35,55);
 const eyes=await createEyes(),eyeTexture=P.Texture.from(eyes.canvas),eyeSprite=new P.Sprite({texture:eyeTexture});root.addChild(eyeSprite);
 const question=createQuestionBubble(P);question.container.position.set(ox+735,oy+125);question.container.scale.set((1536/1254)*(114/115));app.stage.addChild(question.container);
 const deform=(part,point)=>{for(let i=0;i<part.rest.length;i+=2){const p=point(part.rest[i]+part.bounds.x,part.rest[i+1]+part.bounds.y);part.buffer.data[i]=p[0]-part.bounds.x;part.buffer.data[i+1]=p[1]-part.bounds.y;}part.buffer.update();};
 let lastBlink=-1,lastAttention=-1;
 return {app,root,
  render(frame){
   const stroke=penStroke(frame.time,frame.attentionProgress,frame.waitAmount);
   deform(body,(x,y)=>bodyPoint(x,y,frame));deform(arm,(x,y)=>armPoint(x,y,frame,stroke));
   wings.forEach((part,i)=>deform(part,(x,y)=>wingPoint(pieces[i?'rightWing':'leftWing'],x,y,frame)));
   deform(tail,(x,y)=>tailPoint(x,y,frame.tailCurl));
   const close=Math.max(frame.blink,frame.attentionBlink);
   if(close!==lastBlink||frame.attention!==lastAttention){eyes.draw(close,frame.attention);eyeTexture.source.update();lastBlink=close;lastAttention=frame.attention;}
   const eyePos=bodyPoint(eyes.bounds.x,eyes.bounds.y,frame);eyeSprite.position.set(...eyePos);eyeSprite.scale.set((1+(frame.scaleX-1)*.20)/4,(1+(frame.scaleY-1)*.25)/4);
   sheets.forEach((g,i)=>{const p=floatingSheet(frame.time,i);g.position.set(ox+(i%2?780:240),oy+640-(820-p.y)*.85);g.scale.set(p.scale*.84);g.rotation=p.angle;g.alpha=p.alpha;});
   question.render(frame);app.renderer.render(app.stage);
  },
  resize(size){const s=size/1536;canvas.style.width=`${width*s}px`;canvas.style.height=`${height*s}px`;},
  destroy(){app.destroy(false,{children:true,texture:true,textureSource:true});}
 };
}
