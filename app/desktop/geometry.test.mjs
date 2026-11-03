import test from 'node:test';
import assert from 'node:assert/strict';
import {areaAt,outsideEdge} from './geometry.js';
import {DRAG_EDGE_WIDTH} from '../runtime/interaction-scenes.js';

test('both outer edges use the 80px release zone in desktop coordinates',()=>{
 const area={x:-1200,y:100,width:1200,height:800};
 assert.equal(DRAG_EDGE_WIDTH,80);
 for(const side of ['left','right']){
  const boundary=side==='left'?area.x+DRAG_EDGE_WIDTH:area.x+area.width-DRAG_EDGE_WIDTH;
  assert.equal(outsideEdge({x:boundary,y:300},area,[area],DRAG_EDGE_WIDTH),side);
  const inside=boundary+(side==='left'?.01:-.01);
  assert.equal(outsideEdge({x:inside,y:300},area,[area],DRAG_EDGE_WIDTH),null);
 }
});

test('a real neighbour suppresses edge flight only along its overlapping height',()=>{
 const left={x:0,y:0,width:1440,height:900},right={x:1440,y:120,width:1920,height:1080};
 assert.equal(outsideEdge({x:1400,y:300},left,[left,right],171),null);
 assert.equal(outsideEdge({x:1400,y:60},left,[left,right],171),'right');
 assert.equal(outsideEdge({x:1500,y:300},right,[left,right],171),null);
 assert.equal(outsideEdge({x:3300,y:300},right,[left,right],171),'right');
});
test('display selection handles negative coordinates and gaps',()=>{
 const left={x:-1200,y:100,width:1200,height:800},right={x:0,y:0,width:1600,height:1000};
 assert.equal(areaAt({x:-300,y:200},[left,right]),left);
 assert.equal(areaAt({x:100,y:300},[left,right]),right);
 assert.equal(areaAt({x:-100,y:50},[left,right]),left);
});
