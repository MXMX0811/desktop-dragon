import {standingFrame as f,standingWings,standingTail,standingTailPoint,standingWingPoint} from './parts.js';
import {createThinkingStandingBlink} from './face.js';
export async function createScene({PIXI:P,canvas}){
 const app=new P.Application();await app.init({canvas,width:f.width+2*f.padding,height:f.height+2*f.padding,backgroundAlpha:0,antialias:true,resolution:1,autoStart:false});
 const root=new P.Container();root.pivot.set(...f.ground);root.position.set(f.ground[0]+f.padding,f.ground[1]+f.padding);app.stage.addChild(root);
 const load=name=>P.Assets.load(new URL('./textures/'+name+'.png',import.meta.url).href);
 async function mesh(name,shape,nx,ny){const part=new P.MeshPlane({texture:await load(name),verticesX:nx,verticesY:ny});part.position.set(shape.bounds.x,shape.bounds.y);root.addChild(part);const buffer=part.geometry.getBuffer('aPosition');return{part,shape,buffer,rest:new Float32Array(buffer.data)};}
 const tail=await mesh('tail',standingTail,standingTail.verticesX,standingTail.verticesY);
 const body=new P.Sprite({texture:await load('body')});root.addChild(body);
 const wings=[];for(const shape of standingWings)wings.push(await mesh('wing-'+shape.name,shape,33,29));
 const blink=await createThinkingStandingBlink(),eyeTexture=P.Texture.from(blink.canvas),eyes=new P.Sprite({texture:eyeTexture});eyes.position.set(blink.bounds.x,blink.bounds.y);root.addChild(eyes);
 const thought=new P.Container();thought.position.set(155+f.padding,430+f.padding);app.stage.addChild(thought);
 thought.addChild(new P.Graphics().ellipse(0,0,85,53).fill(0xfaf7ff).stroke({width:4,color:0x514369}).circle(64,53,12).fill(0xfaf7ff).stroke({width:3,color:0x514369}).circle(82,74,6).fill(0xfaf7ff).stroke({width:2.5,color:0x514369}));
 const dots=[-36,0,36].map(x=>{const d=new P.Graphics().circle(0,0,8.5).fill(0x675080);d.x=x;thought.addChild(d);return d;});
 function deform(rig,point){for(let i=0;i<rig.rest.length;i+=2){const p=point(rig.rest[i]+rig.shape.bounds.x,rig.rest[i+1]+rig.shape.bounds.y);rig.buffer.data[i]=p[0]-rig.shape.bounds.x;rig.buffer.data[i+1]=p[1]-rig.shape.bounds.y;}rig.buffer.update();}
 function render(frame){
  // Grounded standing breath: soles stay at the floor, without whole-body roll.
  root.scale.set(frame.scaleX,frame.scaleY);
  blink.draw(Math.max(frame.blink,frame.attentionBlink),frame.attention);eyeTexture.source.update();
  deform(tail,(x,y)=>standingTailPoint(x,y,frame.tailCurl));
  for(const wing of wings)deform(wing,(x,y)=>standingWingPoint(wing.shape,x,y,frame.wing));
  thought.y=430+f.padding+3*Math.sin(frame.time*1.4);dots.forEach((d,i)=>{const hop=Math.max(0,Math.sin(frame.time*1.15-i*.28));d.y=-4*hop;d.scale.set(.88+.16*hop);d.alpha=.68+.32*hop;});app.render();
 }
 function resize(size){canvas.style.width=`${(f.width+2*f.padding)*size/f.referenceHeight}px`;canvas.style.height=`${(f.height+2*f.padding)*size/f.referenceHeight}px`;}
 return{app,root,blink,tail,render,resize,destroy(){app.destroy(false,{children:true});eyeTexture.destroy(true);}};
}
