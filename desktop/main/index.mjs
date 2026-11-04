import {app,BrowserWindow,Menu,Tray,nativeImage,screen,ipcMain,protocol,net,dialog} from 'electron';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {union,contains,validRect,initialPosition,sameDisplayLayout} from './geometry.mjs';
import {APP_URL,installProtocol} from './protocol.mjs';
import {createSessionObserver} from './sessions.mjs';
import {isCaptureEnabled,setCaptureEnabled} from '../codex-hooks/control.mjs';
import {readRegistration} from '../codex-hooks/registration.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
app.setName('Desktop Dragon');
if(!app.isPackaged)app.setPath('userData',join(root,'.local','desktop'));
protocol.registerSchemesAsPrivileged([{scheme:'dragon',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
if(!app.requestSingleInstanceLock()){app.quit();}else{
 let win,tray,observer,pointerTimer,saveTimer;
 let displays,desktop,position,regions=[],pointerDown=false,mode='normal',ignored=true,shown=false,hidden=false;
 let savedFile,settingsFile,hookDirectory,captureEnabled=false,captureBusy=false,captureError=null,registration;
 const hookConfig=join(process.env.CODEX_HOME||join(homedir(),'.codex'),'hooks.json');
 const layout=()=>({desktop,displays,window:win.getBounds(),position:{x:position.x-desktop.x,y:position.y-desktop.y}});
 const send=(channel,value)=>{if(win&&!win.isDestroyed())win.webContents.send(channel,value);};
 function refreshDisplays(){
  displays=screen.getAllDisplays().map(d=>({id:d.id,workArea:d.workArea}));
  desktop=union(displays.map(d=>d.workArea));
 }
 function action(value){send('dragon:action',value);}
 const withConnection=snapshot=>({...snapshot,registration,connection:{...snapshot.connection,error:captureError}});
 const publishSessions=snapshot=>send('dragon:sessions',withConnection(snapshot));
 async function observeHooks(){
  observer?.close();
  captureEnabled=await isCaptureEnabled(hookDirectory);
  observer=await createSessionObserver(publishSessions,{directory:hookDirectory,enabled:captureEnabled});
 }
 async function setCapture(enabled){
  captureBusy=true;captureError=null;
  try{
   await setCaptureEnabled(hookDirectory,enabled);
   await observeHooks();
   action({type:'follow'});
  }catch(error){captureError=error.message;publishSessions(observer.snapshot());}
  finally{captureBusy=false;}
 }
 function show(){hidden=false;win.showInactive();action({type:'visible',visible:true});}
 function hide(){hidden=true;win.hide();action({type:'visible',visible:false});}
 function reset(){
  position=initialPosition(displays,null);
  send('dragon:layout',layout());action({type:'reset'});show();
 }
 function menuItems(){return [
  {label:'查看会话状态',click:()=>action({type:'panel'})},
  {label:'启用 Codex 状态采集',type:'checkbox',checked:captureEnabled,enabled:!captureBusy,click:item=>setCapture(item.checked)},
  {label:'跟随会话状态',click:()=>action({type:'follow'})},
  {label:'状态审阅',submenu:[
   {label:'待机',click:()=>action({type:'scene',scene:'standby'})},
   {label:'休眠',click:()=>action({type:'scene',scene:'standby',sleeping:true})},
   {label:'思考',click:()=>action({type:'scene',scene:'thinking'})},
   ...['reading','work','drawing'].map((scene,i)=>({label:['阅读','工作','绘图'][i],submenu:[
    {label:'进行中',click:()=>action({type:'scene',scene})},
    {label:'等待确认',click:()=>action({type:'scene',scene,waiting:true})},
   ]})),
  ]},
  {label:'切换Q版 / 正比',click:()=>action({type:'form'})},
  {type:'separator'},
  {label:hidden?'显示龙娘':'隐藏龙娘',click:()=>hidden?show():hide()},
  {label:'回到屏幕内',click:reset},
  {label:'选择 Codex 钩子目录…',click:()=>chooseHookDirectory().catch(console.error)},
  {type:'separator'},
  {label:'退出 Desktop Dragon',click:()=>app.quit()},
 ];}
 async function popup(){
  registration=await readRegistration(hookConfig);
  publishSessions(observer.snapshot());
  Menu.buildFromTemplate(menuItems()).popup({window:win});
 }
 async function chooseHookDirectory(){
  const result=await dialog.showOpenDialog(win,{title:'选择 Codex 钩子数据目录（包含 events 文件夹）',defaultPath:hookDirectory,properties:['openDirectory']});
  if(result.canceled)return;
  hookDirectory=result.filePaths[0];
  captureError=null;await observeHooks();
  await writeFile(settingsFile,JSON.stringify({hookDirectory})+'\n');
 }
 function source(event){return event.sender===win?.webContents&&event.senderFrame?.url===APP_URL;}
 function savePosition(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>writeFile(savedFile,JSON.stringify(position)+'\n').catch(console.error),250);
 }
 function hitTest(){
  if(!shown||hidden||win.isDestroyed())return;
  const cursor=screen.getCursorScreenPoint();
  const point={x:cursor.x-desktop.x,y:cursor.y-desktop.y};
  const next=mode==='flight'||(!pointerDown&&!regions.some(r=>contains(r,point)));
  if(next!==ignored){ignored=next;win.setIgnoreMouseEvents(ignored,{forward:true});}
 }
 ipcMain.handle('dragon:bootstrap',event=>{if(!source(event))throw Error('Unexpected renderer');return layout();});
 ipcMain.handle('dragon:sessions',event=>{if(!source(event))throw Error('Unexpected renderer');return withConnection(observer.snapshot());});
 ipcMain.on('dragon:menu',event=>{if(source(event))popup();});
 ipcMain.on('dragon:report',(event,value)=>{
  if(!source(event)||!value||!validRect(value.bounds)||!Array.isArray(value.hitRegions)||value.hitRegions.length>32||!value.hitRegions.every(validRect))return;
  if(!['normal','drag','flight','peek'].includes(value.mode)||typeof value.pointerDown!=='boolean')return;
  if(!value.position||!Number.isFinite(value.position.x)||!Number.isFinite(value.position.y))return;
  regions=value.hitRegions;pointerDown=value.pointerDown;mode=value.mode;
  position={x:desktop.x+value.position.x,y:desktop.y+value.position.y};
  // Keep the native surface fixed. Moving it and then translating the renderer
  // in separate frames exposes the old origin and produces visible flashes.
  if(!shown){shown=true;if(!hidden)win.showInactive();}
  if(!pointerDown&&mode==='normal')savePosition();
  hitTest();
 });
 app.on('second-instance',()=>{if(win)show();});
 app.whenReady().then(async()=>{
 await mkdir(app.getPath('userData'),{recursive:true});
 savedFile=join(app.getPath('userData'),'position.json');
 settingsFile=join(app.getPath('userData'),'settings.json');
 let saved;
 try{saved=JSON.parse(await readFile(savedFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 refreshDisplays();position=initialPosition(displays,saved);
 installProtocol(protocol,net,root);
 let settings={};
 try{settings=JSON.parse(await readFile(settingsFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 hookDirectory=settings.hookDirectory||(app.isPackaged?join(app.getPath('userData'),'codex-hooks'):join(root,'.local','codex-hooks'));
 registration=await readRegistration(hookConfig);
 await observeHooks();
 win=new BrowserWindow({
  ...desktop,
  title:'Desktop Dragon',transparent:true,backgroundColor:'#00000000',frame:false,hasShadow:false,
  focusable:false,acceptFirstMouse:true,...(process.platform==='darwin'?{type:'panel',enableLargerThanScreen:true}:{}),
  resizable:false,maximizable:false,minimizable:false,fullscreenable:false,skipTaskbar:true,show:false,
  alwaysOnTop:true,webPreferences:{preload:join(root,'desktop/preload/index.cjs'),
   contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true},
 });
 win.setAlwaysOnTop(true,'floating');
 if(process.platform==='darwin'){win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});app.dock.hide();}
 win.setIgnoreMouseEvents(true,{forward:true});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 win.webContents.on('console-message',event=>{if(['warning','error'].includes(event.level))console.error(event.message);});
 win.webContents.on('render-process-gone',(_event,details)=>console.error('Renderer stopped:',details.reason));
 // A small monochrome ring is legible in either platform's tray.
 const pixels=Buffer.alloc(20*20*4);
 for(let y=0;y<20;y++)for(let x=0;x<20;x++){
  const r=Math.hypot(x-9.5,y-9.5),i=(y*20+x)*4;
  if(r>5&&r<8){pixels[i]=pixels[i+1]=pixels[i+2]=120;pixels[i+3]=255;}
 }
 const icon=nativeImage.createFromBitmap(pixels,{width:20,height:20});
 if(process.platform==='darwin')icon.setTemplateImage(true);
 tray=new Tray(icon);tray.setToolTip('Desktop Dragon');tray.on('click',popup);tray.on('right-click',popup);
 pointerTimer=setInterval(hitTest,33);
 const screenChanged=()=>{
  const previous=displays;refreshDisplays();
  if(sameDisplayLayout(previous,displays))return;
  regions=[];
  win.setBounds(desktop);
  send('dragon:layout',layout());
 };
 screen.on('display-added',screenChanged);screen.on('display-removed',screenChanged);screen.on('display-metrics-changed',screenChanged);
 app.on('before-quit',()=>{clearInterval(pointerTimer);clearTimeout(saveTimer);observer.close();tray.destroy();});
 app.on('window-all-closed',()=>app.quit());
 await win.loadURL(APP_URL);
 console.log('Desktop Dragon loaded',APP_URL);
 }).catch(error=>{console.error(error);app.quit();});
}
