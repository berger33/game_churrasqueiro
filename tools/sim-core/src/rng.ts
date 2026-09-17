/**
 * Deterministic RNG (mulberry32). The whole simulation must be reproducible so
 * balance reports and golden vectors are stable across machines and runs.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    // Force a non-zero 32-bit state.
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1 - 1e-9));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Weighted pick. Returns -1 when the list is empty or all weights are 0. */
  pickWeighted(weights: number[]): number {
    let total = 0;
    for (const w of weights) total += w > 0 ? w : 0;
    if (total <= 0) return -1;
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i]!;
      if (w <= 0) continue;
      roll -= w;
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]!;
  }

  shuffled<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i]!;
      out[i] = out[j]!;
      out[j] = tmp;
    }
    return out;
  }
}
