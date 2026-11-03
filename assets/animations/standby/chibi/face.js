const eyes = [
    { left: 432, right: 580, upper: [[432, 590], [450, 577], [470, 562], [490, 553], [510, 550], [530, 550], [550, 554], [568, 561], [580, 565]],
        closed: [[465, 615], [480, 615], [500, 611], [520, 605], [540, 596], [560, 590], [575, 592]],
        closedLash: 'M 465 602 Q 510 604 550 583 Q 565 582 578 592 Q 553 598 530 613 Q 514 618 501 623 L 498 633 L 494 623 L 485 629 L 477 637 L 479 627 L 469 626 L 474 618 L 465 612 Z',
        lower: [[432, 590], [450, 610], [470, 621], [490, 627], [510, 628], [530, 625], [550, 617], [566, 598], [580, 565]],
        lash: 'M 428 593 L 447 575 L 465 563 L 485 552 Q 518 536 556 551 L 581 562 L 566 569 Q 516 557 482 578 L 447 607 L 473 616 L 452 609 L 440 600 Z' },
    { left: 654, right: 796, upper: [[654, 522], [670, 505], [690, 492], [710, 480], [730, 472], [750, 469], [770, 470], [786, 480], [796, 484]],
        closed: [[674, 550], [690, 544], [710, 539], [730, 535], [750, 528], [770, 517], [785, 513]],
        closedLash: 'M 672 546 Q 701 529 734 524 Q 761 514 780 499 L 777 508 L 792 507 L 782 519 L 791 526 L 779 524 L 776 534 L 766 529 L 763 540 Q 724 550 686 554 L 673 558 Z',
        lower: [[654, 522], [670, 542], [690, 556], [710, 562], [730, 563], [750, 555], [770, 538], [786, 510], [796, 484]],
        lash: 'M 650 525 L 664 503 Q 700 474 737 465 L 748 454 L 757 466 L 775 458 L 780 470 L 801 471 L 790 488 Q 731 477 687 504 Z' },
];
function at(a, x) {
    for (let i = 1; i < a.length; i++)
        if (x <= a[i][0]) {
            const t = Math.max(0, (x - a[i - 1][0]) / (a[i][0] - a[i - 1][0]));
            return a[i - 1][1] + t * (a[i][1] - a[i - 1][1]);
        }
    return a[a.length - 1][1];
}
export function makeLashes(open, closed) {
    const cut = (image, paths) => paths.map(path => {
        const c = document.createElement('canvas');
        c.width = c.height = 1254;
        const ctx = c.getContext('2d');
        ctx.clip(new Path2D(path));
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, 1254, 1254), a = pixels.data;
        for (let i = 0; i < a.length; i += 4)
            if (a[i] > 170 || a[i + 1] > 140 || a[i + 2] > 170)
                a[i + 3] = 0;
        ctx.putImageData(pixels, 0, 0);
        return c;
    });
    return { open: cut(open, eyes.map(e => e.lash)), closed: cut(closed, eyes.map(e => e.closedLash)) };
}
export function drawFace(ctx, awake, lashes, p) {
    const opening = Math.min(1, p.eyes);
    eyes.forEach((eye, index) => {
        const closed = (x) => at(eye.closed, x) - 3 * p.yawning * Math.sin(Math.PI * (x - eye.left) / (eye.right - eye.left));
        const upper = (x) => closed(x) + (at(eye.upper, x) - closed(x)) * opening;
        const lower = (x) => closed(x) + (at(eye.lower, x) - closed(x)) * opening;
        if (opening > .002) {
            const xs = Array.from({ length: 50 }, (_, i) => eye.left + (eye.right - eye.left) * i / 49);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xs[0], upper(xs[0]));
            xs.slice(1).forEach(x => ctx.lineTo(x, upper(x)));
            xs.slice().reverse().forEach(x => ctx.lineTo(x, lower(x)));
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(awake, 0, 0);
            ctx.restore();
        }
        const blend = Math.min(1, opening / .35), thickness = .65 + .35 * opening;
        ctx.save();
        for (let x = eye.left - 5; x < eye.right + 5; x++) {
            const base = at(eye.upper, x), y = upper(x);
            ctx.globalAlpha = blend;
            ctx.drawImage(lashes.open[index], x, 430, 1, 220, x, y + (430 - base) * thickness, 1.05, 220 * thickness);
            ctx.globalAlpha = 1 - blend;
            ctx.drawImage(lashes.closed[index], x, 430, 1, 220, x, 430 + y - at(eye.closed, x), 1.05, 220);
        }
        ctx.restore();
    });
    ctx.save();
    ctx.translate(643, 619);
    ctx.rotate(-.3);
    if (p.yawning > .008) {
        const w = 8 + 26 * p.yawning, h = 1 + 48 * p.yawning;
        ctx.beginPath();
        ctx.ellipse(0, 1, w * .5, h * .5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#a75f73';
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = '#a06675';
        ctx.stroke();
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(1, h * .29, w * .40, h * .28, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#efb0ba';
        ctx.fill();
        ctx.restore();
    }
    else {
        ctx.beginPath();
        ctx.moveTo(-13, 0);
        ctx.quadraticCurveTo(0, 6, 14, -2);
        ctx.strokeStyle = '#aa6d7c';
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
    ctx.restore();
}
