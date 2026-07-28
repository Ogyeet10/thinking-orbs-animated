// Idle: the orb at rest. A Fibonacci dot shell turns slowly — one lazy
// revolution rather than a spin — while the ball nods a few degrees so it
// never reads as a rigid turntable. On top of that each dot creeps around
// its own home position on a tiny circle and breathes in and out by a
// couple of percent, on its own phase. The motion is small enough that
// the field looks still; it just refuses to look frozen.

import type { Dot, ModeDraw } from './types';
import { fibDir, hashD, makeProj, paint, radiusScale } from './core';

const TAU = Math.PI * 2;

export const drawIdle: ModeDraw = (ctx, size, t, dark, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.82;
  // the turn, and a slow nod on top of it
  const pt = makeProj(t * (o.spin ?? 0.34), 0.34 + 0.08 * Math.sin(t * 0.17), cx, cy, 1);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const n = Math.max(8, Math.round(o.dotN ?? 170));
  const breath = o.breath ?? 0.018; // radial, per dot
  const drift = o.drift ?? 0.022; // tangential, per dot
  const aFar = o.aFar ?? 0.72;

  const dots: Dot[] = [];
  for (let i = 0; i < n; i++) {
    const [dx, dy, dz] = fibDir(i, n);
    const h1 = hashD(i, 3.1);
    const h2 = hashD(i, 7.7);

    // tangent frame at the dot's home direction: u = d × a (with `a` the
    // axis least aligned with d, so the cross product never degenerates),
    // v = d × u. The dot creeps around the tiny circle they span.
    const ax = Math.abs(dz) > 0.9 ? 1 : 0;
    const az = Math.abs(dz) > 0.9 ? 0 : 1;
    let ux = dy * az;
    let uy = dz * ax - dx * az;
    let uz = -dy * ax;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = dy * uz - dz * uy;
    const vy = dz * ux - dx * uz;
    const vz = dx * uy - dy * ux;

    const ph = h2 * TAU + t * (o.driftRate ?? 0.31);
    const cp = Math.cos(ph) * drift;
    const sp = Math.sin(ph) * drift;
    // ...and breathes in and out on its own phase
    const rr = R * (1 + breath * Math.sin(t * (o.breathRate ?? 0.53) + h1 * TAU));

    const [px, py, z] = pt((dx + ux * cp + vx * sp) * rr, (dy + uy * cp + vy * sp) * rr, (dz + uz * cp + vz * sp) * rr);
    // breath + drift can push a dot just past R, so clamp before depth
    // drives radius, ink and alpha
    const depth = Math.min(1, Math.max(0, (z / R + 1) / 2));
    dots.push({
      x: px,
      y: py,
      z,
      r: ((o.rBase ?? 0.7) + (o.rDepth ?? 2) * depth) * rs,
      white: (o.inkFar ?? 0.62) - (o.inkSpan ?? 0.54) * depth,
      // the far side thins out — the shell reads as airy, not solid
      a: aFar + (1 - aFar) * depth
    });
  }
  paint(ctx, dots, dark, o.rMin);
};
