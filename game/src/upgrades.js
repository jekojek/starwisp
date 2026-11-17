// Level-up choices: the upgrade pool, rolling three distinct offers, and
// applying the one the player picks. Every upgrade is a small, stackable
// bonus on a player stat, so builds diverge run to run.

export const UPGRADE_DEFS = [
  { id: 'damage', name: 'Bright Bolt', desc: '+25% bolt damage', icon: '✦', max: 5 },
  { id: 'firerate', name: 'Rapid Glow', desc: '+18% fire rate', icon: '≋', max: 5 },
  { id: 'multishot', name: 'Twin Wisp', desc: '+1 bolt per shot', icon: '✧✧', max: 3 },
  { id: 'speed', name: 'Swift Light', desc: '+12% move speed', icon: '➤', max: 4 },
  { id: 'maxhp', name: 'Warm Ember', desc: '+25 max HP, heal 25', icon: '♥', max: 5 },
  { id: 'magnet', name: 'Star Magnet', desc: '+45% shard pickup radius', icon: '◎', max: 4 },
  { id: 'dash', name: 'Blink Step', desc: '-25% dash cooldown', icon: '↯', max: 3 },
  { id: 'nova', name: 'Nova Heart', desc: 'Nova blast on level-up, +1 nova charge', icon: '☀', max: 3 },
  { id: 'pierce', name: 'Piercing Ray', desc: 'Bolts pierce +1 enemy', icon: '→', max: 3 },
  { id: 'crit', name: 'Starfall', desc: '+10% crit chance (2x damage)', icon: '★', max: 4 },
];

/** Roll three distinct upgrades the player has not maxed out. */
export function rollChoices(random, levels) {
  const available = UPGRADE_DEFS.filter((def) => (levels[def.id] || 0) < def.max);
  const choices = [];
  const pool = available.slice();
  while (choices.length < 3 && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

/**
 * Apply one upgrade to the player's stats object and return a short line
 * describing what changed, for the floating text.
 */
export function applyUpgrade(stats, id) {
  stats.upgrades[id] = (stats.upgrades[id] || 0) + 1;
  switch (id) {
    case 'damage': stats.damage *= 1.25; return 'Damage +25%';
    case 'firerate': stats.fireInterval *= 0.85; return 'Fire rate +18%';
    case 'multishot': stats.multishot += 1; return 'Multishot +1';
    case 'speed': stats.speed *= 1.12; return 'Move speed +12%';
    case 'maxhp':
      stats.maxHp += 25;
      stats.hp = Math.min(stats.maxHp, stats.hp + 25);
      return 'Max HP +25, healed 25';
    case 'magnet': stats.magnet *= 1.45; return 'Magnet +45%';
    case 'dash': stats.dashCooldown *= 0.75; return 'Dash cooldown -25%';
    case 'nova': stats.novaCharges += 1; return 'Nova charge +1';
    case 'pierce': stats.pierce += 1; return 'Bolts pierce +1';
    case 'crit': stats.crit += 0.10; return 'Crit chance +10%';
    default: return '';
  }
}

/** The player's starting stats, before any upgrade. */
export function baseStats() {
  return {
    damage: 22,
    fireInterval: 0.42,
    multishot: 1,
    speed: 265,
    maxHp: 100,
    hp: 100,
    magnet: 120,
    dashCooldown: 2.4,
    novaCharges: 0,
    pierce: 0,
    crit: 0.05,
    upgrades: {},
  };
}
