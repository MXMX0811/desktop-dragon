// Simple line drawings remain crisp at the desktop size. Containers use Pixi's
// native position/scale/alpha, with the entire effect behind the painted pet.
export function createDrawingSheet(P,kind){
 const g=new P.Graphics(),ink=kind===2?0xc4a5ed:0x9ed7ed;
 g.roundRect(-124,-84,248,168,14).fill({color:0x32435d,alpha:.75}).stroke({color:ink,width:4});
 const stroke=()=>g.stroke({color:ink,width:5,cap:'round',join:'round'});
 if(kind===0){
  g.rect(-87,-55,167,108);stroke();g.moveTo(-32,-55).lineTo(-32,-9).lineTo(80,-9);stroke();g.moveTo(-32,22).lineTo(-32,53);stroke();g.moveTo(24,-9).lineTo(24,53);stroke();g.arc(-32,23,31,-Math.PI/2,0);g.stroke({color:ink,width:3});
  g.moveTo(-103,-64).lineTo(-103,59).moveTo(-111,-55).lineTo(-95,-55).moveTo(-111,53).lineTo(-95,53);g.stroke({color:ink,width:2,alpha:.7});
 }else if(kind===1){
  g.moveTo(-87,-56).lineTo(-87,52).lineTo(87,52);stroke();
  for(const y of [-26,9])g.moveTo(-83,y).lineTo(87,y);g.stroke({color:ink,width:2,alpha:.3});
  g.moveTo(-70,29).lineTo(-31,-4).lineTo(5,15).lineTo(43,-29).lineTo(82,-48);stroke();
  for(const [x,y] of [[-70,29],[-31,-4],[5,15],[43,-29],[82,-48]])g.circle(x,y,5).fill(ink);
 }else{
  g.moveTo(-78,25).bezierCurveTo(-98,-35,-30,-56,-26,-9).bezierCurveTo(-18,30,-76,59,-78,25);stroke();
  g.moveTo(24,-48).lineTo(36,-19).lineTo(67,-17).lineTo(43,2).lineTo(51,32).lineTo(25,15).lineTo(-1,32).lineTo(8,2).lineTo(-16,-17).lineTo(15,-19).closePath();stroke();
  g.moveTo(65,46).bezierCurveTo(91,40,95,16,83,7);g.moveTo(-70,-50).lineTo(-62,-63).moveTo(-89,-41).lineTo(-105,-45);stroke();
 }
 return g;
}
