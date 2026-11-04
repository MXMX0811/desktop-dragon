import {mkdir, readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {dataDirectory, readEvents} from '../codex-hooks/store.mjs';
import {reduceEvents} from '../codex-hooks/state.mjs';
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
    model:session.model, source:session.source,
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

export function projectSessions(historyEvents, observedEvents, observedSince, previousScene = 'standby', now = Date.now()) {
  const sessions = new Map(reduceEvents(historyEvents).sessions.map(session =>
    [session.session_id, sessionView(session, true)]));
  const recentTools = new Map(), pendingInputs = [];
  for (const session of reduceEvents(observedEvents).sessions) {
    sessions.set(session.session_id, sessionView(session, false));
    const turn = session.turns.find(item => item.turn_id === session.current_turn_id);
    const completed = (turn?.tools ?? []).filter(tool => tool.state === 'output_observed' && tool.started_at)
      .sort((a, b) => String(b.output_observed_at).localeCompare(String(a.output_observed_at)))[0];
    if (completed) recentTools.set(session.session_id, completed);
    for (const input of session.pending_inputs) {
      const sourceTurn = session.turns.find(item => item.turn_id === input.turn_id);
      const precedingTool = sourceTurn?.tools.filter(tool => tool.tool_name !== 'request_user_input_async'
        && tool.started_at && tool.started_at <= input.requested_at)
        .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
      // A question keeps the task pose from when it was asked. Questions asked
      // without a preceding tool use the general work confirmation animation.
      pendingInputs.push({...input, scene:precedingTool ? sceneFor(precedingTool) : 'work'});
    }
  }
  const list = [...sessions.values()].sort((a, b) => String(b.last_received_at).localeCompare(String(a.last_received_at)));
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

/** Read the existing receiver's atomic metadata files; never write to Codex. */
export async function createSessionObserver(onSnapshot, {directory = dataDirectory, enabled = true} = {}) {
  const observedSince = enabled ? new Date().toISOString() : null;
  const folder = join(directory, 'events');
  await mkdir(folder, {recursive:true, mode:0o700});
  const seen = new Set(), observed = [];
  let history = [], current, closed = false, scanning = null, holdTimer;
  const publish = error => {
    if (closed) return;
    clearTimeout(holdTimer);
    current = projectSessions(history, observed, observedSince, current?.activity.scene);
    const latest = events => events.reduce((at, event) => !at || event.received_at > at ? event.received_at : at, null);
    current.connection = {
      enabled, observedSince, lastReceivedAt:latest([...history, ...observed]),
      lastObservedAt:latest(observed), receivedCount:observed.length,
    };
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
        if (!names.length) return;
        const events = await Promise.all(names.map(name => readFile(join(folder, name), 'utf8').then(JSON.parse)));
        names.forEach(name => seen.add(name));
        for (const event of events) (event.received_at >= observedSince ? observed : history).push(event);
        publish();
      } catch (error) { publish(error); }
    })().finally(() => { scanning = null; });
    return scanning;
  }
  const events = await readEvents(directory);
  for (const event of events) {
    seen.add(`${event.event_id}.json`);
    (enabled && event.received_at >= observedSince ? observed : history).push(event);
  }
  publish();
  // Only new metadata files are read. With no new events, publish once when the
  // short tool pose expires; do not publish unchanged snapshots on every scan.
  const timer = enabled ? setInterval(() => void scan(), 1000) : null;
  return {
    snapshot:() => current,
    close() { closed = true; clearInterval(timer); clearTimeout(holdTimer); },
  };
}
