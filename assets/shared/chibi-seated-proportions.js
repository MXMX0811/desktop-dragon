// Rest-pose shaping only. The painted knees keep their original centres;
// ankle ornaments/shoes and all upper-body contacts remain in place.
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

export function readingBodySlimPoint(x,y){
 const height=smooth((y-842)/44)*(1-smooth((y-999)/48));
 if(height===0)return [x,y];
 const t=Math.max(0,Math.min(1,(y-882)/150));
 const centres=[501-27*t,598-19*t];
 // The knees touch in the painting, so the two inner contour fields overlap.
 // Compensate there to give the visible knee and calf widths a similar trim.
 const strength=.15+.12*(1-smooth((y-925)/35));
 let offset=0;
 for(const centre of centres){
  const distance=x-centre;
  // Extend into adjacent cloth so narrowing a contour never leaves an old
  // skin edge or a transparent cutout. Fall off before the other knee axis.
  const reach=1-smooth((Math.abs(distance)-48)/20);
  offset-=distance*strength*reach*height;
 }
 return [x+offset,y];
}

export const READING_HAND_WIDTH=.92;
