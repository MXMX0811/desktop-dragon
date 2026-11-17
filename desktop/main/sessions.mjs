import {mkdir, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {dataDirectory, readEventFiles} from '../codex-hooks/store.mjs';
import {createEventReducer, reduceEvents} from '../codex-hooks/state.mjs';
import {toolKind, kindScene} from '../codex-hooks/tool-kind.mjs';

const ACTIVE = new Set(['activity_observed', 'tool_running', 'agent_running', 'permission_requested', 'compacting']);
// Let sub-second tools remain recognizable without keeping them active in the
// session facts. The deadline belongs to the observed completion, not each scan.
const TOOL_POSE_HOLD_MS = 3000;

export function toolScene(name, kind) {
  return kindScene(kind ?? toolKind(name));
}

const sceneFor = tool => toolScene(tool.tool_name, tool.tool_kind);

function sessionView(session, history) {
  const state = history && !['session_ended', 'interrupted'].includes(session.state) ? 'unknown' : session.state;
  const active = !history && ACTIVE.has(state);
  return {
    session_id:session.session_id, state, history,
    model:session.model, source:session.source, transient_fork:session.transient_fork,
    last_event:session.last_event, last_received_at:session.last_received_at,
    current_turn_id:session.current_turn_id,
    active_tools:active ? session.active_tools : 0,
    active_agents:active ? session.active_agents : 0,
    tools:active ? session.tools : [],
    pending_inputs:history ? [] : session.pending_inputs,
    pending_input_count:history ? 0 : session.pending_input_count,
    permission_requests_observed:session.turns.reduce((sum, item) => sum + item.permission_requests.length, 0),
    unpaired_events:session.unpaired_events,
  };
}

// Only the current pose and question context belong in a live session summary.
// Completed turn/tool details remain available in the receiver's files.
function observedView(session) {
  const turn = session.turns.find(item => item.turn_id === session.current_turn_id);
  const recentTool = (turn?.tools ?? []).filter(tool => tool.state === 'output_observed' && tool.started_at)
    .sort((a, b) => String(b.output_observed_at).localeCompare(String(a.output_observed_at)))[0];
  const pendingInputs = session.pending_inputs.map(input => {
    const sourceTurn = session.turns.find(item => item.turn_id === input.turn_id);
    const precedingTool = sourceTurn?.tools.filter(tool => tool.tool_name !== 'request_user_input_async'
      && tool.started_at && tool.started_at <= input.requested_at)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
    // A question keeps the task pose from when it was asked. Questions asked
    // without a preceding tool use the general work confirmation animation.
    return {...input, scene:precedingTool ? sceneFor(precedingTool) : 'work'};
  });
  return {session:sessionView(session, false), recentTool:ACTIVE.has(session.state) ? recentTool : undefined, pendingInputs};
}

function projectViews(history, observed, observedSince, previousScene = 'standby', now = Date.now()) {
  const sessions = new Map(history.map(session => [session.session_id, session]));
  const recentTools = new Map(), pendingInputs = [];
  for (const view of observed) {
    // Session identity survives the observation boundary; old activity does not.
    const session = {...view.session,
      transient_fork:view.session.transient_fork ?? sessions.get(view.session.session_id)?.transient_fork};
    sessions.set(session.session_id, session);
    if (session.transient_fork) continue;
    if (view.recentTool) recentTools.set(view.session.session_id, view.recentTool);
    pendingInputs.push(...view.pendingInputs);
  }
  // Composer predictions use non-persistent forks and emit ordinary prompt
  // hooks. They are outside the displayed conversation/task inventory.
  const list = [...sessions.values()].filter(session => !session.transient_fork)
    .sort((a, b) => String(b.last_received_at).localeCompare(String(a.last_received_at)));
  const active = list.filter(session => !session.history && ACTIVE.has(session.state));
  const tools = active.flatMap(session => session.tools);
  const sceneCounts = {reading:0, work:0, thinking:0};
  const held = [];
  active.forEach(session => {
    const running = [...session.tools].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
    const completed = recentTools.get(session.session_id);
    const until = completed ? Date.parse(completed.output_observed_at) + TOOL_POSE_HOLD_MS : 0;
    if (!running.length && until > now) held.push({scene:sceneFor(completed), until});
    const scene = running.some(tool => sceneFor(tool) === previousScene)
      ? previousScene : running.length ? sceneFor(running[0]) : until > now ? sceneFor(completed) : 'thinking';
    sceneCounts[scene]++;
  });
  const newestTool = [...tools].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
  const latestHeld = held.sort((a, b) => b.until - a.until)[0];
  const taskScene = active.length
    ? tools.some(tool => sceneFor(tool) === previousScene) ? previousScene
      : newestTool ? sceneFor(newestTool) : latestHeld?.scene ?? 'thinking'
    : 'standby';
  const pending = pendingInputs.sort((a, b) => b.requested_at.localeCompare(a.requested_at))[0];
  return {
    sessions:list,
    activity:{scene:pending?.scene ?? taskScene, waiting:Boolean(pending),
      pendingInputCount:pendingInputs.reduce((sum, input) => sum + input.pending_count, 0),
      activeCount:active.length, toolCount:tools.length,
      agentCount:active.reduce((sum, session) => sum + session.active_agents, 0),
      suspended:false, sceneCounts,
      holdUntil:!pending && !tools.length && latestHeld ? latestHeld.until : null},
    observedSince,
    capabilities:{usage:false, todos:false, confirmedWaiting:true, successfulCompletion:false, rootTaskCount:false},
    error:null,
  };
}

export function projectSessions(historyEvents, observedEvents, observedSince, previousScene = 'standby', now = Date.now()) {
  return projectViews(reduceEvents(historyEvents).sessions.map(session => sessionView(session, true)),
    reduceEvents(observedEvents).sessions.map(observedView), observedSince, previousScene, now);
}

const compareFiles = (a, b) => a.received_at.localeCompare(b.received_at) || a.order - b.order;

/** Read the existing receiver's atomic metadata files; never write to Codex. */
export async function createSessionObserver(onSnapshot, {directory = dataDirectory, enabled = true} = {}) {
  const observedSince = enabled ? new Date().toISOString() : null;
  const folder = join(directory, 'events');
  await mkdir(folder, {recursive:true, mode:0o700});
  const seen = new Set(), sessions = new Map(), dirty = new Set();
  let current, closed = false, scanning = null, holdTimer;
  let lastReceivedAt = null, lastObservedAt = null, receivedCount = 0;

  // The index contains only file names/order. It lets a reopened session or a
  // delayed atomic write be rebuilt in timestamp order without retaining events.
  async function collect(names) {
    for await (const {name, event} of readEventFiles(names, directory)) {
      const order = seen.size;
      seen.add(name);
      const observed = enabled && event.received_at >= observedSince;
      if (!lastReceivedAt || event.received_at > lastReceivedAt) lastReceivedAt = event.received_at;
      if (observed) {
        receivedCount++;
        if (!lastObservedAt || event.received_at > lastObservedAt) lastObservedAt = event.received_at;
      }
      if (!event.session_id || !event.hook_event_name) continue;
      let entry = sessions.get(event.session_id);
      if (!entry) {
        entry = {history:[], observed:[], historyDirty:false, applied:0, reducer:null};
        sessions.set(event.session_id, entry);
      }
      const file = {name, received_at:String(event.received_at ?? ''), order};
      entry[observed ? 'observed' : 'history'].push(file);
      if (!observed) entry.historyDirty = true;
      dirty.add(entry);
    }
  }

  async function applyFiles(reducer, files) {
    for await (const {event} of readEventFiles(files.map(file => file.name), directory)) reducer.apply(event);
    return reducer.snapshot().sessions[0];
  }

  async function update() {
    for (const entry of dirty) {
      if (entry.historyDirty) {
        const files = [...entry.history].sort(compareFiles);
        entry.historyView = sessionView(await applyFiles(createEventReducer(), files), true);
        entry.historyFirst = files[0];
        entry.historyDirty = false;
      }
      if (entry.applied < entry.observed.length) {
        const added = entry.observed.slice(entry.applied).sort(compareFiles);
        // A newly visible file may have been written before an already applied
        // event. Rebuild this session only, preserving the original ordering.
        const rebuild = !entry.reducer || compareFiles(added[0], entry.lastApplied) < 0;
        const reducer = rebuild ? createEventReducer() : entry.reducer;
        const files = rebuild ? [...entry.observed].sort(compareFiles) : added;
        const session = await applyFiles(reducer, files);
        entry.observedView = observedView(session);
        entry.observedFirst = rebuild ? files[0] : entry.observedFirst;
        entry.lastApplied = files.at(-1);
        entry.applied = entry.observed.length;
        // Stop/Interrupt can leave unanswered questions. Their exact IDs/counts
        // and pose remain in observedView; only finished execution detail is freed.
        entry.reducer = ACTIVE.has(session.state) ? reducer : null;
      }
      dirty.delete(entry);
    }
  }

  const publish = error => {
    if (closed) return;
    clearTimeout(holdTimer);
    const entries = [...sessions.values()];
    const history = entries.filter(entry => entry.historyView)
      .sort((a, b) => compareFiles(a.historyFirst, b.historyFirst)).map(entry => entry.historyView);
    const observed = entries.filter(entry => entry.observedView)
      .sort((a, b) => compareFiles(a.observedFirst, b.observedFirst)).map(entry => entry.observedView);
    current = projectViews(history, observed, observedSince, current?.activity.scene);
    current.connection = {enabled, observedSince, lastReceivedAt, lastObservedAt, receivedCount};
    if (error) {
      current.error = error.message;
      current.activity.suspended = current.activity.scene !== 'standby';
    }
    onSnapshot(current);
    if (current.activity.holdUntil) {
      holdTimer = setTimeout(async () => {
        // On wake, this deadline may run before the poll has read a recorded
        // Stop. Finish the current scan before deriving a pose from old facts.
        await scan();
        if (current.activity.holdUntil && current.activity.holdUntil <= Date.now()) publish();
      }, Math.max(0, current.activity.holdUntil - Date.now()));
    }
  };
  function scan() {
    if (closed) return;
    if (scanning) return scanning;
    scanning = (async () => {
      try {
        const names = (await readdir(folder)).filter(name => name.endsWith('.json') && !seen.has(name));
        if (!names.length && !dirty.size) return;
        await collect(names);
        await update();
        publish();
      } catch (error) { publish(error); }
    })().finally(() => { scanning = null; });
    return scanning;
  }
  await collect((await readdir(folder)).filter(name => name.endsWith('.json')));
  await update();
  publish();
  // Only new metadata files are read. With no new events, publish once when the
  // short tool pose expires; do not publish unchanged snapshots on every scan.
  const timer = enabled ? setInterval(() => void scan(), 1000) : null;
  return {
    snapshot:() => current,
    retainedCounts:() => {
      const live = [...sessions.values()].flatMap(entry => entry.reducer ? [entry.reducer.retainedCounts()] : []);
      return {events:0, indexedFiles:seen.size, sessions:sessions.size, liveSessions:live.length,
        turns:live.reduce((sum, counts) => sum + counts.turns, 0),
        tools:live.reduce((sum, counts) => sum + counts.tools, 0)};
    },
    close() { closed = true; clearInterval(timer); clearTimeout(holdTimer); },
  };
}
