import {createDrawingEyes} from '../../../shared/drawing-eyes.js';
import {readingBodySlimPoint} from '../../../shared/chibi-seated-proportions.js';
import {readingWings,readingWingPoint} from '../../../shared/chibi-seated-shapes.js';
import {readingTail,readingTailPoint} from '../../../shared/attention-tail-rig.js';
import {createQuestionBubble} from '../../../shared/question-bubble.js';
import {createBusyScribble} from './busy-scribble.js';
import {workChairArms,workChairArmPose,workChairArmPoint,workChairActivity} from './motion.js';
import '../../../shared/work-terminals.js';

const WIDTH=1754,HEIGHT=1480,OFFSET_X=250,OFFSET_Y=75;
const REFERENCE_HEIGHT=1200;
const asset=file=>new URL(`./textures/${file}`,import.meta.url).href;
const seatedAsset=file=>new URL(`../../../shared/textures/chibi-seated/${file}`,import.meta.url).href;
const load=async src=>{const image=new Image();image.src=src;await image.decode();return image;};

export async function createScene({PIXI:P,canvas}){
 const layout=await fetch(new URL('./layout.json',import.meta.url)).then(response=>response.json());
 const names=['chair','chairFront','keyboard','screen','armLeft','armRight','headFront'];
 const [parts,bodyImage,tailImage,wingImages]=await Promise.all([
  Promise.all(names.map(async name=>[name,await load(asset(layout.parts[name].file))])).then(Object.fromEntries),
  load(seatedAsset('body-tail-separated.png')),
  load(seatedAsset('tail.png')),
  Promise.all(['wing-left.png','wing-right.png'].map(file=>load(seatedAsset(file)))),
 ]);
 const app=new P.Application();
 await app.init({canvas,width:WIDTH,height:HEIGHT,resolution:1,antialias:true,backgroundAlpha:0,autoStart:false,sharedTicker:false,preference:'webgl'});
 const terminals=new globalThis.DragonWorkTerminals(P,[
  {x:-95,y:380,width:350,height:230,rotation:-.055},
  {x:995,y:350,width:350,height:230,rotation:.055},
 ]);
 terminals.container.position.set(OFFSET_X,OFFSET_Y);app.stage.addChild(terminals.container);
 const chair=new P.Sprite({texture:P.Texture.from(parts.chair)});
 chair.position.set(OFFSET_X+layout.parts.chair.x,OFFSET_Y+layout.parts.chair.y);app.stage.addChild(chair);
 const root=new P.Container({label:'seated-chair-laptop-character',eventMode:'none'});
 root.pivot.set(630,915);root.position.set(OFFSET_X+630,OFFSET_Y+915);app.stage.addChild(root);
 const mesh=(image,bounds,nx,ny)=>{
  const part=new P.MeshPlane({texture:P.Texture.from(image),verticesX:nx,verticesY:ny});part.position.set(bounds.x,bounds.y);root.addChild(part);
  const buffer=part.geometry.getAttribute('aPosition').buffer;
  return {part,bounds,buffer,rest:new Float32Array(buffer.data)};
 };
 const deform=(rig,point)=>{
  for(let i=0;i<rig.rest.length;i+=2){const p=point(rig.rest[i]+rig.bounds.x,rig.rest[i+1]+rig.bounds.y);rig.buffer.data[i]=p[0]-rig.bounds.x;rig.buffer.data[i+1]=p[1]-rig.bounds.y;}
  rig.buffer.update();
 };
 const body=mesh(bodyImage,{x:0,y:0},97,97);deform(body,readingBodySlimPoint);
 const wings=readingWings.map((shape,i)=>({...mesh(wingImages[i],shape.bounds,33,25),shape}));
 // Same world transform as the rear chair, but drawn over the hanging rear hair.
 const chairFrontRoot=new P.Container();chairFrontRoot.pivot.set(630,915);chairFrontRoot.position.set(630,915);root.addChild(chairFrontRoot);
 const chairFront=new P.Sprite({texture:P.Texture.from(parts.chairFront)});chairFront.position.set(layout.parts.chairFront.x,layout.parts.chairFront.y);chairFrontRoot.addChild(chairFront);
 const tail=mesh(tailImage,readingTail.bounds,readingTail.verticesX,readingTail.verticesY);
 const eyes=await createDrawingEyes(),eyeTexture=P.Texture.from(eyes.canvas),eyeSprite=new P.Sprite({texture:eyeTexture});
 eyeSprite.position.set(eyes.bounds.x,eyes.bounds.y);root.addChild(eyeSprite);
 const lightCanvas=document.createElement('canvas');lightCanvas.width=390;lightCanvas.height=220;
 const paint=lightCanvas.getContext('2d'),glow=paint.createRadialGradient(195,145,10,195,145,170);
 glow.addColorStop(0,'rgba(177,211,255,.10)');glow.addColorStop(1,'rgba(177,211,255,0)');
 paint.fillStyle=glow;paint.beginPath();paint.ellipse(195,132,180,84,-.12,0,Math.PI*2);paint.fill();
 const light=new P.Sprite({texture:P.Texture.from(lightCanvas)});light.position.set(420,430);root.addChild(light);
 const sprite=name=>{
  const part=new P.Sprite({texture:P.Texture.from(parts[name])});part.position.set(layout.parts[name].x,layout.parts[name].y);root.addChild(part);return part;
 };
 sprite('keyboard');
 const arms=['armLeft','armRight'].map(name=>({...mesh(parts[name],layout.parts[name],35,35),rig:workChairArms[name]}));
 // Shoulder motion belongs behind the face and front locks, even at rest.
 sprite('headFront');
 // The laptop lid also covers hanging hair below its rim.
 sprite('screen');root.addChild(eyeSprite);root.addChild(light);
 const busy=createBusyScribble(P);busy.container.position.set(190,335);busy.container.scale.set(1.1);root.addChild(busy.container);
 const question=createQuestionBubble(P,{tailRight:true});question.container.position.set(190,335);question.container.scale.set((2400/1254)*(114/115));root.addChild(question.container);
 let lastBlink=-1,lastAttention=-1;
 return {app,root,eyes,layout,chair,
  render(frame){
   root.scale.set(frame.scaleX,frame.scaleY);
   chairFrontRoot.scale.set(1/frame.scaleX,1/frame.scaleY);
   terminals.render(frame.time,workChairActivity(frame));
   deform(tail,(x,y)=>readingTailPoint(x,y,frame.tailCurl));
   wings.forEach(wing=>deform(wing,(x,y)=>readingWingPoint(wing.shape,x,y,frame.wing)));
   arms.forEach((arm,index)=>{const pose=workChairArmPose(arm.rig,index===0?frame.typingLeft:frame.typingRight);deform(arm,(x,y)=>workChairArmPoint(arm.rig,x,y,pose));});
   const close=Math.max(frame.blink,frame.attentionBlink);
   if(close!==lastBlink||frame.attention!==lastAttention){eyes.draw(close,frame.attention);eyeTexture.source.update();lastBlink=close;lastAttention=frame.attention;}
   light.alpha=frame.screenGlow;busy.render(frame);question.render(frame);app.renderer.render(app.stage);
  },
  resize(size){canvas.style.width=`${WIDTH*size/REFERENCE_HEIGHT}px`;canvas.style.height=`${HEIGHT*size/REFERENCE_HEIGHT}px`;},
  destroy(){terminals.destroy();app.destroy(false,{children:true,texture:true,textureSource:true});}
 };
}
