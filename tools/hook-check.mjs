// Bounded, read-only observation of the already-installed CrossPet hook ledger.
// This is a diagnostic, not a desktop-dragon client adapter or a hook installer.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const [source, secondsText, output] = process.argv.slice(2);
const seconds = Number(secondsText);
if (!source || !output || !Number.isFinite(seconds) || seconds < 1 || seconds > 300) {
  throw new Error('Usage: node tools/hook-check.mjs <CrossPet events/codex.jsonl> <1..300 seconds> <report.json>');
}
const readLines = async () => (await readFile(source, 'utf8')).trim().split('\n').filter(Boolean);
const clean = line => {
  const row = JSON.parse(line);
  // Keep only the metadata CrossPet documents; never copy arguments or results.
  return {t:row.t, event:row.ev, tool:row.tool, sessionTag:row.sid,
    hasTurnId:row.turn, observerResult:row.result, observerDetail:row.detail};
};
let previous = await readLines();
const history = previous.map(clean), events = [], gaps = [];
const startedAt = new Date().toISOString(), deadline = performance.now() + seconds * 1000;
console.log(`Observing existing hook output for ${seconds}s. No client commands or configuration changes.`);
while (performance.now() < deadline) {
  await delay(250);
  const current = await readLines();
  let overlap = Math.min(previous.length, current.length);
  while (overlap > 0 && !previous.slice(-overlap).every((row, i) => row === current[i])) overlap--;
  if (previous.length && current.length && !overlap) gaps.push(new Date().toISOString());
  events.push(...current.slice(overlap).map(clean));
  previous = current;
}
const count = (rows, key) => rows.reduce((out, row) => {
  if (row[key]) out[row[key]] = (out[row[key]] || 0) + 1;
  return out;
}, {});
const report = {
  evidence:'existing trusted CrossPet hook ledger; not raw hook input',
  startedAt, endedAt:new Date().toISOString(), source,
  history, events, gaps,
  liveCounts:count(events, 'event'), liveToolCounts:count(events, 'tool'),
  limitations:[
    'Tool names are lowercased/truncated by CrossPet.',
    'sessionTag is CrossPet\'s shortened identifier; hasTurnId is only a boolean.',
    'No tool_use_id or raw turn_id: exact concurrent-tool pairing cannot be verified here.',
    'observerDetail is CrossPet\'s interpretation, not a Codex status enum.',
    'A missing event is not evidence that a client capability is unsupported.'
  ]
};
await mkdir(dirname(output), {recursive:true});
await writeFile(output, JSON.stringify(report, null, 2)+'\n', {mode:0o600});
console.log(JSON.stringify({output, liveEvents:events.length, liveCounts:report.liveCounts,
  liveToolCounts:report.liveToolCounts, gaps:gaps.length}, null, 2));
