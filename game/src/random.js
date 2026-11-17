// A small seeded random number generator (mulberry32) plus the helpers the
// game uses everywhere, so the same seed always plays the same game: that is
// what makes the screenshot scenes repeatable and the runs fair.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max] inclusive. */
export function rangeInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of an array, uniformly. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** An angle in radians, uniformly around the circle. */
export function angle(random) {
  return random() * Math.PI * 2;
}

/** A point just outside one edge of the arena, for spawning attackers. */
export function edgePoint(random, width, height, margin) {
  const side = Math.floor(random() * 4);
  if (side === 0) return { x: range(random, 0, width), y: -margin };
  if (side === 1) return { x: width + margin, y: range(random, 0, height) };
  if (side === 2) return { x: range(random, 0, width), y: height + margin };
  return { x: -margin, y: range(random, 0, height) };
}
