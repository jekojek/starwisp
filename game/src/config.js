// Starwisp — every tuning number, colour and balance constant in one place.
// The arena is a fixed 1280x720 logical field; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.42,
  boltSpeed: 620,
  boltDamage: 22,
  boltRadius: 6,
  magnetRadius: 120,
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 2.4,
  invulnerable: 0.9,
  xpPerShard: 1,
};

/** XP needed for level n (1-based): level 2 needs 5 shards, then it grows. */
export function xpForLevel(level) {
  return 4 + level * 3;
}

/** Waves: boss waves are every 5th. Victory is beating the wave-10 boss. */
export const WIN_WAVE = 10;
export const BOSS_WAVES = new Set([5, 10]);

/** How many ordinary foes a wave sends, and how fast they arrive. */
export function waveSize(wave) {
  return 7 + wave * 3;
}
export function spawnInterval(wave) {
  return Math.max(0.35, 1.05 - wave * 0.06);
}

/** Dusk palettes, one per wave, cycling through a sunset that deepens. */
export const PALETTES = [
  { sky: '#1c1430', ground: '#171029', glow: '#ffd166', accent: '#ff9f5a', fog: '#2a1e4a' },
  { sky: '#241430', ground: '#1a1029', glow: '#ffcf5e', accent: '#ff8f6b', fog: '#331f4d' },
  { sky: '#2c1230', ground: '#1d0f2a', glow: '#ffc94d', accent: '#ff7a7a', fog: '#3a1f52' },
  { sky: '#33102e', ground: '#200e2b', glow: '#ffbf3d', accent: '#ff6b8a', fog: '#421f55' },
  { sky: '#3a0f2c', ground: '#230d2c', glow: '#ffb52e', accent: '#ff5f9e', fog: '#4a1e58' },
  { sky: '#2e0f33', ground: '#1e0c2d', glow: '#e8b4ff', accent: '#c77dff', fog: '#3d1c5c' },
  { sky: '#1e1238', ground: '#150e2e', glow: '#a8c8ff', accent: '#7dd3fc', fog: '#2c2158' },
  { sky: '#141a3d', ground: '#101231', glow: '#9be7ff', accent: '#5eead4', fog: '#232a5c' },
  { sky: '#101c33', ground: '#0d1429', glow: '#fde68a', accent: '#fbbf24', fog: '#1d2c52' },
  { sky: '#2b0f2e', ground: '#1f0b28', glow: '#ffd166', accent: '#ff4d6d', fog: '#471a4e' },
];

export const PALETTE = {
  backdrop: '#0b0817',
  text: '#f5efe0',
  muted: '#b8aed6',
  panel: '#221a38',
  panelEdge: '#4a3a72',
  heart: '#ff5f7a',
  xp: '#ffd166',
  danger: '#ff4d6d',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'starwisp.best';
export const BEST_WAVE_KEY = 'starwisp.bestWave';

/** Pool sizes: allocated once at boot, reused for the whole run. */
export const POOLS = { enemies: 90, bolts: 120, shards: 160, particles: 320, floats: 48, pickups: 24, enemyBolts: 80 };
