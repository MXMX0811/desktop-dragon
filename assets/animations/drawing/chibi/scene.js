import {createDrawingSheet} from '../../../shared/drawing-effects.js';
import {createDrawingEyes} from '../../../shared/drawing-eyes.js';
import {readingTail,readingTailPoint} from '../../../shared/attention-tail-rig.js';
import {readingWings,readingWingPoint} from '../../../shared/chibi-seated-shapes.js';
import {readingBodySlimPoint} from '../../../shared/chibi-seated-proportions.js';
import {createQuestionBubble} from '../../../shared/question-bubble.js';
import {drawingSize,drawingStroke,drawingArmPoint,floatingSheet,drawingTablePoint} from '../../../shared/drawing-motion.js';
const image=async(scene,name)=>{const img=new Image();img.src=new URL(`${scene}/${name}`,import.meta.url).href;await img.decode();return img;};

export async function createScene({PIXI:P,canvas}){
 const {width,height,offsetX:ox,offsetY:oy}=drawingSize;
 const app=new P.Application();await app.init({canvas,width,height,resolution:1,antialias:true,backgroundAlpha:0,autoStart:false,sharedTicker:false,preference:'webgl'});
 const effects=new P.Container();app.stage.addChild(effects);
 const sheets=Array.from({length:6},(_,i)=>{const item=createDrawingSheet(P,i%3);effects.addChild(item);return item;});
 const root=new P.Container();root.pivot.set(630,915);root.position.set(ox+630,oy+915);app.stage.addChild(root);
 const sprite=async(parent,folder,file,x=0,y=0)=>{const s=new P.Sprite({texture:P.Texture.from(await image(folder,file))});s.position.set(x,y);parent.addChild(s);return s;};
 const mesh=async(parent,folder,file,bounds,nx=41,ny=41)=>{const m=new P.MeshPlane({texture:P.Texture.from(await image(folder,file)),verticesX:nx,verticesY:ny});m.position.set(bounds.x,bounds.y);parent.addChild(m);const buffer=m.geometry.getAttribute('aPosition').buffer;return {m,buffer,rest:new Float32Array(buffer.data),bounds};};
 const body=await mesh(root,'../../../shared/textures/chibi-seated','body-tail-separated.png',{x:0,y:0},97,97);
 for(let i=0;i<body.rest.length;i+=2){const p=readingBodySlimPoint(body.rest[i],body.rest[i+1]);body.buffer.data[i]=p[0];body.buffer.data[i+1]=p[1];}body.buffer.update();
 const tail=await mesh(root,'../../../shared/textures/chibi-seated','tail.png',readingTail.bounds,49,43);
 const wings=await Promise.all(readingWings.map((shape,i)=>mesh(root,'../../../shared/textures/chibi-seated',`wing-${i?'right':'left'}.png`,shape.bounds,33,25)));
 await sprite(root,'./textures','bodice.png',530,618);
 const blink=await createDrawingEyes(),eyeTexture=P.Texture.from(blink.canvas),eyes=new P.Sprite({texture:eyeTexture});eyes.position.set(blink.bounds.x,blink.bounds.y);root.addChild(eyes);
 // The table has its own fixed transform. Breathing cannot lift the tabletop
 // or slide the resting hand off the sheet.
 const foreground=new P.Container();foreground.position.set(ox,oy);app.stage.addChild(foreground);
 const table=await mesh(foreground,'./textures','table.png',{x:0,y:0},17,81);
 for(let i=0;i<table.rest.length;i+=2){const p=drawingTablePoint(table.rest[i],table.rest[i+1]);table.buffer.data[i]=p[0];table.buffer.data[i+1]=p[1];}table.buffer.update();
 // Foreground tail rests in front of the table legs, never under a foot.
 const tailLayer=new P.Container();tailLayer.pivot.set(630,915);tailLayer.position.set(ox+630,oy+915);app.stage.addChild(tailLayer);
 const tailFront=await mesh(tailLayer,'../../../shared/textures/chibi-seated','tail.png',readingTail.bounds,49,43);
 const tailMask=new P.Graphics().rect(0,1030,1254,400).fill(0xffffff);tailLayer.addChild(tailMask);tailFront.m.mask=tailMask;
 const writing=await mesh(foreground,'./textures','arm-pen.png',{x:292,y:626},43,31);
 const resting=await mesh(foreground,'./textures','arm-rest.png',{x:663,y:627},35,29);
 const question=createQuestionBubble(P);question.container.position.set(ox+1050,oy+245);app.stage.addChild(question.container);
 let lastBlink=-1,lastAttention=-1;
 const deform=(part,point)=>{for(let i=0;i<part.rest.length;i+=2){const p=point(part.rest[i]+part.bounds.x,part.rest[i+1]+part.bounds.y);part.buffer.data[i]=p[0]-part.bounds.x;part.buffer.data[i+1]=p[1]-part.bounds.y;}part.buffer.update();};
 return {app,root,blink,
  render(frame){
   root.scale.set(frame.scaleX,frame.scaleY);tailLayer.scale.set(frame.scaleX,frame.scaleY);
   const stroke=drawingStroke(frame.time,frame.attentionProgress,frame.waitAmount);
   deform(writing,(x,y)=>drawingArmPoint(x,y,stroke,frame.scaleX,frame.scaleY,true));
   deform(resting,(x,y)=>drawingArmPoint(x,y,stroke,frame.scaleX,frame.scaleY,false));
   deform(tail,(x,y)=>readingTailPoint(x,y,frame.tailCurl));
   deform(tailFront,(x,y)=>readingTailPoint(x,y,frame.tailCurl));
   wings.forEach((wing,i)=>deform(wing,(x,y)=>readingWingPoint(readingWings[i],x,y,frame.wing)));
   const close=Math.max(frame.blink,frame.attentionBlink);
   if(close!==lastBlink||frame.attention!==lastAttention){blink.draw(close,frame.attention);eyeTexture.source.update();lastBlink=close;lastAttention=frame.attention;}
   sheets.forEach((g,i)=>{const pose=floatingSheet(frame.time,i);g.position.set(pose.x,pose.y);g.scale.set(pose.scale);g.rotation=pose.angle;g.alpha=pose.alpha;});
   question.render(frame);app.renderer.render(app.stage);
  },
  resize(size){const s=size/1200;canvas.style.width=`${width*s}px`;canvas.style.height=`${height*s}px`;},
  destroy(){app.destroy(false,{children:true,texture:true,textureSource:true});}
 };
}
