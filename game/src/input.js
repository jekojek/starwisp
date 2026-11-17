// Keyboard, mouse and touch input. Held keys give a movement vector; the
// mouse gives an aim point in logical field coordinates; one-shot presses
// (start, pause, dash, mute, restart) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;
export const ACTION_NOVA = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);
const NOVA = new Set(['KeyN']);

export function createInput(canvas, toField) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;
  let mouseHeld = false;
  let touchX = null;
  let touchY = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (DASH.has(event.code)) { if (!event.repeat) actions |= ACTION_DASH; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (RESTART.has(event.code)) { if (!event.repeat) actions |= ACTION_RESTART; }
    else if (NOVA.has(event.code)) { if (!event.repeat) actions |= ACTION_NOVA; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    mouseHeld = false;
    touchX = touchY = null;
  });

  function trackPointer(clientX, clientY) {
    const point = toField(clientX, clientY);
    mouseX = point.x;
    mouseY = point.y;
    mouseSeen = true;
  }
  canvas.addEventListener('pointermove', (event) => trackPointer(event.clientX, event.clientY));
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event.clientX, event.clientY);
    mouseHeld = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseHeld = false; });
  canvas.addEventListener('touchstart', (event) => {
    const t = event.touches[0];
    const point = toField(t.clientX, t.clientY);
    touchX = point.x;
    touchY = point.y;
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (event) => {
    const t = event.touches[0];
    const point = toField(t.clientX, t.clientY);
    touchX = point.x;
    touchY = point.y;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { touchX = touchY = null; });

  return {
    /** Normalised movement vector {x, y} from keys, or toward the touch point. */
    moveVector(playerX, playerY) {
      if (touchX !== null && touchY !== null) {
        const dx = touchX - playerX;
        const dy = touchY - playerY;
        const len = Math.hypot(dx, dy);
        if (len < 12) return { x: 0, y: 0 };
        return { x: dx / len, y: dy / len };
      }
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Aim point in field coordinates; null until the mouse has moved. */
    aim() {
      return mouseSeen ? { x: mouseX, y: mouseY } : null;
    },
    mouseHeld() { return mouseHeld; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
