import {scenes,pointAt} from './motion.js';
import {resizeSceneCanvas,canvasResolution} from '../canvas-size.js';

const width=1500,height=1800;
export async function createGreetingScene({canvas,size,name,base,createFace}){
 const P=globalThis.PIXI,app=new P.Application(),textures=[];
 await app.init({canvas,width,height,backgroundAlpha:0,antialias:true,resolution:canvasResolution(size/1200),autoStart:false});
 const load=async file=>{
  const image=new Image();image.src=new URL(file,base).href;await image.decode();
  const texture=P.Texture.from(image);textures.push(texture);return texture;
 };
 const s=scenes[name],root=new P.Container();
 root.position.set(width/2,height-80);root.pivot.set(...s.ground);root.scale.set(530/s.head);app.stage.addChild(root);
 const mesh=new P.MeshPlane({texture:await load('character.png'),verticesX:81,verticesY:101});root.addChild(mesh);
 const buffer=mesh.geometry.getBuffer('aPosition'),body={buffer,rest:new Float32Array(buffer.data)};
 const wings=[];
 if(name==='coffee'){
  for(const [side,pivot,origin,sign] of [['left',[405,160],[405,780],-1],['right',[106,160],[618,780],1]]){
   const sprite=new P.Sprite(await load('wing-'+side+'.png'));sprite.pivot.set(...pivot);sprite.position.set(...origin);root.addChild(sprite);wings.push({sprite,sign});
  }
  root.addChild(new P.Sprite(await load('foreground.png')));
 }
 let face=await createFace();
 const texture=P.Texture.from(face.canvas);textures.push(texture);
 const faceMesh=new P.MeshPlane({texture,verticesX:29,verticesY:19});faceMesh.position.set(...face.origin);root.addChild(faceMesh);
 const faceBuffer=faceMesh.geometry.getBuffer('aPosition'),faceRig={buffer:faceBuffer,rest:new Float32Array(faceBuffer.data)};
 const steam=new P.Graphics();root.addChild(steam);
 const zs=name==='goodnight'?[0,1,2].map(()=>{
  const z=new P.Text({text:'z',style:{fontFamily:'Arial, sans-serif',fontWeight:'600',fontSize:56,fill:0xa18dc6}});root.addChild(z);return z;
 }):[];
 function deform(r,p,origin=[0,0]){
  for(let i=0;i<r.rest.length;i+=2){const q=pointAt(name,r.rest[i]+origin[0],r.rest[i+1]+origin[1],p);r.buffer.data[i]=q[0]-origin[0];r.buffer.data[i+1]=q[1]-origin[1];}r.buffer.update();
 }
 return {
  render(p){
   if(name==='coffee'){
    face.draw(p.click.smile,p.click.eyes);
    wings.forEach(w=>w.sprite.rotation=w.sign*p.click.wing);
    steam.clear();for(let i=0;i<2;i++){const phase=((p.time/2+i*.5)%1+1)%1,y=705-65*phase,x=510+i*48+9*Math.sin(phase*4+i);steam.moveTo(x,y+20).bezierCurveTo(x-13,y+6,x+13,y-9,x,y-25).stroke({width:4,color:0xd2c6e4,alpha:.55*Math.sin(Math.PI*phase)**2});}
   }else{
    deform(body,p);face.draw(p.close,p.click);deform(faceRig,p,face.origin);
    zs.forEach((z,i)=>{const phase=((p.time/2.7+i/3)%1+1)%1;z.position.set(1020+45*phase,440-190*phase);z.alpha=p.close*Math.sin(Math.PI*phase)**2*.8;z.scale.set(.45+.6*phase);});
   }
   texture.source.update();app.render();
  },
  resize(size){resizeSceneCanvas(app,canvas,width,height,size/1200);},
  destroy(){app.destroy(false,{children:true});for(const texture of textures)texture.destroy(true);face.canvas.width=face.canvas.height=0;face=null;canvas.width=canvas.height=0;}
 };
}
