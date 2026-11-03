import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registeredEvents} from './registration.mjs';

test('counts only our receiver once per event and leaves the source untouched', () => {
 const own={type:'command',command:'"/opt/homebrew/bin/node" "/a project/desktop/codex-hooks/receive.mjs"'};
 const config={hooks:{PreToolUse:[{hooks:[{type:'command',command:'python3 crosspet-hook.py gpt'},own,own]}],
  PostToolUse:[{hooks:[{type:'command',commandWindows:'node "C:\\pet\\desktop\\codex-hooks\\receive.mjs"'}]}],
  Stop:[{hooks:[{type:'command',command:'node /another/receive.mjs'}]}]}};
 const before=JSON.stringify(config);
 assert.deepEqual(registeredEvents(config),['PreToolUse','PostToolUse']);
 assert.equal(JSON.stringify(config),before);
});
