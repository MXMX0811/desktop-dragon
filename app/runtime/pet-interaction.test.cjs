const test=require('node:test'),assert=require('node:assert/strict');

const view=(scene='work',form='chibi',extra={})=>({scene,form,waiting:false,waitingPose:false,sleeping:false,suspended:false,...extra});
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}
async function flush(){for(let i=0;i<40;i++)await Promise.resolve();}

function element(){
 const listeners=new Map(),captures=new Set();
 return {
  style:{setProperty(name,value){this[name]=value;}},children:[],clientWidth:600,clientHeight:460,clientLeft:0,clientTop:0,hidden:false,
  append(child){child.parentElement=this;this.children.push(child);},
  remove(){this.removed=true;},setAttribute(){},getBoundingClientRect(){return{left:0,top:0,width:600,height:460};},
  addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},
  setPointerCapture(id){captures.add(id);},hasPointerCapture(id){return captures.has(id);},
  releasePointerCapture(id){captures.delete(id);listeners.get('lostpointercapture')?.({pointerId:id});},
  closest(){return this.hit?this:null;},
 };
}

async function harness(t,{initial=view(),taskLoad=async()=>{},dragLoad=async()=>{},flightLoad=async()=>{},peekLoad=async()=>{},flightPlay=()=>{},edgeWidth=171.44,taskBounds=()=>({width:200,height:240,eyeX:100,eyeY:100})}={}){
 const saved=Object.fromEntries(['document','window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame'].map(name=>[name,global[name]]));
 global.document={hidden:false,createElement:element,addEventListener(){},removeEventListener(){}};
 global.window={addEventListener(){},removeEventListener(){}};
 global.ResizeObserver=class{observe(){}disconnect(){}};
 let frame=0;global.requestAnimationFrame=()=>++frame;global.cancelAnimationFrame=()=>{};
 const {PetPresenter}=await import('./presenter.js'),{PetInteraction}=await import('./pet-interaction.js');
 const stage=element(),taskStage=element(),events=[],errors=[],clicks=[],peekClicks=[],scenes=[];
 const presenter=new PetPresenter(taskStage,element());
 const taskPosition=(_view,el)=>{
  const offset=taskStage.style.transform?.match(/-?[\d.]+/g)?.map(Number)||[0,0];
  const local=el?.style.transform?.match(/-?[\d.]+/g)?.map(Number)||[0,0];
  return{x:200+offset[0]+local[0],y:200+offset[1]+local[1]};
 };
 function taskEntry(v){
  const el=element();el.hit=true;taskStage.append(el);
  const bounds=taskBounds(v),canvas=element();el.querySelector=()=>canvas;
  canvas.getBoundingClientRect=()=>{const eye=taskPosition(v,el);return{left:eye.x-bounds.eyeX,top:eye.y-bounds.eyeY,width:bounds.width,height:bounds.height};};
  el.getBoundingClientRect=canvas.getBoundingClientRect;
  const animation={setWaiting(value){this.waiting=value;},setSleeping(value){this.sleeping=value;},
   setSuspended(value){this.suspended=value;},setVisible(value){this.visible=value;},resize(){events.push(`resize-task:${v.scene}:${v.form}`);},touch(){},
   destroy(){events.push(`destroy-task:${v.scene}:${v.form}`);},
  };
  return{key:`${v.form}:${v.scene}`,view:v,element:el,animation};
 }
 presenter.prepare=async v=>{events.push(`load-task:${v.scene}:${v.form}`);await taskLoad(v);const entry=taskEntry(v);presenter.apply(entry,v);return entry;};
 presenter.desired=initial;presenter.install(taskEntry(initial));
 const effects=owner=>({animations:[],fit(){},cover:async()=>{events.push(`${owner}:cover`);},reveal:async()=>{events.push(`${owner}:reveal`);},destroy(){}});
 presenter.cloud=effects('presenter');presenter.fade={animations:[],play:async()=>{},destroy(){}};
 function scene(kind,el,ended){
  let eye={x:0,y:0};el.hit=true;
  const result={kind,element:el,starts:0,releases:0,destroyed:0,touches:0,pauses:[],
   place(p){eye=p.eye?{...p.eye}:kind==='peek'?{x:p.edgeX,y:p.eyeY}:{...p};},eye:()=>({...eye}),
   begin(){result.starts++;},release(){result.releases++;},move(){},tick(){},
   touch(){result.touches++;},setPaused(value){result.pauses.push(value);},
   async play(){events.push('play-flight');flightPlay(ended);},pause(){},async resume(){},ended,
   destroy(){result.destroyed++;events.push(`destroy-${kind}`);},
  };scenes.push(result);return result;
 }
 const interaction=new PetInteraction({stage,presenter,edgeWidth,
  createDrag:async el=>{await dragLoad();return scene('drag',el);},
  createFlight:async(el,ended)=>{await flightLoad();return scene('flight',el,ended);},createPeek:async el=>{await peekLoad();return scene('peek',el);},
  taskEye:taskPosition,
  onClick:(count,kind)=>(kind==='peek'?peekClicks:clicks).push(count),onError:error=>errors.push(error),
 });
 interaction.cloud=effects('interaction');interaction.fade={animations:[],play:async()=>{},destroy(){}};
 interaction.setTarget(initial);
 let time=1000;
 const event=(x,y=200,extra={})=>({button:0,pointerId:1,clientX:x,clientY:y,timeStamp:time+=20,
  target:interaction.current?.element||presenter.current.element,preventDefault(){},stopPropagation(){},...extra});
 const down=(x=200,y=200)=>interaction.down(event(x,y));
 const move=(x=260,y=200)=>interaction.move(event(x,y));
 const up=(x=260,y=200)=>interaction.up(event(x,y));
 t.after(()=>{
  interaction.destroy();presenter.destroy();
  for(const[name,value]of Object.entries(saved))if(value===undefined)delete global[name];else global[name]=value;
 });
 return{interaction,presenter,stage,events,errors,clicks,peekClicks,scenes,down,move,up,event};
}

test('install preserves the prepared canvas pixels through scene changes and drag return',async t=>{
 const h=await harness(t);
 h.interaction.setTarget(view('reading'));await flush();
 h.down();h.move();await flush();h.up();await flush();
 assert.equal(h.presenter.current.view.scene,'reading');
 assert.deepEqual(h.events.filter(event=>event.startsWith('resize-task:')),[]);
 assert.equal(h.interaction.active,false);assert.deepEqual(h.errors,[]);
});

test('normal release restores the latest task and leaves task facts unchanged',async t=>{
 const initial=Object.freeze(view('reading','normal',{waiting:true,waitingPose:true,blockingCount:1,toolCount:2}));
 const h=await harness(t,{initial});h.down();h.move();await flush();
 assert.equal(h.interaction.current.kind,'drag');assert.equal(h.presenter.current.view,initial);
 const latest=Object.freeze(view('drawing','normal',{waiting:false,blockingCount:0,toolCount:1}));
 h.interaction.setTarget(latest);assert.equal(h.presenter.current.view,initial);
 h.up(320);await flush();
 assert.equal(h.interaction.mode,'normal');assert.equal(h.interaction.current,null);
 assert.equal(h.presenter.current.view,latest);assert.equal(h.presenter.current.animation.suspended,false);
 assert.equal(initial.blockingCount,1);assert.equal(initial.toolCount,2);assert.equal(latest.toolCount,1);
 assert.equal(h.interaction.active,false);assert.deepEqual(h.errors,[]);
});

test('a larger task fits the initial bottom-right eye before the cloud while the outgoing Q scene stays still',async t=>{
 const h=await harness(t,{initial:view('reading'),taskBounds:v=>v.form==='normal'
  ?{width:400*1024/1536,height:400,eyeX:400*446/1536,eyeY:400*278/1536}
  :{width:229,height:229,eyeX:670/6,eyeY:590/6},
 });
 const area={x:0,y:0,width:1440,height:900},initialEye={x:area.width-240,y:area.height-230};
 h.stage.clientWidth=area.width;h.stage.clientHeight=area.height;
 h.interaction.moveTask(initialEye);h.interaction.position={...initialEye};
 const old=h.presenter.current,cover=deferred();h.presenter.cloud.cover=()=>cover.promise;
 const prepare=h.presenter.prepare.bind(h.presenter);
 h.presenter.prepare=async v=>{const entry=await prepare(v);h.interaction.placePreparedTask(entry,initialEye);return entry;};
 h.interaction.setTarget(view('reading','normal'));await flush();
 assert.equal(h.presenter.current,old);assert.deepEqual(h.interaction.eye(),initialEye);
 const incoming=h.presenter.stage.children.at(-1),canvas=incoming.querySelector('canvas').getBoundingClientRect();
 assert.ok(canvas.left>=8&&canvas.left+canvas.width<=area.width-8);
 assert.equal(canvas.top+canvas.height,area.height-8);
 const fittedEye=h.interaction.taskEye(view('reading','normal'),incoming);
 assert.ok(fittedEye.y<initialEye.y);
 cover.resolve();await flush();
 assert.equal(h.presenter.current.element,incoming);assert.deepEqual(h.interaction.eye(),fittedEye);
 assert.deepEqual(h.errors,[]);
});

test('returning to the same task reuses its controller, canvas and current progress at the release eye',async t=>{
 const h=await harness(t),retained=h.presenter.current;
 retained.animation.progress=.63;
 h.down();h.move(320,245);await flush();
 assert.equal(retained.animation.visible,false);assert.equal(retained.animation.suspended,true);
 const latest=view('work','chibi',{waiting:true,waitingPose:true,toolCount:3});h.interaction.setTarget(latest);
 h.up(345,255);await flush();
 assert.equal(h.presenter.current,retained);assert.equal(retained.animation.progress,.63);
 assert.equal(retained.animation.visible,true);assert.equal(retained.animation.suspended,false);
 assert.equal(retained.animation.waiting,true);assert.equal(retained.view,latest);
 assert.deepEqual(h.interaction.eye(),{x:345,y:255});
 assert.deepEqual(h.events.filter(event=>/^(load|destroy)-task:/.test(event)),[]);
 assert.equal(h.interaction.active,false);assert.deepEqual(h.errors,[]);
});

test('a task changing back during return loading resumes the retained scene and releases the unused one',async t=>{
 const load=deferred(),h=await harness(t,{taskLoad:()=>load.promise}),retained=h.presenter.current;
 h.down();h.move();await flush();h.interaction.setTarget(view('reading'));h.up(330);await flush();
 h.interaction.setTarget(view('work','chibi',{suspended:true}));load.resolve();await flush();
 assert.equal(h.presenter.current,retained);assert.equal(retained.animation.visible,true);
 assert.equal(retained.animation.suspended,true);assert.deepEqual(h.interaction.eye(),{x:330,y:200});
 assert.deepEqual(h.events.filter(event=>event.startsWith('load-task:')),['load-task:reading:chibi']);
 assert.deepEqual(h.events.filter(event=>event.startsWith('destroy-task:')),['destroy-task:reading:chibi']);
 assert.equal(h.interaction.active,false);assert.deepEqual(h.errors,[]);
});

test('a retained return invalidated behind the cloud stays owned by its presenter until replacement',async t=>{
 const h=await harness(t,{initial:view('work','normal')}),retained=h.presenter.current;
 h.down();h.move();await flush();const cover=deferred();h.interaction.cloud.cover=()=>cover.promise;
 h.up(330);await flush();assert.equal(h.interaction.pending,retained);
 h.interaction.setTarget(view('reading','normal'));cover.resolve();await flush();
 assert.notEqual(h.presenter.current,retained);assert.equal(h.presenter.current.view.scene,'reading');
 assert.equal(h.events.filter(event=>event==='destroy-task:work:normal').length,1);
 assert.deepEqual(h.events.filter(event=>event.startsWith('load-task:')),['load-task:reading:normal']);
 assert.equal(h.interaction.active,false);assert.deepEqual(h.errors,[]);
});

test('same scene fact updates do not restart a slow return load',async t=>{
 const load=deferred();let count=0;
 const h=await harness(t,{taskLoad:async()=>{count++;await load.promise;}});
 h.down();h.move();await flush();h.interaction.setTarget(view('reading'));h.up();await flush();
 const latest=view('reading','chibi',{waiting:true,waitingPose:true,blockingCount:1});
 for(let i=0;i<4;i++)h.interaction.setTarget({...latest});
 h.interaction.setTarget(latest);load.resolve();await flush();
 assert.equal(count,1);assert.equal(h.presenter.current.view,latest);
 assert.equal(h.presenter.current.animation.waiting,true);assert.equal(h.interaction.active,false);
});

test('a task change behind the return cloud installs only the latest scene',async t=>{
 const h=await harness(t);h.down();h.move();await flush();
 const cover=deferred(),installed=[];h.presenter.onChange=v=>installed.push(`${v.scene}:${v.form}`);
 h.interaction.cloud.cover=()=>cover.promise;
 h.interaction.setTarget(view('reading','normal'));h.up();await flush();
 const latest=view('drawing','normal',{waiting:true,waitingPose:true});h.interaction.setTarget(latest);
 cover.resolve();await flush();
 assert.deepEqual(installed,['drawing:normal']);assert.equal(h.presenter.current.view,latest);
 assert.equal(h.presenter.current.animation.waiting,true);assert.equal(h.interaction.active,false);
});

test('release during drag loading skips the obsolete drag and uses the final position',async t=>{
 const load=deferred(),h=await harness(t,{dragLoad:()=>load.promise});
 h.down();h.move();await flush();h.up(350);h.interaction.setTarget(view('thinking'));
 load.resolve();await flush();
 assert.equal(h.interaction.current,null);assert.equal(h.presenter.current.view.scene,'thinking');
 assert.deepEqual(h.interaction.position,{x:350,y:200});
 assert.equal(h.scenes[0].starts,0);assert.equal(h.scenes[0].destroyed,1);
 assert.deepEqual(h.clicks,[]);assert.equal(h.interaction.active,false);
});

test('release before drag loads fits the latest task canvas inside the stage',async t=>{
 const load=deferred(),h=await harness(t,{dragLoad:()=>load.promise,
  taskBounds:v=>v.scene==='reading'?{width:260,height:400,eyeX:112,eyeY:72}:{width:200,height:240,eyeX:100,eyeY:100},
 });
 h.down();h.move(320,520);await flush();h.up(320,520);
 h.interaction.setTarget(view('reading','normal'));load.resolve();await flush();
 const canvas=h.presenter.current.element.querySelector('canvas').getBoundingClientRect();
 assert.equal(h.presenter.current.view.scene,'reading');assert.equal(canvas.height,400);
 assert.equal(canvas.top+canvas.height,h.stage.clientHeight-8);assert.ok(canvas.top>=8);
 assert.equal(h.scenes[0].starts,0);assert.equal(h.interaction.active,false);
 assert.ok(!h.scenes.some(scene=>scene.kind==='flight'));assert.deepEqual(h.errors,[]);
});

test('release during entry cloud returns to normal without a late drag start',async t=>{
 const h=await harness(t,{initial:view('work','normal')}),cover=deferred();h.interaction.cloud.cover=()=>cover.promise;
 h.down();h.move();await flush();h.up(330);cover.resolve();await flush();
 assert.equal(h.interaction.current,null);assert.equal(h.presenter.current.view.form,'normal');
 assert.equal(h.scenes[0].starts,0);assert.equal(h.scenes[0].destroyed,1);
 assert.equal(h.presenter.current.animation.suspended,false);assert.equal(h.interaction.active,false);
});

test('the pending drag and its cloud follow pointer movement during cover',async t=>{
 const h=await harness(t,{initial:view('work','normal')}),cover=deferred(),fitted=[];
 h.interaction.cloud.cover=()=>{h.interaction.cloudElement.hidden=false;return cover.promise;};
 h.interaction.cloud.fit=pair=>{
  const scene=h.scenes.find(scene=>scene.element===pair[1]);if(scene)fitted.push(scene.eye());
 };
 h.down();h.move(260);await flush();
 assert.equal(h.interaction.current,null);assert.equal(h.interaction.pending.kind,'drag');
 h.move(340,235);assert.deepEqual(h.interaction.pending.eye(),{x:340,y:235});
 assert.deepEqual(fitted.at(-1),{x:340,y:235});
 h.move(420,270);assert.deepEqual(h.interaction.pending.eye(),{x:420,y:270});
 assert.deepEqual(fitted.at(-1),{x:420,y:270});
 const pending=h.interaction.pending;cover.resolve();await flush();
 assert.equal(h.interaction.current,pending);assert.equal(h.interaction.pending,null);
 assert.deepEqual(h.interaction.current.eye(),{x:420,y:270});h.up(420,270);await flush();
 assert.equal(h.interaction.active,false);
});

test('destroy during cover disposes the pending entry exactly once',async t=>{
 const h=await harness(t,{initial:view('work','normal')}),cover=deferred();
 h.interaction.cloud.cover=()=>cover.promise;h.interaction.cloud.destroy=()=>cover.resolve();
 h.down();h.move();await flush();assert.equal(h.interaction.pending.kind,'drag');
 h.interaction.destroy();await flush();
 assert.equal(h.interaction.pending,null);assert.equal(h.scenes[0].destroyed,1);assert.deepEqual(h.errors,[]);
});

test('release during entry fade is retained until return completes',async t=>{
 const h=await harness(t),fade=deferred();let fades=0;
 h.interaction.fade.play=()=>++fades===1?fade.promise:Promise.resolve();
 h.down();h.move();await flush();assert.equal(h.interaction.current.kind,'drag');
 h.up(310);assert.equal(h.interaction.mode,'normal');assert.equal(h.interaction.pointer,null);
 fade.resolve();await flush();
 assert.equal(h.scenes[0].starts,1);assert.equal(h.scenes[0].releases,1);assert.equal(h.scenes[0].destroyed,1);
 assert.equal(h.interaction.active,false);
});

test('a flight ending while pump is busy still reaches the selected edge',async t=>{
 const h=await harness(t,{flightPlay:ended=>ended()});h.down();h.move();await flush();h.up(12);await flush();
 assert.equal(h.interaction.mode,'peek');assert.equal(h.interaction.current.kind,'peek');
 assert.equal(h.interaction.current.side,'left');assert.equal(h.interaction.current.eye().x,0);
 assert.equal(h.events.filter(x=>x==='play-flight').length,1);
 assert.equal(h.scenes.find(s=>s.kind==='flight').destroyed,1);assert.equal(h.interaction.busy,false);
 assert.deepEqual(h.errors,[]);
});

test('flight keeps the release eye through asynchronous loading and fades without movement',async t=>{
 const load=deferred(),h=await harness(t,{flightLoad:()=>load.promise}),fades=[];
 h.interaction.fade.play=async(from,to,offset)=>{fades.push({from,to,offset});};
 h.down();h.move(150,220);await flush();const drag=h.interaction.current;
 const liveEye={x:153,y:217};drag.eye=()=>liveEye;
 h.up(150,220);await flush();assert.deepEqual(h.interaction.desired.anchor,{x:153,y:217});
 liveEye.x=190;liveEye.y=240;load.resolve();await flush();
 assert.deepEqual(h.interaction.current.anchor,{x:153,y:217});
 assert.deepEqual(h.interaction.current.eye(),{x:153,y:217});
 assert.equal(fades.length,2);assert.equal(fades[0].offset,undefined);
 assert.equal(fades[1].from,drag.element);assert.equal(fades[1].to,h.interaction.current.element);
 assert.equal(fades[1].offset,undefined);
});

test('scene fades change opacity without translating either character',async()=>{
 const {SceneFade}=await import('./scene-fade.js'),frames=[];
 const element={animate(keyframes){frames.push(keyframes);return{finished:Promise.resolve(),cancel(){}};}};
 await new SceneFade().play(element,element);
 assert.deepEqual(frames,[[{opacity:1},{opacity:0}],[{opacity:0},{opacity:1}]]);
});

test('release at the opposite edge during entry cloud selects only that flight',async t=>{
 const h=await harness(t,{initial:view('work','normal')}),cover=deferred();h.interaction.cloud.cover=()=>cover.promise;
 h.down();h.move();await flush();h.up(590);cover.resolve();await flush();
 assert.equal(h.interaction.current.kind,'flight');assert.equal(h.interaction.current.side,'right');
 assert.deepEqual(h.interaction.current.anchor,{x:590,y:200});
 assert.deepEqual(h.interaction.current.eye(),{x:590,y:200});
 assert.equal(h.scenes.find(s=>s.kind==='drag').starts,0);
 h.interaction.current.ended();await flush();assert.equal(h.interaction.current.kind,'peek');
 assert.equal(h.interaction.current.side,'right');
});

for(const grabX of [150,250]){
 test(`release uses the same character eye position when grabbed at ${grabX}`,async t=>{
  const h=await harness(t),pointerX=grabX-40;
  h.down(grabX);h.move(pointerX);await flush();h.up(pointerX);await flush();
  assert.equal(h.interaction.position.x,160);
  assert.equal(h.interaction.mode,'flight');assert.equal(h.interaction.current.side,'left');
 });
}

for(const side of ['left','right'])for(const inside of [true,false]){
 test(`release ${inside?'inside':'outside'} the 80px drag release zone at the ${side} edge`,async t=>{
  const {DRAG_EDGE_WIDTH}=await import('./interaction-scenes.js');
  const h=await harness(t,{edgeWidth:DRAG_EDGE_WIDTH});
  const distance=DRAG_EDGE_WIDTH+(inside?-.01:.01),x=side==='left'?distance:600-distance;
  h.down();h.move(x);await flush();h.up(x);await flush();
  assert.equal(h.interaction.mode,inside?'flight':'normal');
  if(inside)assert.equal(h.interaction.current.side,side);
  assert.equal(h.stage.style['--edge-width'],`${DRAG_EDGE_WIDTH}px`);
 });
}

test('a pointer near the edge does not fly a character whose eye is outside the edge area',async t=>{
 const h=await harness(t);h.down(150);h.move(130);await flush();h.up(130);await flush();
 assert.equal(h.interaction.position.x,180);assert.equal(h.interaction.mode,'normal');
 assert.ok(!h.scenes.some(scene=>scene.kind==='flight'));assert.equal(h.interaction.active,false);
});

test('a supplied character width controls both edge boundaries',async t=>{
 const h=await harness(t,{edgeWidth:100});h.down();h.move(120);await flush();h.up(120);await flush();
 assert.equal(h.interaction.mode,'normal');assert.equal(h.stage.style['--edge-width'],'100px');
 const {releasedEdge}=await import('./pet-interaction.js');
 assert.equal(releasedEdge(100,600,100),'left');assert.equal(releasedEdge(100.1,600,100),null);
 assert.equal(releasedEdge(499.9,600,100),null);assert.equal(releasedEdge(500,600,100),'right');
});

test('pointer cancellation at an edge cancels capture and never starts flight',async t=>{
 const load=deferred(),h=await harness(t,{dragLoad:()=>load.promise});
 h.down();h.move(5);await flush();h.interaction.cancel();load.resolve();await flush();
 assert.equal(h.interaction.pointer,null);assert.equal(h.stage.hasPointerCapture(1),false);
 assert.equal(h.interaction.mode,'normal');assert.equal(h.interaction.active,false);
 assert.ok(!h.scenes.some(s=>s.kind==='flight'));assert.deepEqual(h.clicks,[]);
});

test('dragging resets click count and regrabbing a returning drag starts it again',async t=>{
 const load=deferred(),h=await harness(t,{taskLoad:()=>load.promise});
 h.down();h.up(200);h.down();h.up(200);assert.deepEqual(h.clicks,[1,2]);
 h.down();h.move();await flush();const drag=h.interaction.current;h.interaction.setTarget(view('reading'));h.up();await flush();
 h.down(260);h.move(300);assert.equal(h.scenes[0].starts,2);load.resolve();await flush();
 assert.equal(h.interaction.current,drag);assert.equal(h.interaction.mode,'drag');
 h.up(300);await flush();h.down(300);h.up(300);
 assert.deepEqual(h.clicks,[1,2,1]);assert.equal(h.interaction.active,false);
});

test('dragging out of a peek restores a task that changed while clinging',async t=>{
 const h=await harness(t,{flightPlay:ended=>ended()});h.down();h.move();await flush();h.up(590);await flush();
 const peek=h.scenes.find(scene=>scene.kind==='peek');
 const latest=view('reading','normal',{waiting:true,waitingPose:true});h.interaction.setTarget(latest);
 h.down(590);h.move(400);await flush();assert.equal(h.interaction.current.kind,'drag');
 h.up(350);await flush();assert.equal(h.presenter.current.view,latest);
 assert.equal(h.presenter.current.animation.waiting,true);assert.equal(h.interaction.active,false);
 assert.equal(peek.touches,0);assert.deepEqual(h.clicks,[]);assert.equal(peek.destroyed,1);
});

for(const side of ['left','right']){
 test(`${side} peek clicks animate the visible portrait without touching the retained task`,async t=>{
  const h=await harness(t,{flightPlay:ended=>ended()}),x=side==='left'?10:590;
  h.down();h.move(x);await flush();h.up(x);await flush();
  const entry=h.interaction.current,peek=h.scenes.find(scene=>scene.kind==='peek'),target=h.interaction.target;
  assert.equal(entry.kind,'peek');assert.equal(entry.side,side);
  // Repeated quick clicks must not enter the normal character's triple-click path.
  for(let i=0;i<3;i++){h.down(x);h.up(x);}
  assert.equal(peek.touches,3);assert.deepEqual(h.clicks,[]);assert.equal(h.interaction.clickCount,0);
  assert.deepEqual(h.peekClicks,[1,1,1]);
  assert.equal(h.interaction.current,entry);assert.equal(h.interaction.target,target);
  assert.equal(h.presenter.current.animation.visible,false);assert.equal(h.presenter.current.animation.suspended,true);
  assert.deepEqual(h.errors,[]);
 });
}

test('a hidden or paused peek stops its animation and accepts clicks again after showing',async t=>{
 const h=await harness(t,{flightPlay:ended=>ended()});h.down();h.move(590);await flush();h.up(590);await flush();
 const peek=h.scenes.find(scene=>scene.kind==='peek');
 h.interaction.setPaused(true);h.down(590);h.up(590);
 assert.equal(peek.pauses.at(-1),true);assert.equal(peek.touches,0);
 assert.deepEqual(h.peekClicks,[]);
 h.interaction.setPaused(false);h.down(590);h.up(590);
 assert.equal(peek.pauses.at(-1),false);assert.equal(peek.touches,1);
 h.down(590);document.hidden=true;h.interaction.onVisibility();h.up(590);
 assert.equal(h.interaction.pointer,null);assert.equal(h.stage.hasPointerCapture(1),false);
 assert.equal(peek.pauses.at(-1),true);assert.equal(peek.touches,1);
 document.hidden=false;h.interaction.onVisibility();h.down(590);h.up(590);
 assert.equal(peek.pauses.at(-1),false);assert.equal(peek.touches,2);
 assert.deepEqual(h.peekClicks,[1,1]);
 assert.deepEqual(h.clicks,[]);assert.deepEqual(h.errors,[]);
});

test('a peek finishing loading while hidden starts paused and resumes when shown',async t=>{
 const load=deferred(),h=await harness(t,{flightPlay:ended=>ended(),peekLoad:()=>load.promise});
 h.down();h.move(590);await flush();h.up(590);await flush();
 assert.equal(h.interaction.mode,'peek');assert.equal(h.interaction.busy,true);
 document.hidden=true;h.interaction.onVisibility();load.resolve();await flush();
 const peek=h.scenes.find(scene=>scene.kind==='peek');
 assert.equal(h.interaction.current.kind,'peek');assert.equal(peek.pauses[0],true);
 document.hidden=false;h.interaction.onVisibility();assert.equal(peek.pauses.at(-1),false);
 assert.deepEqual(h.errors,[]);
});

test('the outgoing peek stays pausable during the drag transition and is disposed once',async t=>{
 const h=await harness(t,{flightPlay:ended=>ended()});h.down();h.move(590);await flush();h.up(590);await flush();
 const peek=h.scenes.find(scene=>scene.kind==='peek'),fade=deferred();
 h.interaction.fade.play=()=>fade.promise;
 h.down(590);h.move(400);await flush();
 assert.equal(h.interaction.current.kind,'drag');assert.equal(h.interaction.outgoing.kind,'peek');
 h.interaction.setPaused(true);assert.equal(peek.pauses.at(-1),true);
 h.interaction.setPaused(false);assert.equal(peek.pauses.at(-1),false);
 fade.resolve();await flush();h.up(350);await flush();
 assert.equal(peek.destroyed,1);assert.equal(peek.touches,0);
 assert.equal(h.interaction.active,false);assert.deepEqual(h.clicks,[]);assert.deepEqual(h.errors,[]);
});

test('returning from the edge fits a taller task canvas without changing its size',async t=>{
 const h=await harness(t,{initial:view('work','normal'),flightPlay:ended=>ended(),
  taskBounds:v=>v.scene==='reading'?{width:260,height:400,eyeX:112,eyeY:72}:{width:280,height:280,eyeX:150,eyeY:105},
 });
 h.down();h.move(400,420);await flush();h.up(590,420);await flush();
 h.interaction.setTarget(view('reading','normal'));const peek=h.interaction.current.eye();
 h.down(peek.x,peek.y);h.move(340,420);await flush();
 assert.equal(h.interaction.current.eye().y,420);
 h.up(340,420);await flush();
 const canvas=h.presenter.current.element.querySelector('canvas').getBoundingClientRect();
 assert.equal(h.presenter.current.view.scene,'reading');assert.equal(canvas.width,260);assert.equal(canvas.height,400);
 assert.equal(canvas.top+canvas.height,h.stage.clientHeight-8);assert.ok(canvas.top>=8);
 assert.ok(canvas.left>=8&&canvas.left+canvas.width<=h.stage.clientWidth-8);
 assert.equal(h.interaction.active,false);
});

for(const y of [-40,520]){
 test(`normal release at vertical coordinate ${y} fits the canvas without starting flight`,async t=>{
  const h=await harness(t);h.down();h.move(300,y);await flush();
  assert.equal(h.interaction.current.eye().y,y);
  h.up(300,y);await flush();
  const canvas=h.presenter.current.element.querySelector('canvas').getBoundingClientRect();
  assert.ok(canvas.top>=8&&canvas.top+canvas.height<=h.stage.clientHeight-8);
  assert.equal(canvas.width,200);assert.equal(canvas.height,240);
  assert.ok(!h.scenes.some(scene=>scene.kind==='flight'));assert.equal(h.interaction.active,false);
 });
}

test('destroy during a transition releases incoming and outgoing scenes once',async t=>{
 const h=await harness(t);h.down();h.move();await flush();
 const fade=deferred();h.interaction.fade={animations:[],play:()=>fade.promise,destroy:()=>fade.resolve()};
 h.up(590);await flush();h.interaction.destroy();await flush();
 assert.equal(h.scenes.find(s=>s.kind==='drag').destroyed,1);
 assert.equal(h.scenes.find(s=>s.kind==='flight').destroyed,1);
 assert.deepEqual(h.errors,[]);
});

test('release while waiting for an existing task transition does not enter drag later',async t=>{
 const load=deferred(),h=await harness(t,{taskLoad:()=>load.promise});
 h.interaction.setTarget(view('reading','normal'));await flush();assert.equal(h.presenter.busy,true);
 h.down();h.move();h.up(300);
 const latest=view('drawing','chibi');h.interaction.setTarget(latest);
 load.resolve();await flush();
 assert.equal(h.presenter.current.view,latest);assert.equal(h.scenes.length,0);
 assert.equal(h.interaction.busy,false);assert.equal(h.interaction.active,false);
 assert.deepEqual(h.errors,[]);
});

for(const initial of [view('reading','normal',{waiting:true,waitingPose:true}),view('standby','chibi',{sleeping:true}),view('work','normal',{suspended:true})]){
 test(`dragging preserves ${initial.scene} task waiting, sleeping and suspended facts`,async t=>{
  const h=await harness(t,{initial:Object.freeze(initial)});h.down();h.move();await flush();
  assert.equal(h.interaction.current.kind,'drag');h.up();await flush();
  assert.equal(h.presenter.current.view,initial);
  assert.equal(h.presenter.current.animation.sleeping,initial.sleeping);
  assert.equal(h.presenter.current.animation.suspended,initial.suspended);
  assert.equal(h.presenter.current.animation.waiting,initial.waitingPose);
 });
}

test('native coordinates stay stable when the transparent window moves',async t=>{
 const h=await harness(t);h.interaction.pointFromEvent=e=>({x:e.screenX+500,y:e.screenY});
 const e=h.event(25,30,{screenX:-300,screenY:200});h.interaction.down(e);
 h.interaction.move(h.event(7,8,{screenX:-200,screenY:230}));
 await flush();assert.deepEqual(h.interaction.position,{x:300,y:230});
});

test('native work area clamps release and preserves the selected edge through flight',async t=>{
 const h=await harness(t,{flightPlay:ended=>ended()});
 h.interaction.workAreaAt=()=>({x:180,y:60,width:400,height:340});
 h.interaction.edgeAt=(p,a)=>p.x>=a.x+a.width-90?'right':null;
 h.down();h.move(550,250);await flush();h.up(550,250);await flush();
 assert.equal(h.interaction.mode,'peek');assert.equal(h.interaction.current.eye().x,580);
 assert.deepEqual(h.interaction.current.area,{x:180,y:60,width:400,height:340});
});

test('a desktop origin change preserves the current task and its screen position',async t=>{
 const h=await harness(t,{initial:view('reading','normal',{waiting:true,waitingPose:true})});
 const retained=h.presenter.current;
 h.interaction.position=h.interaction.eye();
 h.interaction.workAreaAt=()=>({x:0,y:0,width:800,height:600});
 h.interaction.updateLayout({x:120,y:30});await flush();
 assert.equal(h.interaction.mode,'normal');assert.equal(h.interaction.current,null);
 assert.equal(h.presenter.current,retained);assert.equal(retained.animation.waiting,true);
 assert.deepEqual(h.interaction.eye(),{x:320,y:230});
 assert.deepEqual(h.events.filter(event=>/^(load|destroy)-task:/.test(event)),[]);
 assert.deepEqual(h.errors,[]);
});

test('a resized desktop keeps the pet at the edge until the user drags it back to the latest task',async t=>{
 const h=await harness(t,{flightPlay:ended=>ended()});
 let area={x:0,y:0,width:600,height:460};h.interaction.workAreaAt=()=>area;
 h.down();h.move(590);await flush();h.up(590);await flush();
 const peek=h.interaction.current,retained=h.presenter.current;
 area={x:0,y:0,width:800,height:500};
 h.interaction.setTarget(view('thinking'));h.interaction.updateLayout({x:0,y:0});await flush();
 h.interaction.setTarget(view('standby'));h.interaction.updateLayout({x:0,y:0});await flush();
 const latest=view('reading','normal',{waiting:true,waitingPose:true});h.interaction.setTarget(latest);await flush();
 assert.equal(h.interaction.current,peek);assert.equal(h.interaction.mode,'peek');
 assert.deepEqual(peek.eye(),{x:800,y:200});assert.deepEqual(peek.area,area);
 assert.equal(h.presenter.current,retained);assert.equal(retained.animation.visible,false);
 assert.equal(h.events.filter(event=>event==='play-flight').length,1);
 h.down(800);h.move(350);await flush();h.up(350);await flush();
 assert.equal(h.interaction.active,false);assert.equal(h.presenter.current.view,latest);
 assert.equal(h.presenter.current.animation.visible,true);assert.equal(h.presenter.current.animation.waiting,true);
 assert.deepEqual(h.errors,[]);
});

test('a desktop origin change preserves the running flight and lands on the updated edge',async t=>{
 const h=await harness(t);let area={x:0,y:0,width:600,height:460};
 h.interaction.workAreaAt=()=>area;
 h.down();h.move(590);await flush();h.up(590);await flush();
 const flight=h.interaction.current;
 assert.equal(flight.kind,'flight');
 area={x:0,y:0,width:640,height:480};
 h.interaction.updateLayout({x:40,y:20});await flush();
 assert.equal(h.interaction.current,flight);assert.equal(h.interaction.mode,'flight');
 assert.deepEqual(flight.eye(),{x:630,y:220});
 assert.equal(h.events.filter(event=>event==='play-flight').length,1);
 flight.ended();await flush();
 assert.equal(h.interaction.mode,'peek');assert.equal(h.interaction.current.side,'right');
 assert.deepEqual(h.interaction.current.eye(),{x:640,y:220});
 assert.deepEqual(h.interaction.current.area,area);
 assert.equal(h.events.filter(event=>event==='play-flight').length,1);assert.deepEqual(h.errors,[]);
});

test('a desktop origin change during a drag keeps the pointer and pet together without a jump',async t=>{
 const h=await harness(t);let origin={x:0,y:0};
 h.interaction.pointFromEvent=e=>({x:e.clientX+origin.x,y:e.clientY+origin.y});
 h.interaction.workAreaAt=()=>({x:0,y:0,width:800,height:600});
 h.down();h.move(260,220);await flush();const drag=h.interaction.current;
 origin={x:50,y:-20};h.interaction.updateLayout(origin);await flush();
 assert.equal(h.interaction.current,drag);assert.equal(h.interaction.mode,'drag');
 assert.equal(h.stage.hasPointerCapture(1),true);assert.deepEqual(drag.eye(),{x:310,y:200});
 h.move(260,220);assert.deepEqual(drag.eye(),{x:310,y:200});
 h.move(280,230);assert.deepEqual(drag.eye(),{x:330,y:210});
 h.up(280,230);await flush();
 assert.equal(h.interaction.active,false);assert.equal(h.stage.hasPointerCapture(1),false);
 assert.deepEqual(h.interaction.eye(),{x:330,y:210});assert.deepEqual(h.errors,[]);
});

test('a flight loading across a layout change starts once from the adjusted release position',async t=>{
 const load=deferred(),h=await harness(t,{flightLoad:()=>load.promise});
 let area={x:0,y:0,width:600,height:460};h.interaction.workAreaAt=()=>area;
 h.down();h.move(590);await flush();h.up(590);await flush();
 assert.equal(h.interaction.mode,'flight');assert.equal(h.interaction.busy,true);
 area={x:0,y:0,width:640,height:480};h.interaction.updateLayout({x:40,y:20});
 load.resolve();await flush();
 assert.equal(h.interaction.current.kind,'flight');
 assert.deepEqual(h.interaction.current.eye(),{x:630,y:220});
 h.interaction.current.ended();await flush();
 assert.equal(h.interaction.mode,'peek');assert.deepEqual(h.interaction.current.eye(),{x:640,y:220});
 assert.equal(h.events.filter(event=>event==='play-flight').length,1);assert.deepEqual(h.errors,[]);
});

test('a peek loading across a layout change uses the latest edge without restoring the task',async t=>{
 const load=deferred(),h=await harness(t,{flightPlay:ended=>ended(),peekLoad:()=>load.promise});
 let area={x:0,y:0,width:600,height:460};h.interaction.workAreaAt=()=>area;
 h.down();h.move(590);await flush();h.up(590);await flush();
 assert.equal(h.interaction.mode,'peek');assert.equal(h.interaction.busy,true);
 area={x:0,y:0,width:740,height:480};h.interaction.updateLayout({x:40,y:20});
 h.interaction.setTarget(view('thinking'));load.resolve();await flush();
 assert.equal(h.interaction.current.kind,'peek');assert.equal(h.interaction.mode,'peek');
 assert.deepEqual(h.interaction.current.eye(),{x:740,y:220});
 assert.deepEqual(h.interaction.current.area,area);assert.equal(h.presenter.current.animation.visible,false);
 assert.equal(h.events.filter(event=>event==='play-flight').length,1);assert.deepEqual(h.errors,[]);
});

test('a desktop origin change keeps both poses aligned during the return fade',async t=>{
 const h=await harness(t);h.interaction.workAreaAt=()=>({x:0,y:0,width:900,height:600});
 h.down();h.move(320);await flush();const drag=h.interaction.current,fade=deferred();
 h.interaction.fade.play=()=>fade.promise;
 h.up(320);await flush();
 assert.equal(h.interaction.current,null);assert.equal(h.interaction.outgoing,drag);
 assert.equal(h.interaction.busy,true);assert.equal(h.interaction.mode,'normal');
 h.interaction.updateLayout({x:80,y:40});
 assert.deepEqual(h.interaction.eye(),{x:400,y:240});assert.deepEqual(drag.eye(),{x:400,y:240});
 assert.equal(h.presenter.current.animation.visible,true);
 fade.resolve();await flush();
 assert.equal(h.interaction.active,false);assert.deepEqual(h.interaction.eye(),{x:400,y:240});
 assert.equal(h.scenes.find(scene=>scene.kind==='drag').destroyed,1);assert.deepEqual(h.errors,[]);
});
