export { ThinkingOrb } from './ThinkingOrb';

export type { ThinkingOrbProps, OrbState, OrbSize, OrbTheme } from './types';

// Power-user surface: the resolved presets + raw frame painters, for
// consumers driving their own canvas outside React.
export { resolvePreset, STATE_TO_MODE, type ModeKey, type Resolved } from './presets';
export { MODE_DRAWS } from './engine/registry';

// The transition machinery, for consumers morphing between modes on
// their own canvas: capture two frames as dots, blend, paint.
export { captureDots, paintDots, type Dot } from './engine/core';
export { blendDots } from './engine/blend';
