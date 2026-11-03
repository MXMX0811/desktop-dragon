// Codex invokes this short-lived, read-only observer for each lifecycle event.
// Complete JSON is processed immediately, even when the host keeps stdin open.
import {metadata, saveEvent, dataDirectory} from './store.mjs';
import {isCaptureEnabled} from './control.mjs';

const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--data-dir')) throw new Error('Expected --data-dir <directory>');
const directory=args[1] || dataDirectory;
try{if(!await isCaptureEnabled(directory))process.exit(0);}
catch{process.stderr.write('desktop-dragon hook: unable to read capture switch\n');process.exit(1);}
let buffer='',finished=false;
const timer=setTimeout(()=>fail('Incomplete hook input after 2000ms'),2000);
function fail(message){
  if(finished)return;
  finished=true;clearTimeout(timer);
  process.stderr.write(`desktop-dragon hook: ${message}\n`);
  process.exit(1); // Never use exit 2, which can affect the client's operation.
}
async function accept(input){
  if(finished)return;
  finished=true;clearTimeout(timer);process.stdin.pause();
  try{
    // A stream can have opened before the user disabled capture.
    if(await isCaptureEnabled(directory))await saveEvent(metadata(input),directory);
    process.exit(0);
  }
  catch{process.stderr.write('desktop-dragon hook: unable to record metadata\n');process.exit(1);}
}
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{
  buffer+=chunk;
  if(Buffer.byteLength(buffer)>64*1024*1024){fail('Hook input too large');return;}
  let input;
  try{input=JSON.parse(buffer);}catch{return;}
  void accept(input);
});
process.stdin.on('end',()=>{if(!finished)fail('Invalid or incomplete hook JSON');});
process.stdin.on('error',()=>fail('Unable to read hook input'));
