import test from 'node:test';
import assert from 'node:assert/strict';
import {reduceEvents} from './state.mjs';

const event = (name, n, extra={}) => ({hook_event_name:name, event_id:`e${n}`,
  received_at:`2026-11-01T00:00:${String(n).padStart(2,'0')}.000Z`,
  session_id:'s1', turn_id:'t1', ...extra});
const current = output => output.sessions[0].turns.find(t => t.turn_id===output.sessions[0].current_turn_id);
const questionEvent = (name, n, extra={}) => event(name,n,{
  tool_name:'request_user_input_async', tool_use_id:'question-a', input_question_count:1, ...extra,
});

test('parallel calls are paired by call ID, sessions do not end each other', () => {
  const output = reduceEvents([
    event('UserPromptSubmit',1),
    event('PreToolUse',2,{tool_use_id:'a',tool_name:'Bash'}),
    event('PreToolUse',3,{tool_use_id:'b',tool_name:'web.run'}),
    event('PreToolUse',4,{session_id:'s2',tool_use_id:'a'}),
    event('PostToolUse',5,{tool_use_id:'a'}),
  ]);
  assert.equal(current(output).active_tools,1);
  assert.equal(output.sessions[0].state,'tool_running');
  assert.equal(output.summary.active_tools,2);
});

test('an out-of-order Pre does not revive an already completed tool or subagent', () => {
  const output = reduceEvents([
    event('PostToolUse',1,{tool_use_id:'a'}),
    event('PreToolUse',2,{tool_use_id:'a'}),
    event('SubagentStop',3,{agent_id:'child'}),
    event('SubagentStart',4,{agent_id:'child'}),
  ]);
  assert.equal(output.summary.active_tools,0);
  assert.equal(output.summary.active_agents,0);
  assert.equal(current(output).tools[0].state,'output_observed');
});

test('late old-turn events never replace the newer prompted turn', () => {
  const output = reduceEvents([
    event('UserPromptSubmit',1),
    event('PreToolUse',2,{tool_use_id:'old'}),
    event('UserPromptSubmit',3,{turn_id:'t2'}),
    event('PreToolUse',4,{turn_id:'t2',tool_use_id:'new'}),
    event('PostToolUse',5,{tool_use_id:'old'}),
    event('Stop',6),
    event('UserPromptSubmit',7),
  ]);
  assert.equal(output.sessions[0].current_turn_id,'t2');
  assert.equal(output.sessions[0].state,'tool_running');
  assert.equal(output.summary.active_tools,1);
});

test('subagents are independent and stopping one does not finish its parent', () => {
  const output = reduceEvents([
    event('UserPromptSubmit',1),
    event('SubagentStart',2,{agent_id:'a',agent_type:'review'}),
    event('SubagentStart',3,{agent_id:'b',agent_type:'review'}),
    event('SubagentStop',4,{agent_id:'a'}),
  ]);
  assert.equal(current(output).active_agents,1);
  assert.equal(output.sessions[0].state,'agent_running');
});

test('independent child turns retain the root turn and survive its Stop until each child stops', () => {
  const childA={turn_id:'child-turn-a',agent_id:'child-a'};
  const childB={turn_id:'child-turn-b',agent_id:'child-b'};
  const events=[
    event('UserPromptSubmit',1),
    event('PreToolUse',2,{tool_use_id:'root-tool'}),
    event('SubagentStart',3,childA),
    event('PreToolUse',4,{...childA,tool_use_id:'child-tool-a'}),
    event('SubagentStart',5,childB),
    event('PreToolUse',6,{...childB,tool_use_id:'child-tool-b'}),
    event('UserPromptSubmit',7,childA),
  ];
  let output=reduceEvents(events);
  assert.equal(output.sessions[0].current_turn_id,'t1');
  assert.equal(output.summary.active_tools,3);
  assert.equal(output.summary.active_agents,2);

  const childStopsFirst=reduceEvents([...events,event('SubagentStop',8,childA)]);
  assert.equal(current(childStopsFirst).state,'tool_running');
  assert.equal(childStopsFirst.summary.active_agents,1);
  assert.deepEqual(childStopsFirst.sessions[0].tools.map(tool=>tool.tool_use_id),['root-tool','child-tool-b']);

  events.push(event('Stop',8));
  output=reduceEvents(events);
  assert.equal(current(output).state,'stop_observed');
  assert.equal(output.sessions[0].state,'tool_running');
  assert.equal(output.summary.active_tools,2);
  assert.equal(output.summary.active_agents,2);

  events.push(event('SubagentStop',9,childA));
  output=reduceEvents(events);
  const stoppedChild=output.sessions[0].turns.find(turn=>turn.turn_id===childA.turn_id);
  assert.equal(stoppedChild.state,'stop_observed');
  assert.equal(stoppedChild.tools[0].state,'stop_observed');
  assert.deepEqual(output.sessions[0].tools.map(tool=>tool.tool_use_id),['child-tool-b']);
  assert.equal(output.summary.active_agents,1);

  events.push(event('SubagentStop',10,childB));
  output=reduceEvents(events);
  assert.equal(output.sessions[0].current_turn_id,'t1');
  assert.equal(output.sessions[0].state,'stop_observed');
  assert.equal(output.summary.activity_observed_sessions,0);
  assert.equal(output.summary.active_tools,0);
  assert.equal(output.summary.active_agents,0);
});

test('child-only hooks report activity without inventing a root; late stopped calls do not resume it', () => {
  const child={turn_id:'child-turn',agent_id:'child'};
  const events=[event('SubagentStart',1,child)];
  let output=reduceEvents(events);
  assert.equal(output.sessions[0].current_turn_id,null);
  assert.equal(output.sessions[0].state,'agent_running');
  assert.equal(output.summary.active_agents,1);

  events.push(event('PreToolUse',2,{...child,tool_use_id:'child-tool'}),
    event('SubagentStop',3,child),
    event('SubagentStart',4,child),
    event('PreToolUse',5,{...child,tool_use_id:'child-tool'}),
    event('PostToolUse',6,{...child,tool_use_id:'child-tool'}));
  output=reduceEvents(events);
  assert.equal(output.sessions[0].current_turn_id,null);
  assert.equal(output.summary.activity_observed_sessions,0);
  assert.equal(output.summary.active_tools,0);
  assert.equal(output.summary.active_agents,0);
  assert.equal(output.sessions[0].turns[0].state,'stop_observed');
});

test('a new root excludes old root agents while retaining a running independent child', () => {
  const output=reduceEvents([
    event('UserPromptSubmit',1),
    event('SubagentStart',2,{agent_id:'old-root-agent'}),
    event('PreToolUse',3,{tool_use_id:'old-root-tool'}),
    event('SubagentStart',4,{turn_id:'child-turn',agent_id:'independent-child'}),
    event('PreToolUse',5,{turn_id:'child-turn',agent_id:'independent-child',tool_use_id:'child-tool'}),
    event('UserPromptSubmit',6,{turn_id:'new-root'}),
  ]);
  assert.equal(output.sessions[0].current_turn_id,'new-root');
  assert.equal(output.summary.active_agents,1);
  assert.equal(output.summary.active_tools,1);
  assert.deepEqual(output.sessions[0].tools.map(tool=>tool.tool_use_id),['child-tool']);
});

test('PermissionRequest and Stop remain observations; later tool use may continue', () => {
  const events=[event('UserPromptSubmit',1),event('PermissionRequest',2,{tool_name:'Bash'})];
  assert.equal(reduceEvents(events).sessions[0].state,'permission_requested');
  events.push(event('Stop',3,{stop_hook_active:false}));
  const stopped=reduceEvents(events);
  assert.equal(stopped.sessions[0].state,'stop_observed');
  assert.equal(stopped.summary.permission_requests_observed,1);
  assert.ok(!JSON.stringify(stopped).includes('success'));
  events.push(event('PreToolUse',4,{tool_use_id:'continued'}));
  assert.equal(reduceEvents(events).sessions[0].state,'tool_running');
});

test('Stop clears remaining tool and subagent activity without claiming success', () => {
  const output=reduceEvents([
    event('UserPromptSubmit',1),
    event('PreToolUse',2,{tool_use_id:'tool'}),
    event('SubagentStart',3,{agent_id:'child'}),
    event('Stop',4,{stop_hook_active:false}),
  ]);
  assert.equal(output.sessions[0].state,'stop_observed');
  assert.equal(current(output).active_tools,0);
  assert.equal(current(output).active_agents,0);
  assert.equal(current(output).tools[0].state,'stop_observed');
  assert.equal(current(output).agents[0].state,'stop_observed');
  assert.equal(output.summary.activity_observed_sessions,0);
  assert.equal(output.summary.active_tools,0);
  assert.equal(output.summary.active_agents,0);
  assert.equal(output.summary.stop_observed_sessions,1);
  assert.ok(!JSON.stringify(output).includes('success'));
});

test('late old calls cannot resume a stopped turn; a new call resumes only its own activity', () => {
  const events=[
    event('UserPromptSubmit',1),
    event('PreToolUse',2,{tool_use_id:'old'}),
    event('SubagentStart',3,{agent_id:'child'}),
    event('Stop',4),
    event('PreToolUse',5,{tool_use_id:'old'}),
    event('PostToolUse',6,{tool_use_id:'old'}),
    event('SubagentStart',7,{agent_id:'child'}),
    event('SubagentStop',8,{agent_id:'child'}),
  ];
  const stopped=reduceEvents(events);
  assert.equal(stopped.sessions[0].state,'stop_observed');
  assert.equal(stopped.summary.activity_observed_sessions,0);
  assert.equal(stopped.summary.active_tools,0);
  assert.equal(stopped.summary.active_agents,0);

  const resumed=reduceEvents([...events,event('PreToolUse',9,{tool_use_id:'new'})]);
  assert.equal(resumed.sessions[0].state,'tool_running');
  assert.deepEqual(current(resumed).tools.filter(tool=>tool.state==='running').map(tool=>tool.tool_use_id),['new']);
  assert.equal(resumed.summary.active_tools,1);
  assert.equal(resumed.summary.active_agents,0);
});

test('interrupt closes activity and late tool output cannot revive the turn', () => {
  const output = reduceEvents([
    event('UserPromptSubmit',1),event('PreToolUse',2,{tool_use_id:'a'}),
    event('SubagentStart',3,{agent_id:'child'}),event('Interrupt',4),
    event('PostToolUse',5,{tool_use_id:'a'}),event('PreToolUse',6,{tool_use_id:'late'}),
  ]);
  assert.equal(output.sessions[0].state,'interrupted');
  assert.equal(output.summary.active_tools,0);
  assert.equal(output.summary.active_agents,0);
});

test('SessionEnd closes all turns; a later new prompt can start a new turn', () => {
  const events=[event('PreToolUse',1,{tool_use_id:'a'}),event('SessionEnd',2,{turn_id:undefined})];
  assert.equal(reduceEvents(events).sessions[0].state,'session_ended');
  events.push(event('UserPromptSubmit',3,{turn_id:'t2'}));
  assert.equal(reduceEvents(events).sessions[0].state,'activity_observed');
});

test('missing call identities remain unpaired; metadata output cannot leak input bodies', () => {
  const output = reduceEvents([
    event('PreToolUse',1,{tool_name:'Bash',tool_input:{command:'SECRET'},transcript_path:'/secret'}),
    event('PostToolUse',2,{tool_response:'SECRET'}),
    event('PermissionRequest',3,{tool_input:{command:'SECRET'}}),
  ]);
  assert.equal(output.summary.unpaired_events,2);
  assert.equal(output.summary.active_tools,0);
  assert.ok(!JSON.stringify(output).includes('SECRET'));
  assert.ok(!JSON.stringify(output).includes('/secret'));
});

test('duplicate deliveries are ignored and compaction without turn ID is visible', () => {
  const e=event('PermissionRequest',1);
  const events=[e,e,event('PreCompact',2,{turn_id:undefined})];
  assert.equal(reduceEvents(events).summary.permission_requests_observed,1);
  assert.equal(reduceEvents(events).sessions[0].state,'compacting');
  events.push(event('PostCompact',3,{turn_id:undefined}));
  assert.equal(reduceEvents(events).sessions[0].state,'permission_requested');
});

test('current-turn stop or interrupt clears compaction even without a PostCompact hook', () => {
  for (const [name, expected] of [['Interrupt','interrupted'],['Stop','stop_observed']]) {
    const output=reduceEvents([
      event('UserPromptSubmit',1),
      event('PreCompact',2,{turn_id:undefined}),
      event(name,3),
    ]);
    assert.equal(output.sessions[0].state,expected);
    assert.equal(output.summary.activity_observed_sessions,0);
  }
});

test('new prompted turns and session closure clear previous session-level compaction', () => {
  const events=[event('UserPromptSubmit',1),event('PreCompact',2,{turn_id:undefined})];
  assert.equal(reduceEvents([...events,event('UserPromptSubmit',3,{turn_id:'t2'})]).sessions[0].state,
    'activity_observed');
  const ended=[...events,event('SessionEnd',3,{turn_id:undefined})];
  assert.equal(reduceEvents(ended).sessions[0].state,'session_ended');
  // SessionStart itself does not clear the compaction flag; closure must clear it.
  assert.notEqual(reduceEvents([...ended,event('SessionStart',4,{turn_id:undefined})]).sessions[0].state,
    'compacting');
});

test('old-turn interrupts, stops and repeated prompts cannot clear current-turn compaction', () => {
  const currentCompact=[
    event('UserPromptSubmit',1),
    event('UserPromptSubmit',2,{turn_id:'t2'}),
    event('PreCompact',3,{turn_id:undefined}),
  ];
  for (const name of ['Interrupt','Stop','UserPromptSubmit']) {
    const output=reduceEvents([...currentCompact,event(name,4)]);
    assert.equal(output.sessions[0].current_turn_id,'t2');
    assert.equal(output.sessions[0].state,'compacting');
  }
});

test('accepted async input remains pending after its immediate tool response', () => {
  const events=[event('UserPromptSubmit',1),questionEvent('PreToolUse',2)];
  assert.equal(reduceEvents(events).sessions[0].pending_input_count,0);

  events.push(questionEvent('PostToolUse',3,{input_request_accepted:true}));
  const output=reduceEvents(events);
  assert.deepEqual(output.sessions[0].pending_inputs,[{
    tool_use_id:'question-a', turn_id:'t1', pending_count:1,
    requested_at:events[1].received_at,
  }]);
  assert.equal(output.sessions[0].pending_input_count,1);
  assert.equal(output.sessions[0].state,'activity_observed');
  assert.equal(output.summary.active_tools,0);
});

test('question count can come from Pre; an observed Post alone can establish accepted input', () => {
  const output=reduceEvents([
    questionEvent('PreToolUse',1,{input_question_count:2}),
    questionEvent('PostToolUse',2,{input_question_count:undefined,input_request_accepted:true}),
    questionEvent('PostToolUse',3,{tool_use_id:'question-b',input_request_accepted:true}),
  ]);
  assert.deepEqual(output.sessions[0].pending_inputs,[
    {tool_use_id:'question-a',turn_id:'t1',pending_count:2,requested_at:event('',1).received_at},
    {tool_use_id:'question-b',turn_id:'t1',pending_count:1,requested_at:event('',3).received_at},
  ]);
  assert.equal(output.sessions[0].pending_input_count,3);
});

test('only a verified accepted request with a known positive question count becomes pending', () => {
  const output=reduceEvents([
    questionEvent('PreToolUse',1,{input_request_accepted:true}),
    questionEvent('PostToolUse',2,{tool_use_id:'old',input_question_count:undefined}),
    questionEvent('PostToolUse',3,{tool_use_id:'rejected',input_request_accepted:false}),
    questionEvent('PostToolUse',4,{tool_use_id:'unknown-count',input_question_count:undefined,input_request_accepted:true}),
    questionEvent('PostToolUse',5,{tool_use_id:'empty',input_question_count:0,input_request_accepted:true}),
    questionEvent('PostToolUse',6,{tool_use_id:'other-tool',tool_name:'Bash',input_request_accepted:true}),
    event('PermissionRequest',7,{tool_name:'request_user_input_async'}),
  ]);
  assert.equal(output.sessions[0].pending_input_count,0);
  assert.deepEqual(output.sessions[0].pending_inputs,[]);
});

test('ordinary prompts, other tools, Stop and Interrupt cannot resolve an async question', () => {
  const events=[
    event('UserPromptSubmit',1),
    questionEvent('PreToolUse',2),
    questionEvent('PostToolUse',3,{input_request_accepted:true}),
    event('PreToolUse',4,{tool_use_id:'other',tool_name:'Bash'}),
    event('PostToolUse',5,{tool_use_id:'other',tool_name:'Bash'}),
    event('Stop',6),
    event('UserPromptSubmit',7,{turn_id:'t2'}),
    event('Interrupt',8,{turn_id:'t2'}),
  ];
  for (let length=3;length<=events.length;length++) {
    assert.equal(reduceEvents(events.slice(0,length)).sessions[0].pending_input_count,1);
  }
  const output=reduceEvents(events);
  assert.equal(output.sessions[0].state,'interrupted');
  assert.equal(output.summary.active_tools,0);

  const answered=reduceEvents([...events,event('UserPromptSubmit',9,{
    turn_id:'t3',input_replies:[{tool_use_id:'question-a',question_index:0}],
  })]);
  assert.equal(answered.sessions[0].pending_input_count,0);
  assert.deepEqual(answered.sessions[0].pending_inputs,[]);
  assert.equal(answered.sessions[0].current_turn_id,'t3');
});

test('question replies resolve exact call and session IDs, and each question separately', () => {
  const events=[
    questionEvent('PostToolUse',1,{input_question_count:3,input_request_accepted:true}),
    questionEvent('PostToolUse',2,{tool_use_id:'question-b',input_request_accepted:true}),
    questionEvent('PostToolUse',3,{session_id:'s2',input_request_accepted:true}),
    event('UserPromptSubmit',4,{turn_id:'t2',input_replies:[
      {tool_use_id:'question-a',question_index:1},
      {tool_use_id:'question-a',question_index:1},
      {tool_use_id:'unknown',question_index:0},
      {tool_use_id:'question-a',question_index:9},
    ]}),
  ];
  let output=reduceEvents(events);
  assert.equal(output.sessions[0].pending_input_count,3);
  assert.deepEqual(output.sessions[0].pending_inputs.map(request=>[request.tool_use_id,request.pending_count]),[
    ['question-a',2],['question-b',1],
  ]);
  assert.equal(output.sessions[1].pending_input_count,1);

  events.push(event('UserPromptSubmit',5,{turn_id:'t3',input_replies:[
    {tool_use_id:'question-a',question_index:0},{tool_use_id:'question-a',question_index:2},
  ]}));
  output=reduceEvents(events);
  assert.deepEqual(output.sessions[0].pending_inputs.map(request=>request.tool_use_id),['question-b']);
  assert.equal(output.sessions[1].pending_input_count,1);
});

test('duplicate acceptances and replies do not reopen or double count resolved questions', () => {
  const accepted=questionEvent('PostToolUse',1,{input_request_accepted:true});
  const reply=event('UserPromptSubmit',2,{turn_id:'t2',input_replies:[{tool_use_id:'question-a',question_index:0}]});
  const output=reduceEvents([
    accepted,accepted,reply,reply,
    questionEvent('PostToolUse',3,{input_request_accepted:true}),
    questionEvent('PreToolUse',4),
    event('UserPromptSubmit',5,{turn_id:'t3',input_replies:reply.input_replies}),
  ]);
  assert.equal(output.sessions[0].pending_input_count,0);
  assert.deepEqual(output.sessions[0].pending_inputs,[]);
});

test('input replies on non-prompt events do not resolve questions', () => {
  const output=reduceEvents([
    questionEvent('PostToolUse',1,{input_request_accepted:true}),
    event('PostToolUse',2,{tool_use_id:'other',input_replies:[{tool_use_id:'question-a',question_index:0}]}),
  ]);
  assert.equal(output.sessions[0].pending_input_count,1);
});

test('SessionEnd discards pending questions and late outputs cannot reopen them', () => {
  const events=[
    questionEvent('PostToolUse',1,{input_request_accepted:true}),
    event('SessionEnd',2,{turn_id:undefined}),
    questionEvent('PostToolUse',3,{input_request_accepted:true}),
    event('UserPromptSubmit',4,{turn_id:'t2'}),
  ];
  assert.equal(reduceEvents(events).sessions[0].pending_input_count,0);
  assert.equal(reduceEvents(events).sessions[0].state,'activity_observed');
});
