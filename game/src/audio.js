// All sound is synthesised with WebAudio: short blips for shots and hits,
// chimes for pickups and level-ups, and a slow ambient pad that drifts
// through a minor pentatonic scale. Nothing is loaded from a file, nothing
// plays until the player has pressed a key or clicked (the browser's rule),
// and M mutes everything.

const NOTES = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let noteIndex = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!context || muted) return;
    try {
      const t0 = context.currentTime + (delay || 0);
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch { /* a failed blip must never break the game */ }
  }

  function pad(freq, dur, delay) {
    if (!context || muted) return;
    try {
      const t0 = context.currentTime + (delay || 0);
      const osc = context.createOscillator();
      const osc2 = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.value = freq;
      osc2.frequency.value = freq * 1.005;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(1, t0 + dur * 0.4);
      gain.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(musicGain);
      osc.start(t0);
      osc2.start(t0);
      osc.stop(t0 + dur);
      osc2.stop(t0 + dur);
    } catch { /* ignore */ }
  }

  function startMusic() {
    if (musicTimer !== null || !context) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      noteIndex = (noteIndex + Math.floor(Math.random() * 3) + 1) % NOTES.length;
      pad(NOTES[noteIndex], 4.5, 0);
      if (Math.random() < 0.4) pad(NOTES[(noteIndex + 4) % NOTES.length] / 2, 5, 0.6);
    }, 2600);
  }

  return {
    /** Call on the first user gesture; starts the context and the ambient pad. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume().catch(() => {});
      startMusic();
    },
    shoot() { tone(880, 0.09, 'square', 0.10, 420); },
    hit() { tone(180, 0.12, 'sawtooth', 0.14, 90); },
    hurt() { tone(140, 0.25, 'sawtooth', 0.20, 55); },
    die() { tone(320, 0.35, 'triangle', 0.18, 60); tone(160, 0.4, 'sine', 0.15, 40, 0.05); },
    shard() { tone(1180 + Math.random() * 300, 0.08, 'sine', 0.10, 1600); },
    levelUp() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'sine', 0.14, null, i * 0.09));
    },
    pickup() { tone(660, 0.15, 'sine', 0.14, 990); tone(990, 0.2, 'sine', 0.10, 1320, 0.07); },
    wave() { tone(392, 0.3, 'triangle', 0.14, 523.25); tone(523.25, 0.35, 'triangle', 0.12, 659.25, 0.18); },
    boss() { tone(98, 0.6, 'sawtooth', 0.18, 49); tone(147, 0.6, 'sawtooth', 0.12, 73.5, 0.2); },
    dash() { tone(500, 0.12, 'sine', 0.10, 900); },
    nova() { tone(220, 0.5, 'sawtooth', 0.16, 40); tone(880, 0.4, 'sine', 0.12, 110, 0.05); },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.4, 'triangle', 0.13, null, i * 0.13));
    },
    gameOver() {
      [392, 329.63, 261.63, 196].forEach((f, i) => tone(f, 0.45, 'triangle', 0.13, null, i * 0.18));
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
  };
}
