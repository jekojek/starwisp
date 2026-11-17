// The shadow creatures: five kinds plus the Night King. Each kind is one
// row of the table below (speed, health, damage, score, look), and one
// behaviour function that steers it each step. The world owns the arrays;
// this file only knows how one enemy is built and how it moves.

import { range, rangeInt } from './random.js';

export const KIND_DRIFTER = 0;
export const KIND_SKITTER = 1;
export const KIND_SPITTER = 2;
export const KIND_BRUTE = 3;
export const KIND_SPLITTER = 4;
export const KIND_BOSS = 5;

/** hp, speed, touch damage, score value, radius, colour, shard yield. */
export const ENEMY_TYPES = [
  { kind: KIND_DRIFTER, name: 'Drifter', hp: 30, speed: 62, damage: 10, score: 50, radius: 15, color: '#7a6ba8', core: '#b9a8e8', shards: 1 },
  { kind: KIND_SKITTER, name: 'Skitter', hp: 16, speed: 148, damage: 7, score: 70, radius: 11, color: '#8a5f9e', core: '#e0aaff', shards: 1 },
  { kind: KIND_SPITTER, name: 'Spitter', hp: 26, speed: 48, damage: 8, score: 90, radius: 14, color: '#5f7a4a', core: '#b7e4a8', shards: 2 },
  { kind: KIND_BRUTE, name: 'Brute', hp: 110, speed: 38, damage: 18, score: 150, radius: 24, color: '#6b3a5e', core: '#ff8fa3', shards: 3 },
  { kind: KIND_SPLITTER, name: 'Splitter', hp: 34, speed: 78, damage: 9, score: 110, radius: 17, color: '#4a6b8a', core: '#90e0ef', shards: 2 },
  { kind: KIND_BOSS, name: 'Night King', hp: 900, speed: 34, damage: 25, score: 2000, radius: 52, color: '#3d1a5c', core: '#ff4d6d', shards: 12 },
];

/** Which kinds a wave may send; later waves unlock the nastier ones. */
export function kindsForWave(wave) {
  const kinds = [KIND_DRIFTER, KIND_SKITTER];
  if (wave >= 2) kinds.push(KIND_SPLITTER);
  if (wave >= 3) kinds.push(KIND_SPITTER);
  if (wave >= 4) kinds.push(KIND_BRUTE);
  return kinds;
}

/** Fill a pooled enemy record with a fresh creature of this kind. */
export function buildEnemy(enemy, kind, x, y, random, wave) {
  const def = ENEMY_TYPES[kind];
  const hpScale = 1 + (wave - 1) * 0.12 + (kind === KIND_BOSS ? (wave - 5) * 0.25 : 0);
  enemy.active = true;
  enemy.kind = kind;
  enemy.x = x;
  enemy.y = y;
  enemy.hp = Math.round(def.hp * hpScale);
  enemy.maxHp = enemy.hp;
  enemy.speed = def.speed * (1 + Math.min(0.4, (wave - 1) * 0.03));
  enemy.radius = def.radius;
  enemy.damage = def.damage;
  enemy.score = def.score;
  enemy.shards = def.shards;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.wobble = range(random, 0, Math.PI * 2);
  enemy.shootTimer = range(random, 1.2, 2.6);
  enemy.spawnTimer = 0;
  enemy.burstTimer = 0;
  enemy.flash = 0;
  enemy.zig = random() < 0.5 ? -1 : 1;
  return enemy;
}

/**
 * Steer one enemy for a step. Returns 'shoot' when a spitter should fire,
 * 'burst' when the boss should loose a radial ring, 'spawn' when the boss
 * should call minions. `player` is the wisp; `dt` is the fixed step.
 */
export function steerEnemy(enemy, player, dt, random) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  let mx = nx;
  let my = ny;

  if (enemy.kind === KIND_SKITTER) {
    // Fast zig-zag: weave sideways while closing in.
    enemy.wobble += dt * 6;
    const perpX = -ny;
    const perpY = nx;
    const weave = Math.sin(enemy.wobble) * 0.9 * enemy.zig;
    mx = nx + perpX * weave;
    my = ny + perpY * weave;
    const len = Math.hypot(mx, my) || 1;
    mx /= len;
    my /= len;
  } else if (enemy.kind === KIND_SPITTER) {
    // Keep a standoff distance and shoot from it.
    if (dist < 220) { mx = -nx; my = -ny; }
    else if (dist < 330) { mx = 0; my = 0; }
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && dist < 460) {
      enemy.shootTimer = range(random, 1.6, 2.4);
      return 'shoot';
    }
  } else if (enemy.kind === KIND_BOSS) {
    enemy.burstTimer -= dt;
    enemy.spawnTimer -= dt;
    if (enemy.burstTimer <= 0) {
      enemy.burstTimer = range(random, 2.6, 3.4);
      return 'burst';
    }
    if (enemy.spawnTimer <= 0) {
      enemy.spawnTimer = range(random, 5, 7);
      return 'spawn';
    }
  } else if (enemy.kind === KIND_DRIFTER) {
    // Slow, drifting pursuit with a lazy sway.
    enemy.wobble += dt * 1.4;
    const perpX = -ny;
    const perpY = nx;
    const sway = Math.sin(enemy.wobble) * 0.35;
    mx = nx + perpX * sway;
    my = ny + perpY * sway;
    const len = Math.hypot(mx, my) || 1;
    mx /= len;
    my /= len;
  }
  enemy.vx = mx * enemy.speed;
  enemy.vy = my * enemy.speed;
  return null;
}

/** What a splitter leaves behind when it dies: two fast little drifters. */
export function splitChildren(random) {
  return [
    { kind: KIND_SKITTER, dx: -14, dy: 0 },
    { kind: KIND_SKITTER, dx: 14, dy: 0 },
  ];
}

export function randomKindForWave(random, wave) {
  const kinds = kindsForWave(wave);
  // Brutes are rare; drifters are the bulk.
  const roll = random();
  if (wave >= 4 && roll < 0.10) return KIND_BRUTE;
  if (wave >= 3 && roll < 0.24) return KIND_SPITTER;
  if (wave >= 2 && roll < 0.38) return KIND_SPLITTER;
  return kinds[Math.floor(random() * kinds.length)];
}

export function bossHpForWave(wave) {
  return wave >= 10 ? 1400 : 900;
}

export { rangeInt };
