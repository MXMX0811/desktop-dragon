import {bindPoint,posePoint,GRIP,SOURCE,PADDING,CANVAS,REFERENCE_HEIGHT} from './rig.js';

export async function createScene({PIXI:P,canvas}){
 const image=new Image();
 image.src=new URL('./textures/character.png',import.meta.url).href;
 await image.decode();
 const app=new P.Application();
 await app.init({canvas,width:CANVAS.width,height:CANVAS.height,antialias:true,resolution:1,backgroundAlpha:0,autoStart:false,sharedTicker:false,preference:'webgl'});
 const root=new P.Container({eventMode:'none'});
 root.pivot.set(...GRIP);root.position.set(PADDING.x+GRIP[0],PADDING.y+GRIP[1]);app.stage.addChild(root);
 const texture=P.Texture.from(image);
 const mesh=new P.MeshPlane({texture,verticesX:97,verticesY:145});root.addChild(mesh);
 const buffer=mesh.geometry.getAttribute('aPosition').buffer;
 const bindings=[];
 for(let i=0;i<buffer.data.length;i+=2)bindings.push(bindPoint(buffer.data[i],buffer.data[i+1]));
 return {
  resize(height){const scale=height/REFERENCE_HEIGHT;canvas.style.width=`${CANVAS.width*scale}px`;canvas.style.height=`${CANVAS.height*scale}px`;return {x:(PADDING.x+GRIP[0])*scale,y:(PADDING.y+GRIP[1])*scale};},
  render(pose){
   root.rotation=pose.body;
   for(let i=0;i<bindings.length;i++){
    const point=posePoint(bindings[i],pose);buffer.data[i*2]=point[0];buffer.data[i*2+1]=point[1];
   }
   buffer.update();app.renderer.render(app.stage);
  },
  destroy(){app.destroy(false,{children:true,texture:true,textureSource:true});},
  sourceSize:SOURCE,
 };
}
