// Source adapters publish facts for one explicitly selected session. Art style is
// deliberately not part of this model: changing Q/normal never changes a task.
const toolKinds = new Set(['read', 'search', 'write', 'edit', 'command', 'image', 'unknown']);
const outcomes = new Set(['completed', 'cancelled', 'blocked', 'error', 'limit']);
const phases = new Set(['unknown', 'idle', 'running', 'ended']);
const requestKinds = new Set(['approval', 'question', 'action']);
const eventTypes = new Set(['session/idle', 'turn/start', 'tool/start', 'tool/end', 'request/open', 'request/resolve', 'reasoning', 'turn/end', 'connection']);
const gapDuration = 900;

export function sceneForTool(kind) {
  if (!toolKinds.has(kind)) throw new TypeError(`Unknown tool kind: ${kind}`);
  if (kind === 'image') return 'drawing';
  if (kind === 'read' || kind === 'search') return 'reading';
  if (kind === 'write' || kind === 'edit' || kind === 'command') return 'work';
  return 'thinking';
}
function id(value, field) {
  if (typeof value !== 'string' || !value.length) throw new TypeError(`${field} is required`);
  return value;
}
function tool(value) {
  id(value.callId, 'callId'); sceneForTool(value.kind);
  return {callId:value.callId, kind:value.kind, name:value.name || value.kind};
}
function request(value) {
  id(value.requestId, 'requestId');
  if (!requestKinds.has(value.kind) || typeof value.blocking !== 'boolean') throw new TypeError('A request needs kind and explicit blocking');
  if (value.scene !== undefined && !['reading', 'work', 'drawing'].includes(value.scene)) throw new TypeError('Request scene must be reading, work or drawing');
  return {requestId:value.requestId, kind:value.kind, blocking:value.blocking,
    ...(value.callId !== undefined ? {callId:id(value.callId,'callId')} : {}),
    ...(value.scene !== undefined ? {scene:value.scene} : {}), label:value.label || ''};
}
function indexed(values, make) {
  const result = new Map();
  for (const value of values) {
    const item = make(value), key = item.callId && !item.requestId ? item.callId : item.requestId;
    if (result.has(key)) throw new TypeError(`Duplicate item: ${key}`);
    result.set(key,item);
  }
  return result;
}

export class SessionState {
  constructor({source, sessionId}) {
    this.source=id(source,'source'); this.sessionId=id(sessionId,'sessionId');
    this.revision=-1; this.connection='disconnected'; this.phase='unknown';
    this.turnId=null; this.outcome=null; this.reason=''; this.reasoning=false;
    this.tools=new Map(); this.requests=new Map(); this.lastToolKind=null;
    this.unread=false; this.sleeping=false;
    this._trusted=false; this._closedTurns=new Set(); this._gapUntil=0;
    this._observedRunningTurn=null;
    this._lastScene='thinking'; this._heldScene='standby';
  }
  _accepts(value) {
    if (value.source !== this.source || value.sessionId !== this.sessionId) return false;
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw new TypeError('revision must be a nonnegative integer');
    return value.revision > this.revision;
  }
  _toolScene(tools=this.tools) {
    const kinds=[...tools.values()].map(item=>sceneForTool(item.kind));
    if (this._lastScene !== 'thinking' && kinds.includes(this._lastScene)) return this._lastScene;
    // A known activity remains meaningful when an unrelated unknown tool runs.
    return kinds.findLast(scene=>scene !== 'thinking') || 'thinking';
  }
  _rememberToolScene(now, previousCount) {
    if (this.tools.size) {
      this._lastScene=this._toolScene(); this._gapUntil=0;
    } else if (previousCount && this.phase === 'running') this._gapUntil=now+gapDuration;
  }
  applySnapshot(value, now=Date.now()) {
    if (!this._accepts(value)) return false;
    if (!['connected','disconnected'].includes(value.connection) || !phases.has(value.phase)) throw new TypeError('Invalid connection or phase');
    if (!Array.isArray(value.tools) || !Array.isArray(value.requests)) throw new TypeError('A snapshot must contain complete tools and requests arrays');
    if (['running','ended'].includes(value.phase)) id(value.turnId,'turnId');
    if (value.phase === 'ended' && !outcomes.has(value.outcome)) throw new TypeError('An ended turn needs an explicit outcome');
    if (value.lastToolKind != null) sceneForTool(value.lastToolKind);
    const tools=indexed(value.tools,tool), requests=indexed(value.requests,request);
    if (this._closedTurns.has(value.turnId) && (value.phase === 'running' || value.turnId !== this.turnId)) return false;
    if (value.phase !== 'running' && tools.size) throw new TypeError('Only a running turn can contain active tools');
    const oldPhase=this.phase, oldTurn=this.turnId, oldCount=this.tools.size;
    this._heldScene=this.presentation(now).scene;
    if (oldTurn && oldTurn !== value.turnId) this._closedTurns.add(oldTurn);
    this.revision=value.revision; this.connection=value.connection;
    this._trusted=value.connection === 'connected';
    this.phase=value.phase; this.turnId=value.turnId || null;
    if (this.phase === 'running') this._observedRunningTurn=this.turnId;
    this.outcome=value.phase === 'ended' ? value.outcome : null;
    this.reason=value.reason || ''; this.reasoning=value.phase === 'running' && value.reasoning === true;
    this.tools=tools; this.requests=requests; this.lastToolKind=value.lastToolKind || null;
    if (this.lastToolKind) this._lastScene=sceneForTool(this.lastToolKind);
    if (oldTurn !== this.turnId) this._gapUntil=0;
    this._rememberToolScene(now,oldTurn === this.turnId ? oldCount : 0);
    if (this.phase === 'ended') {
      this._closedTurns.add(this.turnId);
      // Merely subscribing to an old completed turn is not a new-result event.
      if (this._observedRunningTurn === this.turnId && this.outcome === 'completed' &&
          !(oldPhase === 'ended' && oldTurn === this.turnId)) this.unread=true;
    }
    if (!this.canSleep()) this.sleeping=false;
    return true;
  }
  apply(event, now=Date.now()) {
    if (!this._accepts(event)) return false;
    if (!eventTypes.has(event.type)) throw new TypeError(`Unknown event: ${event.type}`);
    if (!['connection','session/idle'].includes(event.type)) id(event.turnId,'turnId');
    if (event.type === 'turn/start' && (this._closedTurns.has(event.turnId) || this.turnId === event.turnId)) return false;
    if (!['connection','session/idle','turn/start'].includes(event.type) && (event.turnId !== this.turnId || this.phase !== 'running')) return false;
    // Invalid payloads do not consume the revision.
    const nextTool=event.type === 'tool/start' ? tool(event) : null;
    const nextRequest=event.type === 'request/open' ? request(event) : null;
    if (event.type === 'tool/end') id(event.callId,'callId');
    if (event.type === 'request/resolve') id(event.requestId,'requestId');
    if (event.type === 'turn/end' && !outcomes.has(event.outcome)) throw new TypeError('turn/end needs an explicit outcome');
    if (event.type === 'connection' && !['connected','disconnected'].includes(event.connection)) throw new TypeError('Invalid connection');
    if (event.type === 'reasoning' && typeof event.active !== 'boolean') throw new TypeError('reasoning needs active');
    const oldCount=this.tools.size;
    this._heldScene=this.presentation(now).scene;
    this.revision=event.revision;
    switch (event.type) {
      case 'connection':
        this.connection=event.connection; this._trusted=false; this.sleeping=false;
        return true;
      case 'session/idle':
        if (this.turnId) this._closedTurns.add(this.turnId);
        this.connection='connected'; this._trusted=true; this.phase='idle';
        this.turnId=null; this.outcome=null; this.reason=''; this.reasoning=false;
        this.tools.clear(); this._gapUntil=0; this._lastScene='thinking';
        break;
      case 'turn/start':
        if (this.turnId) this._closedTurns.add(this.turnId);
        this.connection='connected'; this._trusted=true; this.phase='running';
        this.turnId=event.turnId; this.outcome=null; this.reason=''; this.reasoning=false;
        this._observedRunningTurn=this.turnId;
        this.tools.clear(); this.requests.clear(); this.lastToolKind=null;
        this._lastScene='thinking'; this._gapUntil=0;
        break;
      case 'tool/start':
        this.tools.set(nextTool.callId,nextTool); this.lastToolKind=nextTool.kind;
        if (nextTool.kind !== 'unknown' || this.tools.size === 1) this._lastScene=sceneForTool(nextTool.kind);
        break;
      case 'tool/end': this.tools.delete(event.callId); break;
      case 'request/open': this.requests.set(nextRequest.requestId,nextRequest); break;
      case 'request/resolve': this.requests.delete(event.requestId); break;
      case 'reasoning': this.reasoning=event.active; break;
      case 'turn/end':
        this.phase='ended'; this.outcome=event.outcome; this.reason=event.reason || '';
        this.reasoning=false; this.tools.clear(); this.requests.clear(); this._gapUntil=0;
        this._closedTurns.add(this.turnId);
        if (event.outcome === 'completed') this.unread=true;
        break;
    }
    this._rememberToolScene(now,oldCount);
    if (!this.canSleep()) this.sleeping=false;
    return true;
  }
  canSleep() {
    return this._trusted && this.connection === 'connected' &&
      (this.phase === 'idle' || (this.phase === 'ended' && ['completed','cancelled'].includes(this.outcome))) &&
      ![...this.requests.values()].some(item=>item.blocking) && this.tools.size === 0;
  }
  setSleeping(value) {
    if (value && !this.canSleep()) return false;
    this.sleeping=Boolean(value); return true;
  }
  markRead() { this.unread=false; }
  presentation(now=Date.now()) {
    const tools=[...this.tools.values()].map(item=>({...item}));
    const requests=[...this.requests.values()].map(item=>({...item}));
    const blocking=requests.filter(item=>item.blocking);
    const result={source:this.source,sessionId:this.sessionId,turnId:this.turnId,revision:this.revision,
      phase:this.phase,outcome:this.outcome,connection:this.connection,unread:this.unread,
      tools,toolCount:tools.length,requests,requestCount:requests.length,blockingCount:blocking.length,
      scene:'standby',waiting:false,waitingPose:false,suspended:false,sleeping:false,canSleep:this.canSleep(),label:''};
    if (this.connection === 'disconnected' || !this._trusted) {
      return {...result,scene:this._heldScene,suspended:true,label:this.connection === 'disconnected' ? (this.revision < 0 ? '尚未连接' : '连接已断开') : '等待状态同步'};
    }
    if (this.phase === 'unknown') return {...result,suspended:true,label:'尚未获取会话状态'};
    if (this.phase === 'ended') {
      const failure=['blocked','error','limit'].includes(this.outcome);
      const labels={completed:this.unread?'有新结果':'本轮已结束',cancelled:'已停止',blocked:'运行受阻',error:'运行出错',limit:'达到运行限制'};
      return {...result,scene:failure?this._heldScene:'standby',suspended:failure,
        sleeping:this.sleeping && result.canSleep,label:this.reason || labels[this.outcome]};
    }
    if (blocking.length) {
      const first=blocking[0],associated=first.callId && this.tools.get(first.callId);
      const scene=first.scene || (associated ? sceneForTool(associated.kind) : this._lastScene);
      const waitingPose=['reading','work','drawing'].includes(scene);
      return {...result,scene,waiting:true,waitingPose,suspended:!waitingPose,
        label:first.label || (first.kind === 'approval'?'等待你批准':first.kind === 'question'?'等待你回答':'等待你操作')};
    }
    if (this.phase === 'idle') return {...result,sleeping:this.sleeping,label:this.sleeping?'小憩中':this.unread?'有新结果':'陪伴中'};
    let scene='thinking',label=this.reasoning?'思考中':'处理中';
    if (tools.length) {
      scene=this._toolScene();
      const relevant=tools.filter(item=>sceneForTool(item.kind) === scene);
      const kinds=new Set(relevant.map(item=>item.kind));
      label=scene === 'reading' ? (kinds.has('search')?'检索中':'读取文件中') : scene === 'work' ? (kinds.size === 1 && kinds.has('command')?'执行命令中':'工作中') : scene === 'drawing' ? '绘制图像中' : '工具处理中';
    } else if (now < this._gapUntil) scene=this._lastScene;
    return {...result,scene,label};
  }
}
