import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {EventEmitter} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {saveEvent} from '../codex-hooks/store.mjs';
import {createSessionObserver, projectSessions, toolScene} from './sessions.mjs';

const since = '2026-11-02T10:00:00.000Z';
let serial = 0;
function event(hook_event_name, values = {}) {
  const index = serial++;
  return {event_id:`event-${index}`, hook_event_name, session_id:'session-a', turn_id:'turn-a',
    received_at:new Date(Date.parse(since) + index).toISOString(), ...values};
}

test('startup history never resumes old tools or subagents', () => {
  const history = [event('UserPromptSubmit'), event('PreToolUse', {tool_name:'webrun', tool_use_id:'tool-a'}),
    event('SubagentStart', {agent_id:'agent-a'})];
  const view = projectSessions(history, [], since);
  assert.equal(view.sessions[0].state, 'unknown');
  assert.equal(view.sessions[0].history, true);
  assert.equal(view.activity.scene, 'standby');
  assert.equal(view.activity.activeCount, 0);
  assert.equal(view.activity.toolCount, 0);
  assert.equal(view.activity.agentCount, 0);
});

test('new observations replace a session history without reviving its old tools', () => {
  const history = [event('UserPromptSubmit'), event('PreToolUse', {tool_name:'Bash', tool_use_id:'old'})];
  const observed = [event('UserPromptSubmit', {turn_id:'turn-b'}),
    event('PreToolUse', {turn_id:'turn-b', tool_name:'webrun', tool_use_id:'new'})];
  const view = projectSessions(history, observed, since);
  assert.equal(view.sessions.length, 1);
  assert.equal(view.sessions[0].history, false);
  assert.deepEqual(view.sessions[0].tools.map(tool => tool.tool_use_id), ['new']);
  assert.equal(view.activity.scene, 'reading');
});

test('concurrent tools are paired and active sessions are counted once', () => {
  const events = [event('UserPromptSubmit'),
    event('PreToolUse', {tool_name:'webrun', tool_use_id:'read'}),
    event('PreToolUse', {tool_name:'Bash', tool_use_id:'work'}),
    event('UserPromptSubmit', {session_id:'session-b', turn_id:'turn-b'})];
  let view = projectSessions([], events, since, 'reading');
  assert.equal(view.activity.activeCount, 2);
  assert.equal(view.activity.toolCount, 2);
  assert.equal(view.activity.scene, 'reading');
  view = projectSessions([], [...events, event('PostToolUse', {tool_use_id:'read'})], since, 'reading');
  assert.equal(view.activity.toolCount, 1);
  assert.equal(view.activity.scene, 'work');
});

test('independent child tools and agents remain visible after the root stops, then return to standby', () => {
  const child={turn_id:'child-turn',agent_id:'child'};
  const events=[event('UserPromptSubmit'),event('SubagentStart',child),
    event('PreToolUse',{...child,tool_use_id:'child-search',tool_name:'Bash',tool_kind:'search'}),
    event('Stop')];
  let view=projectSessions([],events,since,'thinking');
  assert.equal(view.sessions[0].current_turn_id,'turn-a');
  assert.equal(view.sessions[0].state,'tool_running');
  assert.equal(view.activity.scene,'reading');
  assert.equal(view.activity.activeCount,1);
  assert.equal(view.activity.toolCount,1);
  assert.equal(view.activity.agentCount,1);
  assert.deepEqual(view.sessions[0].tools.map(tool=>tool.tool_use_id),['child-search']);

  view=projectSessions([], [...events,event('SubagentStop',child)],since,'reading');
  assert.equal(view.activity.scene,'standby');
  assert.equal(view.activity.activeCount,0);
  assert.equal(view.activity.toolCount,0);
  assert.equal(view.activity.agentCount,0);
  assert.equal(view.activity.holdUntil,null);
  assert.equal(view.activity.suspended,false);
});

test('child-only observations activate helpers and stop cleanly; historical children stay inactive', () => {
  const child={turn_id:'child-turn',agent_id:'child'};
  const started=event('SubagentStart',child);
  let view=projectSessions([], [started],since);
  assert.equal(view.sessions[0].current_turn_id,null);
  assert.equal(view.sessions[0].state,'agent_running');
  assert.equal(view.activity.scene,'thinking');
  assert.equal(view.activity.activeCount,1);
  assert.equal(view.activity.agentCount,1);

  view=projectSessions([], [started,event('SubagentStop',child)],since,'thinking');
  assert.equal(view.activity.scene,'standby');
  assert.equal(view.activity.activeCount,0);
  assert.equal(view.activity.agentCount,0);

  const history=[started,event('PreToolUse',{...child,tool_use_id:'historical-child-tool',tool_name:'Bash'})];
  view=projectSessions(history, [],since,'work');
  assert.equal(view.activity.scene,'standby');
  assert.equal(view.activity.agentCount,0);
  assert.equal(view.activity.toolCount,0);

  view=projectSessions(history, [event('UserPromptSubmit',{turn_id:'new-root'})],since);
  assert.equal(view.activity.scene,'thinking');
  assert.equal(view.activity.activeCount,1);
  assert.equal(view.activity.agentCount,0);
  assert.equal(view.activity.toolCount,0);
  assert.deepEqual(view.sessions[0].tools,[]);
});

test('a stopped turn returns every prior pose to standby without claiming successful completion', () => {
  const events=[event('UserPromptSubmit'),
    event('PreToolUse', {tool_name:'Bash', tool_use_id:'tool'}),
    event('SubagentStart', {agent_id:'child'}),event('Stop')];
  for (const previousScene of ['thinking','reading','work']) {
    const view = projectSessions([], events, since, previousScene);
    assert.equal(view.sessions[0].state, 'stop_observed');
    assert.equal(view.activity.activeCount, 0);
    assert.equal(view.activity.toolCount, 0);
    assert.equal(view.activity.agentCount, 0);
    assert.equal(view.activity.scene, 'standby');
    assert.equal(view.activity.suspended, false);
    assert.equal(view.activity.holdUntil, null);
    assert.equal(view.capabilities.successfulCompletion, false);
  }
});

test('the final active session stopping returns the pet to standby; earlier stops preserve other activity', () => {
  const events=[event('UserPromptSubmit'),
    event('PreToolUse',{tool_use_id:'work',tool_name:'Bash',tool_kind:'command'}),
    event('UserPromptSubmit',{session_id:'session-b',turn_id:'turn-b'}),
    event('PreToolUse',{session_id:'session-b',turn_id:'turn-b',tool_use_id:'read',tool_name:'Bash',tool_kind:'read'}),
    event('Stop')];
  let view=projectSessions([],events,since,'work');
  assert.equal(view.activity.scene,'reading');
  assert.equal(view.activity.activeCount,1);
  assert.equal(view.activity.toolCount,1);
  assert.equal(view.sessions.find(session=>session.session_id==='session-a').state,'stop_observed');

  view=projectSessions([], [...events,event('Stop',{session_id:'session-b',turn_id:'turn-b'})],since,'reading');
  assert.equal(view.activity.scene,'standby');
  assert.equal(view.activity.suspended,false);
  assert.equal(view.activity.activeCount,0);
  assert.equal(view.activity.toolCount,0);
  assert.equal(view.activity.agentCount,0);
  assert.equal(view.capabilities.successfulCompletion,false);
});

test('unknown session facts do not retain a thinking pose without observed activity', () => {
  const view=projectSessions([], [event('SessionStart',{turn_id:undefined,source:'resume'})],since,'thinking');
  assert.equal(view.sessions[0].state,'unknown');
  assert.equal(view.activity.activeCount,0);
  assert.equal(view.activity.scene,'standby');
  assert.equal(view.activity.suspended,false);
  assert.equal(view.capabilities.successfulCompletion,false);
});

test('non-persistent fork lifecycle never enters the desktop task inventory', () => {
  const events=[event('SessionStart',{turn_id:undefined,source:'fork',has_transcript_path:false}),
    event('UserPromptSubmit',{has_transcript_path:false}),event('Interrupt'),
    event('SessionEnd',{turn_id:undefined})];
  for(let length=1;length<=events.length;length++) {
    const view=projectSessions([],events.slice(0,length),since,'thinking');
    assert.deepEqual(view.sessions,[]);
    assert.equal(view.activity.scene,'standby');
    assert.equal(view.activity.activeCount,0);
    assert.equal(view.activity.agentCount,0);
    assert.equal(view.activity.waiting,false);
  }
});

test('persistent forks, non-fork sessions and sessions with unknown persistence remain visible', () => {
  for(const start of [
    {source:'fork',has_transcript_path:true},
    {source:'fork'},
    {source:'startup',has_transcript_path:false},
    {source:'resume',has_transcript_path:true},
  ]) {
    const view=projectSessions([], [event('SessionStart',{turn_id:undefined,...start}),
      event('UserPromptSubmit')],since);
    assert.equal(view.sessions.length,1);
    assert.equal(view.activity.activeCount,1);
    assert.equal(view.activity.scene,'thinking');
  }
  const child=projectSessions([], [event('SubagentStart',
    {turn_id:'child-turn',agent_id:'child',has_transcript_path:false})],since);
  assert.equal(child.activity.activeCount,1);
  assert.equal(child.activity.agentCount,1);
});

test('fork identity crosses the observation boundary without reviving historical activity', () => {
  const history=[event('SessionStart',{turn_id:undefined,source:'fork',has_transcript_path:false})];
  const observed=[event('UserPromptSubmit'),
    event('UserPromptSubmit',{session_id:'formal'}),
    event('PreToolUse',{session_id:'formal',tool_use_id:'read',tool_kind:'read',tool_name:'Bash'}),
    event('SubagentStart',{session_id:'formal',turn_id:'child-turn',agent_id:'child'})];
  const view=projectSessions(history,observed,since);
  assert.deepEqual(view.sessions.map(session=>session.session_id),['formal']);
  assert.equal(view.activity.scene,'reading');
  assert.equal(view.activity.activeCount,1);
  assert.equal(view.activity.toolCount,1);
  assert.equal(view.activity.agentCount,1);
});

test('non-persistent forks cannot introduce question or tool poses into a real task', () => {
  const question={tool_use_id:'question',tool_name:'request_user_input_async',input_question_count:1};
  const events=[event('UserPromptSubmit',{session_id:'formal'}),
    event('SessionStart',{turn_id:undefined,source:'fork',has_transcript_path:false}),
    event('UserPromptSubmit'),event('PreToolUse',{tool_use_id:'read',tool_kind:'read'}),
    event('PostToolUse',{tool_use_id:'read'}),event('PreToolUse',question),
    event('PostToolUse',{...question,input_request_accepted:true}),
    event('SubagentStart',{turn_id:'child-turn',agent_id:'child'})];
  const view=projectSessions([],events,since,'reading',Date.parse(events.at(-1).received_at));
  assert.equal(view.activity.scene,'thinking');
  assert.equal(view.activity.activeCount,1);
  assert.equal(view.activity.toolCount,0);
  assert.equal(view.activity.agentCount,0);
  assert.equal(view.activity.waiting,false);
  assert.equal(view.activity.holdUntil,null);
});

test('permission event does not claim confirmed waiting', () => {
  const view = projectSessions([], [event('UserPromptSubmit'), event('PermissionRequest')], since);
  assert.equal(view.sessions[0].state, 'permission_requested');
  assert.equal(view.activity.scene, 'thinking');
  assert.equal(view.activity.waiting, false);
  assert.equal(view.activity.pendingInputCount, 0);
  assert.equal(view.sessions[0].permission_requests_observed, 1);
});

test('an accepted async question keeps its reading pose after tools and the turn stop', () => {
  const question = {tool_name:'request_user_input_async', tool_use_id:'question', input_question_count:2};
  const events = [event('UserPromptSubmit'),
    event('PreToolUse', {tool_use_id:'read', tool_name:'Bash', tool_kind:'read'}),
    event('PostToolUse', {tool_use_id:'read'}), event('PreToolUse', question),
    event('PostToolUse', {...question, input_request_accepted:true}),
    event('PreToolUse', {tool_use_id:'later-work', tool_name:'Bash', tool_kind:'command'}), event('Stop')];
  let view = projectSessions([], events, since, 'work');
  assert.equal(view.activity.waiting, true);
  assert.equal(view.activity.scene, 'reading');
  assert.equal(view.activity.pendingInputCount, 2);
  assert.equal(view.activity.activeCount, 0);
  assert.equal(view.activity.toolCount, 0);
  assert.equal(view.activity.holdUntil, null);

  events.push(event('UserPromptSubmit', {turn_id:'answer-turn',
    input_replies:[{tool_use_id:'question', question_index:0}]}));
  view = projectSessions([], events, since);
  assert.equal(view.activity.waiting, true);
  assert.equal(view.activity.pendingInputCount, 1);

  events.push(event('UserPromptSubmit', {turn_id:'answer-turn',
    input_replies:[{tool_use_id:'question', question_index:1}]}));
  view = projectSessions([], events, since);
  assert.equal(view.activity.waiting, false);
  assert.equal(view.activity.pendingInputCount, 0);
  assert.equal(view.activity.scene, 'thinking');
});

test('pending user input takes display priority across sessions without changing activity counts', () => {
  const question = {tool_name:'request_user_input_async', tool_use_id:'question', input_question_count:1};
  const events = [event('UserPromptSubmit'), event('PreToolUse', question),
    event('PostToolUse', {...question, input_request_accepted:true}), event('Stop'),
    event('UserPromptSubmit', {session_id:'session-b',turn_id:'turn-b'}),
    event('PreToolUse', {session_id:'session-b',turn_id:'turn-b',tool_use_id:'read',tool_name:'webrun'})];
  let view = projectSessions([], events, since, 'reading');
  assert.equal(view.activity.scene, 'work');
  assert.equal(view.activity.waiting, true);
  assert.equal(view.activity.activeCount, 1);
  assert.equal(view.activity.toolCount, 1);
  assert.equal(view.activity.sceneCounts.reading, 1);
  events.push(event('UserPromptSubmit', {turn_id:'answer-turn',
    input_replies:[{tool_use_id:'question',question_index:0}]}));
  view = projectSessions([], events, since, 'work');
  assert.equal(view.activity.scene, 'reading');
  assert.equal(view.activity.waiting, false);
});

test('historical or unaccepted questions do not create waiting', () => {
  const question = {tool_name:'request_user_input_async', tool_use_id:'question', input_question_count:1};
  const events = [event('UserPromptSubmit'), event('PreToolUse', question),
    event('PostToolUse', {...question, input_request_accepted:true})];
  const view = projectSessions(events, [], since);
  assert.equal(view.activity.waiting, false);
  assert.equal(view.activity.pendingInputCount, 0);
  assert.equal(view.sessions[0].pending_input_count, 0);
  assert.deepEqual(view.sessions[0].pending_inputs, []);
  assert.equal(projectSessions([], events.slice(0, 2), since).activity.waiting, false);
});

test('explicit session end removes activity; unfamiliar tools are general work', () => {
  const view = projectSessions([], [event('UserPromptSubmit'), event('SessionEnd')], since, 'work');
  assert.equal(view.activity.scene, 'standby');
  assert.equal(view.activity.activeCount, 0);
  assert.equal(view.activity.suspended, false);
  assert.equal(toolScene('Bash'), 'work');
  assert.equal(toolScene('imagegen-unknown'), 'work');
  assert.equal(toolScene('view_image'), 'reading');
  assert.equal(toolScene('Bash', 'search'), 'reading');
});

test('a complete short search is shown without inventing an active tool', () => {
  const start = Date.parse(since);
  const events = [event('UserPromptSubmit'),
    event('PreToolUse', {tool_use_id:'search', tool_name:'Bash', tool_kind:'search', received_at:new Date(start + 100).toISOString()}),
    event('PostToolUse', {tool_use_id:'search', tool_name:'Bash', tool_kind:'search', received_at:new Date(start + 244).toISOString()})];
  let view = projectSessions([], events, since, 'thinking', start + 1000);
  assert.equal(view.activity.scene, 'reading');
  assert.equal(view.activity.activeCount, 1);
  assert.equal(view.activity.toolCount, 0);
  assert.equal(view.sessions[0].active_tools, 0);
  assert.equal(view.activity.holdUntil, start + 3244);
  view = projectSessions([], events, since, 'reading', start + 3244);
  assert.equal(view.activity.scene, 'thinking');
  assert.equal(view.activity.holdUntil, null);
});

test('actual tools outrank recent poses and other thinking sessions', () => {
  const start = Date.parse(since);
  const events = [event('UserPromptSubmit'),
    event('PreToolUse', {tool_use_id:'search', tool_name:'Bash', tool_kind:'search', received_at:new Date(start + 100).toISOString()}),
    event('PostToolUse', {tool_use_id:'search', received_at:new Date(start + 200).toISOString()}),
    event('UserPromptSubmit', {session_id:'thinking', turn_id:'t2', received_at:new Date(start + 300).toISOString()})];
  let view = projectSessions([], events, since, 'thinking', start + 500);
  assert.equal(view.activity.scene, 'reading');
  view = projectSessions([], [...events,
    event('PreToolUse', {session_id:'working', tool_use_id:'command', tool_name:'Bash', tool_kind:'command', received_at:new Date(start + 400).toISOString()})], since, 'reading', start + 500);
  assert.equal(view.activity.scene, 'work');
  assert.equal(view.activity.toolCount, 1);
  assert.equal(view.activity.holdUntil, null);
});

test('one batch presents the latest completed action rather than replaying older actions', () => {
  const start = Date.parse(since);
  const events = [event('UserPromptSubmit'),
    event('PreToolUse', {tool_use_id:'search', tool_name:'Bash', tool_kind:'search', received_at:new Date(start + 100).toISOString()}),
    event('PostToolUse', {tool_use_id:'search', received_at:new Date(start + 200).toISOString()}),
    event('PreToolUse', {tool_use_id:'command', tool_name:'Bash', tool_kind:'command', received_at:new Date(start + 300).toISOString()}),
    event('PostToolUse', {tool_use_id:'command', received_at:new Date(start + 400).toISOString()})];
  const view = projectSessions([], events, since, 'reading', start + 500);
  assert.equal(view.activity.scene, 'work');
  assert.equal(view.activity.toolCount, 0);
  assert.equal(view.activity.holdUntil, start + 3400);
});

test('a short pose requires the observed start and current active turn', () => {
  const start = Date.parse(since);
  const prompt = event('UserPromptSubmit', {received_at:new Date(start).toISOString()});
  const before = event('PreToolUse', {tool_use_id:'search', tool_name:'Bash', tool_kind:'search', received_at:new Date(start + 100).toISOString()});
  const after = event('PostToolUse', {tool_use_id:'search', tool_name:'Bash', tool_kind:'search', received_at:new Date(start + 200).toISOString()});
  assert.equal(projectSessions([], [prompt, after], since, 'thinking', start + 500).activity.scene, 'thinking');
  for (const name of ['Stop', 'Interrupt', 'SessionEnd']) {
    const view = projectSessions([], [prompt, before, after,
      event(name, {received_at:new Date(start + 300).toISOString()})], since, 'reading', start + 500);
    assert.equal(view.activity.holdUntil, null, name);
    assert.equal(view.activity.toolCount, 0, name);
    assert.equal(view.activity.scene, 'standby', name);
    assert.equal(view.activity.suspended, false, name);
  }
  const view = projectSessions([], [prompt, before, after,
    event('UserPromptSubmit', {turn_id:'new-turn', received_at:new Date(start + 300).toISOString()})], since, 'reading', start + 500);
  assert.equal(view.activity.scene, 'thinking');
  assert.equal(view.activity.holdUntil, null);
});

test('observer expires a short pose without new events or repeated idle publications', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dragon-short-tool-'));
  const updates = new EventEmitter();
  let observer, publications = 0;
  try {
    observer = await createSessionObserver(snapshot => {publications++; updates.emit('snapshot', snapshot);}, {directory});
    const pair = {received_at:new Date().toISOString(), tool_use_id:'short', tool_name:'Bash', tool_kind:'search'};
    const shown = once(updates, 'snapshot', {signal:AbortSignal.timeout(3000)});
    await saveEvent(event('PreToolUse', pair), directory);
    await saveEvent(event('PostToolUse', pair), directory);
    const [reading] = await shown;
    assert.equal(reading.activity.scene, 'reading');
    assert.equal(reading.activity.toolCount, 0);
    const [thinking] = await once(updates, 'snapshot', {signal:AbortSignal.timeout(3000)});
    assert.equal(thinking.activity.scene, 'thinking');
    assert.equal(thinking.activity.holdUntil, null);
    assert.equal(thinking.connection.receivedCount, 2);
    const count = publications;
    await delay(1100);
    assert.equal(publications, count);
  } finally {
    observer?.close();
    await rm(directory, {recursive:true, force:true});
  }
});

test('a delayed pose timer reads a recorded Stop before publishing after wake', async t => {
  const start = Date.parse('2030-01-01T00:00:00.000Z');
  t.mock.timers.enable({apis:['setTimeout', 'setInterval', 'Date'], now:start});
  const directory = await mkdtemp(join(tmpdir(), 'dragon-wake-stop-'));
  const updates = new EventEmitter(), scenes = [];
  let observer;
  try {
    observer = await createSessionObserver(snapshot => {
      scenes.push(snapshot.activity.scene); updates.emit('snapshot', snapshot);
    }, {directory});
    const pair = {tool_use_id:'short', tool_name:'Bash', tool_kind:'search'};
    await saveEvent(event('PreToolUse', {...pair, received_at:new Date(start + 100).toISOString()}), directory);
    await saveEvent(event('PostToolUse', {...pair, received_at:new Date(start + 200).toISOString()}), directory);
    const reading = once(updates, 'snapshot');
    t.mock.timers.tick(1000);
    assert.equal((await reading)[0].activity.scene, 'reading');

    // The receiver writes Stop while the desktop's timers have not run. On
    // resume the overdue poll and pose timer compete before filesystem I/O ends.
    await saveEvent(event('Stop', {received_at:new Date(start + 2000).toISOString()}), directory);
    const resumed = once(updates, 'snapshot');
    t.mock.timers.setTime(start + 10000);
    t.mock.timers.tick(0);
    assert.equal((await resumed)[0].activity.scene, 'standby');
    assert.deepEqual(scenes, ['standby', 'reading', 'standby']);
  } finally {
    observer?.close(); t.mock.timers.reset();
    await rm(directory, {recursive:true, force:true});
  }
});

test('observer publishes new atomic files and closes without writing session state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dragon-session-test-'));
  const events = new EventEmitter();
  let observer;
  try {
    await saveEvent(event('PreToolUse', {received_at:'2000-01-01T00:00:00.000Z', tool_use_id:'historical'}), directory);
    observer = await createSessionObserver(snapshot => events.emit('snapshot', snapshot), {directory});
    assert.equal(observer.snapshot().activity.activeCount, 0);
    assert.equal(observer.snapshot().connection.enabled, true);
    assert.equal(observer.snapshot().connection.lastReceivedAt, '2000-01-01T00:00:00.000Z');
    assert.equal(observer.snapshot().connection.lastObservedAt, null);
    assert.equal(observer.snapshot().connection.receivedCount, 0);
    const update = once(events, 'snapshot', {signal:AbortSignal.timeout(3000)});
    await saveEvent(event('UserPromptSubmit', {received_at:new Date().toISOString(), turn_id:'current'}), directory);
    const [snapshot] = await update;
    assert.equal(snapshot.activity.activeCount, 1);
    assert.equal(snapshot.activity.scene, 'thinking');
    assert.equal(snapshot.activity.toolCount, 0);
    assert.equal(snapshot.connection.receivedCount, 1);
    assert.equal(snapshot.connection.lastObservedAt, snapshot.sessions[0].last_received_at);
    observer.close();
    const last = observer.snapshot();
    await saveEvent(event('SessionEnd', {received_at:new Date().toISOString()}), directory);
    assert.equal(observer.snapshot(), last);
  } finally {
    observer?.close();
    await rm(directory, {recursive:true, force:true});
  }
});

test('disabled observer keeps history without watching; re-enable starts fresh observation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dragon-session-switch-'));
  const events = new EventEmitter();
  let observer;
  try {
    await saveEvent(event('PreToolUse', {received_at:'2000-01-01T00:00:00.000Z', tool_use_id:'old', tool_name:'Bash'}), directory);
    let publications = 0;
    observer = await createSessionObserver(() => publications++, {directory, enabled:false});
    assert.equal(observer.snapshot().sessions.length, 1);
    assert.equal(observer.snapshot().activity.activeCount, 0);
    assert.equal(observer.snapshot().activity.scene, 'standby');
    assert.deepEqual(observer.snapshot().connection, {
      enabled:false, observedSince:null, lastReceivedAt:'2000-01-01T00:00:00.000Z',
      lastObservedAt:null, receivedCount:0,
    });
    // Another writer cannot make a disabled desktop resume activity.
    await saveEvent(event('PreToolUse', {received_at:'2001-01-01T00:00:00.000Z', session_id:'while-disabled', tool_use_id:'gap'}), directory);
    await delay(1100);
    assert.equal(publications, 1);
    assert.equal(observer.snapshot().sessions.length, 1);
    observer.close();
    observer = await createSessionObserver(snapshot => events.emit('snapshot', snapshot), {directory, enabled:true});
    assert.equal(observer.snapshot().sessions.length, 2);
    assert.equal(observer.snapshot().activity.activeCount, 0);
    assert.equal(observer.snapshot().connection.lastReceivedAt, '2001-01-01T00:00:00.000Z');
    assert.equal(observer.snapshot().connection.receivedCount, 0);
    const update = once(events, 'snapshot', {signal:AbortSignal.timeout(3000)});
    await saveEvent(event('PreToolUse', {received_at:new Date().toISOString(), session_id:'fresh', tool_use_id:'new', tool_name:'Bash'}), directory);
    const [snapshot] = await update;
    assert.equal(snapshot.activity.toolCount, 1);
    assert.equal(snapshot.activity.scene, 'work');
    assert.equal(snapshot.connection.receivedCount, 1);
  } finally {
    observer?.close();
    await rm(directory, {recursive:true, force:true});
  }
});

test('long logs keep historical and stopped sessions as summaries, including unanswered questions', async t => {
  const start=Date.parse('2030-01-01T00:00:00.000Z');
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:start});
  const directory=await mkdtemp(join(tmpdir(),'dragon-summary-memory-'));
  const updates=new EventEmitter();
  let observer, index=0;
  const make=(name, extra={})=>event(name,{event_id:`long-${String(index).padStart(6,'0')}`,
    received_at:new Date(start+index++).toISOString(),...extra});
  const write=async events=>{
    for(let offset=0;offset<events.length;offset+=32) {
      await Promise.all(events.slice(offset,offset+32).map(item=>saveEvent(item,directory)));
    }
  };
  try {
    const history=[make('UserPromptSubmit',{received_at:'2000-01-01T00:00:00.000Z'})];
    for(let i=0;i<500;i++) {
      history.push(make('PreToolUse',{tool_use_id:`old-${i}`,received_at:'2000-01-01T00:00:00.001Z'}),
        make('PostToolUse',{tool_use_id:`old-${i}`,received_at:'2000-01-01T00:00:00.002Z'}));
    }
    history.push(make('Stop',{received_at:'2000-01-01T00:00:00.003Z'}));
    await write(history);
    observer=await createSessionObserver(snapshot=>updates.emit('snapshot',snapshot),{directory});
    assert.deepEqual(observer.retainedCounts(),{events:0,indexedFiles:history.length,sessions:1,liveSessions:0,turns:0,tools:0});
    assert.equal(observer.snapshot().sessions[0].state,'unknown');
    assert.equal(observer.snapshot().activity.scene,'standby');

    const observed=[make('UserPromptSubmit',{turn_id:'new-turn'})];
    for(let i=0;i<500;i++) {
      const call={turn_id:'new-turn',tool_use_id:`new-${i}`,tool_name:'Read',tool_kind:'read'};
      observed.push(make('PreToolUse',call),make('PostToolUse',call));
    }
    const question={turn_id:'new-turn',tool_use_id:'question',tool_name:'request_user_input_async',input_question_count:2};
    observed.push(make('PreToolUse',question),make('PostToolUse',{...question,input_request_accepted:true}),
      make('Stop',{turn_id:'new-turn'}));
    await write(observed);
    const changed=once(updates,'snapshot');t.mock.timers.tick(3000);
    const snapshot=(await changed)[0];
    assert.equal(snapshot.activity.scene,'reading');
    assert.equal(snapshot.activity.pendingInputCount,2);
    assert.equal(snapshot.sessions[0].state,'stop_observed');
    assert.equal(snapshot.connection.receivedCount,observed.length);
    assert.deepEqual(observer.retainedCounts(),{events:0,indexedFiles:history.length+observed.length,
      sessions:1,liveSessions:0,turns:0,tools:0});
    assert.equal(snapshot.sessions[0].tools.length,0);
    assert.ok(!('turns' in snapshot.sessions[0]));
  } finally {
    observer?.close();t.mock.timers.reset();await rm(directory,{recursive:true,force:true});
  }
});

test('incremental scans and session rebuilds match batch state through delayed writes and exact replies', async t => {
  const start=Date.parse('2030-01-01T00:00:00.000Z');
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:start});
  const directory=await mkdtemp(join(tmpdir(),'dragon-incremental-scan-'));
  const updates=new EventEmitter();
  const recorded=[];
  let observer;
  const at=(name,time,extra={})=>event(name,{received_at:new Date(start+time).toISOString(),...extra});
  const question={tool_use_id:'question',tool_name:'request_user_input_async',input_question_count:2};
  const child={turn_id:'child',agent_id:'agent'};
  try {
    observer=await createSessionObserver(snapshot=>updates.emit('snapshot',snapshot),{directory});
    const check=async batch=>{
      const previous=observer.snapshot().activity.scene;
      for(const item of batch) await saveEvent(item,directory);
      recorded.push(...batch);
      const changed=once(updates,'snapshot');t.mock.timers.tick(1000);
      const actual=(await changed)[0];
      const expected=projectSessions([],recorded,new Date(start).toISOString(),previous,Date.now());
      const {connection,...projection}=actual;
      assert.deepEqual(projection,expected);
      assert.equal(connection.receivedCount,recorded.length);
      return actual;
    };
    let snapshot=await check([at('UserPromptSubmit',1),
      at('PreToolUse',2,{tool_use_id:'read',tool_name:'Read',tool_kind:'read'}),
      at('PreToolUse',3,question),at('PostToolUse',4,{...question,input_request_accepted:true}),at('Stop',5)]);
    assert.equal(snapshot.activity.pendingInputCount,2);
    assert.equal(observer.retainedCounts().liveSessions,0);

    // Resuming a released session must still remember exact question replies and
    // old call identities. An output arriving late does not revive the old call.
    snapshot=await check([at('UserPromptSubmit',1001,{turn_id:'next',
      input_replies:[{tool_use_id:'question',question_index:0}]}),
      at('PostToolUse',6,{tool_use_id:'read'}),
      at('PostToolUse',1002,{...question,input_request_accepted:true}),
      at('SubagentStart',1003,child),at('PreToolUse',1004,{...child,tool_use_id:'child-tool',tool_name:'Bash'}),
      at('Stop',1005,{turn_id:'next'})]);
    assert.equal(snapshot.activity.pendingInputCount,1);
    assert.equal(snapshot.activity.agentCount,1);
    assert.equal(observer.retainedCounts().liveSessions,1);

    // This timestamp belongs inside the already reduced live session. Replay
    // must preserve a child working after the root stops and the question pose.
    snapshot=await check([at('Interrupt',7),at('PreToolUse',2001,{tool_use_id:'read',tool_name:'Read'})]);
    assert.equal(snapshot.activity.toolCount,1);
    assert.equal(snapshot.activity.pendingInputCount,1);

    snapshot=await check([at('UserPromptSubmit',3001,{turn_id:'last',
      input_replies:[{tool_use_id:'question',question_index:1}]}),
      at('SubagentStop',3002,child),at('Interrupt',3003,{turn_id:'last'})]);
    assert.equal(snapshot.activity.pendingInputCount,0);
    assert.equal(observer.retainedCounts().liveSessions,0);

    snapshot=await check([at('PostToolUse',4001,{...question,input_request_accepted:true})]);
    assert.equal(snapshot.activity.pendingInputCount,0);
    assert.equal(snapshot.activity.scene,'standby');
    snapshot=await check([at('SessionEnd',5001,{turn_id:undefined})]);
    assert.equal(snapshot.sessions[0].state,'session_ended');
    assert.equal(observer.retainedCounts().tools,0);
  } finally {
    observer?.close();t.mock.timers.reset();await rm(directory,{recursive:true,force:true});
  }
});

test('live observer excludes a transient fork started before launch and retains normal tasks', async t => {
  const start=Date.parse('2030-01-01T00:00:00.000Z');
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:start});
  const directory=await mkdtemp(join(tmpdir(),'dragon-transient-fork-'));
  const updates=new EventEmitter();
  let observer;
  const at=(name,time,extra={})=>event(name,{received_at:new Date(start+time).toISOString(),...extra});
  try {
    await saveEvent(at('SessionStart',-100,{turn_id:undefined,source:'fork',has_transcript_path:false}),directory);
    observer=await createSessionObserver(snapshot=>updates.emit('snapshot',snapshot),{directory});
    assert.deepEqual(observer.snapshot().sessions,[]);
    const check=async batch=>{
      for(const item of batch)await saveEvent(item,directory);
      const changed=once(updates,'snapshot');t.mock.timers.tick(1000);
      return (await changed)[0];
    };
    let view=await check([at('UserPromptSubmit',1)]);
    assert.equal(view.activity.scene,'standby');
    assert.equal(view.connection.receivedCount,1);
    assert.deepEqual(view.sessions,[]);

    view=await check([at('SessionStart',1001,{session_id:'formal',turn_id:undefined,source:'fork',has_transcript_path:true}),
      at('UserPromptSubmit',1002,{session_id:'formal'})]);
    assert.equal(view.activity.scene,'thinking');
    assert.equal(view.activity.activeCount,1);
    assert.deepEqual(view.sessions.map(session=>session.session_id),['formal']);

    view=await check([at('Interrupt',2001),at('SessionEnd',2002,{turn_id:undefined})]);
    assert.equal(view.activity.activeCount,1);
    assert.equal(observer.retainedCounts().liveSessions,1);
    view=await check([at('Stop',3001,{session_id:'formal'})]);
    assert.equal(view.activity.scene,'standby');
    assert.equal(view.activity.activeCount,0);
    assert.equal(observer.retainedCounts().liveSessions,0);
  } finally {
    observer?.close();t.mock.timers.reset();await rm(directory,{recursive:true,force:true});
  }
});
