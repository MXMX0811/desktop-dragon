import {mkdir, writeFile, rename, readdir, readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {toolKind} from './tool-kind.mjs';

export const dataDirectory = fileURLToPath(new URL('../../.local/codex-hooks/', import.meta.url));
export const hookEvents = ['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse',
  'PermissionRequest','SubagentStart','SubagentStop','PreCompact','PostCompact','Stop','Interrupt','SessionEnd'];
const stringFields = ['session_id','turn_id','tool_use_id','tool_name','agent_id','agent_type',
  'source','trigger','model','permission_mode','reason'];

export function metadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !hookEvents.includes(input.hook_event_name) || typeof input.session_id !== 'string' || !input.session_id) {
    throw new Error('Invalid hook event or session_id');
  }
  const event = {event_id:randomUUID(),received_at:new Date().toISOString(),hook_event_name:input.hook_event_name};
  for (const field of stringFields) if (typeof input[field] === 'string') event[field]=input[field];
  if (typeof input.tool_name === 'string') event.tool_kind=toolKind(input.tool_name,input.tool_input);
  if (typeof input.stop_hook_active === 'boolean') event.stop_hook_active=input.stop_hook_active;
  event.has_transcript_path=typeof input.transcript_path==='string' && Boolean(input.transcript_path);
  for (const key of ['tool_input','tool_response']) {
    const value=input[key];
    event[`${key}_type`]=Array.isArray(value)?'array':value===null?'null':typeof value;
  }
  return event;
}

export async function saveEvent(event, directory=dataDirectory) {
  const events=join(directory,'events');
  await mkdir(events,{recursive:true,mode:0o700});
  const file=join(events,event.event_id);
  await writeFile(`${file}.tmp`,JSON.stringify(event)+'\n',{flag:'wx',mode:0o600});
  await rename(`${file}.tmp`,`${file}.json`);
}

export async function readEvents(directory=dataDirectory) {
  const folder=join(directory,'events');
  await mkdir(folder,{recursive:true,mode:0o700});
  const files=(await readdir(folder)).filter(name=>name.endsWith('.json'));
  const events=await Promise.all(files.map(async name=>JSON.parse(await readFile(join(folder,name),'utf8'))));
  return events.sort((a,b)=>a.received_at.localeCompare(b.received_at));
}
