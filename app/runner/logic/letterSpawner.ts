// Pure letter spawning: no Phaser imports. Elevation is the letter centre's
// height above the flat base ground line.

import type { Gap, Platform, Rng, SurfaceInfo } from './terrainGenerator';

export type Band = 'ground' | 'low' | 'high';
export type LetterSite =
  | 'ground'
  | 'platform'
  | 'under' // on a lower tier, beneath a higher one
  | 'gap'
  | 'approach'
  | 'depart';

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
  // Centre height above the surface for each band, in px.
  bandHeights: Record<Band, number>;
  bandWeights: Record<Band, number>;
  featureBias: number;
  underChance: number;
  // Gap between a letter's top and a platform underside when under it.
  underMargin: number;
  // Highest letter centre (keeps letters on screen and under the HUD).
  maxElevation: number;
  transit: {
    chance: number;
    takeoffDistance: number;
    approachDistance: [number, number];
    departDistance: [number, number];
  };
  // Real jump numbers for transit arcs.
  physics: {
    gravity: number;
    velocity: number;
    speed: number;
    centerOffset: number;
  };
};

// What the spawner needs to know about the world, supplied by the scene.
export type LetterEnv = {
  describeAt(x: number, radius: number): SurfaceInfo | null;
  featuresIn(x0: number, x1: number): { gaps: Gap[]; platforms: Platform[] };
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

    for (;;) {
      const missing = this.targetMissing(playerX);
      const windowEnd = playerX + this.o.targetWindowPx;
      const lazy = this.lastX + this.o.spacing[0] < playerX + this.o.aheadPx;
      // Letters are sparse; if the target is not coming up within the window,
      // spawn further ahead than usual and make that letter the target.
      const urgent = missing && this.lastX + this.o.spacing[0] <= windowEnd;
      if (!lazy && !urgent) break;
      const letter = this.spawnNext(urgent ? windowEnd : Infinity, urgent);
      if (!letter) break;
      this.letters.push(letter);
      result.spawned.push(letter);
    }

    // Every update: the player can also pass the only target letter by.
    this.ensureTarget(playerX, viewRightX, result);
    return result;
  }

  private targetMissing(playerX: number): boolean {
    return (
      this.target !== null &&
      !this.letters.some((l) => l.x >= playerX && l.char === this.target)
    );
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

  private spawnNext(maxX: number, forceTarget: boolean): Letter | null {
    const spot = this.findSpot(maxX);
    if (!spot) return null;
    this.lastX = spot.x;

    const isDistractor = this.rng() < this.distractorRatio;
    const char =
      this.target && (forceTarget || !isDistractor)
        ? this.target
        : this.randomChar(this.target !== null);
    return { id: this.nextId++, char, ...this.place(spot) };
  }

  // A spot within the spacing window where a letter can sit. Often on a
  // nearby gap or platform; otherwise random. Falls back to scanning the
  // window so spacing never leaves the configured bounds.
  private findSpot(maxX: number): { x: number; info: SurfaceInfo } | null {
    const [min, max] = this.o.spacing;
    const r = this.o.radius;
    const lo = this.lastX + min;
    const hi = Math.min(this.lastX + max, maxX);
    if (hi < lo) return null;

    if (this.rng() < this.o.featureBias) {
      const zones = this.featureZones(lo, hi);
      if (zones.length > 0) {
        const [z0, z1] = zones[Math.floor(this.rng() * zones.length)];
        for (let i = 0; i < 10; i++) {
          const x = z0 + this.rng() * (z1 - z0);
          const info = this.env.describeAt(x, r);
          if (info) return { x, info };
        }
      }
    }
    for (let i = 0; i < 8; i++) {
      const x = lo + this.rng() * (hi - lo);
      const info = this.env.describeAt(x, r);
      if (info) return { x, info };
    }
    for (let x = lo; x <= hi; x += 10) {
      const info = this.env.describeAt(x, r);
      if (info) return { x, info };
    }
    return null;
  }

  // x ranges within [lo, hi] around gaps and platforms (incl. transit arcs).
  private featureZones(lo: number, hi: number): [number, number][] {
    const t = this.o.transit;
    const reach = Math.max(t.approachDistance[1], t.departDistance[1]);
    const { gaps, platforms } = this.env.featuresIn(lo - reach, hi + reach);
    const zones: [number, number][] = [];
    const add = (a: number, b: number) => {
      const z0 = Math.max(a, lo);
      const z1 = Math.min(b, hi);
      if (z1 > z0) zones.push([z0, z1]);
    };
    for (const g of gaps) add(g.x, g.x + g.width);
    for (const p of platforms) {
      add(p.x - t.approachDistance[1], p.x + p.width + t.departDistance[1]);
    }
    return zones;
  }

  private randomChar(avoidTarget: boolean): string {
    for (;;) {
      const c = ALPHABET[Math.floor(this.rng() * ALPHABET.length)];
      if (!avoidTarget || c !== this.target) return c;
    }
  }

  // Height by site. Bands are fractions of the jump apex measured from the
  // surface the letter belongs to (ground or a platform top); transit letters
  // sit on real jump arcs around a platform. Bands that would rise above the
  // screen ceiling are skipped.
  private place(spot: { x: number; info: SurfaceInfo }): {
    x: number;
    elevation: number;
    site: LetterSite;
  } {
    const { x, info } = spot;
    const r = this.o.radius;
    const h = this.o.bandHeights;
    const max = this.o.maxElevation;

    if (info.kind === 'platform') {
      const p = info.platform;
      // Under a ledge: ground band of the surface below (ground or a lower
      // tier), only if it fits beneath the underside.
      const base = info.below ? info.below.top : 0;
      const underFits = base + h.ground + r <= p.bottom - this.o.underMargin;
      if (underFits && this.rng() < this.o.underChance) {
        return {
          x,
          site: info.below ? 'under' : 'ground',
          elevation: base + h.ground,
        };
      }
      return this.onSurface(x, 'platform', p.top, max, false);
    }
    if (info.kind === 'gap') {
      return this.onSurface(x, 'gap', info.base, max, true);
    }
    if (
      (info.kind === 'approach' || info.kind === 'depart') &&
      this.rng() < this.o.transit.chance
    ) {
      return this.transit(x, info);
    }

    const blockTop = info.kind === 'ground' ? info.blockTop : 0;
    const floor = blockTop > 0 ? blockTop + r + this.o.blockClearance : r;
    const preferred = this.pickBand(false);
    const ordered = [preferred, ...BANDS.filter((b) => b !== preferred)];
    for (const band of ordered) {
      if (h[band] >= floor && h[band] <= max) {
        return { x, site: 'ground', elevation: h[band] };
      }
    }
    return { x, site: 'ground', elevation: h.high };
  }

  // A band above `base` (a platform top, or the ground over an air gap),
  // skipping bands above the screen ceiling.
  private onSurface(
    x: number,
    site: LetterSite,
    base: number,
    max: number,
    airOnly: boolean,
  ): { x: number; elevation: number; site: LetterSite } {
    const h = this.o.bandHeights;
    const preferred = this.pickBand(airOnly);
    const ordered = [preferred, ...BANDS.filter((b) => b !== preferred)];
    for (const band of ordered) {
      if (airOnly && band === 'ground') continue;
      if (base + h[band] <= max) return { x, site, elevation: base + h[band] };
    }
    return { x, site, elevation: base + h.ground };
  }

  // On the arc of a full jump that took off takeoffDistance before the
  // platform (approach), or of the drop after running off its far end (depart).
  private transit(
    x: number,
    info: Extract<SurfaceInfo, { kind: 'approach' | 'depart' }>,
  ): { x: number; elevation: number; site: LetterSite } {
    const { gravity, velocity, speed, centerOffset } = this.o.physics;
    if (info.kind === 'approach') {
      const t = (this.o.transit.takeoffDistance - info.distance) / speed;
      const feet = velocity * t - (gravity * t * t) / 2;
      return { x, site: 'approach', elevation: feet + centerOffset };
    }
    const t = info.distance / speed;
    const feet = Math.max(0, info.platform.top - (gravity * t * t) / 2);
    return { x, site: 'depart', elevation: feet + centerOffset };
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
