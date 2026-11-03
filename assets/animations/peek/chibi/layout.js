export const SOURCE = {width:1024,height:1536};
// Keep the hands against the same source x=660 line used by edge-preview.html.
export const CONTACT = {x:660,y:676};
export const EYES = {x:470,y:538};
// Crown-to-chin is approximately 510px; standing-thinking is 514px at 1128.
export const REFERENCE_HEIGHT = 510*1128/514;

export function edgeLayout({size,side,edgeX,eyeY}){
 const scale=size/REFERENCE_HEIGHT;
 const width=SOURCE.width*scale,height=SOURCE.height*scale;
 const mirrored=side==='left';
 const left=edgeX-(mirrored?SOURCE.width-CONTACT.x:CONTACT.x)*scale;
 const top=eyeY-EYES.y*scale;
 const exposed=CONTACT.x*scale;
 return {
  left,top,width,height,scale,exposed,
  eye:{x:edgeX+(mirrored?1:-1)*(CONTACT.x-EYES.x)*scale,y:eyeY},
  contact:{x:edgeX,y:top+CONTACT.y*scale},
  visible:{left:mirrored?edgeX:edgeX-exposed,top,width:exposed,height},
 };
}

