import {readingTail,readingTailPoint} from '../../../shared/attention-tail-rig.js';
import {readingWings,readingWingPoint,leafPoint} from '../../../shared/chibi-seated-shapes.js';
import {createReadingBlink} from '../../../shared/reading-blink.js';
import {readingWaitParts,readingBookPose,readingArmPoint} from './wait-rig.js';
import {createQuestionBubble} from '../../../shared/question-bubble.js';
import {readingBodySlimPoint,READING_HAND_WIDTH} from '../../../shared/chibi-seated-proportions.js';

const url=name=>new URL(`./textures/${name}`,import.meta.url).href;
const seatedUrl=name=>new URL(`../../../shared/textures/chibi-seated/${name}`,import.meta.url).href;
const loadImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});

export async function createScene({PIXI:P,canvas}){
 const app=new P.Application();
 await app.init({canvas,width:1374,height:1374,resolution:1,antialias:true,backgroundAlpha:0,autoStart:false,sharedTicker:false,preference:'webgl'});
 const [bg,body,...wings]=await Promise.all([loadImage(url('background.png')),...['body-tail-separated.png','wing-left.png','wing-right.png'].map(name=>loadImage(seatedUrl(name)))]);
 const background=new P.Sprite({texture:P.Texture.from(bg)});background.position.set(60,60);app.stage.addChild(background);
 const root=new P.Container({eventMode:'none'});root.pivot.set(630,915);root.position.set(690,975);app.stage.addChild(root);
 const bodyMesh=new P.MeshPlane({texture:P.Texture.from(body),verticesX:97,verticesY:97});
 const bodyBuffer=bodyMesh.geometry.getAttribute('aPosition').buffer;
 for(let i=0;i<bodyBuffer.data.length;i+=2){const point=readingBodySlimPoint(bodyBuffer.data[i],bodyBuffer.data[i+1]);bodyBuffer.data[i]=point[0];bodyBuffer.data[i+1]=point[1];}bodyBuffer.update();root.addChild(bodyMesh);
 const tail=new P.MeshPlane({texture:P.Texture.from(await loadImage(seatedUrl('tail.png'))),verticesX:readingTail.verticesX,verticesY:readingTail.verticesY});tail.position.set(readingTail.bounds.x,readingTail.bounds.y);root.addChild(tail);
 const tailBuffer=tail.geometry.getAttribute('aPosition').buffer,tailRest=new Float32Array(tailBuffer.data);
 const wingMeshes=readingWings.map((shape,i)=>{
  const mesh=new P.MeshPlane({texture:P.Texture.from(wings[i]),verticesX:33,verticesY:25});mesh.position.set(shape.bounds.x,shape.bounds.y);root.addChild(mesh);
  const buffer=mesh.geometry.getAttribute('aPosition').buffer;return {shape,mesh,buffer,rest:new Float32Array(buffer.data)};
 });
 const armMeshes=await Promise.all(['armR','armL'].map(async(name)=>{
  const part=readingWaitParts[name],image=await loadImage(url(`wait-${name}.png`));
  const mesh=new P.MeshPlane({texture:P.Texture.from(image),verticesX:29,verticesY:43});mesh.position.set(part.bounds.x,part.bounds.y);root.addChild(mesh);
  const buffer=mesh.geometry.getAttribute('aPosition').buffer;return {part,mesh,buffer,rest:new Float32Array(buffer.data)};
 }));
 const blink=await createReadingBlink();
 const eyeTexture=P.Texture.from(blink.canvas),eyes=new P.Sprite({texture:eyeTexture});eyes.position.set(blink.bounds.x,blink.bounds.y);root.addChild(eyes);
 const bookGroup=new P.Container();root.addChild(bookGroup);
 const bookPart=readingWaitParts.book,book=new P.Sprite({texture:P.Texture.from(await loadImage(url('wait-book.png')))});book.position.set(bookPart.bounds.x,bookPart.bounds.y);bookGroup.addChild(book);
 const paperCanvas=document.createElement('canvas');paperCanvas.width=460;paperCanvas.height=460;
 const paper=paperCanvas.getContext('2d'),paperTexture=P.Texture.from(paperCanvas),pages=new P.Sprite({texture:paperTexture});pages.position.set(350,430);bookGroup.addChild(pages);
 const bookFront=new P.Sprite({texture:P.Texture.from(await loadImage(url('book-front.png')))});bookFront.position.set(345,625);bookGroup.addChild(bookFront);
 for(const name of ['sleeveR','sleeveL','handR','handL']){
  const file=name.startsWith('hand')?`wait-${name}.png`:`wait-${name}.png`;
  const part=readingWaitParts[name],sprite=new P.Sprite({texture:P.Texture.from(await loadImage(url(file)))});sprite.position.set(part.bounds.x,part.bounds.y);bookGroup.addChild(sprite);
  if(name.startsWith('hand')){
   const grip=readingWaitParts[name==='handR'?'armR':'armL'].grip;
   sprite.pivot.x=grip[0]-part.bounds.x;sprite.position.x=grip[0];sprite.scale.x=READING_HAND_WIDTH;
  }
 }
 const question=createQuestionBubble(P);question.container.position.set(1000,230);question.container.scale.set((2400/1254)*(114/115));root.addChild(question.container);
 let lastBlink=-1,lastAttention=-1;
 function drawLeaf(leaf){
  const at=(u,v)=>{const p=leafPoint(u,v,leaf.progress);return [p[0]-350,p[1]-430];};
  const face=leaf.progress<.5?'#fff8e9':'#f5eddf';paper.beginPath();
  let p=at(0,0);paper.moveTo(...p);
  for(let i=1;i<=32;i++)paper.lineTo(...at(i/32,0));
  paper.lineTo(...at(1,1));for(let i=31;i>=0;i--)paper.lineTo(...at(i/32,1));paper.closePath();
  const fade=Math.min(1,leaf.progress/.08,(1-leaf.progress)/.1);paper.globalAlpha=fade;
  paper.fillStyle=face;paper.fill();paper.strokeStyle='#b6a895';paper.lineWidth=1.25;paper.stroke();
  paper.strokeStyle='#d9c7af';paper.lineWidth=.85;
  for(const v of [.25,.5,.75]){paper.beginPath();for(let i=1;i<32;i++){p=at(i/32,v);i===1?paper.moveTo(...p):paper.lineTo(...p);}paper.stroke();}
  paper.globalAlpha=1;
 }
 return {
  app,root,blink,tail,
  render(frame){
   root.scale.set(frame.scaleX,frame.scaleY);
   for(let i=0;i<tailRest.length;i+=2){const p=readingTailPoint(tailRest[i]+readingTail.bounds.x,tailRest[i+1]+readingTail.bounds.y,frame.tailCurl);tailBuffer.data[i]=p[0]-readingTail.bounds.x;tailBuffer.data[i+1]=p[1]-readingTail.bounds.y;}tailBuffer.update();
   const waiting=frame.waitAmount,bookPose=readingBookPose(waiting);bookGroup.position.set(bookPose.x,bookPose.y);
   for(const arm of armMeshes){const {part,buffer,rest}=arm;for(let i=0;i<rest.length;i+=2){const p=readingArmPoint(part,rest[i]+part.bounds.x,rest[i+1]+part.bounds.y,waiting);buffer.data[i]=p[0]-part.bounds.x;buffer.data[i+1]=p[1]-part.bounds.y;}buffer.update();}
   question.render(frame);
   for(const wing of wingMeshes){const {shape,buffer,rest}=wing;for(let i=0;i<rest.length;i+=2){const p=readingWingPoint(shape,rest[i]+shape.bounds.x,rest[i+1]+shape.bounds.y,frame.wing);buffer.data[i]=p[0]-shape.bounds.x;buffer.data[i+1]=p[1]-shape.bounds.y;}buffer.update();}
   const blinkAmount=Math.max(frame.blink,frame.attentionBlink);
   if(lastBlink!==blinkAmount||lastAttention!==frame.attention){blink.draw(blinkAmount,frame.attention);eyeTexture.source.update();lastBlink=blinkAmount;lastAttention=frame.attention;}
   paper.clearRect(0,0,460,460);for(const leaf of [...frame.pages].sort((a,b)=>Math.sin(Math.PI*a.progress)-Math.sin(Math.PI*b.progress)))drawLeaf(leaf);paperTexture.source.update();
   app.renderer.render(app.stage);
  },
  resize(height){const scale=height/1200;canvas.style.width=`${1374*scale}px`;canvas.style.height=`${1374*scale}px`;},
  destroy(){app.destroy(false,{children:true,texture:true,textureSource:true});}
 };
}
