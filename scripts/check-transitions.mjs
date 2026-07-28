// Headless check of the state-morph engine, run against the built bundle:
//
//   npm run build && node scripts/check-transitions.mjs
//
// 1. every state captures a sane frame (finite, in-bounds, alpha 0..1);
// 2. a morph at m→0 is the source frame and at m→1 the destination;
// 3. simulating the real loop (60 fps) and rasterizing each frame the way
//    the canvas does, no single frame stands out more than the animations
//    themselves do — i.e. the morph reads as motion, never as a cut.

import { MODE_DRAWS, blendDots, captureDots, resolvePreset } from '../dist/index.es.js';

const STATES = ['idle', 'working', 'searching', 'solving', 'listening', 'composing', 'shaping'];
const SIZE = 64;
const FPS = 60;
const DUR = 0.62;
// modes only touch ctx via paint(), which is intercepted while capturing
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });

const frame = (state, clock) => {
  const { mode, speed, opts } = resolvePreset(state, SIZE);
  return captureDots(() => MODE_DRAWS[mode](ctx, SIZE, speed * clock, false, opts));
};

/** Mirrors paintDots: far→near, source-over discs, with soft (AA) edges. */
function raster(dots) {
  const buf = new Float64Array(SIZE * SIZE);
  for (const d of [...dots].sort((a, b) => a.z - b.z)) {
    const alpha = d.a ?? 1;
    if (alpha < 0.02) continue;
    const w = Math.min(1, Math.max(0, d.white));
    const r = d.r;
    const y0 = Math.max(0, Math.floor(d.y - r - 1));
    const y1 = Math.min(SIZE - 1, Math.ceil(d.y + r + 1));
    const x0 = Math.max(0, Math.floor(d.x - r - 1));
    const x1 = Math.min(SIZE - 1, Math.ceil(d.x + r + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cov = Math.min(1, Math.max(0, r - Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) + 0.5)) * alpha;
        if (cov <= 0) continue;
        const i = y * SIZE + x;
        buf[i] = buf[i] * (1 - cov) + w * cov;
      }
    }
  }
  return buf;
}

const diff = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

const deltas = (frames) => {
  const out = [];
  for (let i = 1; i < frames.length; i++) out.push(diff(frames[i - 1], frames[i]));
  return out;
};

/** How far one frame's change stands out from its neighbours'. */
function jerk(series) {
  let worst = { j: 0 };
  for (let i = 1; i < series.length - 1; i++) {
    const around = (series[i - 1] + series[i + 1]) / 2;
    const j = series[i] / Math.max(around, 1e-6);
    if (j > worst.j) worst = { j, i };
  }
  return worst;
}

// --- 1. every state captures a sane frame ------------------------------
const counts = {};
for (const s of STATES) {
  const dots = frame(s, 1.23);
  if (dots.length === 0) throw new Error(`${s}: captured no dots`);
  for (const d of dots) {
    for (const k of ['x', 'y', 'z', 'r', 'white']) {
      if (!Number.isFinite(d[k])) throw new Error(`${s}: non-finite ${k}`);
    }
    const a = d.a ?? 1;
    if (!(a >= -0.001 && a <= 1.001)) throw new Error(`${s}: alpha out of range (${a})`);
    if (d.r < 0) throw new Error(`${s}: negative radius`);
  }
  counts[s] = dots.length;
}
console.log('captured dot counts:', counts);

// --- 2. the ends of a morph match the frames they join ------------------
let endDrift = 0;
for (const a of STATES) {
  for (const b of STATES) {
    if (a === b) continue;
    const fa = frame(a, 1.23);
    const fb = frame(b, 1.23);
    for (const m of [0, 0.25, 0.5, 0.75, 1]) {
      for (const d of blendDots(fa, fb, m, SIZE)) {
        if (d.x < -8 || d.x > SIZE + 8 || d.y < -8 || d.y > SIZE + 8) {
          throw new Error(`${a}→${b} @${m}: a dot escaped the frame`);
        }
      }
    }
    endDrift = Math.max(
      endDrift,
      diff(raster(blendDots(fa, fb, 0.0005, SIZE)), raster(fa)),
      diff(raster(blendDots(fa, fb, 0.9995, SIZE)), raster(fb))
    );
  }
}
console.log('pixel drift at the ends of a morph:', endDrift.toFixed(6));
if (endDrift > 0.002) throw new Error('a morph does not start/land on the plain state');

// --- 3. no frame of a morph stands out more than the animations do ------
let steadyPeak = 0;
let steadyJerk = { j: 0 };
for (const s of STATES) {
  const frames = [];
  for (let f = 0; f < 120; f++) frames.push(raster(frame(s, f / FPS)));
  const d = deltas(frames);
  steadyPeak = Math.max(steadyPeak, ...d);
  const jk = jerk(d);
  if (jk.j > steadyJerk.j) steadyJerk = { ...jk, s };
}

let peak = { d: 0 };
let worstJerk = { j: 0 };
for (const a of STATES) {
  for (const b of STATES) {
    if (a === b) continue;
    const frames = [raster(frame(a, 0))];
    let m = 0;
    for (let f = 1; f <= FPS * (DUR + 0.25); f++) {
      const clock = f / FPS;
      let dots;
      if (m >= 1) dots = frame(b, clock);
      else {
        dots = blendDots(frame(a, clock), frame(b, clock), m, SIZE);
        m = Math.min(1, m + 1 / FPS / DUR);
      }
      frames.push(raster(dots));
    }
    const d = deltas(frames);
    for (const v of d) if (v > peak.d) peak = { d: v, a, b };
    const jk = jerk(d);
    if (jk.j > worstJerk.j) worstJerk = { ...jk, a, b };
  }
}

console.log(
  `steady   peak/frame ${steadyPeak.toFixed(5)} · worst standout ${steadyJerk.j.toFixed(2)}× (${steadyJerk.s})`
);
console.log(
  `morphing peak/frame ${peak.d.toFixed(5)} (${peak.a}→${peak.b}) · worst standout ${worstJerk.j.toFixed(2)}× (${worstJerk.a}→${worstJerk.b})`
);
if (worstJerk.j > steadyJerk.j) throw new Error('a transition frame stands out more than the animations do');
console.log('transitions: OK');
