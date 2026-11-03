import {join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';

export const APP_URL='dragon://app/desktop/index.html';
export function resourcePath(url,root) {
 const target=new URL(url);
 if(target.protocol!=='dragon:'||target.hostname!=='app')return null;
 const pathname=decodeURIComponent(target.pathname);
 const directory=pathname.startsWith('/assets/')?'assets':/^\/(desktop|runtime)\//.test(pathname)?'app':null;
 if(!directory)return null;
 const base=join(root,directory);
 const relative=directory==='assets'?pathname.slice('/assets/'.length):pathname.slice(1);
 const file=resolve(base,relative);
 return file.startsWith(base+sep)?file:null;
}
export function installProtocol(protocol,net,root) {
 protocol.handle('dragon',request=>{
  const file=resourcePath(request.url,root);
  if(!file||request.method!=='GET')return new Response('Not found',{status:404});
  return net.fetch(pathToFileURL(file).href);
 });
}
