// Character-local coordinates. Book and grips share one rigid translation;
// anatomical left/right follow the character, not the observer.
export const BOOK_LIFT=92;
export const readingWaitParts={
 book:{bounds:{x:347,y:632,width:478,height:247},path:'M400 638 C455 640 519 655 553 710 L568 705 L578 700 L588 694 L598 689 L608 685 L618 681 L628 677 L638 673 L648 670 L658 668 L668 665 L678 663 L688 662 L698 660 L708 659 L718 658 L728 657 L738 656 L748 655 L758 655 L768 655 L773 655 L790 676 Q797 672 799 685 L816 849 L815 853 L810 853 L800 856 L790 857 L780 859 L770 861 L760 862 L750 864 L740 866 L730 867 L720 869 L710 870 L700 872 L690 872 L680 872 L670 872 L660 870 L650 870 L640 870 L630 869 L620 866 L610 863 L600 862 L590 861 L575 861 L565 862 L560 861 L550 856 L540 854 L530 853 L520 853 L510 851 L500 852 L490 851 L480 848 L470 845 L460 842 L450 839 L440 834 Q435 833 430 823 L355 681 Q349 667 361 665 L369 665 Z'},
 handR:{bounds:{x:378,y:748,width:64,height:71},path:'M391 755 C405 748 426 758 432 779 C440 794 429 809 414 812 C393 816 384 799 383 780 C381 770 384 761 391 755 Z'},
 handL:{bounds:{x:777,y:768,width:65,height:71},path:'M799 775 C818 768 833 780 835 795 C839 815 823 832 807 833 C790 835 779 825 781 808 C776 795 783 780 799 775 Z'},
 sleeveR:{bounds:{x:290,y:750,width:220,height:270}},
 sleeveL:{bounds:{x:770,y:760,width:240,height:300}},
 armR:{bounds:{x:484,y:628,width:133,height:206},path:'M559 635 C578 629 592 632 595 640 L574 692 L550 754 Q549 765 562 774 L600 804 L599 820 Q559 832 524 817 C502 812 492 802 495 780 L514 716 L536 666 Q548 644 559 635 Z', shoulder:[570,655],elbow:[522,780],wrist:[591,811],grip:[421,787],bend:-1},
 armL:{bounds:{x:636,y:630,width:132,height:213},path:'M703 638 C718 633 737 647 747 674 L758 744 L758 784 Q759 809 738 821 C712 837 680 837 648 824 L644 807 L701 784 L709 748 L696 681 Z', shoulder:[719,655],elbow:[731,794],wrist:[654,818],grip:[797,806],bend:1}
};
export function readingBookPose(amount){return {x:0,y:-BOOK_LIFT*amount};}
export function readingArmPose(part,amount){
 const s=part.shoulder,l1=112,l2=110,b=readingBookPose(amount),w=[part.grip[0]+b.x,part.grip[1]+b.y];
 const dx=w[0]-s[0],dy=w[1]-s[1],d=Math.hypot(dx,dy),along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const e=[s[0]+dx/d*along-dy/d*height*part.bend,s[1]+dy/d*along+dx/d*height*part.bend];
 return {shoulder:s,elbow:e,wrist:w,l1,l2};
}
function segmentPoint(x,y,a,b,c,d){const sx=b[0]-a[0],sy=b[1]-a[1],tx=d[0]-c[0],ty=d[1]-c[1],den=sx*sx+sy*sy,u=((x-a[0])*sx+(y-a[1])*sy)/den,v=.87*(-(x-a[0])*sy+(y-a[1])*sx)/Math.sqrt(den),len=Math.hypot(tx,ty);return [c[0]+u*tx-v*ty/len,c[1]+u*ty+v*tx/len];}
export function readingArmPoint(part,x,y,amount){
 const pose=readingArmPose(part,amount),a=segmentPoint(x,y,part.shoulder,part.elbow,pose.shoulder,pose.elbow),b=segmentPoint(x,y,part.elbow,part.wrist,pose.elbow,pose.wrist);
 const ex=part.elbow[0],ey=part.elbow[1],vx=part.wrist[0]-part.shoulder[0],vy=part.wrist[1]-part.shoulder[1],l=Math.hypot(vx,vy),q=Math.max(0,Math.min(1,.5+((x-ex)*vx+(y-ey)*vy)/(l*38))),t=q*q*(3-2*q);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}
