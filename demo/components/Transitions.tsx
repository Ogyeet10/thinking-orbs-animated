import React, { useEffect, useState } from 'react';
import type { OrbState } from '../../src';
import { ThinkingOrb } from '../../src';

const pillClass =
  'inline-flex items-center gap-3 w-[270px] h-[74px] pl-[9px] pr-8 rounded-full bg-(--pill-fill) shadow-(--pill-stroke) text-(--pill-fg) text-lg leading-6 font-inherit cursor-default';
const chipClass =
  'inline-flex items-center gap-2 h-9 pl-2 pr-3.5 rounded-full bg-(--pill-fill) shadow-(--pill-stroke) text-(--pill-fg) text-xs leading-[14px] font-inherit cursor-default';

/** A scripted agent run — the states an assistant walks through. */
const SCRIPT: Array<{ state: OrbState; label: string }> = [
  { state: 'listening', label: 'Listening…' },
  { state: 'searching', label: 'Searching…' },
  { state: 'working', label: 'Working…' },
  { state: 'solving', label: 'Solving…' },
  { state: 'composing', label: 'Composing…' },
  { state: 'shaping', label: 'Shaping…' },
];

const STEP_MS = 2600;

export function Transitions() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % SCRIPT.length), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const step = SCRIPT[i];

  return (
    <section className="w-full flex flex-col gap-3 mb-12" aria-label="State transitions">
      <h2 className="text-base font-normal leading-[34px] text-(--section-title-color)">Transitions</h2>

      <div className="relative w-full rounded-[30px] bg-(--hero-surface) flex flex-col items-center justify-center gap-6 px-10 py-14 overflow-hidden max-sm:px-5 max-sm:py-10 max-sm:rounded-[20px]">
        <div className={pillClass}>
          <ThinkingOrb state={step.state} size={64} style={{ width: 56, height: 56 }} />
          <span key={step.label} className="t-shimmer t-label-in" data-text={step.label}>
            {step.label}
          </span>
        </div>

        <div className={chipClass}>
          <ThinkingOrb state={step.state} size={20} />
          <span key={step.label} className="t-shimmer t-label-in" data-text={`Agent ${step.state}…`}>
            {`Agent ${step.state}…`}
          </span>
        </div>

        <div className="flex gap-1.5" aria-hidden="true">
          {SCRIPT.map((s, n) => (
            <span
              key={s.state}
              className={`h-1 rounded-full transition-all duration-500 ${n === i ? 'w-6 bg-(--pill-fg)' : 'w-1.5 bg-(--pill-fg) opacity-25'}`}
            />
          ))}
        </div>
      </div>

      <p className="text-sm leading-[22px] text-(--text-muted) max-w-[620px]">
        Changing <code className="font-[Roboto_Mono,monospace]">state</code> morphs dot by dot — both
        animations keep running while every dot travels to its new home, so a state change never cuts.
      </p>
    </section>
  );
}
