import {edgeLayout,SOURCE,CONTACT,EYES,REFERENCE_HEIGHT} from './layout.js';
import {applyReferenceColor} from '../../../shared/reference-palette.mjs';
import {FACE,createBlink} from './face.js';
export {edgeLayout,SOURCE,CONTACT,EYES,REFERENCE_HEIGHT};
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
export function motion(time,touchAt=-Infinity){
 const blinkAt=time%5.7;let blink=blinkAt<3.5?0:blinkAt<3.63?smooth((blinkAt-3.5)/.13):blinkAt<3.68?1:1-smooth((blinkAt-3.68)/.18);
 const p=time-touchAt,respond=p>=0&&p<1.35;
 const wing=respond?Math.sin(Math.PI*clamp(p/1.35))**2*Math.sin(p/1.35*Math.PI*6):0;
 // One small spring response. Both screen-edge gripping hands stay on x=660.
 const u=clamp(p/.64);
 const bounce=respond&&p<.64?Math.sin(u*Math.PI*2)*Math.sin(u*Math.PI)**2*(1-.5*u):0;
 const breath=Math.sin(time*Math.PI*2/4.7);
 return{time,blink,wing,scaleX:1+.007*breath-.023*bounce,scaleY:1+.006*breath+.015*bounce};
}
export async function createEdgeScene({canvas,PIXI:P=globalThis.PIXI}){
 const app=new P.Application();await app.init({canvas,width:SOURCE.width,height:SOURCE.height,backgroundAlpha:0,antialias:true,resolution:1,autoStart:false});
 applyReferenceColor(canvas,'peek-chibi');canvas.dataset.petHit='';canvas.setAttribute('aria-label','扒在边缘的龙娘，点击回应，向内拖回');canvas.setAttribute('role','img');
 Object.assign(canvas.style,{position:'absolute',display:'block',maxWidth:'none',pointerEvents:'auto',transformOrigin:'center center'});
 const load=name=>P.Assets.load(new URL(`./textures/${name}.png`,import.meta.url).href);
 const root=new P.Container();root.pivot.set(CONTACT.x,CONTACT.y);root.position.set(CONTACT.x,CONTACT.y);app.stage.addChild(root);
 const body=new P.Sprite({texture:await load('body')});root.addChild(body);
 const wing=new P.MeshPlane({texture:await load('wing'),verticesX:81,verticesY:121});root.addChild(wing);
 const buf=wing.geometry.getBuffer('aPosition'),rest=new Float32Array(buf.data);
 const names=['original','skin','front','front-mask','iris-right','iris-left','lash-right','lash-left'];
 const imgs=Object.fromEntries(await Promise.all(names.map(async name=>{const im=new Image();im.src=new URL(`./textures/${name}.png`,import.meta.url).href;await im.decode();return[name,im];})));
 const blink=createBlink(imgs),eyeTexture=P.Texture.from(blink.canvas),face=new P.Sprite({texture:eyeTexture});face.position.set(FACE.x,FACE.y);root.addChild(face);
 let time=0,touchAt=-Infinity,last=null,raf=0,paused=false,destroyed=false;
 function render(frame=motion(time,touchAt)){
  root.scale.set(frame.scaleX,frame.scaleY);blink.draw(frame.blink);eyeTexture.source.update();
  for(let i=0;i<rest.length;i+=2){const x=rest[i],y=rest[i+1];const rootFall=smooth((y-800)/120)*smooth((355-x)/95);const a=frame.wing*.105*rootFall,dx=x-348,dy=y-808;
   buf.data[i]=348+dx*Math.cos(a)-dy*Math.sin(a);buf.data[i+1]=808+dx*Math.sin(a)+dy*Math.cos(a);
  }buf.update();app.render();
 }
 function tick(now){raf=0;if(destroyed||paused||document.hidden)return;time+=last===null?0:Math.min(.05,(now-last)/1000);last=now;render();raf=requestAnimationFrame(tick);}
 function schedule(){cancelAnimationFrame(raf);last=null;if(!destroyed&&!paused&&!document.hidden)raf=requestAnimationFrame(tick);}
 const visibility=()=>schedule();document.addEventListener('visibilitychange',visibility);render();schedule();
 return{
  layout(options){const bounds=edgeLayout(options),{left,top,width,height}=bounds;Object.assign(canvas.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`,transform:options.side==='left'?'scaleX(-1)':'none'});return bounds;},
  touch(){if(destroyed||paused)return false;if(time-touchAt<1.35)return true;touchAt=time;render();return true;},
  setPaused(value){paused=Boolean(value);schedule();},
  destroy(){destroyed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);app.destroy(false,{children:true});eyeTexture.destroy(true);},
 };
}
