// Changing task form is shared by the three task scenes.
export const dualFormScenes=new Set(['reading','work','drawing']);
const baseSizes={chibi:200,normal:400};
// Keep each scene's existing body calibration; these are not canvas heights.
export function displaySize(scene,form){
 const ratio=scene==='flight' ? .8*.95 : ['thinking','drag'].includes(scene) ? .8 : .9;
 return baseSizes[form]*ratio;
}
// Generic gaps in a normal-form task keep the last set, so individual tools do
// not repeatedly shrink and grow the character. The activity label stays live.
export class DisplayPolicy {
 constructor(taskForm='normal'){this.taskForm=taskForm;this.task=null;}
 select(facts){
  const identity=`${facts.source}:${facts.sessionId}:${facts.turnId}`;
  if(this.task?.identity!==identity||facts.phase!=='running')this.task=null;
  if(dualFormScenes.has(facts.scene)&&facts.phase==='running')this.task={identity,scene:facts.scene};
  let scene=facts.scene,form=dualFormScenes.has(scene)?this.taskForm:'chibi';
  let suspended=facts.suspended;
  if(scene==='thinking'&&this.task&&this.taskForm==='normal'){
   scene=this.task.scene;form='normal';suspended=true;
  }
  return {...facts,scene,form,suspended};
 }
 toggle(){this.taskForm=this.taskForm==='normal'?'chibi':'normal';return this.taskForm;}
}
