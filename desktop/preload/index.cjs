const {contextBridge,ipcRenderer}=require('electron');
const listen=channel=>callback=>{
 const handler=(_event,value)=>callback(value);
 ipcRenderer.on(channel,handler);
 return ()=>ipcRenderer.removeListener(channel,handler);
};
contextBridge.exposeInMainWorld('dragon',{
 bootstrap:()=>ipcRenderer.invoke('dragon:bootstrap'),
 sessions:()=>ipcRenderer.invoke('dragon:sessions'),
 quota:()=>ipcRenderer.invoke('dragon:quota'),
 report:value=>ipcRenderer.send('dragon:report',value),
 menu:()=>ipcRenderer.send('dragon:menu'),
 onLayout:listen('dragon:layout'),
 onAction:listen('dragon:action'),
 onSessions:listen('dragon:sessions'),
});
