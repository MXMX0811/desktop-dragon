import {poseAt,scenes,reactionDuration} from './motion.js';

// The host owns pause/visibility; the desktop policy owns when to show a greeting.
export class GreetingController {
 constructor(name){this.name=name;this.elapsed=0;this.clock=0;this.reaction=null;this.finished=false;}
 touch(){
  if(this.finished||this.reaction||this.clock>=10)return false;
  this.reaction=0;return true;
 }
 update(dt){
  if(this.finished)return;
  this.clock+=dt;
  if(this.reaction!==null){
   this.reaction+=dt;
   if(this.reaction>=reactionDuration[this.name])this.reaction=null;
  }else this.elapsed+=dt;
  this.finished=this.reaction===null&&(this.elapsed>=scenes[this.name].duration||this.clock>=10);
 }
 sample(){
  const pose=poseAt(this.name,Math.min(this.elapsed,scenes[this.name].duration),{clickTime:this.reaction});
  pose.time=this.clock;
  return pose;
 }
}
