# ✦ Starwisp

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/jekojek/starwisp/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/jekojek/starwisp/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Starwisp** is a top-down 2D canvas arena survival game. You are a wisp of
light in a dark forest. Shadow creatures swarm in from the edges of the
arena, and your light burns them. Gather star-shards to level up, choose one
of three blessings each level, and survive ten waves — the **Night King**
wakes on wave 5 and returns stronger on wave 10. Slay him to win, then keep
going in endless mode. If your light goes out, the forest takes you.

Everything is original and procedural: the art is drawn on canvas, the
music and sound effects are synthesised live with WebAudio, and the game
runs entirely offline from static files — no network requests, no libraries.

## How to play

Serve the game locally and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` from any static file server.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim (auto-fire light bolts) |
| Shift / Space | Dash (with cooldown and i-frames) |
| N | Nova blast (if you hold a nova charge) |
| 1 / 2 / 3 or click a card | Choose a level-up blessing |
| P / Esc | Pause |
| M | Mute |
| R | Restart |

Touch works too: drag to move toward your finger; the wisp fires at the
nearest shadow on its own.

## The creatures

- **Drifter** — slow, swaying pursuer
- **Skitter** — fast zig-zag hunter, fragile
- **Spitter** — keeps its distance and shoots thorn bolts
- **Brute** — slow, huge health, heavy touch damage
- **Splitter** — bursts into two skitters when slain
- **Night King** — the boss of waves 5 and 10: a crowned shadow that fires
  radial rings of bolts and calls minions

## Systems

- **XP & levels** — star-shards from slain creatures; each level offers 3
  blessings from a pool of 10 (damage, fire rate, multishot, speed, max HP,
  magnet, dash cooldown, nova, pierce, crit)
- **Combo multiplier** — chained kills raise your score multiplier up to 3x
- **Pickups** — hearts heal, nova bombs blast the whole arena, magnets pull
  in every shard
- **Feel** — particles, screen shake, floating damage numbers, glow effects,
  wave banners, and a dusk palette that deepens every wave
- **Sound** — WebAudio synth effects plus a slow ambient pad
- **Best score & best wave** — kept in `localStorage`

## Screenshots

The four screenshots in `screenshots/` are real renders of the game's own
code, staged deterministically with `?shot=start|play|levelup|end&seed=7`
(see `game/src/shots.js` and `shots.json`): the title over a living forest,
combat in progress, a level-up choice, and the game-over screen.

## Structure

```
game/
  index.html        page + canvas
  src/
    config.js       tuning, palettes, wave math
    random.js       seeded RNG (mulberry32) + helpers
    input.js        keyboard, mouse, touch
    audio.js        WebAudio synth SFX + ambient music
    world.js        state, spawning, waves, combat, combo, boss
    enemies.js      the six creature kinds + their behaviour
    upgrades.js     the blessing pool + applying choices
    render.js       all drawing: forest, creatures, HUD, panels
    shots.js        deterministic screenshot scenes (autopilot)
    main.js         boot, the fixed-step loop, screens
main.ts             hands game/ + screenshots/ to /output with a dossier
serve.ts            tiny local static server (port 8080)
shots.json          the four screenshot scenes
vendor/
  makefun-game.ts   the kit's dossier library, unchanged
```

## License

MIT — see [LICENSE](LICENSE).
