// The ThinkingOrb component. One shared clock (performance.now) keeps
// every mounted orb in phase; each instance runs its own rAF loop but
// pauses automatically while offscreen (IntersectionObserver) or when
// the tab is hidden (visibilitychange). Reduced-motion users get a
// static representative frame that still follows the live theme.
//
// Prop changes never restart the loop: a new `state` morphs dot-by-dot
// into place (see ./scene), a new `speed` warps the clock continuously,
// pausing freezes it and resuming picks up exactly where it stopped, and
// a theme flip fades ink polarity instead of snapping.

import { useEffect, useRef } from 'react';
import { paintDots } from './engine/core';
import type { OrbNode } from './scene';
import { advance, drawLeaf, isSettled, leafTime, orbLeaf, renderNode, transitionTo } from './scene';
import { useReducedMotion, useResolvedDark } from './theme';
import type { OrbState, ThinkingOrbProps } from './types';

const LABELS: Record<string, string> = {
  working: 'Working…',
  searching: 'Searching…',
  solving: 'Solving…',
  listening: 'Listening…',
  composing: 'Composing…',
  shaping: 'Shaping…'
};

/** Default state-morph duration, in ms. */
const TRANSITION_MS = 620;
/** Theme flips fade their ink polarity over this many seconds. */
const THEME_FADE = 0.3;
/** …but the very first theme resolution after mount snaps. */
const THEME_SETTLE = 0.4;
/** Deterministic frame shown to reduced-motion users. */
const STATIC_T = 0.6;

const noop = () => {};

interface Live {
  speed: number;
  paused: boolean;
  dark: boolean;
  transition: number;
}

interface Runtime {
  node: OrbNode;
  /** Warped seconds: `now * speed + shift`, or `frozen` while paused. */
  shift: number;
  frozen: number | null;
  lastSpeed: number;
  lastNow: number;
  born: number;
  darkMix: number;
}

const nowSec = () => performance.now() / 1000;

export function ThinkingOrb({
  state = 'working',
  size = 64,
  theme = 'auto',
  speed = 1,
  paused = false,
  transition = TRANSITION_MS,
  style,
  'aria-label': ariaLabel,
  ...rest
}: ThinkingOrbProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const dark = useResolvedDark(theme, ref);
  const reduced = useReducedMotion();

  // Everything the loop reads lives in refs, so prop changes are absorbed
  // by the running animation instead of tearing it down.
  const live = useRef<Live>({ speed, paused, dark, transition });
  const stateRef = useRef<OrbState>(state);
  const rt = useRef<Runtime | null>(null);
  const kick = useRef<() => void>(noop);
  const repaintStatic = useRef<() => void>(noop);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clear = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
    };

    // reduced motion → one static, deterministic frame per change
    if (reduced) {
      rt.current = null;
      const paint = () => {
        clear();
        drawLeaf(ctx, stateRef.current, size, STATIC_T, live.current.dark);
      };
      paint();
      repaintStatic.current = paint;
      return () => {
        repaintStatic.current = noop;
      };
    }

    const t0 = nowSec();
    const runtime: Runtime = {
      node: orbLeaf(stateRef.current),
      shift: 0,
      frozen: null,
      lastSpeed: live.current.speed,
      lastNow: t0,
      born: t0,
      darkMix: live.current.dark ? 1 : 0
    };
    rt.current = runtime;

    /** Draws one frame; returns true when nothing is left to animate. */
    const frame = (now: number): boolean => {
      const l = live.current;
      const dt = Math.min(0.05, Math.max(0, now - runtime.lastNow));
      runtime.lastNow = now;

      // clock: `shift` absorbs speed changes and pauses, so the phase is
      // continuous across both — the orb never jumps or restarts
      if (l.speed !== runtime.lastSpeed) {
        runtime.shift += now * (runtime.lastSpeed - l.speed);
        runtime.lastSpeed = l.speed;
      }
      if (l.paused) {
        if (runtime.frozen === null) runtime.frozen = now * l.speed + runtime.shift;
      } else if (runtime.frozen !== null) {
        runtime.shift = runtime.frozen - now * l.speed;
        runtime.frozen = null;
      }
      const clock = runtime.frozen ?? now * l.speed + runtime.shift;

      // state morphs run on real time, so they still play while paused
      if (!isSettled(runtime.node)) {
        runtime.node = advance(runtime.node, dt / Math.max(0.016, l.transition / 1000));
      }

      const inkTarget = l.dark ? 1 : 0;
      if (runtime.darkMix !== inkTarget) {
        // the first resolution (auto theme, post-mount) snaps; later
        // toggles fade
        const snap = now - runtime.born < THEME_SETTLE;
        const step = snap ? 1 : Math.min(1, dt / THEME_FADE);
        runtime.darkMix += (inkTarget - runtime.darkMix) * step;
        if (Math.abs(inkTarget - runtime.darkMix) < 0.002) runtime.darkMix = inkTarget;
      }

      clear();
      const settled = isSettled(runtime.node);
      if (settled && (runtime.darkMix === 0 || runtime.darkMix === 1)) {
        // steady state: straight to the mode painter, no extra work
        const st = (runtime.node as { state: OrbState }).state;
        drawLeaf(ctx, st, size, leafTime(st, size, clock), runtime.darkMix === 1);
      } else {
        paintDots(ctx, renderNode(ctx, runtime.node, size, clock), runtime.darkMix);
      }
      return settled && runtime.darkMix === inkTarget;
    };

    let raf = 0;
    let running = false;
    let visible = true;
    const loop = () => {
      const atRest = frame(nowSec());
      // while paused there is nothing left to draw once everything settles
      if (running && !(live.current.paused && atRest)) raf = requestAnimationFrame(loop);
      else running = false;
    };
    const start = () => {
      if (running || !visible || document.visibilityState === 'hidden') return;
      runtime.lastNow = nowSec();
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    kick.current = start;

    // draw at least one frame even when paused/offscreen
    frame(t0);

    // pause offscreen + on hidden tabs — free when not visible
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && document.visibilityState !== 'hidden') start();
            else stop();
          })
        : null;
    io?.observe(canvas);
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVis);
    if (!io) start();

    return () => {
      stop();
      kick.current = noop;
      rt.current = null;
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [size, reduced]);

  // keep the loop's view of the props fresh (runs after every render)
  useEffect(() => {
    live.current = { speed, paused, dark, transition };
    stateRef.current = state;
    repaintStatic.current();
    kick.current();
  });

  // a new state retargets the scene tree; the loop morphs it into place
  useEffect(() => {
    const runtime = rt.current;
    if (!runtime) return;
    const next = transitionTo(runtime.node, state, transition <= 0);
    if (next === runtime.node) return;
    runtime.node = next;
    kick.current();
  }, [state, transition]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={ariaLabel ?? LABELS[state]}
      style={{ width: size, height: size, display: 'block', ...style }}
      {...rest}
    />
  );
}
