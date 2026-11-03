// Web Animations keeps both painted scenes alive through the opacity blend.
// No character geometry or canvas resolution changes during the transition.
export class SceneFade {
 constructor(){this.animations=[];}
 async play(outgoing,incoming){
  const options={duration:520,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'};
  const animations=[
   outgoing.animate([{opacity:1},{opacity:0}],options),
   incoming.animate([{opacity:0},{opacity:1}],options),
  ];
  this.animations=animations;
  try{await Promise.all(animations.map(animation=>animation.finished));}
  catch(error){if(error.name!=='AbortError')throw error;}
  finally{for(const animation of animations)animation.cancel();this.animations=[];}
 }
 destroy(){for(const animation of this.animations)animation.cancel();this.animations=[];}
}
