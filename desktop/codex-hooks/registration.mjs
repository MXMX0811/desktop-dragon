import {readFile} from 'node:fs/promises';
import {hookEvents} from './store.mjs';

// Inspect our receiver's registrations without changing other integrations.
const receiver = /[/\\]desktop[/\\]codex-hooks[/\\]receive\.mjs(?=["'\s]|$)/;
export function registeredEvents(config) {
 return hookEvents.filter(event => (config.hooks?.[event] ?? []).some(group =>
  (group.hooks ?? []).some(hook => hook.type === 'command' &&
   [hook.command, hook.commandWindows].some(command => typeof command === 'string' && receiver.test(command)))));
}
export async function readRegistration(file) {
 try {
  const config = JSON.parse(await readFile(file, 'utf8'));
  return {eventCount:registeredEvents(config).length, total:hookEvents.length, error:null};
 } catch (error) {
  return {eventCount:0, total:hookEvents.length, error:error.code === 'ENOENT' ? null : error.message};
 }
}
