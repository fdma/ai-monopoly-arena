/**
 * Seedable PRNG based on mulberry32.
 * Deterministic: same seed → same sequence of rolls.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Roll a single die (1-6) */
  rollDie(): number {
    return Math.floor(this.next() * 6) + 1;
  }

  /** Roll two dice, returns [d1, d2] */
  rollDice(): [number, number] {
    return [this.rollDie(), this.rollDie()];
  }

  /** Returns a random integer in [min, max] inclusive */
  randInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  getState(): number {
    return this.state;
  }

  static fromState(rngState: number): SeededRNG {
    const rng = new SeededRNG(0);
    rng.state = rngState;
    return rng;
  }
}
