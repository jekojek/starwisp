// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 field is scaled to fit the window and centred. Everything
// is procedural canvas art: a glowing wisp, shadow creatures with pulsing
// cores, a firefly forest, star-shards, particles and a dusk sky that
// deepens wave by wave.

import { FIELD, FONT, PALETTES, PALETTE } from './config.js';
import { ENEMY_TYPES, KIND_BOSS } from './enemies.js';
import { PICKUP_HEART, PICKUP_NOVA, PICKUP_MAGNET } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let time = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  // Glow is a pre-rendered radial sprite per colour, stamped with
  // drawImage: far cheaper than building a gradient for every glow, every
  // frame (which crawls on software rendering).
  const glowSprites = new Map();
  function glowSprite(color) {
    let sprite = glowSprites.get(color);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = 128;
      sprite.height = 128;
      const g = sprite.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      glowSprites.set(color, sprite);
    }
    return sprite;
  }

  function glowCircle(x, y, radius, color, alpha) {
    context.globalAlpha = alpha;
    context.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
    context.globalAlpha = 1;
  }

  function drawForest(state, palette) {
    // Dusk sky with a low sun-glow and drifting fireflies.
    const sky = context.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, palette.sky);
    sky.addColorStop(0.7, palette.ground);
    sky.addColorStop(1, '#0a0714');
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    glowCircle(FIELD.width * 0.78, 130, 260, palette.glow, 0.10);
    glowCircle(FIELD.width * 0.2, 90, 180, palette.accent, 0.07);
    // Stars.
    context.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i += 1) {
      const sx = (i * 173.3) % FIELD.width;
      const sy = (i * 97.7) % 260;
      const tw = 0.25 + 0.2 * Math.sin(time * 1.7 + i * 2.3);
      context.globalAlpha = Math.max(0.05, tw);
      context.fillRect(sx, sy, 2, 2);
    }
    context.globalAlpha = 1;
    // Forest floor: soft dark mounds.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 5; i += 1) {
      context.beginPath();
      context.ellipse(180 + i * 240, FIELD.height + 40, 260, 70, 0, Math.PI, TAU);
      context.fill();
    }
    // Trees: dark trunks with swaying glowing canopies.
    for (const tree of state.trees) {
      const sway = Math.sin(time * 0.8 + tree.sway) * 3;
      context.strokeStyle = '#120c22';
      context.lineWidth = tree.r * 0.35;
      context.beginPath();
      context.moveTo(tree.x, tree.y + tree.r);
      context.lineTo(tree.x + sway, tree.y - tree.r * 1.4);
      context.stroke();
      glowCircle(tree.x + sway, tree.y - tree.r * 1.5, tree.r * 1.5, palette.fog, 0.55);
      context.fillStyle = '#1a1230';
      context.beginPath();
      context.arc(tree.x + sway, tree.y - tree.r * 1.5, tree.r, 0, TAU);
      context.fill();
      context.fillStyle = palette.glow;
      context.globalAlpha = 0.5;
      context.beginPath();
      context.arc(tree.x + sway - tree.r * 0.3, tree.y - tree.r * 1.7, 2.5, 0, TAU);
      context.arc(tree.x + sway + tree.r * 0.35, tree.y - tree.r * 1.3, 2, 0, TAU);
      context.fill();
      context.globalAlpha = 1;
    }
    // Fireflies.
    for (let i = 0; i < 24; i += 1) {
      const fx = (i * 211.7 + Math.sin(time * 0.5 + i) * 30) % FIELD.width;
      const fy = 120 + ((i * 137.3) % 480) + Math.cos(time * 0.7 + i * 1.7) * 18;
      context.globalAlpha = 0.25 + 0.3 * Math.abs(Math.sin(time + i));
      context.fillStyle = palette.glow;
      context.beginPath();
      context.arc(fx, fy, 2.2, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawPlayer(state) {
    const p = state.player;
    const st = state.stats;
    const blink = state.invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
    const dashing = state.dashTimer > 0;
    glowCircle(p.x, p.y, 90, '#ffd166', dashing ? 0.5 : 0.34);
    glowCircle(p.x, p.y, 42, '#ffe9a8', 0.5);
    if (!blink) {
      context.fillStyle = '#fff7d6';
      context.beginPath();
      context.arc(p.x, p.y, p.radius * 0.85, 0, TAU);
      context.fill();
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.arc(p.x, p.y, p.radius * 0.55, 0, TAU);
      context.fill();
      // Eyes and the aim glint.
      context.fillStyle = '#2b1a4d';
      context.beginPath();
      context.arc(p.x - 5, p.y - 2, 2.6, 0, TAU);
      context.arc(p.x + 5, p.y - 2, 2.6, 0, TAU);
      context.fill();
      const ax = p.x + Math.cos(p.aimAngle) * (p.radius + 10);
      const ay = p.y + Math.sin(p.aimAngle) * (p.radius + 10);
      glowCircle(ax, ay, 12, '#ffffff', 0.7);
    }
    // Dash cooldown ring.
    if (state.dashCooldown > 0) {
      const frac = 1 - state.dashCooldown / st.dashCooldown;
      context.strokeStyle = 'rgba(168,200,255,0.8)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, p.y, p.radius + 7, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
      context.stroke();
    }
  }

  function drawEnemy(e) {
    const def = ENEMY_TYPES[e.kind];
    const pulse = 1 + 0.08 * Math.sin(time * 5 + e.wobble);
    const r = e.radius * pulse;
    glowCircle(e.x, e.y, r * 2.4, def.color, 0.35);
    context.fillStyle = def.color;
    context.beginPath();
    if (e.kind === KIND_BOSS) {
      // A crowned shadow: jagged ring of spikes around a dark core.
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * TAU + time * 0.25;
        const sx = e.x + Math.cos(a) * r;
        const sy = e.y + Math.sin(a) * r;
        context.moveTo(e.x + Math.cos(a - 0.22) * r * 0.7, e.y + Math.sin(a - 0.22) * r * 0.7);
        context.lineTo(sx, sy);
        context.lineTo(e.x + Math.cos(a + 0.22) * r * 0.7, e.y + Math.sin(a + 0.22) * r * 0.7);
      }
      context.fill();
      context.beginPath();
      context.arc(e.x, e.y, r * 0.82, 0, TAU);
      context.fill();
    } else {
      context.arc(e.x, e.y, r, 0, TAU);
      context.fill();
      // Little horns for the brute, a tail wisp for the skitter.
      if (e.kind === 3) {
        context.beginPath();
        context.moveTo(e.x - r * 0.6, e.y - r * 0.7);
        context.lineTo(e.x - r * 0.9, e.y - r * 1.4);
        context.lineTo(e.x - r * 0.2, e.y - r * 0.9);
        context.moveTo(e.x + r * 0.6, e.y - r * 0.7);
        context.lineTo(e.x + r * 0.9, e.y - r * 1.4);
        context.lineTo(e.x + r * 0.2, e.y - r * 0.9);
        context.fill();
      }
    }
    // Glowing core and eyes.
    const flash = e.flash > 0;
    context.fillStyle = flash ? '#ffffff' : def.core;
    context.beginPath();
    context.arc(e.x, e.y, r * 0.45, 0, TAU);
    context.fill();
    context.fillStyle = '#ffffff';
    const eyeOff = r * 0.32;
    const lookX = Math.cos(time * 0.6 + e.wobble) * 2;
    context.beginPath();
    context.arc(e.x - eyeOff + lookX, e.y - r * 0.18, 2.6, 0, TAU);
    context.arc(e.x + eyeOff + lookX, e.y - r * 0.18, 2.6, 0, TAU);
    context.fill();
    // Boss health bar.
    if (e.kind === KIND_BOSS) {
      const w = 220;
      const x = e.x - w / 2;
      const y = e.y - r - 26;
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(x - 2, y - 2, w + 4, 12);
      context.fillStyle = '#ff4d6d';
      context.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 8);
      text('NIGHT KING', e.x, y - 8, 15, '#ff8fa3', 'center');
    } else if (e.hp < e.maxHp) {
      const w = e.radius * 2;
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(e.x - w / 2, e.y - r - 10, w, 5);
      context.fillStyle = def.core;
      context.fillRect(e.x - w / 2, e.y - r - 10, w * Math.max(0, e.hp / e.maxHp), 5);
    }
  }

  function drawHud(state, best, muted) {
    const st = state.stats;
    context.textBaseline = 'top';
    // Top-left: score and best.
    text(`Score ${state.score}`, 22, 16, 26, PALETTE.text, 'left', 'top');
    text(`Best ${best}`, 22, 46, 17, PALETTE.muted, 'left', 'top');
    if (state.combo >= 3) {
      text(`Combo x${(1 + Math.min(2, state.combo * 0.05)).toFixed(2)}  (${state.combo})`, 22, 72, 18, '#ffd166', 'left', 'top');
    }
    // Top-centre: wave and banner.
    text(`Wave ${state.wave}`, FIELD.width / 2, 16, 26, PALETTE.text, 'center', 'top');
    text(state.victory ? 'The forest is free!' : `Level ${state.level}`, FIELD.width / 2, 46, 17, PALETTE.muted, 'center', 'top');
    // Top-right: kills, mute hint.
    text(`Kills ${state.kills}`, FIELD.width - 22, 16, 20, PALETTE.text, 'right', 'top');
    text(muted ? 'Muted (M)' : 'M: mute', FIELD.width - 22, 42, 15, PALETTE.muted, 'right', 'top');
    // HP bar, bottom-left.
    const barW = 260;
    const barH = 18;
    const bx = 22;
    const by = FIELD.height - 58;
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(bx - 3, by - 3, barW + 6, barH + 6);
    context.fillStyle = '#3a2b4d';
    context.fillRect(bx, by, barW, barH);
    context.fillStyle = st.hp / st.maxHp > 0.35 ? '#ff5f7a' : '#ff2e4d';
    context.fillRect(bx, by, barW * Math.max(0, st.hp / st.maxHp), barH);
    text(`HP ${Math.ceil(st.hp)} / ${st.maxHp}`, bx, by + 24, 16, PALETTE.text, 'left', 'top');
    // XP bar, bottom-centre.
    const xpW = 420;
    const xpX = (FIELD.width - xpW) / 2;
    const xpY = FIELD.height - 30;
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(xpX - 3, xpY - 3, xpW + 6, 12);
    context.fillStyle = '#3a2b4d';
    context.fillRect(xpX, xpY, xpW, 6);
    context.fillStyle = '#ffd166';
    context.fillRect(xpX, xpY, xpW * Math.min(1, state.xp / state.xpNext), 6);
    text(`XP ${state.xp}/${state.xpNext}`, FIELD.width / 2, xpY + 12, 13, PALETTE.muted, 'center', 'top');
    // Dash + nova, bottom-right.
    const dashReady = state.dashCooldown <= 0;
    text(dashReady ? 'Dash ready [Shift]' : `Dash ${state.dashCooldown.toFixed(1)}s`, FIELD.width - 22, FIELD.height - 58, 16, dashReady ? '#a8c8ff' : PALETTE.muted, 'right', 'top');
    if (st.novaCharges > 0) text(`Nova charges: ${st.novaCharges}  (press N)`, FIELD.width - 22, FIELD.height - 34, 15, '#ffd166', 'right', 'top');
    // Wave banner.
    if (state.bannerTimer > 0 && state.banner) {
      const alpha = Math.min(1, state.bannerTimer);
      context.globalAlpha = alpha;
      text(state.banner, FIELD.width / 2, 120, 40, '#ffe9a8', 'center', 'top');
      context.globalAlpha = 1;
    }
    if (state.novaFlash > 0) {
      context.fillStyle = `rgba(255,209,102,${state.novaFlash * 0.8})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const lineH = 32;
    const height = 150 + lines.length * lineH + 70;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5,3,12,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 62, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 122 + i * lineH, 21, PALETTE.muted, 'center');
    }
    if (prompt) text(prompt, FIELD.width / 2, y + height - 34, 22, '#ffd166', 'center');
  }

  function drawLevelUp(state) {
    const width = 760;
    const height = 430;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5,3,12,0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = '#ffd166';
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(`LEVEL ${state.level}!`, FIELD.width / 2, y + 58, 42, '#ffd166', 'center');
    text('Choose a blessing of the forest:', FIELD.width / 2, y + 100, 20, PALETTE.muted, 'center');
    const choices = state.pendingChoices || [];
    const cardW = 210;
    const gap = 20;
    const total = choices.length * cardW + (choices.length - 1) * gap;
    let cx = (FIELD.width - total) / 2;
    const cy = y + 140;
    choices.forEach((choice, i) => {
      context.fillStyle = '#2e2148';
      context.fillRect(cx, cy, cardW, 190);
      context.strokeStyle = '#6b5599';
      context.lineWidth = 2;
      context.strokeRect(cx, cy, cardW, 190);
      text(choice.icon, cx + cardW / 2, cy + 56, 40, '#ffd166', 'center');
      text(`${i + 1}`, cx + 14, cy + 14, 16, PALETTE.muted, 'left', 'top');
      text(choice.name, cx + cardW / 2, cy + 102, 20, PALETTE.text, 'center');
      // Word-wrap the description into two lines at most.
      const words = choice.desc.split(' ');
      let line = '';
      let ly = cy + 132;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 20 && line) {
          text(line, cx + cardW / 2, ly, 16, PALETTE.muted, 'center');
          ly += 22;
          line = word;
        } else {
          line = (line + ' ' + word).trim();
        }
      }
      if (line) text(line, cx + cardW / 2, ly, 16, PALETTE.muted, 'center');
      cx += cardW + gap;
    });
    text('Press 1, 2 or 3 — or click a card', FIELD.width / 2, y + height - 36, 19, '#ffd166', 'center');
  }

  /** Paint one frame: the forest, the creatures, the HUD and the screen panel. */
  function draw(state, screen, best, muted, extra) {
    time += 1 / 60;
    const palette = PALETTES[Math.min(PALETTES.length - 1, state.wave - 1)];
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);

    drawForest(state, palette);

    // Star-shards.
    for (const s of state.shards) {
      if (!s.active) continue;
      const tw = 0.7 + 0.3 * Math.sin(time * 6 + s.x);
      glowCircle(s.x, s.y, 14, '#ffd166', 0.5 * tw);
      context.fillStyle = '#ffe9a8';
      context.save();
      context.translate(s.x, s.y);
      context.rotate(time * 2 + s.x);
      context.fillRect(-4, -4, 8, 8);
      context.restore();
    }
    // Pickups.
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(time * 4 + pk.x) * 4;
      if (pk.kind === PICKUP_HEART) {
        glowCircle(pk.x, pk.y + bob, 22, '#ff5f7a', 0.6);
        text('♥', pk.x, pk.y + bob + 8, 26, '#ff5f7a', 'center');
      } else if (pk.kind === PICKUP_NOVA) {
        glowCircle(pk.x, pk.y + bob, 26, '#ffd166', 0.7);
        text('☀', pk.x, pk.y + bob + 10, 28, '#ffd166', 'center');
      } else {
        glowCircle(pk.x, pk.y + bob, 24, '#a8c8ff', 0.7);
        text('◎', pk.x, pk.y + bob + 9, 26, '#a8c8ff', 'center');
      }
    }
    // Enemy bolts.
    for (const b of state.enemyBolts) {
      if (!b.active) continue;
      glowCircle(b.x, b.y, 16, '#b7e4a8', 0.6);
      context.fillStyle = '#d8f3c0';
      context.beginPath();
      context.arc(b.x, b.y, b.radius, 0, TAU);
      context.fill();
    }
    // Enemies, then the wisp, then its bolts.
    for (const e of state.enemies) if (e.active) drawEnemy(e);
    drawPlayer(state);
    for (const b of state.bolts) {
      if (!b.active) continue;
      glowCircle(b.x, b.y, 18, '#ffe9a8', 0.8);
      context.fillStyle = '#fff7d6';
      context.beginPath();
      context.arc(b.x, b.y, b.radius, 0, TAU);
      context.fill();
    }
    // Particles and floating numbers.
    for (const pt of state.particles) {
      if (!pt.active) continue;
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const f of state.floats) {
      if (!f.active) continue;
      context.globalAlpha = Math.min(1, f.life * 2);
      text(f.text, f.x, f.y, f.size, f.color, 'center');
    }
    context.globalAlpha = 1;

    if (screen === SCREEN_TITLE) {
      const lines = [
        'You are a wisp of light in a dark forest.',
        'Shadow creatures swarm — your light burns them.',
        'Gather star-shards, level up, slay the Night King.',
        '',
        `Best score ${best}   •   Best wave ${extra && extra.bestWave ? extra.bestWave : 0}`,
        'WASD / arrows to move  •  mouse to aim (auto-fire)',
        'Shift / Space to dash  •  P pause  •  M mute  •  R restart',
      ];
      drawPanel('✦  STARWISP  ✦', lines, 'Press Space or click to begin', '#ffd166');
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_LEVELUP) {
      drawLevelUp(state);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The forest holds its breath.', `Wave ${state.wave}  •  Score ${state.score}`], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const lines = [
        `Score ${state.score}   •   Best ${best}`,
        `Wave reached ${state.wave}   •   ${state.kills} creatures banished`,
        `Best combo ${state.bestCombo}   •   Level ${state.level}`,
        '',
        'The light fades… but wisps always return.',
      ];
      drawPanel('The light fades', lines, 'Press Space or click to play again', '#ff5f7a');
    } else if (screen === SCREEN_WIN) {
      const lines = [
        `Score ${state.score}   •   Best ${best}`,
        `The Night King is banished on wave ${state.wave}!`,
        `${state.kills} creatures banished   •   Best combo ${state.bestCombo}`,
        '',
        'The forest glows again —',
        'and the night is endless if you wish.',
      ];
      drawPanel('✦  VICTORY  ✦', lines, 'Press Space for endless mode, or R to restart', '#ffd166');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** Convert a client (mouse/touch) point to logical field coordinates. */
    toField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      return {
        x: ((clientX - rect.left) * ratio - view.x) / view.scale,
        y: ((clientY - rect.top) * ratio - view.y) / view.scale,
      };
    },
  };
}
