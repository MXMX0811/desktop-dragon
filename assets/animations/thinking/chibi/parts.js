// Coordinates belong to the 1024×1536 standing master, v2.
export const standingFrame={width:1024,height:1536,padding:80,ground:[510,1518],referenceHeight:1128};
export const standingWings=[
 {name:'left',pivot:[253,677],side:-1,bounds:{x:15,y:652,width:285,height:235},path:'M248 664 C260 657 270 665 266 680 C265 687 260 692 259 696 C259 710 267 726 274 732 C266 749 271 769 282 780 C267 801 251 814 235 828 C209 818 177 831 158 861 C155 863 153 854 152 850 C147 830 130 819 114 820 C83 821 49 846 24 876 C29 845 50 813 77 781 C122 735 170 703 214 684 C225 676 239 671 248 664Z'},
 {name:'right',pivot:[794,676],side:1,bounds:{x:768,y:650,width:249,height:228},path:'M786 662 C799 658 810 667 817 672 C827 673 834 677 840 683 L850 688 L860 693 L870 698 L880 704 L890 710 L900 717 L910 724 L920 731 L930 739 L940 748 L950 757 L960 769 L970 781 L980 795 L990 812 L1000 834 Q1007 851 1007 867 C980 840 947 819 925 814 C904 807 886 824 879 851 C878 857 875 858 872 851 C854 833 839 824 822 824 C814 795 789 780 774 760 C794 738 802 708 788 687 C783 680 780 667 786 662Z'}
];
export const standingTail={bounds:{x:792,y:1068,width:226,height:309},verticesX:33,verticesY:45,path:'M850 1068H1024V1377H792V1200H850Z'};
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export function standingTailPoint(x,y,curl){
 const weight=smooth((1280-y)/170)*smooth((x-835)/65);
 const angle=-.2*curl*weight,dx=x-955,dy=y-1280;
 return[955+dx*Math.cos(angle)-dy*Math.sin(angle),1280+dx*Math.sin(angle)+dy*Math.cos(angle)];
}
export function standingWingPoint(wing,x,y,amount){
 const weight=smooth(wing.side*(x-wing.pivot[0])/225),angle=wing.side*.13*amount*weight;
 const dx=x-wing.pivot[0],dy=y-wing.pivot[1];
 return[wing.pivot[0]+dx*Math.cos(angle)-dy*Math.sin(angle),wing.pivot[1]+dx*Math.sin(angle)+dy*Math.cos(angle)];
}
