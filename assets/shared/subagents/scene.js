const ASSETS = [
  {name: 'sora', file: 'sora.png', duration: 820, period: 4600, phase: 0},
  {name: 'codex', file: 'codex.png', duration: 900, period: 5200, phase: 1900},
];
const ORBIT_START = 3500, ORBIT_PERIOD = 18000;
const ORBIT_DURATION = 6000, BANK_DURATION = 500;

// Height recovers scene.resize(size). Left/right are cloud rest centres beside
// the body at shoulder height, excluding canvas padding and distant desk edges.
const FRAMES = {
  'reading:chibi': {height:1374/1200, left:140/1374, right:1254/1374},
  'work:chibi': {height:1480/1200, left:330/1754, right:1444/1754},
  'drawing:chibi': {height:1404/1200, left:330/1754, right:1444/1754},
  'thinking:chibi': {height:1696/1128, left:95/1184, right:1097/1184},
  'reading:normal': {height:1, left:60/1024, right:1010/1024},
  'work:normal': {height:1, left:170/1254, right:1180/1254},
  'drawing:normal': {height:1600/1536, left:140/1304, right:1150/1304},
};

function orbitKeyframes(side, span, height, radiusScale) {
  // Bank out from each rest anchor before changing depth at the side extrema.
  // Coordinates are in the slot's 32px local space.
  const radius = (span / 2 + 32) * radiusScale;
  const clearance = radius - span / 2;
  const start = ORBIT_START, period = ORBIT_PERIOD;
  const loopStart = start + BANK_DURATION;
  const loopEnd = start + ORBIT_DURATION - BANK_DURATION;
  const rest = 'translate(0px, 0px) scale(1)';
  const frames = [
    {offset: 0, transform: rest},
    {offset: start / period, transform: rest, easing: 'ease-in-out'},
  ];
  for (let i = 0; i <= 96; i++) {
    const t = i / 96, ramp = .12;
    const turn = t < ramp ? t * t / (2 * ramp * (1 - ramp))
      : t > 1 - ramp ? 1 - (1 - t) ** 2 / (2 * ramp * (1 - ramp))
      : (t - ramp / 2) / (1 - ramp);
    const angle = turn * Math.PI * 2, depth = -side * Math.sin(angle);
    const x = side * (radius * Math.cos(angle) - radius + clearance);
    frames.push({
      offset: (loopStart + t * (loopEnd - loopStart)) / period,
      transform: `translate(${x}px, ${depth * height * radiusScale}px) scale(${1 + depth * .08})`,
      easing: i === 96 ? 'ease-in-out' : 'linear',
    });
  }
  frames.push({offset: (start + ORBIT_DURATION) / period, transform: rest}, {offset: 1, transform: rest});
  const depth = [
    {offset: 0, zIndex: '1'},
    {offset: loopStart / period, zIndex: side < 0 ? '1' : '-1'},
    {offset: (loopStart + loopEnd) / 2 / period, zIndex: side < 0 ? '-1' : '1'},
    {offset: loopEnd / period, zIndex: '1'},
    {offset: 1, zIndex: '1'},
  ].map(frame => ({...frame, easing: 'steps(1, end)'}));
  return {frames, depth};
}

/** A presentation-only layer. Callers own the actual subagent activity. */
export class SubagentCompanions {
  constructor(stage) {
    this.stage = stage;
    this.anchor = null;
    this.active = false;
    this.paused = false;
    this.rate = 1;
    this.review = false;
    this.loaded = false;
    this.destroyed = false;
    this.layout = null;
    this.moves = [];
    stage.classList.add('subagent-stage');
    this.element = document.createElement('div');
    this.element.className = 'subagent-companions';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.hidden = true;
    stage.append(this.element);
    this.members = ASSETS.map((asset, index) => {
      const slot = document.createElement('div');
      slot.className = 'subagent-slot';
      slot.dataset.helper = asset.name;
      const orbital = document.createElement('div');
      orbital.className = 'subagent-orbit';
      const arrival = document.createElement('div');
      arrival.className = 'subagent-arrival';
      const floating = document.createElement('div');
      floating.className = 'subagent-float';
      const art = document.createElement('div');
      art.className = `subagent-art subagent-art-${asset.name}`;
      const image = new Image();
      image.alt = '';
      image.draggable = false;
      image.src = new URL(`./textures/${asset.file}`, import.meta.url).href;
      art.append(image);
      floating.append(art);
      arrival.append(floating);
      orbital.append(arrival);
      slot.append(orbital);
      this.element.append(slot);
      const side = index === 0 ? 1 : -1;
      const enter = arrival.animate([
        {opacity: 0, transform: `translate(${side * 70}%, 85%) scale(.72) rotate(${-side * 8}deg)`},
        {opacity: 1, transform: 'translate(0, 0) scale(1) rotate(0deg)'},
      ], {duration: asset.duration, easing: 'cubic-bezier(.22,.7,.32,1)', fill: 'both'});
      enter.pause();
      enter.currentTime = 0;
      const float = floating.animate([
        {transform: 'translate(-5%, 5%) rotate(-2.5deg)', easing: 'ease-in-out'},
        {transform: 'translate(6%, -12%) rotate(2.5deg)', easing: 'ease-in-out'},
        {transform: 'translate(-5%, 5%) rotate(-2.5deg)'},
      ], {duration: asset.period, iterations: Infinity});
      float.pause();
      float.currentTime = asset.phase;
      const orbit = orbital.animate([{transform: 'translate(0px, 0px)'}], {duration: ORBIT_PERIOD, iterations: Infinity});
      const depth = slot.animate([{zIndex: '1'}], {duration: ORBIT_PERIOD, iterations: Infinity});
      orbit.pause();depth.pause();
      orbit.currentTime = depth.currentTime = 0;
      enter.onfinish = () => this.sync();
      return {...asset, slot, orbital, enter, float, orbit, depth, image};
    });
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(stage);
    this.onVisibility = () => this.sync();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.ready = Promise.all(this.members.map(member => member.image.decode())).then(() => {
      if (this.destroyed) return;
      this.loaded = true;
      this.fit();
      this.sync();
    });
  }

  setAnchor(element, {scene, form}) {
    if (this.anchor !== element) {
      if (this.anchor) this.observer.unobserve(this.anchor);
      this.anchor = element;
      this.observer.observe(element);
    }
    this.scene = scene;
    this.form = form;
    this.fit();
    this.sync();
  }

  fit() {
    if (!this.anchor || this.destroyed) return;
    const rect = this.anchor.getBoundingClientRect();
    const origin = this.stage.getBoundingClientRect();
    const frame = FRAMES[`${this.scene}:${this.form}`];
    const displaySize = rect.height / frame.height;
    const size = displaySize * (this.form === 'normal' ? .12 : .17);
    const left = rect.left - origin.left - this.stage.clientLeft + this.stage.scrollLeft;
    const top = rect.top - origin.top - this.stage.clientTop + this.stage.scrollTop;
    const positions = [
      {x: left + rect.width * frame.left, y: top + rect.height * .49},
      {x: left + rect.width * frame.right, y: top + rect.height * .59},
    ];
    const layout = [...positions.flatMap(point => [point.x, point.y]), size];
    if (this.layout && layout.every((value, index) => Math.abs(value - this.layout[index]) < .1)) return;
    const animate = this.layout && !this.element.hidden && !this.review && !this.paused && !document.hidden;
    this.members.forEach((member, index) => {
      const previous = getComputedStyle(member.slot).transform;
      const oldOrbit = animate ? new DOMMatrix(getComputedStyle(member.orbital).transform) : null;
      this.moves[index]?.cancel();
      this.moves[index] = null;
      const point = positions[index];
      const scale = size / 32;
      const keyframes = orbitKeyframes(index === 0 ? -1 : 1,
        (positions[1].x - positions[0].x) / scale, displaySize * .09 / scale,
        this.form === 'chibi' ? .85 : 1);
      member.orbit.effect.setKeyframes(keyframes.frames);
      member.depth.effect.setKeyframes(keyframes.depth);
      const transform = `translate(${point.x}px, ${point.y}px) scale(${size / 32})`;
      member.slot.style.transform = transform;
      if (animate) {
        const newOrbit = new DOMMatrix(getComputedStyle(member.orbital).transform);
        const from = new DOMMatrix(previous).multiply(oldOrbit).multiply(newOrbit.inverse()).toString();
        const move = member.slot.animate([{transform: from}, {transform}], {
          duration: 520, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'none',
        });
        move.playbackRate = this.rate;
        if (this.paused || document.hidden) move.pause();
        this.moves[index] = move;
      }
    });
    this.layout = layout;
  }

  setActive(value) {
    const active = Boolean(value);
    if (this.active === active && !this.review) return;
    this.active = active;
    this.review = false;
    this.sync();
  }

  setPaused(value) {
    this.paused = Boolean(value);
    this.sync();
  }

  setPlaybackRate(rate) {
    this.rate = rate;
    this.sync();
  }

  triggerOrbit() {
    if (!this.active || this.element.hidden || this.paused || this.review || document.hidden) return;
    const phase = this.members[0].orbit.currentTime % ORBIT_PERIOD;
    // A second click continues the current circle, including the outward and
    // inward banks. Seeking only while at rest keeps both position and speed.
    if (phase >= ORBIT_START && phase < ORBIT_START + ORBIT_DURATION) return;
    for (const member of this.members) {
      member.orbit.currentTime = member.depth.currentTime = ORBIT_START;
    }
  }

  sync() {
    if (this.destroyed) return;
    const visible = this.active || this.members.some(member => member.enter.currentTime > 0);
    this.element.hidden = !visible || !this.anchor || !this.loaded;
    const running = !this.element.hidden && !this.paused && !this.review && !document.hidden;
    for (const member of this.members) {
      const time = member.enter.currentTime;
      member.enter.updatePlaybackRate((this.active ? 1 : -1) * this.rate);
      const transitioning = this.active ? time < member.duration : time > 0;
      if (running && transitioning) member.enter.play();
      else member.enter.pause();
      for (const animation of [member.float, member.orbit, member.depth]) {
        animation.updatePlaybackRate(this.rate);
        if (running) animation.play();
        else animation.pause();
      }
    }
    for (const move of this.moves.filter(Boolean)) {
      move.updatePlaybackRate(this.rate);
      if (move.playState === 'finished') continue;
      if (running) move.play();
      else move.pause();
    }
    this.element.dataset.active = String(this.active);
  }

  // Deterministic review: sample 0..1 entry, then the independent hover clock.
  // No new poses are drawn here; these are checks of the two complete sprites.
  setReviewTime(progress, seconds = 0) {
    this.review = true;
    for (const member of this.members) {
      member.enter.pause();
      member.float.pause();
      member.orbit.pause();
      member.depth.pause();
      member.enter.currentTime = Math.max(0, Math.min(1, progress)) * member.duration;
      member.float.currentTime = member.phase + seconds * 1000;
      member.orbit.currentTime = member.depth.currentTime = seconds * 1000;
    }
    for (const move of this.moves.filter(Boolean)) move.pause();
    this.element.hidden = !this.anchor || !this.loaded || progress <= 0;
  }

  setOrbitReviewTime(progress) {
    this.setReviewTime(1, (ORBIT_START + progress * ORBIT_DURATION) / 1000);
  }

  resumeReview() {
    this.review = false;
    this.sync();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    for (const member of this.members) {
      member.enter.onfinish = null;
      member.enter.cancel();
      member.float.cancel();
      member.orbit.cancel();
      member.depth.cancel();
    }
    for (const move of this.moves.filter(Boolean)) move.cancel();
    this.element.remove();
    this.stage.classList.remove('subagent-stage');
  }
}
