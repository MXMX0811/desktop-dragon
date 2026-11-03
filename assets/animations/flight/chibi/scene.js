import {applyReferenceColor} from '../../../shared/reference-palette.mjs';

// 5640 original frame 9 (0.375s), the trimmed clip entry.
export const SOURCE = {width:1112,height:834};
export const EYES = {x:568.5,y:378.5};
export const REFERENCE_HEIGHT = 1200;
const EYE_SCALE = Math.hypot(219,-67)/Math.hypot(97,-8);

export function flightLayout({size,side,eye}){
 const scale=size/REFERENCE_HEIGHT*EYE_SCALE;
 const mirrored=side==='left';
 const width=SOURCE.width*scale,height=SOURCE.height*scale;
 // Keep the released head position: translate once, then retain the clip's path.
 const left=eye.x-(mirrored?SOURCE.width-EYES.x:EYES.x)*scale;
 const top=eye.y-EYES.y*scale;
 const startEye={x:left+(mirrored?SOURCE.width-EYES.x:EYES.x)*scale,y:top+EYES.y*scale};
 return {left,top,width,height,scale,eye:startEye,exitX:mirrored?left:left+width};
}

// Resolves only after the whole short clip is loaded and frame 0 is decoded.
// The caller owns opacity, crossfading, clipping and the containing element.
export async function createFlightScene({video,onEnded}){
 const lifetime=new AbortController();
 let videoURL;
 video.muted=true;video.playsInline=true;video.preload='auto';video.loop=false;
 applyReferenceColor(video,'flight-chibi');
 Object.assign(video.style,{position:'absolute',display:'block',maxWidth:'none',pointerEvents:'none',transformOrigin:'center center'});

 function mediaEvent(name){
  return new Promise((resolve,reject)=>{
   const cleanup=()=>{
    video.removeEventListener(name,ready);video.removeEventListener('error',error);
    lifetime.signal.removeEventListener('abort',abort);
   };
   const ready=()=>{cleanup();resolve();};
   const error=()=>{cleanup();reject(new Error('飞行视频加载或解码失败'));};
   const abort=()=>{cleanup();reject(lifetime.signal.reason);};
   video.addEventListener(name,ready,{once:true});video.addEventListener('error',error,{once:true});
   lifetime.signal.addEventListener('abort',abort,{once:true});
  });
 }
 async function prepare(){
  lifetime.signal.throwIfAborted();
  video.pause();
  if(video.error)throw new Error('飞行视频加载或解码失败');
  if(video.readyState<HTMLMediaElement.HAVE_CURRENT_DATA)await mediaEvent('loadeddata');
  if(video.currentTime!==0){
   const ready=mediaEvent('seeked');video.currentTime=0;await ready;
  }
 }
 function destroy(){
  lifetime.abort();video.pause();video.removeAttribute('src');video.load();
  if(videoURL)URL.revokeObjectURL(videoURL);
 }
 try{
  const response=await fetch(new URL('./textures/flight.webm',import.meta.url),{signal:lifetime.signal});
  if(!response.ok)throw new Error(`飞行视频读取失败（${response.status}）`);
  videoURL=URL.createObjectURL(await response.blob());
  video.src=videoURL;video.load();await prepare();video.playbackRate=1.5;
  video.addEventListener('ended',onEnded,{signal:lifetime.signal});
 }catch(error){destroy();throw error;}

 return {
  layout(options){
   const bounds=flightLayout(options);
   const {left,top,width,height}=bounds;
   Object.assign(video.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`,transform:options.side==='left'?'scaleX(-1)':'none'});
   return bounds;
  },
  prepare,
  play(){return video.play();},
  pause(){video.pause();},
  resume(){return video.play();},
  destroy,
 };
}
