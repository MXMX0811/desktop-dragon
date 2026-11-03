/* Shared decorative terminals for both work proportions; no session output. */
(() => {
  'use strict';
  const LINES=['> build','... modules','[====  ]','> run','... checks','[======]','> render','... assets','[====  ]'];
  const WIDTH=360,HEIGHT=230;

  class DragonWorkTerminals {
    constructor(P,placements) {
      this.container=new P.Container({label:'terminals-behind-character',eventMode:'none'});
      this.clock=0;this.lastTime=null;
      this.windows=placements.map((placement,index)=>{
        const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
        const texture=P.Texture.from(canvas);
        const part=new P.Container({label:`background-terminal-${index+1}`,eventMode:'none'});
        part.position.set(placement.x,placement.y);part.rotation=placement.rotation;
        part.scale.set(placement.width/WIDTH,placement.height/HEIGHT);
        const sprite=new P.Sprite({texture});part.addChild(sprite);
        const ink=index===0?'#9ed7f1':'#c5b3ed';
        const cursor=new P.Graphics({label:'terminal-block-cursor'}).rect(64,181,13,20).fill(ink);
        part.addChild(cursor);this.container.addChild(part);
        const window={canvas,texture,part,cursor,ink,row:-1,index};
        this.paint(window,0);
        return window;
      });
      this.render(0,1);
    }

    paint(window,row) {
      const {canvas,ink}=window,ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,WIDTH,HEIGHT);
      ctx.beginPath();ctx.roundRect(4,4,WIDTH-8,HEIGHT-8,17);
      const background=ctx.createLinearGradient(0,0,WIDTH,HEIGHT);
      background.addColorStop(0,'rgba(40,45,67,.88)');
      background.addColorStop(1,'rgba(37,38,59,.78)');
      ctx.fillStyle=background;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=3;ctx.stroke();
      ctx.beginPath();ctx.moveTo(6,47);ctx.lineTo(WIDTH-6,47);
      ctx.strokeStyle=ink;ctx.globalAlpha=.42;ctx.lineWidth=2;ctx.stroke();
      ctx.font='bold 27px ui-monospace, Menlo, Consolas, monospace';
      ctx.textBaseline='alphabetic';ctx.fillStyle=ink;ctx.globalAlpha=1;ctx.fillText('>_',22,34);
      for(let i=0;i<3;i++){
        ctx.globalAlpha=.6-i*.12;ctx.beginPath();ctx.arc(WIDTH-28-i*17,25,4,0,Math.PI*2);ctx.fill();
      }
      ctx.font='24px ui-monospace, Menlo, Consolas, monospace';
      for(let line=0;line<3;line++){
        ctx.globalAlpha=.45+line*.22;
        ctx.fillText(LINES[(row+line+window.index*3)%LINES.length],24,83+line*33);
      }
      ctx.globalAlpha=1;ctx.fillText('>',24,200);
      window.row=row;window.texture.source.update();
    }

    render(time,activity) {
      // This is the scene clock, so hidden/paused scenes do not consume time.
      // Rewinding an inspection timeline also rewinds the terminal sequence.
      if(this.lastTime===null||time<this.lastTime)this.clock=time*activity;
      else this.clock+=(time-this.lastTime)*activity;
      this.lastTime=time;
      for(const window of this.windows){
        const phase=time*Math.PI*2/4.8+window.index*2.1;
        window.part.alpha=.38+activity*(.28+.065*Math.sin(phase));
        window.cursor.alpha=.16+.84*(.5+.5*Math.cos(time*Math.PI*2/1.15+window.index*.8));
        const row=Math.floor(this.clock/1.65);
        if(row!==window.row)this.paint(window,row);
      }
    }

    destroy() {
      this.container.destroy({children:true,texture:true,textureSource:true});
    }
  }
  globalThis.DragonWorkTerminals=DragonWorkTerminals;
})();
