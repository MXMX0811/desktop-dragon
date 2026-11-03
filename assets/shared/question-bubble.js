import {questionArt} from './question-art.js';

function paintedCanvas(art){
 const canvas=document.createElement('canvas');canvas.width=art.width;canvas.height=art.height;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(art.width,art.height);
 pixels.data.set(Uint8Array.from(atob(art.rgba),char=>char.charCodeAt(0)));
 ctx.putImageData(pixels,0,0);return canvas;
}

// The scene positions/scales the outer container. Only the inner bubble pops
// on entry; after settling, the question mark alone rocks around its center.
export function createQuestionBubble(PIXI,{tailRight=false}={}){
 const container=new PIXI.Container({label:'waiting-question'});
 const pop=new PIXI.Container({label:'question-entry-scale'});container.addChild(pop);
 const bubble=new PIXI.Sprite({texture:PIXI.Texture.from(paintedCanvas(questionArt.body)),label:'stable-painted-question-bubble'});
 bubble.anchor.set(.5);bubble.scale.x=tailRight?1:-1;
 const mark=new PIXI.Sprite({texture:PIXI.Texture.from(paintedCanvas(questionArt.mark)),label:'painted-ticking-question-mark'});
 mark.pivot.set(32,42);mark.position.set(tailRight?-2:2,-5);pop.addChild(bubble,mark);
 function render(frame){pop.alpha=frame.questionAlpha;pop.scale.set(frame.questionScale);mark.rotation=frame.questionAngle;container.visible=frame.questionAlpha>.001;}
 return {container,render};
}
