// Pure spelling state for one word: no Phaser imports.

import type { RunnerWord } from './wordPool';

export type LetterResult = 'correct' | 'wrong';

export class WordProgress {
  private filled = 0;
  wrongLetters = 0;

  constructor(readonly word: RunnerWord) {}

  get slots(): (string | null)[] {
    return [...this.word.en].map((c, i) => (i < this.filled ? c : null));
  }

  get nextIndex(): number {
    return this.filled;
  }

  get complete(): boolean {
    return this.filled >= this.word.en.length;
  }

  // The only letter that counts right now, or null once the word is done.
  get target(): string | null {
    return this.complete ? null : this.word.en[this.filled];
  }

  // Decided at touch time against the current target. Letters needed later in
  // the word are distractors; each correct pickup fills exactly one slot.
  touch(char: string): LetterResult {
    if (this.complete) return 'wrong';
    if (char === this.word.en[this.filled]) {
      this.filled += 1;
      return 'correct';
    }
    this.wrongLetters += 1;
    return 'wrong';
  }
}
