import {continuousPose, ease, wingFlutter} from './motion.js';

const WAKE_PLAYBACK_RATE = 1.5;
export const WAKE_DURATION = 11 / WAKE_PLAYBACK_RATE;
const RESPONSE_DURATION = 1.3;
const breathAt = time => .5 - .5 * Math.cos(2 * Math.PI * time / 4.8);

// The gesture has a finite duration; sleep and standby keep their own live clock.
export class WakeController {
  constructor(random = Math.random) {
    this.random = random;
    this.time = 0;
    this.state = 'standby';
    this.stateStart = 0;
    this.blinkStart = null;
    this.blinkEyes = 1;
    this.responseStart = null;
    this.nextBlink = 3.2;
    this.sleepEyes = 1;
    this.wakeEyes = 0;
    this.wakeZzz = 1;
  }

  wake() {
    if (!['sleeping', 'falling-asleep'].includes(this.state)) return false;
    const pose = this.sample();
    this.wakeEyes = pose.eyes;
    this.wakeZzz = pose.zzz;
    this.responseStart = null;
    this.state = 'waking';
    this.stateStart = this.time;
    return true;
  }

  touch() {
    if (this.state === 'sleeping' || this.state === 'falling-asleep') return this.wake();
    if (this.state !== 'standby' || this.responseStart !== null) return false;
    this.blinkEyes = this.sample().eyes;
    this.blinkStart = this.responseStart = this.time;
    return true;
  }

  sleep() {
    if (this.state !== 'standby') return false;
    this.sleepEyes = this.sample().eyes;
    this.state = 'falling-asleep';
    this.stateStart = this.time;
    this.blinkStart = this.responseStart = null;
    return true;
  }

  seek(time) {
    this.time = time;
    this.stateStart = 0;
    this.state = time < WAKE_DURATION ? 'waking' : 'standby';
    this.blinkStart = this.responseStart = null;
    this.nextBlink = time + 3.2;
    this.wakeEyes = 0;
    this.wakeZzz = 1;
  }

  update(seconds) {
    this.time += seconds;
    const age = this.time - this.stateStart;
    if (this.state === 'waking' && age >= WAKE_DURATION) {
      this.state = 'standby';
      this.stateStart += WAKE_DURATION;
      this.nextBlink = this.time + 3 + this.random() * 2;
    } else if (this.state === 'falling-asleep' && age >= .6) {
      this.state = 'sleeping';
      this.stateStart += .6;
    }
    if (this.state === 'standby') {
      if (this.blinkStart !== null && this.time - this.blinkStart >= .32) {
        this.blinkStart = null;
        this.nextBlink = this.time + 3 + this.random() * 2;
      }
      if (this.responseStart !== null && this.time - this.responseStart >= RESPONSE_DURATION) {
        this.responseStart = null;
      }
      if (this.blinkStart === null && this.responseStart === null && this.time >= this.nextBlink) {
        this.blinkEyes = 1;
        this.blinkStart = this.time;
      }
    }
    return this.sample();
  }

  sample() {
    const age = this.time - this.stateStart;
    const wakeTime = this.state === 'waking' ? age : this.state === 'standby' ? WAKE_DURATION : 0;
    const gestureTime = wakeTime * WAKE_PLAYBACK_RATE;
    const pose = {...continuousPose(gestureTime), t: this.time, breath: breathAt(this.time)};
    if (this.state === 'waking' && gestureTime < .3) {
      const settling = ease(gestureTime / .3);
      pose.eyes += this.wakeEyes * (1 - settling);
      pose.zzz = this.wakeZzz + (pose.zzz - this.wakeZzz) * settling;
    }
    if (this.state === 'sleeping') pose.stage = '休眠中 · 点击唤醒';
    if (this.state === 'falling-asleep') {
      const closing = ease(age / .6);
      pose.eyes = this.sleepEyes * (1 - closing);
      pose.zzz = closing;
      pose.stage = '准备休眠';
    }
    if (this.state === 'standby') {
      if (this.blinkStart !== null) {
        const blinkAge = this.time - this.blinkStart;
        pose.eyes = blinkAge < .1 ? this.blinkEyes * (1 - ease(blinkAge / .1))
          : blinkAge < .14 ? 0 : ease((blinkAge - .14) / .18);
      }
      if (this.responseStart !== null) {
        const progress = (this.time - this.responseStart) / RESPONSE_DURATION;
        // Three strokes share a smooth envelope, resting without a speed jump.
        pose.wing = wingFlutter(progress);
      }
      pose.stage = this.responseStart === null ? '陪伴中 · 点击眨眼振翅回应' : '眨眼振翅回应';
    }
    return {...pose, state: this.state, wakeTime};
  }
}
