import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readEvents} from './store.mjs';
import {isCaptureEnabled, setCaptureEnabled} from './control.mjs';

const script=fileURLToPath(new URL('./receive.mjs',import.meta.url));
function invoke(directory,input,{open=false,partial=false,beforeRemainder}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[script,'--data-dir',directory]);
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
    const timeout=setTimeout(()=>{child.kill();reject(new Error('Hook did not exit promptly'));},3500);
    child.on('error',reject);child.on('close',code=>{clearTimeout(timeout);resolve({code,stdout,stderr});});
    child.stdin.on('error',()=>{});
    const text=JSON.stringify(input);
    if(partial){
      child.stdin.write(text.slice(0,13));
      setTimeout(async()=>{
        try{await beforeRemainder?.();child.stdin.write(text.slice(13));}
        catch(error){child.kill();reject(error);}
      },beforeRemainder?100:20);
    }
    else child.stdin.write(text);
    if(!open&&!partial)child.stdin.end();
  });
}
test('complete fragmented JSON exits without stdin EOF, preserving IDs and excluding content',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dragon-hooks-'));
  try{
    const result=await invoke(dir,{hook_event_name:'PreToolUse',session_id:'s',turn_id:'t',tool_use_id:'call',
      tool_name:'Bash',prompt:'SECRET_PROMPT',transcript_path:'/secret/history',
      SECRET_PAYLOAD_KEY:'secret', tool_input:{command:'SECRET_COMMAND',SECRET_INPUT_KEY:1},
      tool_response:{output:'SECRET_RESULT',SECRET_RESULT_KEY:1}},{open:true,partial:true});
    assert.equal(result.code,0);assert.equal(result.stdout,'');assert.equal(result.stderr,'');
    const rows=await readEvents(dir);assert.equal(rows.length,1);assert.equal(rows[0].tool_use_id,'call');
    assert.equal(rows[0].tool_input_type,'object');assert.equal(rows[0].tool_response_type,'object');
    assert.ok(!('tool_input_keys' in rows[0]));assert.ok(!('payload_keys' in rows[0]));
    assert.ok(!JSON.stringify(rows).includes('SECRET'));
    assert.ok(!JSON.stringify(rows).includes('/secret/history'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('parallel hook processes preserve every complete event without partial JSON',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dragon-hooks-'));
  try{
    const results=await Promise.all(Array.from({length:16},(_,i)=>invoke(dir,{hook_event_name:'PostToolUse',
      session_id:`s${i%2}`,turn_id:'t',tool_use_id:`call${i}`,tool_name:'Bash'})));
    assert.ok(results.every(r=>r.code===0&&r.stdout===''));
    const rows=await readEvents(dir);assert.equal(new Set(rows.map(r=>r.tool_use_id)).size,16);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('invalid metadata reports failure without emitting a control decision',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dragon-hooks-'));
  try{
    const result=await invoke(dir,{hook_event_name:'PermissionRequest',tool_input:{command:'SECRET'}});
    assert.equal(result.code,1);assert.equal(result.stdout,'');assert.ok(!result.stderr.includes('SECRET'));
    assert.equal((await readEvents(dir)).length,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('capture switch stops new records, preserves history and can be enabled again',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dragon-hooks-'));
  const input={hook_event_name:'UserPromptSubmit',session_id:'s',turn_id:'t'};
  try{
    assert.equal(await isCaptureEnabled(dir),true);
    assert.equal((await invoke(dir,input)).code,0);
    await setCaptureEnabled(dir,false);
    assert.equal(await isCaptureEnabled(dir),false);
    assert.deepEqual(await invoke(dir,input,{open:true}),{code:0,stdout:'',stderr:''});
    assert.equal((await readEvents(dir)).length,1);
    await setCaptureEnabled(dir,true);
    assert.equal(await isCaptureEnabled(dir),true);
    assert.deepEqual(await invoke(dir,input),{code:0,stdout:'',stderr:''});
    assert.equal((await readEvents(dir)).length,2);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('disabling capture while JSON is incomplete prevents the pending record',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dragon-hooks-'));
  try{
    const result=await invoke(dir,{hook_event_name:'PreToolUse',session_id:'s',turn_id:'t',tool_use_id:'call'},
      {open:true,partial:true,beforeRemainder:()=>setCaptureEnabled(dir,false)});
    assert.deepEqual(result,{code:0,stdout:'',stderr:''});
    assert.equal((await readEvents(dir)).length,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
