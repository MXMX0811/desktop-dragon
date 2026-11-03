import {basename} from 'node:path';
import shellQuote from 'shell-quote';

const readTools = new Set([
  'view_image', 'mcp__codex_app__read_thread',
  'mcp__codex_apps__github__fetch_file', 'mcp__codex_apps__github__fetch',
  'mcp__codex_apps__github__get_repo',
]);
const searchTools = new Set([
  'webrun', 'mcp__codex_apps__github__search',
  'mcp__codex_apps__github__search_repositories',
]);
const readCommands = new Set(['cat', 'head', 'tail', 'ls', 'pwd', 'wc', 'file']);

function commandKind(words) {
  const name = basename(words[0] ?? '');
  const args = words.slice(1);
  if (['rg', 'grep'].includes(name) && !args.some(arg => /^--pre(?:=|$)/.test(arg))) return 'search';
  if (name === 'find' && !args.some(arg => /^-(?:exec|execdir|ok|okdir|delete|fprint|fprint0|fprintf)$/.test(arg))) return 'search';
  if (readCommands.has(name)) return 'read';
  // The range-print form used for source inspection; editing sed scripts are work.
  if (name === 'sed' && args[0] === '-n' && /^\d+(?:,\d+)?p$/.test(args[1] ?? '')) return 'read';
  if (name === 'git' && ['diff', 'status', 'log', 'show', 'ls-files'].includes(args[0])) return 'read';
  if (name === 'git' && args[0] === 'grep') return 'search';
  if (name === 'cd') return 'directory';
  return 'command';
}

function shellKind(command) {
  // Scripts, substitutions and redirection remain general command activity.
  // This classifier never executes the input or reads environment values.
  if (typeof command !== 'string' || /[\r\n`]|\$\(/.test(command)) return 'command';
  let tokens;
  try { tokens = shellQuote.parse(command, key => `$${key}`); }
  catch { return 'command'; }
  const parts = [[]];
  for (const token of tokens) {
    if (typeof token === 'string') parts.at(-1).push(token);
    else if (token.op === 'glob') parts.at(-1).push(token.pattern);
    else if (['|', '&&', '||', ';'].includes(token.op)) parts.push([]);
    else if ('comment' in token) break;
    else return 'command';
  }
  const kinds = parts.map(commandKind);
  if (kinds.includes('command')) return 'command';
  if (kinds.includes('search')) return 'search';
  return kinds.includes('read') ? 'read' : 'command';
}

/** Reduce input to an activity category in memory. Never persist the command. */
export function toolKind(name, input) {
  if (name === 'Bash') return shellKind(input?.command);
  if (readTools.has(name)) return 'read';
  if (searchTools.has(name)) return 'search';
  if (name === 'apply_patch') return 'edit';
  return 'unknown';
}

export function kindScene(kind) {
  return kind === 'read' || kind === 'search' ? 'reading' : 'work';
}
