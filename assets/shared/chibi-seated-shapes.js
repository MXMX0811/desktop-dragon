// All positions refer to the 1254px reading master. Wing roots are pinned.
export const readingWings = [
  {name:'left',bounds:{x:88,y:594,width:295,height:235},pivot:[348,655],direction:-1,
   path:'M348 605 C334 599 307 614 294 628 L292 636 C242 660 205 686 171 715 C136 747 108 787 96 810 Q92 820 101 815 C145 782 180 765 207 765 C231 765 245 785 250 802 Q253 806 256 796 C278 770 306 752 335 749 C348 726 357 710 370 699 L357 674 C352 660 347 648 350 637 C355 623 357 613 348 605 Z'},
  {name:'right',bounds:{x:895,y:594,width:294,height:236},pivot:[919,660],direction:1,
   path:'M910 602 C923 600 945 617 977 635 C1032 662 1082 695 1114 730 C1147 765 1166 795 1175 814 Q1183 825 1179 813 C1154 773 1114 747 1081 748 C1047 746 1024 766 1018 803 Q1016 814 1011 801 C996 779 978 766 951 769 C936 735 924 705 915 678 C910 665 907 648 911 637 C915 624 899 609 910 602 Z'}
];

export function readingWingPoint(shape,x,y,amount){
  const distance=shape.direction<0?(350-x)/230:(x-925)/230;
  const t=Math.max(0,Math.min(1,distance)),w=t*t*(3-2*t);
  const a=amount*shape.direction*.12*w,dx=x-shape.pivot[0],dy=y-shape.pivot[1];
  return [shape.pivot[0]+dx*Math.cos(a)-dy*Math.sin(a),shape.pivot[1]+dx*Math.sin(a)+dy*Math.cos(a)];
}

// The hinge lies on the exposed TOP sheets, never at the cover or lower spine.
export const bookTop={back:[555,716],front:[598,850],rightBack:[768,658],rightFront:[789.7,797.8],leftBack:[402,641],leftFront:[460.3,782.5]};

export function leafPoint(u,v,progress){
  const p=Math.max(0,Math.min(1,progress)),open=28*Math.PI/180;
  const angle=open+(Math.PI-2*open)*p;
  const arc=.08*Math.sin(Math.PI*p)*u;
  const length=arc===0?u:u*Math.sin(arc)/arc;
  const across=length*Math.cos(angle+arc)/Math.cos(open);
  const depth=length*Math.sin(angle+arc)/Math.sin(open),taper=1-.1*v;
  // Full leaf including the part hidden by the cover. The lower paper is
  // occluded by an independent native book foreground, rather than pretending
  // the thin visible stack cross-section is the whole sheet.
  return [555+43*v+taper*(183*across+30*depth),
    716+134*v+taper*(8.5*across-66.5*depth)];
}
