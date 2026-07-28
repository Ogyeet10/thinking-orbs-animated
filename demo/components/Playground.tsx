import React, { useEffect, useState } from 'react';
import type { OrbSize, OrbState } from '../../src';
import { ThinkingOrb } from '../../src';
import { cn } from '../lib/utils';
import { CopyButton } from './CopyButton';
import { PlayPauseToggle } from './PlayPauseToggle';
import { Slider } from './Slider';

const STATES: OrbState[] = ['idle', 'working', 'searching', 'solving', 'listening', 'composing', 'shaping'];
const SIZES: OrbSize[] = [64, 20];

const SPEED_MIN = 25;
const SPEED_MAX = 300;

const TRANSITION_DEFAULT = 620;
const TRANSITION_MAX = 1600;

/** How long each state is held while auto-cycling. */
const CYCLE_MS = 2200;

function buildSnippet(state: OrbState, size: OrbSize, speed: number, transition: number) {
  const props = [`state="${state}"`, `size={${size}}`];
  if (speed !== 100) props.push(`speed={${(speed / 100).toFixed(2)}}`);
  if (transition !== TRANSITION_DEFAULT) props.push(`transition={${transition}}`);
  return `import { ThinkingOrb } from 'thinking-orbs';\n\n<ThinkingOrb ${props.join(' ')} />`;
}

const tabBtnBase = 'flex items-center justify-center h-9 px-3 border-none rounded-lg font-[Inter,sans-serif] text-[13px] font-normal leading-[14px] cursor-pointer transition-[background-color,color] duration-150 whitespace-nowrap [-webkit-tap-highlight-color:transparent] hover:bg-(--tab-hover-bg) hover:text-(--tab-hover-color) focus-visible:outline-2 focus-visible:outline-[rgba(255,255,255,0.5)] focus-visible:outline-offset-2';

function TabBtn({ active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        tabBtnBase,
        active
          ? 'bg-(--tab-active-bg) text-(--tab-active-color) shadow-(--tab-active-shadow)'
          : 'bg-(--tab-bg) text-(--tab-color)',
      )}
      type="button"
    />
  );
}

export function Playground({
  speed,
  onSpeedChange,
}: {
  /** Speed as percent (25..300), lifted to App so it also drives the hero examples. */
  speed: number;
  onSpeedChange: (value: number) => void;
}) {
  const [state, setState] = useState<OrbState>('listening');
  const [size, setSize] = useState<OrbSize>(64);
  // Playground starts paused so the page loads quietly; the PlayPauseToggle
  // below only flips this local state, so the surrounding Examples keep
  // auto-playing regardless.
  const [paused, setPaused] = useState(true);
  const [transition, setTransition] = useState(TRANSITION_DEFAULT);
  const [cycling, setCycling] = useState(false);

  // Auto-cycle walks the states on a timer — the fastest way to see that a
  // switch is a morph, not a cut. Every hop interrupts the last one cleanly.
  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(() => {
      setState((s) => STATES[(STATES.indexOf(s) + 1) % STATES.length]);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [cycling]);

  const snippet = buildSnippet(state, size, speed, transition);

  return (
    <section className="w-full flex flex-col gap-1.5 mb-12" aria-label="Interactive playground">
      <h2 className="text-base font-normal leading-[34px] text-(--section-title-color)">Playground</h2>

      <div className="flex flex-col gap-4 bg-(--panel-bg) rounded-[10px] p-4">
        <div className="flex items-end gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
          <div className="flex flex-col gap-[9px] min-w-0" role="radiogroup" aria-label="Orb state">
            <span className="text-xs font-normal leading-[14px] text-(--text-muted)">State</span>
            <div className="flex gap-2 items-center flex-wrap">
              {STATES.map((s) => (
                <TabBtn key={s} active={state === s} onClick={() => setState(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </TabBtn>
              ))}
              <TabBtn
                active={cycling}
                onClick={() => setCycling((c) => !c)}
                aria-pressed={cycling}
                title="Step through every state on a timer"
              >
                {cycling ? 'Stop cycle' : 'Auto-cycle'}
              </TabBtn>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
          <div className="flex flex-col gap-[9px] min-w-0" role="radiogroup" aria-label="Orb size">
            <span className="text-xs font-normal leading-[14px] text-(--text-muted)">Size</span>
            <div className="flex gap-2 items-center">
              {SIZES.map((s) => (
                <TabBtn key={s} active={size === s} onClick={() => setSize(s)}>
                  {s}px
                </TabBtn>
              ))}
            </div>
          </div>

          <Slider
            label="Speed"
            value={speed}
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={5}
            format={(v) => `${(v / 100).toFixed(2)}×`}
            onChange={onSpeedChange}
          />

          <Slider
            label="Transition"
            value={transition}
            min={0}
            max={TRANSITION_MAX}
            step={20}
            format={(v) => (v === 0 ? 'instant' : `${v} ms`)}
            onChange={setTransition}
          />
        </div>
      </div>

      <div className="relative w-full min-h-[304px] rounded-[10px] bg-(--surface) flex flex-col items-center justify-center p-12 gap-6 max-sm:p-6">
        <ThinkingOrb state={state} size={size} speed={speed / 100} paused={paused} transition={transition} />
        <PlayPauseToggle playing={!paused} onToggle={() => setPaused((p) => !p)} className="max-sm:absolute max-sm:bottom-6 max-sm:left-1/2 max-sm:-translate-x-1/2" />
      </div>

      <div className="flex items-start h-auto bg-(--code-bg) rounded-[10px] py-1.5 pr-10 pl-3 overflow-hidden relative max-sm:hidden">
        <code className="font-[Roboto_Mono,monospace] text-sm leading-[22px] text-(--code-text) whitespace-pre overflow-x-auto min-w-0 flex-1">{snippet}</code>
        <CopyButton getText={() => snippet} />
      </div>
    </section>
  );
}
