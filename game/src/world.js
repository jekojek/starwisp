// The game's rules and state, with no drawing and no browser in it: the
// wisp, the shadow creatures, bolts, star-shards, pickups, waves, the boss,
// combo scoring and level-ups. step() advances one fixed step and returns
// what happened as bit flags, so the caller can react (sounds, screens)
// without the world knowing about them. Pools are allocated once at boot.

import { FIELD, PLAYER, POOLS, WIN_WAVE, BOSS_WAVES, xpForLevel, waveSize, spawnInterval } from './config.js';
import { edgePoint, range, rangeInt } from './random.js';
import { ENEMY_TYPES, KIND_BOSS, KIND_SPLITTER, buildEnemy, steerEnemy, splitChildren, randomKindForWave, bossHpForWave } from './enemies.js';
import { baseStats, rollChoices, applyUpgrade } from './upgrades.js';

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_KILL = 4;
export const EVENT_SHARD = 8;
export const EVENT_LEVELUP = 16;
export const EVENT_WAVE = 32;
export const EVENT_OVER = 64;
export const EVENT_WIN = 128;
export const EVENT_PICKUP = 256;
export const EVENT_DASH = 512;
export const EVENT_NOVA = 1024;
export const EVENT_BOSS = 2048;

export const PICKUP_HEART = 0;
export const PICKUP_NOVA = 1;
export const PICKUP_MAGNET = 2;

function makePool(size, factory) {
  const pool = [];
  for (let i = 0; i < size; i += 1) pool.push(factory());
  return pool;
}

function freeSlot(pool) {
  for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
  return null;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    player: { x: FIELD.width / 2, y: FIELD.height / 2, radius: PLAYER.radius, aimAngle: -Math.PI / 2 },
    stats: baseStats(),
    enemies: makePool(POOLS.enemies, () => ({ active: false, kind: 0, x: 0, y: 0, hp: 1, maxHp: 1, speed: 0, radius: 10, damage: 0, score: 0, shards: 0, vx: 0, vy: 0, wobble: 0, shootTimer: 0, spawnTimer: 0, burstTimer: 0, flash: 0, zig: 1 })),
    bolts: makePool(POOLS.bolts, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 0, pierce: 0, radius: 6, life: 0 })),
    enemyBolts: makePool(POOLS.enemyBolts, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 7, life: 0 })),
    shards: makePool(POOLS.shards, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, value: 1, life: 0 })),
    pickups: makePool(POOLS.pickups, () => ({ active: false, kind: 0, x: 0, y: 0, life: 0 })),
    particles: makePool(POOLS.particles, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#fff' })),
    floats: makePool(POOLS.floats, () => ({ active: false, x: 0, y: 0, text: '', life: 0, color: '#fff', size: 16 })),
    score: 0,
    kills: 0,
    wave: 1,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    elapsed: 0,
    spawnQueue: 0,
    spawnTimer: 0,
    waveBreak: 0,
    banner: '',
    bannerTimer: 0,
    bossSpawned: false,
    pendingChoices: null,
    victory: false,
    over: false,
    shake: 0,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invulnerable: 0,
    novaFlash: 0,
    trees: [],
  };

  // A fixed grove of trees, placed once per world so the forest is stable.
  for (let i = 0; i < 26; i += 1) {
    state.trees.push({ x: range(random, 30, FIELD.width - 30), y: range(random, 30, FIELD.height - 30), r: range(random, 14, 30), sway: range(random, 0, Math.PI * 2) });
  }

  function reset() {
    const p = state.player;
    p.x = FIELD.width / 2;
    p.y = FIELD.height / 2;
    p.aimAngle = -Math.PI / 2;
    state.stats = baseStats();
    for (const pool of [state.enemies, state.bolts, state.enemyBolts, state.shards, state.pickups, state.particles, state.floats]) {
      for (const item of pool) item.active = false;
    }
    state.score = 0;
    state.kills = 0;
    state.wave = 1;
    state.level = 1;
    state.xp = 0;
    state.xpNext = xpForLevel(1);
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.elapsed = 0;
    state.spawnQueue = waveSize(1);
    state.spawnTimer = 0.5;
    state.waveBreak = 0;
    state.banner = 'Wave 1';
    state.bannerTimer = 2.2;
    state.bossSpawned = false;
    state.pendingChoices = null;
    state.victory = false;
    state.over = false;
    state.shake = 0;
    state.fireTimer = 0;
    state.dashTimer = 0;
    state.dashCooldown = 0;
    state.invulnerable = 0;
    state.novaFlash = 0;
  }

  function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const pt = freeSlot(state.particles);
      if (!pt) return;
      const a = range(random, 0, Math.PI * 2);
      const s = range(random, speed * 0.3, speed);
      pt.active = true;
      pt.x = x;
      pt.y = y;
      pt.vx = Math.cos(a) * s;
      pt.vy = Math.sin(a) * s;
      pt.maxLife = range(random, 0.3, 0.7);
      pt.life = pt.maxLife;
      pt.size = range(random, 2, 5);
      pt.color = color;
    }
  }

  function addFloat(x, y, text, color, size) {
    const f = freeSlot(state.floats);
    if (!f) return;
    f.active = true;
    f.x = x + range(random, -8, 8);
    f.y = y - 10;
    f.text = text;
    f.life = 0.9;
    f.color = color;
    f.size = size || 16;
  }

  function dropShards(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const s = freeSlot(state.shards);
      if (!s) return;
      const a = range(random, 0, Math.PI * 2);
      s.active = true;
      s.x = x;
      s.y = y;
      s.vx = Math.cos(a) * range(random, 40, 140);
      s.vy = Math.sin(a) * range(random, 40, 140);
      s.value = PLAYER.xpPerShard;
      s.life = 14;
    }
  }

  function dropPickup(x, y) {
    const roll = random();
    if (roll > 0.11) return;
    const pk = freeSlot(state.pickups);
    if (!pk) return;
    pk.active = true;
    pk.x = x;
    pk.y = y;
    pk.life = 12;
    pk.kind = roll < 0.05 ? PICKUP_HEART : roll < 0.085 ? PICKUP_NOVA : PICKUP_MAGNET;
  }

  function spawnEnemy(kind, x, y) {
    const slot = freeSlot(state.enemies);
    if (!slot) return null;
    buildEnemy(slot, kind, x, y, random, state.wave);
    if (kind === KIND_BOSS) {
      slot.hp = bossHpForWave(state.wave);
      slot.maxHp = slot.hp;
    }
    return slot;
  }

  function spawnFromEdge(kind) {
    const point = edgePoint(random, FIELD.width, FIELD.height, 40);
    return spawnEnemy(kind, point.x, point.y);
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = BOSS_WAVES.has(wave) ? waveSize(wave) : waveSize(wave);
    state.spawnTimer = 0.6;
    state.bossSpawned = false;
    state.banner = BOSS_WAVES.has(wave) ? `Wave ${wave} — the Night King wakes` : `Wave ${wave}`;
    state.bannerTimer = 2.4;
    if (BOSS_WAVES.has(wave)) {
      const point = edgePoint(random, FIELD.width, FIELD.height, 70);
      spawnEnemy(KIND_BOSS, point.x, point.y);
      state.bossSpawned = true;
    }
  }

  function aliveEnemies() {
    let count = 0;
    for (const e of state.enemies) if (e.active) count += 1;
    return count;
  }

  function nearestEnemy(x, y, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const e of state.enemies) {
      if (!e.active) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function fireBolt(angle, damage) {
    const b = freeSlot(state.bolts);
    if (!b) return;
    const p = state.player;
    b.active = true;
    b.x = p.x + Math.cos(angle) * (p.radius + 8);
    b.y = p.y + Math.sin(angle) * (p.radius + 8);
    b.vx = Math.cos(angle) * PLAYER.boltSpeed;
    b.vy = Math.sin(angle) * PLAYER.boltSpeed;
    b.damage = damage;
    b.pierce = state.stats.pierce;
    b.radius = PLAYER.boltRadius;
    b.life = 1.1;
  }

  function novaBlast() {
    state.novaFlash = 0.35;
    state.shake = Math.max(state.shake, 10);
    spawnParticles(state.player.x, state.player.y, '#ffd166', 40, 420);
    for (const e of state.enemies) {
      if (!e.active) continue;
      damageEnemy(e, 90, true);
    }
  }

  function damageEnemy(enemy, damage, silent) {
    const isCrit = random() < state.stats.crit;
    const dealt = Math.round(damage * (isCrit ? 2 : 1));
    enemy.hp -= dealt;
    enemy.flash = 0.12;
    addFloat(enemy.x, enemy.y - enemy.radius, String(dealt), isCrit ? '#ffd166' : '#ffffff', isCrit ? 22 : 16);
    spawnParticles(enemy.x, enemy.y, ENEMY_TYPES[enemy.kind].core, 4, 160);
    if (enemy.hp <= 0) killEnemy(enemy, silent);
  }

  function killEnemy(enemy, silent) {
    enemy.active = false;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = 3.5;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    const mult = 1 + Math.min(2, state.combo * 0.05);
    const gained = Math.round(enemy.score * mult);
    state.score += gained;
    addFloat(enemy.x, enemy.y, `+${gained}`, '#ffd166', 18);
    spawnParticles(enemy.x, enemy.y, ENEMY_TYPES[enemy.kind].color, 16, 260);
    spawnParticles(enemy.x, enemy.y, ENEMY_TYPES[enemy.kind].core, 8, 180);
    state.shake = Math.max(state.shake, enemy.kind === KIND_BOSS ? 14 : 4);
    dropShards(enemy.x, enemy.y, enemy.shards);
    if (!silent) dropPickup(enemy.x, enemy.y);
    if (enemy.kind === KIND_SPLITTER) {
      for (const child of splitChildren(random)) {
        const slot = spawnEnemy(child.kind, enemy.x + child.dx, enemy.y + child.dy);
        if (slot) { slot.hp = 14; slot.maxHp = 14; }
      }
    }
    if (enemy.kind === KIND_BOSS) {
      dropShards(enemy.x, enemy.y, 12);
      spawnParticles(enemy.x, enemy.y, '#ff4d6d', 50, 380);
      if (state.wave >= WIN_WAVE) {
        state.victory = true;
      }
    }
  }

  function hurtPlayer(damage) {
    if (state.invulnerable > 0 || state.dashTimer > 0 || state.over) return 0;
    state.stats.hp -= damage;
    state.invulnerable = PLAYER.invulnerable;
    state.combo = 0;
    state.shake = Math.max(state.shake, 8);
    spawnParticles(state.player.x, state.player.y, '#ff5f7a', 14, 240);
    if (state.stats.hp <= 0) {
      state.stats.hp = 0;
      state.over = true;
      spawnParticles(state.player.x, state.player.y, '#ffd166', 60, 420);
      return EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function gainXp(amount) {
    state.xp += amount;
    while (state.xp >= state.xpNext && !state.pendingChoices) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.xpNext = xpForLevel(state.level);
      state.pendingChoices = rollChoices(random, state.stats.upgrades);
      if (state.stats.upgrades.nova > 0) novaBlast();
      return EVENT_LEVELUP;
    }
    return 0;
  }

  /**
   * One fixed step. `input` is {mx, my, aimX, aimY, firing, dash}.
   * With `harmless` set (the title screen's backdrop) the wisp fights but
   * cannot die, scores nothing and waves never advance.
   */
  function step(dt, input, harmless) {
    let events = 0;
    const p = state.player;
    const st = state.stats;
    state.elapsed += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (state.novaFlash > 0) state.novaFlash -= dt;
    if (state.invulnerable > 0) state.invulnerable -= dt;
    if (state.dashCooldown > 0) state.dashCooldown -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // --- movement & dash ---
    if (state.dashTimer > 0) {
      state.dashTimer -= dt;
      p.x += state.dashX * PLAYER.dashSpeed * dt;
      p.y += state.dashY * PLAYER.dashSpeed * dt;
    } else {
      p.x += input.mx * st.speed * dt;
      p.y += input.my * st.speed * dt;
      if (input.dash && state.dashCooldown <= 0) {
        const len = Math.hypot(input.mx, input.my);
        const dx = len > 0 ? input.mx / len : Math.cos(p.aimAngle);
        const dy = len > 0 ? input.my / len : Math.sin(p.aimAngle);
        state.dashX = dx;
        state.dashY = dy;
        state.dashTimer = PLAYER.dashTime;
        state.dashCooldown = st.dashCooldown;
        spawnParticles(p.x, p.y, '#a8c8ff', 10, 200);
        events |= EVENT_DASH;
      }
    }
    p.x = Math.max(p.radius, Math.min(FIELD.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(FIELD.height - p.radius, p.y));

    // --- aim & auto-fire ---
    let aimX = p.x + Math.cos(p.aimAngle) * 100;
    let aimY = p.y + Math.sin(p.aimAngle) * 100;
    if (input.aimX !== null && input.aimX !== undefined) {
      aimX = input.aimX;
      aimY = input.aimY;
    } else {
      const target = nearestEnemy(p.x, p.y, 560);
      if (target) { aimX = target.x; aimY = target.y; }
    }
    p.aimAngle = Math.atan2(aimY - p.y, aimX - p.x);
    state.fireTimer -= dt;
    if ((input.firing || input.aimX === null || input.aimX === undefined) && state.fireTimer <= 0) {
      state.fireTimer = st.fireInterval;
      const spread = 0.14;
      const count = st.multishot;
      for (let i = 0; i < count; i += 1) {
        const offset = (i - (count - 1) / 2) * spread;
        fireBolt(p.aimAngle + offset, st.damage);
      }
      events |= EVENT_SHOOT;
    }

    // --- spawning ---
    if (!harmless) {
      if (state.spawnQueue > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = spawnInterval(state.wave);
          state.spawnQueue -= 1;
          spawnFromEdge(randomKindForWave(random, state.wave));
        }
      } else if (aliveEnemies() === 0 && !state.over && !state.victory) {
        if (state.waveBreak <= 0) {
          state.waveBreak = 2.2;
          state.score += 100 * state.wave;
          st.hp = Math.min(st.maxHp, st.hp + 8);
          state.banner = state.wave >= WIN_WAVE ? '' : `Wave ${state.wave} cleared  +${100 * state.wave}`;
          state.bannerTimer = 2.2;
          events |= EVENT_WAVE;
        } else {
          state.waveBreak -= dt;
          if (state.waveBreak <= 0) startWave(state.wave + 1);
        }
      }
    } else if (aliveEnemies() < 6 && random() < 0.02) {
      spawnFromEdge(randomKindForWave(random, 1));
    }

    // --- enemies ---
    for (const e of state.enemies) {
      if (!e.active) continue;
      if (e.flash > 0) e.flash -= dt;
      const action = steerEnemy(e, p, dt, random);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = Math.max(-60, Math.min(FIELD.width + 60, e.x));
      e.y = Math.max(-60, Math.min(FIELD.height + 60, e.y));
      if (action === 'shoot') {
        const b = freeSlot(state.enemyBolts);
        if (b) {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          b.active = true;
          b.x = e.x;
          b.y = e.y;
          b.vx = (dx / d) * 240;
          b.vy = (dy / d) * 240;
          b.life = 3;
        }
      } else if (action === 'burst') {
        for (let i = 0; i < 10; i += 1) {
          const b = freeSlot(state.enemyBolts);
          if (!b) break;
          const a = (i / 10) * Math.PI * 2;
          b.active = true;
          b.x = e.x;
          b.y = e.y;
          b.vx = Math.cos(a) * 190;
          b.vy = Math.sin(a) * 190;
          b.life = 3.5;
        }
        state.shake = Math.max(state.shake, 6);
        events |= EVENT_BOSS;
      } else if (action === 'spawn') {
        for (let i = 0; i < 2; i += 1) spawnFromEdge(KIND_SPLITTER);
        events |= EVENT_BOSS;
      }
      // Touch damage.
      const rr = e.radius + p.radius;
      if (!harmless && dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        const result = hurtPlayer(e.damage);
        if (result) events |= result;
        // Push the enemy back a little so it does not stick.
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x = p.x + (dx / d) * rr;
        e.y = p.y + (dy / d) * rr;
      }
    }

    // --- player bolts ---
    for (const b of state.bolts) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of state.enemies) {
        if (!e.active) continue;
        const rr = e.radius + b.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          const wasAlive = e.active;
          damageEnemy(e, b.damage, false);
          if (wasAlive) events |= EVENT_KILL;
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            b.active = false;
            break;
          }
        }
      }
    }

    // --- enemy bolts ---
    for (const b of state.enemyBolts) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const rr = b.radius + p.radius;
      if (!harmless && dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        b.active = false;
        const result = hurtPlayer(8);
        if (result) events |= result;
        continue;
      }
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) b.active = false;
    }

    // --- shards (magnet + collect) ---
    for (const s of state.shards) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { s.active = false; continue; }
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < st.magnet) {
        const pull = 520 * (1 - d / (st.magnet + 1)) + 180;
        s.vx += ((p.x - s.x) / (d || 1)) * pull * dt * 4;
        s.vy += ((p.y - s.y) / (d || 1)) * pull * dt * 4;
      }
      s.vx *= 0.92;
      s.vy *= 0.92;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (d < p.radius + 16) {
        s.active = false;
        if (!harmless) {
          const ev = gainXp(s.value);
          if (ev) events |= ev;
          events |= EVENT_SHARD;
        }
      }
    }

    // --- pickups ---
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      pk.life -= dt;
      if (pk.life <= 0) { pk.active = false; continue; }
      const rr = p.radius + 18;
      if (dist2(pk.x, pk.y, p.x, p.y) < rr * rr) {
        pk.active = false;
        if (!harmless) {
          if (pk.kind === PICKUP_HEART) {
            st.hp = Math.min(st.maxHp, st.hp + 30);
            addFloat(p.x, p.y - 24, '+30 HP', '#ff5f7a', 18);
          } else if (pk.kind === PICKUP_NOVA) {
            novaBlast();
            events |= EVENT_NOVA;
          } else {
            for (const s of state.shards) {
              if (!s.active) continue;
              s.x = p.x;
              s.y = p.y;
            }
            addFloat(p.x, p.y - 24, 'Magnet!', '#a8c8ff', 18);
          }
          events |= EVENT_PICKUP;
        }
      }
    }

    // --- particles & floats ---
    for (const pt of state.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) { pt.active = false; continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
    }
    for (const f of state.floats) {
      if (!f.active) continue;
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) f.active = false;
    }

    if (state.victory) events |= EVENT_WIN;
    if (state.over) events |= EVENT_OVER;
    return events;
  }

  /** Apply a level-up choice; returns the description line for the HUD. */
  function chooseUpgrade(choice) {
    if (!state.pendingChoices) return '';
    const line = applyUpgrade(state.stats, choice.id);
    state.pendingChoices = null;
    return line;
  }

  /** Fire a nova from a stored charge (nova pickup already blasts directly). */
  function useNova() {
    if (state.stats.novaCharges <= 0) return false;
    state.stats.novaCharges -= 1;
    novaBlast();
    return true;
  }

  reset();
  return { state, reset, step, chooseUpgrade, useNova, startWave };
}
