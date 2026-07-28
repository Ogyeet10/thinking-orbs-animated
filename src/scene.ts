// The scene tree. A steady orb is a single leaf (one mode painting one
// frame). A state change wraps the current tree in a blend node, so the
// outgoing animation KEEPS RUNNING while it morphs into the incoming
// one — nothing freezes, nothing cross-dissolves.
//
// Interrupting a transition wraps again: the in-flight blend is frozen
// at its current mix (which is exactly what is on screen, so there is no
// jump) and becomes the source of the new one. Depth is capped so
// hammering the state prop can't grow unbounded work per frame.

import { blendDots } from './engine/blend';
import type { Dot } from './engine/core';
import { captureDots } from './engine/core';
import { MODE_DRAWS } from './engine/registry';
import { resolvePreset } from './presets';
import type { OrbSize, OrbState } from './types';

export interface OrbLeaf {
  kind: 'leaf';
  state: OrbState;
}

export interface OrbBlend {
  kind: 'blend';
  from: OrbNode;
  to: OrbLeaf;
  /** Linear mix 0..1; easing/stagger happen inside `blendDots`. */
  m: number;
}

export type OrbNode = OrbLeaf | OrbBlend;

/** How many blends may stack before the oldest is resolved to one side. */
const MAX_DEPTH = 3;

export function orbLeaf(state: OrbState): OrbLeaf {
  return { kind: 'leaf', state };
}

/** The state a node is settling on. */
export function targetState(node: OrbNode): OrbState {
  return node.kind === 'leaf' ? node.state : node.to.state;
}

/** Resolve a subtree to the side that currently dominates it. */
function collapse(node: OrbNode): OrbLeaf {
  if (node.kind === 'leaf') return node;
  return node.m >= 0.5 ? node.to : collapse(node.from);
}

function prune(node: OrbNode, budget: number): OrbNode {
  if (node.kind === 'leaf') return node;
  if (budget <= 1) return collapse(node);
  const from = prune(node.from, budget - 1);
  return from === node.from ? node : { ...node, from };
}

/**
 * Retarget a tree at `next`. `instant` (reduced motion, or transition
 * disabled) swaps straight to a leaf.
 */
export function transitionTo(node: OrbNode, next: OrbState, instant: boolean): OrbNode {
  if (instant) return orbLeaf(next);
  if (targetState(node) === next) return node;
  return { kind: 'blend', from: prune(node, MAX_DEPTH), to: orbLeaf(next), m: 0 };
}

/** Advance the root blend; returns the tree with finished blends dropped. */
export function advance(node: OrbNode, step: number): OrbNode {
  if (node.kind === 'leaf') return node;
  const m = node.m + step;
  if (m >= 1) return node.to;
  return { ...node, m };
}

export function isSettled(node: OrbNode): boolean {
  return node.kind === 'leaf';
}

/**
 * `clock` is the orb's warped seconds; each state multiplies it by its own
 * baked speed, so every mode keeps its tuned tempo through a transition.
 */
export function drawLeaf(
  ctx: CanvasRenderingContext2D,
  state: OrbState,
  size: OrbSize,
  t: number,
  dark: boolean
): void {
  const { mode, opts } = resolvePreset(state, size);
  MODE_DRAWS[mode](ctx, size, t, dark, opts);
}

export function leafTime(state: OrbState, size: OrbSize, clock: number): number {
  return resolvePreset(state, size).speed * clock;
}

/** Render a tree to a dot list. Blends recurse; leaves capture a frame. */
export function renderNode(
  ctx: CanvasRenderingContext2D,
  node: OrbNode,
  size: OrbSize,
  clock: number
): Dot[] {
  if (node.kind === 'leaf') {
    const { mode, speed, opts } = resolvePreset(node.state, size);
    const draw = MODE_DRAWS[mode];
    // `dark` is irrelevant while capturing: ink polarity is applied once,
    // at paint time, from the (animatable) darkness mix.
    return captureDots(() => draw(ctx, size, speed * clock, false, opts));
  }
  return blendDots(
    renderNode(ctx, node.from, size, clock),
    renderNode(ctx, node.to, size, clock),
    node.m,
    size
  );
}
