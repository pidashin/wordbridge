// Pure letter spawning: no Phaser imports. Elevation is the letter centre's
// height above the base ground line.

import type { Rng } from './terrainGenerator';

export type Band = 'ground' | 'low' | 'high';

export type Letter = {
  id: number;
  char: string;
  x: number;
  elevation: number;
  band: Band;
};

export type LetterOptions = {
  aheadPx: number;
  targetWindowPx: number;
  distractorRatio: [number, number];
  gap: [number, number];
  firstLetterOffset: number;
  despawnBehind: number;
  provisionalMargin: number;
  radius: number;
  blockClearance: number;
  // Centre height above the local surface for each band, in px.
  bandHeights: Record<Band, number>;
  bandWeights: Record<Band, number>;
};

// What the spawner needs to know about the world, supplied by the scene.
export type LetterEnv = {
  surfaceAt(x: number): number;
  maxSurfaceIn(x0: number, x1: number): number;
  blockTopIn(x0: number, x1: number): number;
};

export type SpawnerUpdate = {
  spawned: Letter[];
  rewritten: Letter[];
  removed: Letter[];
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const BANDS: Band[] = ['ground', 'low', 'high'];

export class LetterSpawner {
  letters: Letter[] = [];
  private nextId = 1;
  private cursor: number;
  private target: string | null = null;
  private readonly distractorRatio: number;

  constructor(
    private readonly o: LetterOptions,
    private readonly rng: Rng,
    private readonly env: LetterEnv,
    startX: number,
  ) {
    this.cursor = startX + o.firstLetterOffset;
    this.distractorRatio =
      o.distractorRatio[0] +
      rng() * (o.distractorRatio[1] - o.distractorRatio[0]);
  }

  // Called when a slot fills or a new word starts.
  setTarget(char: string | null): void {
    this.target = char;
  }

  remove(letter: Letter): void {
    this.letters = this.letters.filter((l) => l !== letter);
  }

  update(
    playerX: number,
    viewLeftX: number,
    viewRightX: number,
  ): SpawnerUpdate {
    const result: SpawnerUpdate = { spawned: [], rewritten: [], removed: [] };

    const keep: Letter[] = [];
    for (const l of this.letters) {
      if (l.x < viewLeftX - this.o.despawnBehind) result.removed.push(l);
      else keep.push(l);
    }
    this.letters = keep;

    while (this.cursor < playerX + this.o.aheadPx) {
      const letter = this.spawnAt(this.cursor);
      this.letters.push(letter);
      result.spawned.push(letter);
      const [gapMin, gapMax] = this.o.gap;
      this.cursor += gapMin + this.rng() * (gapMax - gapMin);
    }

    // Every update: the player can also pass the only target letter by.
    this.ensureTarget(playerX, viewRightX, result);
    return result;
  }

  // The current target must appear at least once in the next
  // targetWindowPx. Only letters still beyond the right screen edge
  // (provisional) are ever rewritten.
  private ensureTarget(
    playerX: number,
    viewRightX: number,
    result: SpawnerUpdate,
  ): void {
    const target = this.target;
    if (!target) return;
    const windowEnd = playerX + this.o.targetWindowPx;
    const inWindow = this.letters.filter(
      (l) => l.x >= playerX && l.x <= windowEnd,
    );
    if (inWindow.some((l) => l.char === target)) return;

    const provisional = inWindow
      .filter((l) => l.x > viewRightX + this.o.provisionalMargin)
      .sort((a, b) => a.x - b.x)[0];
    if (!provisional) return;
    provisional.char = target;
    result.rewritten.push(provisional);
  }

  private spawnAt(x: number): Letter {
    const isDistractor = this.rng() < this.distractorRatio;
    const char =
      this.target && !isDistractor
        ? this.target
        : this.randomChar(isDistractor);
    const { band, elevation } = this.place(x);
    return { id: this.nextId++, char, x, elevation, band };
  }

  private randomChar(avoidTarget: boolean): string {
    for (;;) {
      const c = ALPHABET[Math.floor(this.rng() * ALPHABET.length)];
      if (!avoidTarget || c !== this.target) return c;
    }
  }

  // Pick a band, then lift the letter if the chosen height would put it
  // inside the ground or a block.
  private place(x: number): { band: Band; elevation: number } {
    const r = this.o.radius;
    const surface = this.env.maxSurfaceIn(x - r, x + r);
    const blockTop = this.env.blockTopIn(x - r - 4, x + r + 4);
    const floor =
      Math.max(surface, blockTop > 0 ? blockTop : 0) +
      r +
      (blockTop > 0 ? this.o.blockClearance : 0);

    const preferred = this.pickBand();
    const ordered = [preferred, ...BANDS.filter((b) => b !== preferred)];
    for (const band of ordered) {
      const elevation = this.bandElevation(band, x);
      if (elevation >= floor) return { band, elevation };
    }
    return { band: 'high', elevation: this.bandElevation('high', x) };
  }

  private bandElevation(band: Band, x: number): number {
    return this.env.surfaceAt(x) + this.o.bandHeights[band];
  }

  private pickBand(): Band {
    const w = this.o.bandWeights;
    let roll = this.rng() * (w.ground + w.low + w.high);
    for (const band of BANDS) {
      roll -= w[band];
      if (roll < 0) return band;
    }
    return 'ground';
  }
}
