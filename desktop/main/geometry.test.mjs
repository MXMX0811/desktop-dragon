import test from 'node:test';
import assert from 'node:assert/strict';
import {union,contains,initialPosition,clipBounds} from './geometry.mjs';
import {resourcePath} from './protocol.mjs';
test('virtual desktop includes negative coordinates but hit tests respect real displays',()=>{
 const screens=[{workArea:{x:-1440,y:0,width:1440,height:900}},{workArea:{x:0,y:30,width:1920,height:1050}}];
 assert.deepEqual(union(screens.map(s=>s.workArea)),{x:-1440,y:0,width:3360,height:1080});
 assert.equal(screens.some(s=>contains(s.workArea,{x:100,y:10})),false);
 assert.deepEqual(initialPosition(screens,{x:-500,y:400}),{x:-500,y:400});
 assert.notDeepEqual(initialPosition(screens,{x:4000,y:400}),{x:4000,y:400});
});
test('window crop rounds outward and stays within desktop',()=>{
 assert.deepEqual(clipBounds({x:-20.1,y:50.2,width:250.5,height:200.7},{x:0,y:0,width:1920,height:1080}),{x:0,y:50,width:231,height:201});
});
test('asset protocol exposes only application and asset resources',()=>{
 assert.equal(resourcePath('dragon://app/assets/shared/reference-palette.mjs','/repo'),'/repo/assets/shared/reference-palette.mjs');
 assert.equal(resourcePath('dragon://app/desktop/index.html','/repo'),'/repo/app/desktop/index.html');
 for(const path of ['dragon://app/.local/events.json','dragon://app/desktop/../../.local/events.json','https://example.com/assets/a.png','dragon://other/assets/a.png'])assert.equal(resourcePath(path,'/repo'),null);
});
