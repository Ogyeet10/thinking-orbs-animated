import React from 'react';

/** The playground's custom range control: a filled track with an inline
 *  value read-out and a transparent, touch-sized native thumb on top. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  className = 'w-[140px]',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
}) {
  const fillPct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`flex flex-col gap-[9px] min-w-[100px] max-sm:w-full ${className}`}>
      <span className="text-xs font-normal leading-[14px] text-(--text-muted)">{label}</span>
      <div className="strength-track relative w-full h-9 rounded-lg bg-(--strength-bg) shadow-(--strength-shadow) overflow-hidden cursor-grab active:cursor-grabbing hover:bg-(--strength-hover)">
        <div
          className="absolute top-0 left-0 bottom-0 rounded-lg bg-(--strength-fill-bg) shadow-(--strength-shadow) transition-[width] duration-[80ms] ease-out pointer-events-none"
          style={{ width: `${fillPct}%` }}
        />
        <span className="absolute top-0 left-[11px] h-full flex items-center text-[11px] font-normal leading-[14px] text-(--text-muted) whitespace-nowrap pointer-events-none z-[1]">
          {format(value)}
        </span>
        <input
          className="strength-input appearance-none absolute inset-0 w-full h-full m-0 p-0 bg-transparent cursor-grab opacity-0 z-[2] active:cursor-grabbing"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
      </div>
    </div>
  );
}
