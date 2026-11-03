import {forearmPose} from './motion.js';
import {drawFace, makeLashes} from './face.js';
import {drawSleeve, makeSleeveTexture, makeOrnament, drawOrnament} from './sleeve.js';
import {prepareWings, drawWings} from './wings.js';

export const forearmOutline = 'M 579.5 628.4 C 575.8 624.2 573 624.8 570.4 629 C 568.6 633.1 566.3 642.5 565.6 648 C 565.4 663.3 577 684.4 591.4 693.8 L 592 717 C 593 730 606 751 623 771 Q 632 782 639 789 L 640.7 760 L 640.2 742 L 639.1 722 L 638 696.3 C 641.4 689.3 643.2 681.8 643.1 669.2 C 641.7 661.5 641.4 656.5 642.3 650 C 643.4 639.5 641.5 625.2 637.4 622.1 Q 635.6 619.9 634.2 619.7 C 632.3 619.6 631 621 630.5 622.5 C 632 615.1 629.2 608.4 625.4 607.1 C 623.3 606.2 621.4 607.3 620.2 608.7 C 619.2 601.5 616.4 597.5 612.1 597.9 C 607.9 598 603.5 603.4 601.2 606.9 C 599.3 601.5 595.9 600.8 592.6 602.8 C 587.7 606.1 582.5 618.4 579.5 628.4 Z';

export function drawArm(ctx, image, pose) {
  const arm = forearmPose(pose);
  ctx.save();
  ctx.translate(...arm.elbow);
  ctx.rotate((arm.angle + 104.35) * Math.PI / 180);
  ctx.scale(1, arm.projection);
  ctx.translate(-630, -790);
  ctx.clip(new Path2D(forearmOutline));
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

export function prepareArt({underlay, wingUnderlay, cloth, awake, sleep, yawn}) {
  const wingLayers = prepareWings(underlay, wingUnderlay);
  return {underlay: wingLayers.underlay, wingLayers, awake, yawn, lashes: makeLashes(awake, sleep),
    shoulder: makeSleeveTexture(cloth, 'shoulder'),
    sleeve: makeSleeveTexture(cloth, 'cloth'), ornament: makeOrnament(awake)};
}

export async function loadArt() {
  const read = async name => {
    const image = new Image();
    image.src = new URL(`./textures/${name}.png`, import.meta.url).href;
    await image.decode();
    return image;
  };
  const [underlay, wingUnderlay, cloth, awake, sleep, yawn] = await Promise.all(
    ['underlay', 'wing-underlay', 'sleeve', 'awake', 'sleep', 'yawn'].map(read));
  return prepareArt({underlay, wingUnderlay, cloth, awake, sleep, yawn});
}

export function drawPet(ctx, art, pose) {
  ctx.clearRect(0, 0, 1414, 1414);
  ctx.save();
  ctx.translate(80, 80);
  ctx.translate(635, 1220);
  ctx.rotate(-.008 * pose.extension);
  ctx.scale(1 + .014 * pose.breath, 1 + .028 * pose.breath + .016 * pose.extension);
  ctx.translate(-635, -1220);
  ctx.drawImage(art.underlay, 0, 0);
  drawWings(ctx, art.wingLayers, pose.wing);
  drawFace(ctx, art.awake, art.lashes, pose);
  drawSleeve(ctx, art.shoulder, pose, false);
  drawArm(ctx, art.yawn, pose);
  drawSleeve(ctx, art.sleeve, pose, true);
  drawOrnament(ctx, art.ornament, pose);
  for (let i = 0; i < 3; i++) {
    const u = (pose.t * .29 + i * .32) % 1;
    ctx.globalAlpha = Math.sin(Math.PI * u) * pose.zzz * .8;
    ctx.fillStyle = '#b6a1d2';
    ctx.font = `700 ${42 + u * 52}px Arial, sans-serif`;
    ctx.fillText('z', 990 + u * 90, 390 - u * 170);
  }
  ctx.restore();
}
