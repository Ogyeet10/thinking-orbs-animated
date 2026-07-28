// Dot-level morphing between two captured frames. Modes have wildly
// different dot counts and topologies (a 700-dot globe vs a 34-dot
// outline), so a cross-fade would read as two overlapping animations.
// Instead every dot of the outgoing frame travels to a dot of the
// incoming one:
//
//   1. both frames are ordered by angle around the centre, so pairs are
//      rotationally coherent — nothing flies across the orb;
//   2. the shorter list is fanned out over the longer one — the extra
//      copies bud out of their parent from zero radius (and merging dots
//      shrink back into it), so each end of the morph is pixel-identical
//      to the frame it starts or lands on;
//   3. dots travel in POLAR space (radius + shortest-arc angle), so they
//      curve around the centre instead of collapsing through it;
//   4. a small per-dot stagger, distributed by angle, makes the change
//      sweep around the orb rather than snapping as one rigid block.

import type { Dot } from './core';

/** Smootherstep — zero 1st AND 2nd derivative at both ends. */
function ease(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * c * (c * (c * 6 - 15) + 10);
}

interface Keyed {
  k: number;
  d: Dot;
}

/** Frame ordered by angle around the centre — the pairing key. */
function byAngle(dots: Dot[], c: number): Dot[] {
  const keyed: Keyed[] = new Array(dots.length);
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i];
    keyed[i] = { k: Math.atan2(d.y - c, d.x - c), d };
  }
  keyed.sort((a, b) => a.k - b.k);
  const out: Dot[] = new Array(dots.length);
  for (let i = 0; i < keyed.length; i++) out[i] = keyed[i].d;
  return out;
}

function mixDot(p: Dot, q: Dot, e: number, c: number, rScale: number): Dot {
  const px = p.x - c;
  const py = p.y - c;
  const rp = Math.hypot(px, py);
  const rq = Math.hypot(q.x - c, q.y - c);
  const ap = Math.atan2(py, px);
  const aq = Math.atan2(q.y - c, q.x - c);
  // shortest arc — pairs are angle-sorted, so this is a short sweep
  const da = Math.atan2(Math.sin(aq - ap), Math.cos(aq - ap));
  const ang = ap + da * e;
  const rad = rp + (rq - rp) * e;
  const pa = p.a ?? 1;
  const qa = q.a ?? 1;
  return {
    x: c + Math.cos(ang) * rad,
    y: c + Math.sin(ang) * rad,
    z: p.z + (q.z - p.z) * e,
    r: (p.r + (q.r - p.r) * e) * rScale,
    white: p.white + (q.white - p.white) * e,
    a: pa + (qa - pa) * e
  };
}

/** Fraction of the transition spent staggering dots around the orb. */
const STAGGER = 0.3;

/**
 * Morph frame `from` into frame `to` at linear progress `m` (0..1).
 * Returns a fresh dot list ready for `paintDots`.
 */
export function blendDots(from: Dot[], to: Dot[], m: number, size: number): Dot[] {
  if (m <= 0 || to.length === 0) return from;
  if (m >= 1 || from.length === 0) return to;

  const c = size / 2;
  const a = byAngle(from, c);
  const b = byAngle(to, c);
  const na = a.length;
  const nb = b.length;
  const n = Math.max(na, nb);

  const out: Dot[] = new Array(n);
  let lastA = -1;
  let lastB = -1;
  for (let i = 0; i < n; i++) {
    const ia = Math.floor((i * na) / n);
    const ib = Math.floor((i * nb) / n);
    // u sweeps 0→1 around the orb; later dots start their morph later
    const u = n > 1 ? i / (n - 1) : 0;
    const e = ease(m * (1 + STAGGER) - STAGGER * u);
    // Only one side can have duplicates (n is the larger count). A dot
    // repeated on the source side buds out of its parent; one repeated on
    // the target side shrinks back into it as they converge.
    // √ so the dot's AREA — its ink — ramps linearly
    let rScale = 1;
    if (ia === lastA) rScale = Math.sqrt(e);
    else if (ib === lastB) rScale = Math.sqrt(1 - e);
    lastA = ia;
    lastB = ib;
    out[i] = mixDot(a[ia], b[ib], e, c, rScale);
  }
  return out;
}
