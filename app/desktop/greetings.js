export const greetingScenes=new Set(['coffee','goodnight']);

export function greetingPeriod(now){
 const date=new Date(now),hour=date.getHours(),scene=hour>=6&&hour<18?'coffee':'goodnight';
 // The night before and after midnight is one visit period.
 if(hour<6)date.setDate(date.getDate()-1);
 return {scene,key:`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}:${scene}`};
}
export function nextGreetingBoundary(now){
 const date=new Date(now),hour=date.getHours();
 if(hour<6)date.setHours(6,0,0,0);
 else if(hour<18)date.setHours(18,0,0,0);
 else{date.setDate(date.getDate()+1);date.setHours(6,0,0,0);}
 return date.getTime();
}

// A local presentation overlay; it never changes the latest session target.
export class GreetingSchedule {
 constructor(lastPeriod=null){this.lastPeriod=lastPeriod;this.active=null;}
 select({allowed,ready},now){
  if(!allowed){this.active=null;return null;}
  if(!this.active&&ready){
   const period=greetingPeriod(now);
   if(period.key!==this.lastPeriod){this.lastPeriod=period.key;this.active=period.scene;}
  }
  return this.active;
 }
 finish(){this.active=null;}
 dismiss(now){this.finish();this.lastPeriod=greetingPeriod(now).key;}
}
