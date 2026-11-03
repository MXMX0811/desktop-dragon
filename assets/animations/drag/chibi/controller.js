// Angles are relative to the held body; pointer position belongs to the view.
// Different settling times give attached cloth and the tail a delayed response.
// Frequency and damping are paired to give a softer, slower return.
const PARTS = {
  body:      {limit: .13, frequency: 9.35, damping: 5.78,  x: 1,    y: .08},
  armNear:   {limit: .14, frequency: 10.2, damping: 5.61,  x: .92,  y: .25},
  armFar:    {limit: .14, frequency: 8.5,  damping: 4.505, x: .78,  y: -.22},
  legNear:   {limit: .12, frequency: 7.65, damping: 4.08,  x: .85,  y: -.3},
  legFar:    {limit: .12, frequency: 6.8,  damping: 3.74,  x: .72,  y: .35},
  kneeNear:  {limit: .06, frequency: 10.2, damping: 5.1,   x: .3,   y: .8},
  kneeFar:   {limit: .06, frequency: 9.35, damping: 4.93,  x: .24,  y: .72},
  tail:      {limit: .16, frequency: 5.95, damping: 3.06,  x: .85,  y: .18},
  tailTip:   {limit: .12, frequency: 5.1,  damping: 2.72,  x: 0,    y: 0},
  skirtNear: {limit: .10, frequency: 6.8,  damping: 3.825, x: .78,  y: .4},
  skirtFar:  {limit: .10, frequency: 5.95, damping: 3.4,   x: .64,  y: -.35},
  hair:      {limit: .06, frequency: 6.8,  damping: 4.08,  x: .65,  y: .15},
  wing:      {limit: .06, frequency: 11.05, damping: 5.95, x: .5,   y: .35},
};

// Same exact damped-spring integration used by the existing question/attention
// controllers. Position and angular velocity survive input changes and release.
function advance(state, target, frequency, damping, dt) {
  const offset = state.position - target;
  const oscillation = Math.sqrt(frequency ** 2 - damping ** 2);
  const phase = oscillation * dt, decay = Math.exp(-damping * dt);
  const c = Math.cos(phase), s = Math.sin(phase), velocity = state.velocity;
  state.position = target + decay * (offset * c + (velocity + damping * offset) / oscillation * s);
  state.velocity = decay * (velocity * c - (damping * velocity + frequency ** 2 * offset) / oscillation * s);
  if (target === 0 && Math.abs(state.position) < .00001 && Math.abs(state.velocity) < .0001) {
    state.position = state.velocity = 0;
  }
}

export class DragController {
  constructor() {
    this.dragging = false;
    this.pointerX = 0;
    this.pointerY = 0;
    this.inputX = 0;
    this.inputY = 0;
    this.inputAge = 0;
    this.parts = Object.fromEntries(Object.keys(PARTS).map(name => [name, {position: 0, velocity: 0}]));
  }

  begin() {
    this.dragging = true;
  }

  // dx/dy: pointer displacement divided by displayed character height.
  // dt: positive seconds since the preceding pointer sample.
  move(dx, dy, dt) {
    this.pointerX = dx / dt;
    this.pointerY = dy / dt;
    this.inputAge = 0;
  }

  release() {
    this.dragging = false;
    this.pointerX = this.pointerY = 0;
    this.inputX = this.inputY = 0;
  }

  update(dt) {
    // Resolve the coupled tail and changing input at the same small step across
    // display rates. A held, stationary pointer loses its drive after 60 ms.
    for (let left = dt; left > 0;) {
      const step = Math.min(left, 1 / 120);
      const oldAge = this.inputAge;
      this.inputAge += step;
      const quietTime = Math.max(0, this.inputAge - .06) - Math.max(0, oldAge - .06);
      const decay = Math.exp(-14 * quietTime);
      this.pointerX *= decay;
      this.pointerY *= decay;
      const blend = 1 - Math.exp(-18 * step);
      this.inputX += (this.pointerX - this.inputX) * blend;
      this.inputY += (this.pointerY - this.inputY) * blend;
      if (Math.abs(this.inputX) < .00001) this.inputX = 0;
      if (Math.abs(this.inputY) < .00001) this.inputY = 0;
      const x = Math.tanh(this.inputX * .45), y = Math.tanh(this.inputY * .4);
      for (const [name, tuning] of Object.entries(PARTS)) {
        const target = name === 'tailTip' ? this.parts.tail.position * .75
          : this.dragging ? 1.65 * (tuning.x * x + tuning.y * y) : 0;
        advance(this.parts[name], target, tuning.frequency, tuning.damping, step);
      }
      left -= step;
    }
    return this.sample();
  }

  sample() {
    const pose = {};
    let settling = false;
    for (const [name, tuning] of Object.entries(PARTS)) {
      const state = this.parts[name];
      // A smooth angular limit preserves continuous motion at fast reversals.
      pose[name] = tuning.limit * Math.tanh(state.position);
      settling ||= Math.abs(state.position) > .00001 || Math.abs(state.velocity) > .0001;
    }
    return {...pose, settling, dragging: this.dragging};
  }
}
