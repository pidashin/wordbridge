// Pure letter spawning: no Phaser imports. Elevation is the letter centre's
// height above the flat base ground line.

import type { Rng, SurfaceInfo } from './terrainGenerator';

export type Band = 'ground' | 'low' | 'high';
export type LetterSite = 'ground' | 'platform' | 'gap';

export type Letter = {
  id: number;
  char: string;
  x: number;
  elevation: number;
  site: LetterSite;
};

export type LetterOptions = {
  aheadPx: number;
  targetWindowPx: number;
  distractorRatio: [number, number];
  spacing: [number, number];
  firstLetterOffset: number;
  despawnBehind: number;
  provisionalMargin: number;
  radius: number;
  blockClearance: number;
  // Centre height above the ground for each band, in px.
  bandHeights: Record<Band, number>;
  bandWeights: Record<Band, number>;
  // Min/max centre height above a platform top, in px.
  platformHeights: [number, number];
};

// What the spawner needs to know about the world, supplied by the scene.
export type LetterEnv = {
  describeAt(x: number, radius: number): SurfaceInfo | null;
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
  private lastX: number;
  private target: string | null = null;
  private readonly distractorRatio: number;

  constructor(
    private readonly o: LetterOptions,
    private readonly rng: Rng,
    private readonly env: LetterEnv,
    startX: number,
  ) {
    // lastX is the previous letter; the first one lands firstLetterOffset on.
    this.lastX = startX + o.firstLetterOffset - o.spacing[0];
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

    while (this.lastX + this.o.spacing[0] < playerX + this.o.aheadPx) {
      const letter = this.spawnNext(playerX);
      if (!letter) break;
      this.letters.push(letter);
      result.spawned.push(letter);
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

  private spawnNext(playerX: number): Letter | null {
    const spot = this.findSpot();
    if (!spot) return null;
    this.lastX = spot.x;

    // If no target letter is coming up yet, the next letter is the target.
    const targetAhead =
      this.target !== null &&
      this.letters.some((l) => l.x >= playerX && l.char === this.target);
    const isDistractor = this.rng() < this.distractorRatio;
    const char =
      this.target && (!targetAhead || !isDistractor)
        ? this.target
        : this.randomChar(this.target !== null);
    return { id: this.nextId++, char, ...this.place(spot) };
  }

  // A random x within the spacing window where a letter can sit; falls back
  // to scanning the window so spacing never leaves the configured bounds.
  private findSpot(): { x: number; info: SurfaceInfo } | null {
    const [min, max] = this.o.spacing;
    const r = this.o.radius;
    for (let i = 0; i < 8; i++) {
      const x = this.lastX + min + this.rng() * (max - min);
      const info = this.env.describeAt(x, r);
      if (info) return { x, info };
    }
    for (let x = this.lastX + min; x <= this.lastX + max; x += 10) {
      const info = this.env.describeAt(x, r);
      if (info) return { x, info };
    }
    return null;
  }

  private randomChar(avoidTarget: boolean): string {
    for (;;) {
      const c = ALPHABET[Math.floor(this.rng() * ALPHABET.length)];
      if (!avoidTarget || c !== this.target) return c;
    }
  }

  // Height by site: bands over the ground (lifted clear of blocks), the arc
  // over a gap (low/high band), or above a platform (needs the second jump).
  private place(spot: { x: number; info: SurfaceInfo }): {
    x: number;
    elevation: number;
    site: LetterSite;
  } {
    const { x, info } = spot;
    const r = this.o.radius;

    if (info.kind === 'platform') {
      const [lo, hi] = this.o.platformHeights;
      return {
        x,
        site: 'platform',
        elevation: info.base + lo + this.rng() * (hi - lo),
      };
    }

    const preferred = this.pickBand(info.kind === 'gap');
    if (info.kind === 'gap') {
      return { x, site: 'gap', elevation: this.o.bandHeights[preferred] };
    }

    const floor =
      info.blockTop > 0 ? info.blockTop + r + this.o.blockClearance : r;
    const ordered = [preferred, ...BANDS.filter((b) => b !== preferred)];
    for (const band of ordered) {
      const elevation = this.o.bandHeights[band];
      if (elevation >= floor) return { x, site: 'ground', elevation };
    }
    return { x, site: 'ground', elevation: this.o.bandHeights.high };
  }

  private pickBand(airOnly: boolean): Band {
    const w = this.o.bandWeights;
    const weights: Record<Band, number> = airOnly
      ? { ground: 0, low: w.low, high: w.high }
      : w;
    let roll = this.rng() * (weights.ground + weights.low + weights.high);
    for (const band of BANDS) {
      roll -= weights[band];
      if (roll < 0) return band;
    }
    return 'low';
  }
}
