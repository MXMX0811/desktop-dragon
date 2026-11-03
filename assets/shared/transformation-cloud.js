// Round smoke lobes expand, cover, then clear from the centre outwards.
// Shared cross-form transition artwork; scope: ../../docs/asset-catalog.md.
export class TransformationCloud {
 constructor(layer){
  this.layer=layer;this.animations=[];
  const shadeId=`${layer.id}-shade`;
  this.puffs=[
   [197,74,54,-12],[288,100,50,16],[332,186,52,-8],[306,278,55,20],
   [222,328,52,-14],[126,306,53,12],[72,227,50,-18],[93,132,57,8],
   [151,170,84,-8],[245,160,79,14],[201,249,83,-12],
  ];
  const lobe=`<path d="M-44 14C-57 7-55-14-39-22C-41-43-16-52 0-38C15-52 39-39 38-22C58-16 57 10 43 20C45 41 18 49 3 37C-15 51-42 39-44 14Z" fill="url(#${shadeId})" stroke="#c9b9dc" stroke-width="1.1"/>
   <path d="M-38-15C-42-29-26-40-14-32M5-31C15-38 28-33 29-23" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>
   <path d="M-38 16C-34 30-17 33-9 26M15 32C28 35 39 24 37 16" fill="none" stroke="#c5b2db" stroke-width="2" stroke-linecap="round" opacity=".38"/>`;
  layer.innerHTML=`<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
   <defs><radialGradient id="${shadeId}" cx="38%" cy="26%" r="78%">
    <stop offset="0" stop-color="#fffdfd"/><stop offset=".62" stop-color="#f4eefb"/><stop offset="1" stop-color="#dcd0eb"/>
   </radialGradient></defs>
   <g data-smoke-core style="transform-origin:200px 200px"><circle cx="200" cy="200" r="140" fill="#f4eefb"/></g>
   ${this.puffs.map(([x,y,r,rotation],i)=>`<g transform="translate(${x} ${y})"><g data-smoke-puff="${i}" style="transform-origin:0 0"><g transform="rotate(${rotation}) scale(${r/50})">${lobe}</g></g></g>`).join('')}
   ${[[64,111,9],[319,85,7],[349,278,10],[105,342,7],[48,254,6]].map(([x,y,r],i)=>`<g transform="translate(${x} ${y})"><g data-smoke-wisp="${i}" style="transform-origin:0 0"><circle r="${r}" fill="#eee5f7" stroke="#cbbcdc" stroke-width="1"/><path d="M${-r*.55} ${-r*.2}Q${-r*.35} ${-r*.7} ${r*.25} ${-r*.55}" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g></g>`).join('')}
  </svg>`;
 }
 play(element,frames,options){
  const animation=element.animate(frames,{fill:'forwards',...options});
  this.animations.push(animation);return animation;
 }
 fit(elements){
  const frames=elements.map(element=>element.getBoundingClientRect());
  const stage=this.layer.parentElement,origin=stage.getBoundingClientRect();
  const diameter=Math.max(...frames.flatMap(frame=>[frame.width,frame.height]))*1.03;
  const last=frames.at(-1);
  Object.assign(this.layer.style,{width:`${diameter}px`,height:`${diameter}px`,
   left:`${last.left+last.width/2-origin.left+stage.scrollLeft-diameter/2}px`,
   top:`${last.top+last.height/2-origin.top+stage.scrollTop-diameter/2}px`});
 }
 async cover(character){
  this.layer.hidden=false;
  this.play(character,[{opacity:1},{opacity:1,offset:.42},{opacity:0,offset:.86},{opacity:0}],{duration:340,easing:'ease-in-out'});
  this.layer.querySelectorAll('[data-smoke-puff]').forEach((element,i)=>{
   const [x,y]=this.puffs[i];
   this.play(element,[
    {opacity:0,transform:`translate(${(200-x)*.44}px,${(200-y)*.44}px) scale(.38)`},
    {opacity:1,transform:'translate(0,0) scale(1.035)',offset:.78},
    {opacity:1,transform:'translate(0,0) scale(1)'}
   ],{duration:300,delay:i%3*16,easing:'cubic-bezier(.16,.72,.28,1)',fill:'both'});
  });
  this.layer.querySelectorAll('[data-smoke-wisp]').forEach((element,i)=>this.play(element,[
   {opacity:0,transform:'scale(.1)'},{opacity:.8,transform:'scale(1)'}
  ],{duration:180,delay:130+i*6,fill:'both',easing:'ease-out'}));
  await this.play(this.layer.querySelector('[data-smoke-core]'),[
   {opacity:0,transform:'scale(.3)'},{opacity:1,transform:'scale(1)',offset:.82},{opacity:1,transform:'scale(1)'}
  ],{duration:340,easing:'cubic-bezier(.16,.72,.28,1)'}).finished;
 }
 async reveal(character){
  this.play(character,[{opacity:0},{opacity:1,offset:.46},{opacity:1}],{duration:560,easing:'ease-out'});
  this.play(this.layer.querySelector('[data-smoke-core]'),[
   {opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.7)'}
  ],{duration:100,easing:'ease-out'});
  this.layer.querySelectorAll('[data-smoke-puff]').forEach((element,i)=>{
   const [x,y]=this.puffs[i],outer=i<8;
   const dx=(x-200)*(outer?.18:.34),dy=(y-200)*(outer?.18:.34)-9;
   this.play(element,[
    {opacity:1,transform:'translate(0,0) scale(1)'},
    {opacity:1,transform:`translate(${dx*.58}px,${dy*.58}px) scale(${outer?.96:.76})`,offset:.3},
    {opacity:0,transform:`translate(${dx}px,${dy}px) scale(.16) rotate(${i%2?14:-12}deg)`}
   ],{duration:outer?480:350,delay:outer?i%3*20:0,easing:'cubic-bezier(.22,.62,.36,1)'});
  });
  const animations=[...this.layer.querySelectorAll('[data-smoke-wisp]')].map((element,i)=>this.play(element,[
   {opacity:.8,transform:'translate(0,0) scale(1)'},
   {opacity:.65,transform:`translate(${i%2?8:-8}px,-10px) scale(.8)`,offset:.42},
   {opacity:0,transform:`translate(${i%2?15:-15}px,-24px) scale(.1)`}
  ],{duration:560,easing:'ease-out'}));
  await Promise.all(animations.map(animation=>animation.finished));
  this.layer.hidden=true;for(const animation of this.animations)animation.cancel();this.animations=[];
 }
 destroy(){for(const animation of this.animations)animation.cancel();this.animations=[];this.layer.hidden=true;}
}
