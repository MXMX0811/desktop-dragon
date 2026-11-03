const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};

// Coordinates use the shared reading body. Left/right refer to the screen.
export const workChairArms={
 armLeft:{shoulder:[570,637],elbow:[500,735],wrist:[490,766],tip:[525,803],stroke:[2,1.5]},
 armRight:{shoulder:[715,640],elbow:[766,746],wrist:[709,787],tip:[650,813],stroke:[0,3.5]},
};

export function workChairActivity(frame){
 return (1-smooth(frame.waitAmount/.24))*(1-smooth(frame.attentionProgress/.24));
}

// Two fixed-length links follow a short wrist downstroke. The full palm and
// fingers then move rigidly with that wrist; no texture is scaled to press.
export function workChairArmPose(rig,press){
 const p=clamp(press),s=rig.shoulder,e=rig.elbow,w=rig.wrist;
 const target=[w[0]+rig.stroke[0]*p,w[1]+rig.stroke[1]*p];
 const upperLength=Math.hypot(e[0]-s[0],e[1]-s[1]),lowerLength=Math.hypot(w[0]-e[0],w[1]-e[1]);
 const dx=target[0]-s[0],dy=target[1]-s[1],distance=Math.hypot(dx,dy);
 const cosine=Math.max(-1,Math.min(1,(upperLength**2+distance**2-lowerLength**2)/(2*upperLength*distance)));
 const bend=Math.sign((w[0]-s[0])*(e[1]-s[1])-(w[1]-s[1])*(e[0]-s[0]));
 const angle=Math.atan2(dy,dx)+bend*Math.acos(cosine);
 const elbow=[s[0]+upperLength*Math.cos(angle),s[1]+upperLength*Math.sin(angle)];
 const upperAngle=angle-Math.atan2(e[1]-s[1],e[0]-s[0]);
 const lowerAngle=Math.atan2(target[1]-elbow[1],target[0]-elbow[0])-Math.atan2(w[1]-e[1],w[0]-e[0]);
 return {press:p,elbow,wrist:target,upperCos:Math.cos(upperAngle),upperSin:Math.sin(upperAngle),lowerCos:Math.cos(lowerAngle),lowerSin:Math.sin(lowerAngle)};
}

function segmentDistance(x,y,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy));
 return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}

export function workChairArmPoint(rig,x,y,pose){
 if(pose.press===0)return [x,y];
 const s=rig.shoulder,e=rig.elbow,w=rig.wrist;
 const upper=[s[0]+(x-s[0])*pose.upperCos-(y-s[1])*pose.upperSin,s[1]+(x-s[0])*pose.upperSin+(y-s[1])*pose.upperCos];
 const lower=[pose.elbow[0]+(x-e[0])*pose.lowerCos-(y-e[1])*pose.lowerSin,pose.elbow[1]+(x-e[0])*pose.lowerSin+(y-e[1])*pose.lowerCos];
 const shoulder=Math.hypot(x-s[0],y-s[1]);
 const elbowBlend=smooth((segmentDistance(x,y,s,e)-segmentDistance(x,y,e,w)+12)/24)*smooth(shoulder/38);
 const tip=rig.tip,handAxis=[tip[0]-w[0],tip[1]-w[1]],handLength=Math.hypot(...handAxis);
 const handAlong=((x-w[0])*handAxis[0]+(y-w[1])*handAxis[1])/handLength;
 const handBlend=smooth((handAlong+20)/20);
 const arm=[upper[0]+(lower[0]-upper[0])*elbowBlend,upper[1]+(lower[1]-upper[1])*elbowBlend];
 const hand=[x+pose.wrist[0]-w[0],y+pose.wrist[1]-w[1]];
 return [arm[0]+(hand[0]-arm[0])*handBlend,arm[1]+(hand[1]-arm[1])*handBlend];
}
