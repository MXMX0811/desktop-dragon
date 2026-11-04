import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

const CACHE_MS=30_000, REQUEST_MS=20_000;
const unavailable=message=>({status:'unavailable',windows:[],fetchedAt:null,message});
const failed=message=>({status:'error',windows:[],fetchedAt:null,message});

function durationLabel(minutes){
 if(!Number.isFinite(minutes)||minutes<=0)return '额度窗口';
 if(minutes===10_080)return '每周';
 if(minutes%1440===0)return `${minutes/1440}天`;
 if(minutes%60===0)return `${minutes/60}小时`;
 return `${minutes}分钟`;
}

export function quotaSnapshot(result,now=Date.now()){
 const buckets=result?.rateLimitsByLimitId;
 if(!buckets||typeof buckets!=='object'||Array.isArray(buckets))return unavailable('Codex 未提供额度窗口。');
 const windows=[];
 for(const [id,bucket] of Object.entries(buckets)){
  if(!bucket||typeof bucket!=='object')continue;
  const name=bucket.limitName||(id==='codex'?'Codex':id);
  for(const window of [bucket.primary,bucket.secondary]){
   if(!window||typeof window!=='object')continue;
   windows.push({
    label:`${name} · ${durationLabel(window.windowDurationMins)}`,
    remainingPercent:Number.isFinite(window.usedPercent)?Math.max(0,Math.min(100,100-window.usedPercent)):null,
    resetsAt:Number.isFinite(window.resetsAt)&&window.resetsAt>0?window.resetsAt:null,
   });
  }
 }
 if(!windows.length)return unavailable('当前账户未提供额度窗口。');
 return {status:'ready',windows,fetchedAt:now};
}

function requestError(error){
 const message=typeof error?.message==='string'?error.message:'';
 if(/auth|unauthorized|not logged|not signed|sign.?in|api.?key/i.test(message)){
  return unavailable('请先在 Codex 中登录 ChatGPT 账户。');
 }
 return failed('额度查询失败，请稍后再试。');
}

// Each read uses its own stdio connection. Only these two read-only requests
// are sent; no thread is created, resumed, or subscribed to.
export function createQuotaReader({executable='codex',spawnProcess=spawn}={}){
 let cached=null,inFlight=null,cancel=null,closed=false;
 function read(){
  if(closed)return Promise.resolve(unavailable('额度查询已关闭。'));
  if(inFlight)return inFlight;
  const now=Date.now();
  if(cached&&now>=cached.fetchedAt&&now-cached.fetchedAt<CACHE_MS&&
   cached.windows.every(window=>window.resetsAt===null||window.resetsAt*1000>now))return Promise.resolve(cached);
  inFlight=new Promise(resolve=>{
   let child,lines,timer,finished=false,initialized=false;
   const finish=value=>{
    if(finished)return;
    finished=true;clearTimeout(timer);lines?.close();
    child?.stdin.end();child?.kill();
    if(value.status==='ready')cached=value;
    else cached=null;
    resolve(value);
   };
   cancel=()=>finish(unavailable('额度查询已关闭。'));
   try{
    child=spawnProcess(executable,['app-server','--stdio'],{stdio:['pipe','pipe','ignore'],windowsHide:true});
   }catch{finish(failed('无法启动 Codex 额度查询。'));return;}
   child.once('error',error=>finish(error.code==='ENOENT'
    ?unavailable('未找到 Codex，请在右键菜单选择 Codex 程序。')
    :failed('无法启动 Codex，请检查所选程序。')));
   child.once('exit',()=>finish(failed('Codex 额度查询已中断，请重试。')));
   child.stdin.on('error',()=>finish(failed('Codex 额度连接已中断，请重试。')));
   lines=createInterface({input:child.stdout});
   const send=message=>child.stdin.write(`${JSON.stringify(message)}\n`);
   lines.on('line',line=>{
    if(finished)return;
    let message;
    try{message=JSON.parse(line);}catch{finish(failed('Codex 返回的额度数据无法读取。'));return;}
    if(!message||typeof message!=='object'||Array.isArray(message)){finish(failed('Codex 返回的额度数据无法读取。'));return;}
    if(message.id===0&&!initialized){
     if(message.error){finish(requestError(message.error));return;}
     initialized=true;
     send({method:'initialized',params:{}});
     send({method:'account/rateLimits/read',id:1});
    }else if(message.id===1&&initialized){
     finish(message.error?requestError(message.error):quotaSnapshot(message.result));
    }
   });
   timer=setTimeout(()=>finish(failed('额度查询超时，请稍后再试。')),REQUEST_MS);
   send({method:'initialize',id:0,params:{clientInfo:{name:'desktop_dragon',title:'Desktop Dragon',version:'0.1.0'}}});
  }).finally(()=>{inFlight=null;cancel=null;});
  return inFlight;
 }
 return {read,close(){closed=true;cached=null;cancel?.();}};
}
