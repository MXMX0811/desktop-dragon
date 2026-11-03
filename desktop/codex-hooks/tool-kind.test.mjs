import test from 'node:test';
import assert from 'node:assert/strict';
import {toolKind, kindScene} from './tool-kind.mjs';
import {metadata} from './store.mjs';
import {reduceEvents} from './state.mjs';

test('file search and source inspection stay reading through ordinary shell syntax', () => {
  for (const command of [
    "rg -n 'state|scene' app", 'rg --files app | head -35',
    "cd '/project with spaces' && /usr/bin/grep -n state *.js",
    'find app -name "*.js"', 'git grep state',
  ]) assert.equal(toolKind('Bash', {command}), 'search', command);
  for (const command of ['cat AGENTS.md', "sed -n '1,95p' src/main.js", 'git diff --stat', 'ls -l app']) {
    assert.equal(toolKind('Bash', {command}), 'read', command);
  }
});

test('mixed writes, arbitrary scripts and command substitutions are general work', () => {
  for (const command of [
    'rg state app && npm test', 'cat a > b', 'sed -i s/a/b/ file',
    'find . -delete', 'find . -exec rm {} \\;', 'rg --pre converter text',
    'python3 script.py', 'cat $(generate-file)', 'cat `generate-file`',
    'cat a\nnode script.js', 'node -e "console.log(\'rg search\')"',
    'cd /project',
  ]) assert.equal(toolKind('Bash', {command}), 'command', command);
  assert.equal(kindScene(toolKind('unverified-search')), 'work');
});

test('only category reaches storage and projection, never search content or filenames', () => {
  const event = metadata({hook_event_name:'PreToolUse', session_id:'s', turn_id:'t',
    tool_use_id:'call', tool_name:'Bash',
    tool_input:{command:"rg 'SECRET_QUERY' /SECRET_PATH"},tool_response:{output:'SECRET_CONTENT'}});
  assert.equal(event.tool_kind, 'search');
  assert.ok(!JSON.stringify(event).includes('SECRET'));
  const tool = reduceEvents([event]).sessions[0].turns[0].tools[0];
  assert.equal(tool.tool_kind, 'search');
  assert.equal(kindScene(tool.tool_kind), 'reading');
  assert.ok(!JSON.stringify(tool).includes('SECRET'));
});
