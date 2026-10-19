// Pure word-pool logic: no Phaser imports.

import type { Rng } from './terrainGenerator';

export type RawWord = { enUS?: string | null; zhTW?: string | null };
export type RunnerWord = { en: string; zh: string };

export type PoolRules = { minLength: number; maxLength: number };

// Lowercase + trim, keep only plain letter words of the allowed length, and
// de-duplicate. Drops hyphenated and multi-word entries.
export function normalisePool(raw: RawWord[], rules: PoolRules): RunnerWord[] {
  const pattern = new RegExp(`^[a-z]{${rules.minLength},${rules.maxLength}}$`);
  const seen = new Set<string>();
  const pool: RunnerWord[] = [];
  for (const entry of raw) {
    const en = (entry.enUS ?? '').toLowerCase().trim();
    if (!pattern.test(en) || seen.has(en)) continue;
    seen.add(en);
    pool.push({ en, zh: (entry.zhTW ?? '').trim() });
  }
  return pool;
}

// Random order without repeats; next() returns null once every word is used.
export class WordDeck {
  private order: RunnerWord[];
  private index = 0;

  constructor(pool: RunnerWord[], rng: Rng) {
    this.order = [...pool];
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
  }

  next(): RunnerWord | null {
    return this.index < this.order.length ? this.order[this.index++] : null;
  }
}
