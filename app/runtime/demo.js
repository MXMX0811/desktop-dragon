import {SessionState} from './state.js';

export class DemoDriver {
 constructor(changed,logged,progress){
  this.changed=changed;this.logged=logged;this.progress=progress;
  this.revision=0;this.turn=0;this.timer=null;
  this.state=new SessionState({source:'demo',sessionId:'rehearsal'});
  this.emit('session/idle');
 }
 emit(type,fields={}){
  const event={source:'demo',sessionId:'rehearsal',revision:++this.revision,type,turnId:this.state.turnId,...fields};
  const accepted=this.state.apply(event);this.logged(event,accepted);this.changed();return event;
 }
 start(){this.emit('turn/start',{turnId:`turn-${++this.turn}`});}
 tool(kind='read',callId='tool-1'){this.emit('tool/start',{callId,kind,name:{read:'读取文件',search:'网页检索',edit:'修改代码',command:'执行命令',image:'绘制图像'}[kind]||kind});}
 wait(scene,callId='tool-1'){this.emit('request/open',{requestId:'approval-1',kind:'approval',blocking:true,scene,callId,label:'等待你确认 · 请在原客户端处理'});}
 snapshot(){return {source:this.state.source,sessionId:this.state.sessionId,revision:++this.revision,connection:'connected',phase:this.state.phase,turnId:this.state.turnId,outcome:this.state.outcome,reason:this.state.reason,reasoning:this.state.reasoning,lastToolKind:this.state.lastToolKind,tools:[...this.state.tools.values()],requests:[...this.state.requests.values()]};}
 enter(name){
  this.stop();
  if(name==='complete'||name==='cancel'){
   if(this.state.phase!=='running')this.start();
   this.emit('turn/end',{outcome:name==='complete'?'completed':'cancelled'});return;
  }
  for(const request of this.state.requests.values())this.emit('request/resolve',{requestId:request.requestId});
  this.emit('session/idle');
  if(name==='sleep'){this.state.setSleeping(true);this.changed();return;}
  this.state.setSleeping(false);
  if(name==='standby'){this.changed();return;}
  this.start();
  if(name.startsWith('reading'))this.tool('read');
  if(name.startsWith('work'))this.tool('edit');
  if(name.startsWith('drawing'))this.tool('image');
  if(name.endsWith('-wait'))this.wait(name.split('-')[0]);
 }
 run(name){
  this.enter('standby');
  const end=()=>this.emit('tool/end',{callId:'tool-1'}),resolve=()=>this.emit('request/resolve',{requestId:'approval-1'});
  const complete=()=>this.emit('turn/end',{outcome:'completed'});
  let saved,oldTurn;
  const sequences={
   rest:[[.7,'闭眼小憩',()=>{this.state.setSleeping(true);this.changed();}],[3,'醒来，掩嘴打哈欠',()=>{this.state.setSleeping(false);this.changed();}],[11,'回到陪伴',()=>this.changed()]],
   complete:[[1,'开始任务',()=>this.start()],[4,'读取文件',()=>this.tool('read')],[9,'阅读待确认',()=>this.wait('reading')],[14,'确认后继续',resolve],[17,'读取完成',end],[17.35,'修改代码',()=>this.tool('edit')],[23,'工作待确认',()=>this.wait('work')],[29,'确认后继续',resolve],[34,'执行命令',()=>{end();this.tool('command');}],[39,'本轮完成',complete],[44,'空闲小憩',()=>{this.state.setSleeping(true);this.changed();}]],
   reading:[[1,'开始任务',()=>this.start()],[3,'网页检索',()=>this.tool('search')],[8,'阅读待确认',()=>this.wait('reading')],[15,'确认后继续阅读',resolve],[21,'检索完成',end],[21.4,'本轮完成',complete]],
   drawing:[[1,'开始任务',()=>this.start()],[3,'读取图像参考',()=>this.tool('read')],[8,'绘制图像',()=>{end();this.tool('image');}],[18,'绘图待确认',()=>this.wait('drawing')],[24,'确认后继续绘图',resolve],[32,'图像已生成',end],[35,'本轮完成',complete]],
   concurrent:[[1,'开始任务',()=>this.start()],[3,'两个工具并行',()=>{this.tool('read');this.tool('command','tool-2');}],[8,'单个工具失败，另一个继续',()=>this.emit('tool/end',{callId:'tool-1',isError:true})],[13,'异步问题不阻塞执行',()=>this.emit('request/open',{requestId:'question-1',kind:'question',blocking:false,label:'可稍后回答的问题'})],[18,'本轮完成',()=>{oldTurn=this.state.turnId;complete();}],[22,'新一轮开始',()=>{this.start();this.tool('edit');}],[25,'忽略旧轮次晚到的事件',()=>this.emit('tool/end',{callId:'tool-2',turnId:oldTurn})],[30,'结束新一轮',complete]],
   disconnect:[[1,'开始任务',()=>this.start()],[3,'工作中',()=>this.tool('edit')],[8,'连接断开，保持现场',()=>{saved=this.snapshot();this.emit('connection',{connection:'disconnected'});}],[14,'连接恢复，等待同步',()=>this.emit('connection',{connection:'connected'})],[17,'收到可信当前状态',()=>{saved.revision=++this.revision;this.state.applySnapshot(saved);this.logged({type:'snapshot',revision:saved.revision},true);this.changed();}],[23,'用户取消',()=>this.emit('turn/end',{outcome:'cancelled'})]]
  };
  const steps=sequences[name];let index=0;const began=performance.now();
  this.progress('准备开始',true);
  this.timer=setInterval(()=>{
   const elapsed=(performance.now()-began)/1000;
   while(index<steps.length&&elapsed>=steps[index][0]){
    const step=steps[index++];step[2]();this.progress(`${index}/${steps.length} · ${step[1]}`,true);
   }
   if(index===steps.length){clearInterval(this.timer);this.timer=null;this.progress('演练完成',false);}
  },100);
 }
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null;this.progress('',false);}
}
