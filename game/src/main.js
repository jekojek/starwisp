// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, level-up, paused, game over and victory (then endless mode).
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|levelup|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, BEST_WAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_DASH, EVENT_HIT, EVENT_KILL, EVENT_LEVELUP, EVENT_NOVA, EVENT_OVER, EVENT_PICKUP, EVENT_SHARD, EVENT_SHOOT, EVENT_WAVE, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_NOVA, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readNumber(key) {
  try {
    return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveNumber(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false, { bestWave: Math.max(1, world.state.wave) });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readNumber(BEST_KEY);
  let bestWave = readNumber(BEST_WAVE_KEY);
  let accumulator = 0;
  let last = performance.now();
  let muted = false;
  let endless = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    endless = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Survive the waves and slay the Night King on wave 10.');
  }

  function finishRun(won) {
    if (world.state.score > best) {
      best = world.state.score;
      saveNumber(BEST_KEY, best);
    }
    if (world.state.wave > bestWave) {
      bestWave = world.state.wave;
      saveNumber(BEST_WAVE_KEY, bestWave);
    }
    if (won) {
      screen = SCREEN_WIN;
      audio.victory();
      announce(`Victory! Score ${world.state.score}. Press Space for endless mode.`);
    } else {
      screen = SCREEN_OVER;
      audio.gameOver();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function playSounds(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_KILL) audio.die();
    if (events & EVENT_SHARD) audio.shard();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_NOVA) audio.nova();
    if (events & EVENT_BOSS) audio.boss();
    if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_LEVELUP) audio.levelUp();
  }

  function stepWorld() {
    const move = input.moveVector(world.state.player.x, world.state.player.y);
    const aim = input.aim();
    const events = world.step(STEP, {
      mx: move.x,
      my: move.y,
      aimX: aim ? aim.x : null,
      aimY: aim ? aim.y : null,
      firing: true,
      dash: false,
    }, false);
    playSounds(events);
    if (world.state.pendingChoices) {
      screen = SCREEN_LEVELUP;
      announce(`Level ${world.state.level}! Choose an upgrade.`);
    } else if (events & EVENT_WIN && !endless) {
      finishRun(true);
    } else if (events & EVENT_OVER) {
      finishRun(false);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_NOVA && screen === SCREEN_PLAY) {
      if (world.useNova()) {
        audio.nova();
        announce('Nova blast!');
      }
    }
    if (actions & ACTION_DASH && screen === SCREEN_PLAY) {
      // Dash is read inside the step via a held flag: re-issue it this frame.
      const move = input.moveVector(world.state.player.x, world.state.player.y);
      const aim = input.aim();
      const events = world.step(STEP, {
        mx: move.x, my: move.y,
        aimX: aim ? aim.x : null, aimY: aim ? aim.y : null,
        firing: true, dash: true,
      }, false);
      playSounds(events);
      return;
    }
    if (screen === SCREEN_LEVELUP) {
      // Number keys 1-3 pick a card; clicking a card is handled below.
      return;
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) {
      // Endless mode: keep playing past wave 10.
      endless = true;
      screen = SCREEN_PLAY;
      world.state.victory = false;
      announce('Endless mode. How long can the light last?');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  // Number keys and card clicks choose a level-up blessing.
  window.addEventListener('keydown', (event) => {
    if (screen !== SCREEN_LEVELUP) return;
    const choices = world.state.pendingChoices || [];
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
    if (index >= 0 && choices[index]) {
      const line = world.chooseUpgrade(choices[index]);
      audio.levelUp();
      announce(`Chose ${choices[index].name}. ${line}`);
      screen = SCREEN_PLAY;
    }
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (screen !== SCREEN_LEVELUP) return;
    const choices = world.state.pendingChoices || [];
    if (choices.length === 0) return;
    const point = renderer.toField(event.clientX, event.clientY);
    // The cards are laid out in render.js: 760-wide panel, 210-wide cards.
    const panelX = (1280 - 760) / 2;
    const panelY = (720 - 430) / 2;
    const cardY = panelY + 140;
    const cardW = 210;
    const gap = 20;
    const total = choices.length * cardW + (choices.length - 1) * gap;
    const firstX = (1280 - total) / 2;
    for (let i = 0; i < choices.length; i += 1) {
      const cx = firstX + i * (cardW + gap);
      if (point.x >= cx && point.x <= cx + cardW && point.y >= cardY && point.y <= cardY + 190) {
        const line = world.chooseUpgrade(choices[i]);
        audio.levelUp();
        announce(`Chose ${choices[i].name}. ${line}`);
        screen = SCREEN_PLAY;
        break;
      }
    }
    void panelX;
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        const move = { mx: 0, my: 0, aimX: null, aimY: null, firing: true, dash: false };
        world.step(STEP, move, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepWorld();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, muted, { bestWave });
  }

  // Leaving the tab pauses a running game rather than letting shadows swarm unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Tiny read-only hooks the automated play-test uses to read the live state
  // (screen, score, HP, wave, kills). They change nothing about the game.
  window.__starwispDebug = () => ({
    screen,
    score: world.state.score,
    hp: Math.round(world.state.stats.hp),
    wave: world.state.wave,
    level: world.state.level,
    kills: world.state.kills,
    combo: world.state.combo,
    levelup: world.state.pendingChoices !== null,
    xp: world.state.xp,
    xpNext: world.state.xpNext,
  });
  window.__starwispHurt = (amount) => {
    world.state.stats.hp -= amount;
    if (world.state.stats.hp <= 0) {
      world.state.stats.hp = 0;
      world.state.over = true;
    }
  };

  announce('Starwisp. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
