import {readEvents} from './store.mjs';
import {reduceEvents} from './state.mjs';
import {setTimeout as delay} from 'node:timers/promises';

const args=process.argv.slice(2);
if(args.some(arg=>!['--watch','--events'].includes(arg)))throw new Error('Supported options: --watch, --events');
let previous='';
do {
  const events=await readEvents();
  const text=JSON.stringify(args.includes('--events')?events:reduceEvents(events),null,2);
  if(text!==previous){console.log(text);previous=text;}
  if(!args.includes('--watch'))break;
  await delay(1000);
}while(true);
