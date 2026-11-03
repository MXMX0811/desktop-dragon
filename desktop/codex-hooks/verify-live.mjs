// Verify records produced by an actual Codex run, without writing synthetic events.
import assert from 'node:assert/strict';
import {readEvents} from './store.mjs';
import {reduceEvents} from './state.mjs';

const session=process.argv[2];
if(!session)throw new Error('Usage: node desktop/codex-hooks/verify-live.mjs <actual session_id>');
const events=(await readEvents()).filter(e=>e.session_id===session);
for(const name of ['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','Stop','SessionEnd']){
  assert.ok(events.some(e=>e.hook_event_name===name),`Missing actual event: ${name}`);
}
const starts=events.filter(e=>e.hook_event_name==='PreToolUse');
const outputs=events.filter(e=>e.hook_event_name==='PostToolUse');
assert.ok(starts.length>=3,'Need at least three actual tool invocations');
for(const start of starts){
  assert.ok(start.turn_id&&start.tool_use_id);
  assert.equal(outputs.filter(e=>e.turn_id===start.turn_id&&e.tool_use_id===start.tool_use_id).length,1);
}
const timeline=events.map((event,i)=>{
  const state=reduceEvents(events.slice(0,i+1));
  return {event:event.hook_event_name,tool:event.tool_name,
    state:state.sessions[0].state,activeTools:state.summary.active_tools};
});
assert.ok(timeline.some(e=>e.state==='tool_running'&&e.activeTools===1));
assert.equal(timeline.at(-1).state,'session_ended');
assert.equal(timeline.at(-1).activeTools,0);
console.log(JSON.stringify({verified:true,session_id:session,events:events.length,
  pairedTools:starts.length,tools:[...new Set(starts.map(e=>e.tool_name))],timeline},null,2));
