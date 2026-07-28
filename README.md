# thinking-orbs

Dotted thought-orb loading indicators for AI & agent UIs. Six hand-tuned animated states, each shipped at two purpose-tuned sizes, rendered on a plain 2D canvas — no WebGL, no filters, works identically in Chrome, Safari and Firefox.

[Live demo](https://orbs.jakubantalik.com) · [Repository](https://github.com/Jakubantalik/thinking-orbs) · [Report an issue](https://github.com/Jakubantalik/thinking-orbs/issues)

## Install

```bash
npm install thinking-orbs
```

## Quick start

```tsx
import { ThinkingOrb } from 'thinking-orbs';

function Status() {
  return <ThinkingOrb state="searching" size={64} />;
}
```

## States

Six verbs an agent can be doing, each a distinct animation:

```tsx
<ThinkingOrb state="working" />    {/* particles on tilted orbits */}
<ThinkingOrb state="searching" />  {/* a scan meridian sweeps a dotted globe */}
<ThinkingOrb state="solving" />    {/* bands scramble, then click back solved */}
<ThinkingOrb state="listening" />  {/* a waveform rolls through the rings */}
<ThinkingOrb state="composing" />  {/* an undulating multi-band sash */}
<ThinkingOrb state="shaping" />    {/* dotted outline: circle → triangle → square */}
```

## Transitions

Changing `state` morphs; it never cuts. Both animations keep running while every dot of the outgoing frame travels to a dot of the incoming one, so an agent moving from `listening` to `searching` reads as one continuous object changing its mind:

```tsx
<ThinkingOrb state={agent.state} />              {/* 620 ms morph (default) */}
<ThinkingOrb state={agent.state} transition={900} />  {/* slower, dreamier */}
<ThinkingOrb state={agent.state} transition={0} />    {/* opt out: hard swap */}
```

How it works: the two frames are captured as dot lists, ordered by angle around the centre and paired, then each dot travels in polar space — curving around the centre rather than through it — with a slight per-dot stagger so the change sweeps around the orb. Where the two states have different dot counts, the extra dots bud out of their parent from zero radius (and merging dots shrink back into it), so the first and last frames of a morph are pixel-identical to the plain states.

Everything else is continuous too:

- **Interrupting** a morph is free — a new `state` mid-flight starts from exactly what is on screen, no snap-back.
- **`speed`** warps the clock instead of resetting it, so dragging a speed slider never jumps the phase.
- **`paused`** freezes the clock and resuming picks up where it stopped. State morphs still play while paused.
- **Theme flips** fade the ink polarity rather than inverting on one frame.
- `prefers-reduced-motion: reduce` skips all of it: states swap instantly on a static frame.

## Sizes

Two tuned presets — separate designs, not a scale factor. `64` for chat-avatar scale, `20` for inline-text scale. Each carries its own dot count, dot size and speed tuning:

```tsx
<ThinkingOrb state="working" size={64} />
<ThinkingOrb state="working" size={20} />
```

## Theme

Strictly monochrome — light ink for dark backgrounds, dark ink for light backgrounds — with the mode picked automatically from the host project:

```tsx
<ThinkingOrb theme="auto" />   {/* default — detects from the project */}
<ThinkingOrb theme="dark" />   {/* pin: light dots for dark backgrounds */}
<ThinkingOrb theme="light" />  {/* pin: dark dots for light backgrounds */}
```

`auto` resolves in three layers and updates live when any of them change:

1. an ancestor `data-theme="dark|light"` attribute or `dark`/`light` class (the Tailwind / shadcn convention), watched via `MutationObserver`;
2. otherwise `prefers-color-scheme`, subscribed for live OS theme switches;
3. SSR-safe — the canvas paints only on the client, after the theme has resolved.

## Other props

```tsx
<ThinkingOrb
  state="solving"
  size={20}
  speed={1.5}          // multiplier on the preset's baked speed
  paused={false}       // freeze on the current frame
  transition={620}     // ms of the state-change morph; 0 swaps instantly
  aria-label="Analysing repository…"  // overrides the per-state default
/>
```

All other `<canvas>` props (`className`, `style`, `data-*`, …) pass through.

## Accessibility & performance

- `role="img"` with a sensible per-state `aria-label` out of the box.
- `prefers-reduced-motion: reduce` renders a static representative frame — no animation, no morphing — and still follows the live theme.
- Every instance pauses automatically when scrolled offscreen (`IntersectionObserver`) or when the tab is hidden, and resumes in phase — all instances share one clock.
- Plain 2D canvas arcs only: no `ctx.filter`, no SVG filters, no WebGL — the same pixels everywhere, cheap on low-end devices. Device-pixel-ratio capped at 2.
- A settled orb paints exactly one mode per frame — the blending machinery only runs while a morph is in flight, and a paused, settled orb stops requesting frames entirely.

## License

MIT © Jakub Antalik
