import {createReadingBlinkFromImages} from './reading-blink.js';
export async function createDrawingEyes(){
 const keys=['original','taskOriginal','skin','foreground','foregroundMask','irisR','irisL','taskIrisR','taskIrisL','lashesR','lashesL'];
 const images=Object.fromEntries(await Promise.all(keys.map(async key=>{const image=new Image();image.src=new URL(`./textures/drawing-eyes/eye-${key}.png`,import.meta.url).href;await image.decode();return[key,image];})));
 const blink=createReadingBlinkFromImages(images),draw=blink.draw;
 const mask=document.createElement('canvas');mask.width=blink.bounds.width;mask.height=blink.bounds.height;
 const context=mask.getContext('2d'),pixels=context.createImageData(mask.width,mask.height);
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){const edge=Math.min(x,y,mask.width-1-x,mask.height-1-y),i=(y*mask.width+x)*4;pixels.data[i+3]=Math.round(255*Math.min(1,edge/6));}context.putImageData(pixels,0,0);
 blink.draw=(amount,attention)=>{draw(amount,attention);const ctx=blink.canvas.getContext('2d');ctx.save();ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.restore();};
 blink.draw(0,0);return blink;
}
