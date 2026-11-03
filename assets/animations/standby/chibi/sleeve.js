import {Delaunator} from '../../../vendor/delaunator.js';
import { curveValue } from './motion.js';
// Matching outlines from the five full drawings, clockwise from the shoulder.
// One painted surface follows all poses, keeping lines opaque during motion.
const outlines = [
    [[586, 676], [616, 684], [629, 713], [630, 740], [625, 755], [639, 780], [653, 814], [677, 856], [699, 878], [713, 895], [687, 893], [659, 915], [620, 932], [568, 945], [520, 959], [477, 973], [490, 940], [510, 895], [530, 851], [548, 825], [561, 791], [558, 768], [550, 743], [546, 712], [558, 685]],
    [[586, 676], [618, 684], [631, 711], [628, 740], [617, 760], [604, 782], [615, 801], [627, 831], [629, 862], [625, 888], [617, 909], [595, 933], [566, 950], [531, 964], [507, 975], [486, 978], [499, 948], [510, 925], [520, 901], [527, 873], [532, 838], [538, 790], [520, 761], [540, 716], [557, 688]],
    [[586, 676], [618, 684], [631, 711], [628, 740], [617, 760], [602, 777], [618, 791], [626, 814], [629, 849], [625, 882], [617, 903], [595, 928], [566, 946], [531, 960], [507, 975], [486, 978], [499, 948], [510, 925], [520, 901], [527, 873], [532, 838], [538, 790], [520, 761], [540, 716], [557, 688]],
    [[576, 677], [594, 682], [600, 702], [594, 728], [587, 743], [598, 767], [613, 796], [632, 831], [650, 868], [655, 902], [649, 926], [625, 947], [591, 956], [553, 956], [521, 952], [493, 958], [501, 930], [509, 907], [515, 882], [520, 856], [527, 819], [534, 778], [512, 758], [537, 719], [550, 691]],
    [[575, 676], [592, 677], [599, 693], [598, 713], [593, 726], [608, 751], [626, 782], [645, 814], [667, 855], [682, 896], [681, 913], [661, 940], [618, 954], [571, 953], [526, 948], [491, 956], [501, 928], [511, 903], [517, 876], [523, 851], [529, 813], [537, 775], [520, 757], [534, 718], [549, 691]],
];
const details = [
    [[568, 803], [585, 763], [550, 841], [533, 902], [579, 870], [543, 932], [646, 870], [590, 715]],
    [[516, 798], [559, 758], [501, 840], [492, 903], [558, 885], [530, 934], [605, 859], [584, 712]],
    [[521, 794], [559, 755], [502, 835], [493, 895], [565, 868], [540, 929], [610, 838], [590, 715]],
    [[525, 790], [560, 741], [505, 837], [499, 900], [596, 884], [561, 934], [624, 865], [569, 710]],
    [[528, 786], [559, 736], [510, 833], [502, 897], [601, 870], [568, 931], [653, 866], [566, 709]],
];
const points = outlines.map((outline, i) => [...outline, ...[0, 1, 2, 4, 6, 7].map(j => details[i][j])]);
const within = ([x, y], cage) => {
    let inside = false;
    for (let i = 0, j = cage.length - 1; i < cage.length; j = i++) {
        if ((cage[i][1] > y) !== (cage[j][1] > y) && x < (cage[j][0] - cage[i][0]) * (y - cage[i][1]) / (cage[j][1] - cage[i][1]) + cage[i][0])
            inside = !inside;
    }
    return inside;
};
const mean = points[0].map((_, i) => [
    points.reduce((sum, pose) => sum + pose[i][0], 0) / points.length,
    points.reduce((sum, pose) => sum + pose[i][1], 0) / points.length,
]);
const raw = Delaunator.from(mean).triangles, triangles = [];
for (let i = 0; i < raw.length; i += 3) {
    const ids = [raw[i], raw[i + 1], raw[i + 2]];
    if (within([ids.reduce((s, j) => s + mean[j][0], 0) / 3, ids.reduce((s, j) => s + mean[j][1], 0) / 3], mean.slice(0, 25)))
        triangles.push(...ids);
}
export function sleevePoints(p) {
    return points[0].map((point, i) => [
        curveValue(points.map(v => v[i][0]), p.lift),
        curveValue(points.map(v => v[i][1]), p.lift) + p.clothLag * Math.min(1, Math.max(0, (point[1] - 780) / 150)),
    ]);
}
function contour(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (let i = 0; i < pts.length; i++) {
        const a = pts[(i - 1 + pts.length) % pts.length];
        const b = pts[i], c = pts[(i + 1) % pts.length], d = pts[(i + 2) % pts.length];
        ctx.bezierCurveTo(b[0] + (c[0] - a[0]) * .11, b[1] + (c[1] - a[1]) * .11, c[0] - (d[0] - b[0]) * .11, c[1] - (d[1] - b[1]) * .11, c[0], c[1]);
    }
    ctx.closePath();
}
// The shoulder is behind the forearm; only cloth can cover the elbow root.
// Both layers share the same mesh so their seam stays attached throughout.
const cuffBoundary = 'M 0 766 L 564 766 Q 567 758 572 755 L 577 755 Q 581 748 586 746 L 590 745 Q 595 740 604 741 L 614 742 Q 617 744 622 744 Q 627 746 632 751 L 1254 751';
export function makeSleeveTexture(image, part) {
    const c = document.createElement('canvas');
    c.width = c.height = 1254;
    const ctx = c.getContext('2d');
    contour(ctx, outlines[0]);
    ctx.clip();
    const end = part === 'shoulder' ? 'L 1254 0 L 0 0 Z' : 'L 1254 1254 L 0 1254 Z';
    ctx.clip(new Path2D(cuffBoundary + end));
    ctx.drawImage(image, 0, 0);
    return c;
}
function drawTriangle(ctx, image, s, d) {
    const [s0, s1, s2] = s, [d0, d1, d2] = d;
    const ux = s1[0] - s0[0], uy = s1[1] - s0[1], vx = s2[0] - s0[0], vy = s2[1] - s0[1];
    const det = ux * vy - uy * vx;
    const dx = d1[0] - d0[0], dy = d1[1] - d0[1], ex = d2[0] - d0[0], ey = d2[1] - d0[1];
    const a = (dx * vy - ex * uy) / det, c = (ex * ux - dx * vx) / det;
    const b = (dy * vy - ey * uy) / det, e = (ey * ux - dy * vx) / det;
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const expanded = d.map(([x, y]) => { const r = Math.hypot(x - cx, y - cy); return [x + (x - cx) / r * .7, y + (y - cy) / r * .7]; });
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...expanded[0]);
    ctx.lineTo(...expanded[1]);
    ctx.lineTo(...expanded[2]);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, e, d0[0] - a * s0[0] - c * s0[1], d0[1] - b * s0[0] - e * s0[1]);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
}
export function drawSleeve(ctx, image, p, outline) {
    const dest = sleevePoints(p), source = points[0];
    ctx.save();
    contour(ctx, dest.slice(0, 25));
    ctx.clip();
    for (let i = 0; i < triangles.length; i += 3) {
        const ids = [triangles[i], triangles[i + 1], triangles[i + 2]];
        drawTriangle(ctx, image, ids.map(j => source[j]), ids.map(j => dest[j]));
    }
    ctx.restore();
    if (!outline) return;
    // This is the actual free cloth edge revealed by removing the ornament.
    // Keep its contour connected; internal shoulder/arm joins are not outlined.
    const edge = dest.slice(15, 23);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...edge[0]);
    for (let i = 0; i < edge.length - 1; i++) {
        const a = edge[Math.max(0, i - 1)], b = edge[i], c = edge[i + 1], d = edge[Math.min(edge.length - 1, i + 2)];
        ctx.bezierCurveTo(b[0] + (c[0] - a[0]) * .11, b[1] + (c[1] - a[1]) * .11, c[0] - (d[0] - b[0]) * .11, c[1] - (d[1] - b[1]) * .11, ...c);
    }
    ctx.strokeStyle = '#6c567d';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
}
export function sleeveFoldCount(p) {
    const dest = sleevePoints(p);
    let flipped = 0;
    for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
        const cross = (v) => (v[b][0] - v[a][0]) * (v[c][1] - v[a][1]) - (v[b][1] - v[a][1]) * (v[c][0] - v[a][0]);
        if (cross(points[0]) * cross(dest) <= 0)
            flipped++;
    }
    return flipped;
}
// The knot and tassels keep their original contours instead of stretching with cloth.
export function makeOrnament(image) {
    const c = document.createElement('canvas');
    c.width = c.height = 1254;
    const ctx = c.getContext('2d');
    ctx.clip(new Path2D('M 552 778 Q 550 764 567 762 Q 580 759 588 772 Q 605 771 608 785 Q 612 806 596 820 Q 591 832 580 836 Q 587 843 580 848 L 589 900 L 588 908 Q 570 914 551 907 L 546 902 Q 530 905 514 893 L 536 851 Q 531 844 540 836 Q 526 829 531 815 Q 528 797 539 787 Q 539 778 552 778 Z'));
    ctx.drawImage(image, 0, 0);
    return c;
}
export function drawOrnament(ctx, image, p) {
    const x = curveValue(details.map(v => v[0][0]), p.lift), y = curveValue(details.map(v => v[0][1]), p.lift);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-.10 * p.lift + .012 * Math.sin(Math.PI * p.lift));
    ctx.translate(-568, -803);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
}
