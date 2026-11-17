// The screenshot scenes behind ?shot=start|play|levelup|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (flee the nearest enemy, dash when cornered,
// chase the nearest shard when safe), so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_LEVELUP, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 26;
const LEVELUP_LIMIT_SECONDS = 240;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Steer away from the nearest enemy, toward shards when the coast is clear. */
function autopilot(state, cautious) {
  const p = state.player;
  let threat = null;
  let threatD = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < threatD) { threatD = d; threat = e; }
  }
  let mx = 0;
  let my = 0;
  let dash = false;
  if (threat && threatD < (cautious ? 260 : 170)) {
    // Flee, and keep a little sideways drift so the wisp does not get pinned.
    const dx = p.x - threat.x;
    const dy = p.y - threat.y;
    const d = Math.hypot(dx, dy) || 1;
    mx = dx / d;
    my = dy / d + 0.35;
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    if (threatD < 90 && state.dashCooldown <= 0) dash = true;
  } else {
    // Chase the nearest shard; otherwise drift toward the centre.
    let shard = null;
    let shardD = Infinity;
    for (const s of state.shards) {
      if (!s.active) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < shardD) { shardD = d; shard = s; }
    }
    const tx = shard ? shard.x : FIELD.width / 2;
    const ty = shard ? shard.y : FIELD.height / 2;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 24) { mx = dx / d; my = dy / d; }
  }
  // Clamp inside the arena with a margin.
  if (p.x < 80) mx = Math.max(mx, 0.4);
  if (p.x > FIELD.width - 80) mx = Math.min(mx, -0.4);
  if (p.y < 80) my = Math.max(my, 0.4);
  if (p.y > FIELD.height - 80) my = Math.min(my, -0.4);
  return { mx, my, aimX: null, aimY: null, firing: true, dash };
}

function stepPilot(world, seconds, cautious, autoPick) {
  let events = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    events = world.step(STEP, autopilot(world.state, cautious), false);
    if (world.state.pendingChoices && autoPick) {
      world.chooseUpgrade(world.state.pendingChoices[0]);
    }
    if (events & (EVENT_OVER | EVENT_WIN)) break;
    if (events & EVENT_LEVELUP && !autoPick) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, levelup or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    stepPilot(world, PLAY_SECONDS, true, true);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'levelup') {
    for (let t = 0; t < LEVELUP_LIMIT_SECONDS / SAMPLE; t += 1) {
      const events = stepPilot(world, SAMPLE, true, false);
      if (events & EVENT_LEVELUP) return { screen: SCREEN_LEVELUP, best: world.state.score };
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    // Fall back to a play frame if the pilot never levelled up.
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    for (let t = 0; t < END_LIMIT_SECONDS / SAMPLE; t += 1) {
      const events = stepPilot(world, SAMPLE, false, true);
      if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
      if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // start: the title over a living forest, a few seconds in.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, autopilot(world.state, true), true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
