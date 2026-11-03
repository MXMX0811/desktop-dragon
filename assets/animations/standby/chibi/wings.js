// Wing masks measured on the adopted redraw/underlay.png, in its 1254px space.
// Left/right are screen directions. Front hair stays in the underlay; the full
// inner cut is pinned, so flutter cannot pull that hair away from the body.
function outlinePath(points) {
  let path = `M ${points[0].join(' ')}`;
  for(let i=0;i<points.length;i++) {
    const a=points[(i-1+points.length)%points.length], b=points[i], c=points[(i+1)%points.length], d=points[(i+2)%points.length];
    path += ` C ${b[0]+(c[0]-a[0])/6} ${b[1]+(c[1]-a[1])/6} ${c[0]-(d[0]-b[0])/6} ${c[1]-(d[1]-b[1])/6} ${c[0]} ${c[1]}`;
  }
  return path+' Z';
}
export const wingShapes = [
  {
    name:'left', bounds:[79,657,318,218], pivot:[381,781],
    direction:-1, fixed:335, full:278,
    path:outlinePath([
      [84,866],[89,842],[99,822],[109,807],[119,795],[129,784],[139,774],
      [149,766],[159,757],[169,750],[179,743],[189,737],[199,733],
      [209,727],[219,721],[229,715],[239,710],[249,706],[259,701],
      [269,697],[279,692],[289,688],[299,680],[309,674],[319,672],
      [329,669],[339,662],[349,660],[359,659],[365,665],
      [365,675],[359,688],[359,703],[369,720],[379,732],[390,741],
      [383,749],[376,761],[371,774],[372,788],[381,802],
      [370,805],[360,811],[350,819],[340,828],[330,824],[320,823],
      [310,823],[300,826],[290,831],[280,836],[270,843],[260,854],
      [252,867],[249,868],[246,848],[240,834],[230,817],[220,812],
      [210,808],[200,807],[190,808],[180,811],[170,814],[160,817],
      [150,821],[140,827],[130,833],[120,840],[110,849],[100,859],[90,868]
    ])
  },
  {
    name:'right',bounds:[905,661,309,202],pivot:[946,788],
    direction:1,fixed:979,full:1040,
    path:outlinePath([
      [913,750],[930,732],[939,716],[942,702],[936,690],[933,682],
      [937,672],[945,666],[952,666],[960,670],[970,674],[980,676],[986,680],
      [990,683],[1000,686],[1010,690],[1020,694],[1030,698],[1040,702],
      [1050,706],[1060,711],[1070,716],[1080,721],[1090,727],[1100,733],
      [1110,739],[1120,745],[1130,751],[1140,757],[1150,765],[1160,774],
      [1170,783],[1180,795],[1190,809],[1200,828],[1206,849],[1205,855],
      [1200,854],[1190,843],[1180,834],[1170,826],[1160,820],[1150,814],
      [1140,810],[1130,806],[1120,803],[1110,800],[1100,799],[1090,799],
      [1080,801],[1070,805],[1060,812],[1050,827],[1045,841],[1042,849],
      [1039,848],[1030,836],[1020,830],[1010,826],[1000,822],[990,822],
      [980,823],[970,824],[961,805],[950,794],[940,784],[930,774],[920,764]
    ])
  }
];

const canvas = () => {
  const out = document.createElement('canvas');
  out.width = out.height = 1254;
  return out;
};

export function wingPoint(shape, x, y, amount) {
  const u = Math.max(0, Math.min(1, (x - shape.fixed) / (shape.full - shape.fixed)));
  const weight = u * u * (3 - 2 * u);
  const angle = amount * shape.direction * 7 * Math.PI / 180 * weight;
  const [px, py] = shape.pivot, dx = x - px, dy = y - py;
  return [px + dx * Math.cos(angle) - dy * Math.sin(angle),
    py + dx * Math.sin(angle) + dy * Math.cos(angle)];
}

export function prepareWings(source, cleanUnderlay) {
  const underlay = canvas(), ctx = underlay.getContext('2d');
  ctx.drawImage(source, 0, 0);
  const wings = wingShapes.map(shape => {
    const path = new Path2D(shape.path);
    // Repair complete rear locks on either side, beyond the moving wing edge.
    // Cutting this repair at the old silhouette would truncate the newly
    // exposed hair. The center face/body and the upper hairstyle stay native.
    const mask = canvas(), m = mask.getContext('2d');
    m.fillRect(shape.direction<0?0:880, 610, shape.direction<0?420:374, 350);
    const replacement = canvas(), r = replacement.getContext('2d');
    r.drawImage(cleanUnderlay, 0, 0);
    r.globalCompositeOperation = 'destination-in'; r.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(replacement, 0, 0);
    const texture = canvas(), t = texture.getContext('2d');
    t.clip(path); t.drawImage(source, 0, 0);
    const [x, y, width, height] = shape.bounds;
    const vertices = [], triangles = [], columns = 20, rows = 14;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++)
      vertices.push([x + i * width / columns, y + j * height / rows]);
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
      triangles.push([a, b, c], [b, d, c]);
    }
    return {shape, texture, vertices, triangles};
  });
  return {underlay, wings};
}

function triangle(ctx, image, s, d) {
  const [a,b,c] = s, [p,q,r] = d;
  const ux = b[0]-a[0], uy = b[1]-a[1], vx = c[0]-a[0], vy = c[1]-a[1];
  const det = ux*vy-uy*vx;
  const dx = q[0]-p[0], dy = q[1]-p[1], ex = r[0]-p[0], ey = r[1]-p[1];
  const xx=(dx*vy-ex*uy)/det, xy=(dy*vy-ey*uy)/det;
  const yx=(ex*ux-dx*vx)/det, yy=(ey*ux-dy*vx)/det;
  const cx=(p[0]+q[0]+r[0])/3, cy=(p[1]+q[1]+r[1])/3;
  ctx.save(); ctx.beginPath();
  for(let i=0;i<3;i++) {
    const [x,y]=d[i], len=Math.hypot(x-cx,y-cy);
    const px=x+(x-cx)/len*1.2, py=y+(y-cy)/len*1.2;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath(); ctx.clip();
  ctx.transform(xx,xy,yx,yy,p[0]-xx*a[0]-yx*a[1],p[1]-xy*a[0]-yy*a[1]);
  ctx.drawImage(image,0,0); ctx.restore();
}

export function drawWings(ctx, prepared, amount) {
  for(const wing of prepared.wings) {
    if(amount===0) {ctx.drawImage(wing.texture,0,0);continue;}
    const dest=wing.vertices.map(([x,y])=>wingPoint(wing.shape,x,y,amount));
    for(const ids of wing.triangles)
      triangle(ctx,wing.texture,ids.map(i=>wing.vertices[i]),ids.map(i=>dest[i]));
  }
}

export function wingFoldCount(prepared, amount) {
  let folded=0;
  for(const wing of prepared.wings) {
    const dest=wing.vertices.map(([x,y])=>wingPoint(wing.shape,x,y,amount));
    for(const [a,b,c] of wing.triangles) {
      const cross=v=>(v[b][0]-v[a][0])*(v[c][1]-v[a][1])-(v[b][1]-v[a][1])*(v[c][0]-v[a][0]);
      if(cross(wing.vertices)*cross(dest)<=0)folded++;
    }
  }
  return folded;
}
