export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const ease = (v) => {
    const t = clamp01(v);
    return t * t * t * (t * (t * 6 - 15) + 10);
};
const rise = (t, a, b) => ease((t - a) / (b - a));
const pulse = (t, a, b, c, d) => rise(t, a, b) * (1 - rise(t, c, d));
export function wingFlutter(progress) {
    if (progress <= 0 || progress >= 1) return 0;
    return Math.sin(Math.PI * progress) ** 2 * Math.sin(6 * Math.PI * progress);
}
const eyesReopenStart = 8.35;
// A short acceleration/deceleration ramp surrounds one constant-speed stroke.
// Intermediate drawings do not restart easing or receive equal time by index.
export function strokeProgress(t, start, end) {
    const duration = end - start, ramp = .3;
    const elapsed = Math.max(0, Math.min(duration, t - start));
    const rampDistance = (seconds) => {
        const u = seconds / ramp;
        return ramp * (u * u * u - .5 * u * u * u * u);
    };
    if (elapsed < ramp)
        return rampDistance(elapsed) / (duration - ramp);
    if (elapsed > duration - ramp)
        return 1 - rampDistance(duration - elapsed) / (duration - ramp);
    return (elapsed - ramp / 2) / (duration - ramp);
}
const armAngles = [52, -8, -23, -94, -104.35];
export const poseKnots = armAngles.map(angle => (armAngles[0] - angle) / (armAngles[0] - armAngles[4]));
export function poseSegment(progress) {
    const u = clamp01(progress);
    let index = 0;
    while (index < poseKnots.length - 2 && u > poseKnots[index + 1])
        index++;
    return { index, mix: (u - poseKnots[index]) / (poseKnots[index + 1] - poseKnots[index]) };
}
// Seconds are the shared clock for the gesture, eye timing and secondary motion.
export function continuousPose(t) {
    const lifting = strokeProgress(t, 2.3, 4.65);
    const lowering = strokeProgress(t, 6.25, 8.85);
    const lift = lifting * (1 - lowering);
    const yawning = pulse(t, 4.08, 4.95, 6.12, 6.95);
    const extension = pulse(t, 3.6, 5.05, 6.0, 9.05);
    const eyes = .30 * pulse(t, .68, .96, 1.12, 1.38) +
        .60 * pulse(t, 1.52, 1.84, 2.02, 2.27) +
        rise(t, eyesReopenStart, 9.15);
    const breath = .5 - .5 * Math.cos(2 * Math.PI * t / 4.8);
    return {
        t, lift, yawning, extension, eyes, breath,
        // Begin with the final eye opening and settle before the wake finishes.
        wing: wingFlutter((t - eyesReopenStart) / 1.95),
        returning: t > 6.25,
        clothLag: Math.sin(Math.PI * lowering) * 6,
        zzz: 1 - rise(t, .5, 1.05),
        stage: t < .68 ? '小憩' : t < 2.3 ? '两次微睁' : t < 4.65 ? '抬手掩嘴' :
            t < 6.25 ? '哈欠 · 停留' : t < 8.85 ? '放松落手' : '恢复微笑',
    };
}
// Non-uniform Hermite tangents share a velocity at each drawing. Monotone
// segments cannot overshoot; an actual direction reversal has zero tangent.
export function curveValue(values, u) {
    const { index: i, mix: q } = poseSegment(u);
    const widths = poseKnots.slice(1).map((v, j) => v - poseKnots[j]);
    const slopes = widths.map((width, j) => (values[j + 1] - values[j]) / width);
    const tangent = (j) => {
        if (j === 0)
            return slopes[0];
        if (j === values.length - 1)
            return slopes[j - 1];
        const a = slopes[j - 1], b = slopes[j];
        if (a * b <= 0)
            return 0;
        const wa = 2 * widths[j] + widths[j - 1], wb = widths[j] + 2 * widths[j - 1];
        return (wa + wb) / (wa / a + wb / b);
    };
    const b = values[i], c = values[i + 1];
    const m0 = tangent(i) * widths[i], m1 = tangent(i + 1) * widths[i];
    return (2 * q * q * q - 3 * q * q + 1) * b + (q * q * q - 2 * q * q + q) * m0 +
        (-2 * q * q * q + 3 * q * q) * c + (q * q * q - q * q) * m1;
}
export function forearmPose(p) {
    return {
        elbow: [
            curveValue([625, 525, 540, 623, 630], p.lift) + (p.returning ? 4 * Math.sin(Math.PI * p.lift) : 0),
            curveValue([850, 850, 835, 820, 790], p.lift) + p.clothLag * .4,
        ],
        angle: armAngles[0] + (armAngles[4] - armAngles[0]) * p.lift,
        projection: curveValue([.94, .96, .96, .9, 1], p.lift),
    };
}
