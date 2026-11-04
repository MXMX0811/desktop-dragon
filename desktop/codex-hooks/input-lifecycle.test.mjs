import test from 'node:test';
import assert from 'node:assert/strict';
import {inputLifecycle} from './input-lifecycle.mjs';
import {metadata} from './store.mjs';

const reply=rows=>`<send_user_message_question_reply>\n${JSON.stringify(rows)}\n</send_user_message_question_reply>`;
const item=(call,index)=>JSON.stringify(['request_user_input_async',call,index]);

test('accepted async questions retain only bookkeeping, never question text',()=>{
 const row=metadata({session_id:'session',turn_id:'turn',hook_event_name:'PostToolUse',tool_name:'request_user_input_async',tool_use_id:'call',
  tool_input:{questions:[{title:'PRIVATE_QUESTION',options:['PRIVATE_OPTION']}]},tool_response:'{"accepted":true}'});
 assert.equal(row.input_question_count,1);assert.equal(row.input_request_accepted,true);
 assert.deepEqual(Object.keys(row).filter(key=>key.startsWith('input_')).sort(),['input_question_count','input_request_accepted']);
 assert.doesNotMatch(JSON.stringify(row),/PRIVATE_/);
});

test('only an explicit accepted result opens an async question',()=>{
 for(const response of ['not json','{}','{"accepted":false}','{"accepted":"true"}','null']){
  const row=inputLifecycle({hook_event_name:'PostToolUse',tool_name:'request_user_input_async',tool_input:{questions:[{}]},tool_response:response});
  assert.notEqual(row.input_request_accepted,true);
 }
 assert.deepEqual(inputLifecycle({hook_event_name:'PostToolUse',tool_name:'unrelated_tool',tool_response:'{"accepted":true}'}),{});
});

test('host reply stores exact call and index while discarding question and answer text',()=>{
 const row=metadata({session_id:'session',turn_id:'later-turn',hook_event_name:'UserPromptSubmit',
  prompt:reply([{questionItemId:item('call',0),question:'PRIVATE_QUESTION',answer:'PRIVATE_ANSWER'},{questionItemId:item('call',2),answer:'PRIVATE_SECOND'}])});
 assert.deepEqual(row.input_replies,[{tool_use_id:'call',question_index:0},{tool_use_id:'call',question_index:2}]);
 assert.doesNotMatch(JSON.stringify(row),/PRIVATE_/);
});

test('ordinary text, quoted envelopes and unrelated or malformed IDs do not resolve questions',()=>{
 const good=reply([{questionItemId:item('call',0)}]);
 const prompts=['I answered the question',`Here is an example: ${good}`,`${good}\nPlease review this XML`,reply({questionItemId:item('call',0)}),
  reply([{questionItemId:'broken'},{questionItemId:'["other","call",0]'},{questionItemId:item('call',-1)},{questionItemId:item('',0)}]),
  '<send_user_message_question_reply>not json</send_user_message_question_reply>'];
 for(const prompt of prompts)assert.equal(inputLifecycle({hook_event_name:'UserPromptSubmit',prompt}).input_replies,undefined);
 assert.equal(inputLifecycle({hook_event_name:'Stop',prompt:good}).input_replies,undefined);
});
