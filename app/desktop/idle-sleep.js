export const IDLE_SLEEP_DELAY_MS=120000;

// Local companion idle time; never changes the observed session state.
export class IdleSleep {
 constructor(onSleep){this.onSleep=onSleep;this.eligible=false;this.timer=null;}
 setEligible(value){
  if(this.eligible===value)return;
  this.eligible=value;this.restart();
 }
 restart(){
  clearTimeout(this.timer);
  this.timer=this.eligible?setTimeout(()=>{
   this.timer=null;this.onSleep();
  },IDLE_SLEEP_DELAY_MS):null;
 }
 destroy(){this.eligible=false;clearTimeout(this.timer);this.timer=null;}
}
