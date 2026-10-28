// Pure terrain logic: no Phaser imports. Elevation is height above the flat
// base ground line in px (positive = up); the scene converts it to screen y.
// The route is flat: it only varies by gaps (holes), one-way platforms and
// low blocks.

export type ChunkKind = 'flat' | 'blocks' | 'gap' | 'platform';

export type Block = {
  x: number; // left edge
  width: number;
  height: number; // above the ground
};

// One-way ledge: jump up through it, land on top.
export type Platform = {
  x: number; // left edge
  width: number;
  top: number; // height above the ground
};

// A hole in the ground.
export type Gap = { x: number; width: number };

export type TerrainChunk = {
  kind: ChunkKind;
  startX: number;
  endX: number;
  blocks: Block[];
  platforms: Platform[];
  gaps: Gap[];
};

export type TerrainOptions = {
  startX: number;
  startFlatWidth: number;
  weights: Record<ChunkKind, number>;
  flatWidth: [number, number];
  blocksWidth: [number, number];
  blockWidth: number;
  blockHeight: number;
  blockEdgeMargin: number;
  blockMinSpacing: number;
  gapWidth: [number, number];
  gapPad: [number, number];
  platformTop: [number, number];
  platformSegments: [number, number];
  platformSegmentWidth: number;
  platformCapWidth: number;
  platformPad: [number, number];
  maxJumpApex: number;
  maxStepFraction: number;
};

export type Rng = () => number;

// mulberry32: small seedable PRNG so generation can be replayed in checks.
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(rng: Rng, [min, max]: [number, number]): number {
  return min + rng() * (max - min);
}

function empty(kind: ChunkKind, startX: number, width: number): TerrainChunk {
  return {
    kind,
    startX,
    endX: startX + width,
    blocks: [],
    platforms: [],
    gaps: [],
  };
}

export class TerrainGenerator {
  private cursor: number;
  private first = true;

  constructor(
    private readonly o: TerrainOptions,
    private readonly rng: Rng,
  ) {
    this.cursor = o.startX;
  }

  next(): TerrainChunk {
    const startX = this.cursor;
    const kind = this.first ? 'flat' : this.pickKind();
    const width = this.first ? this.o.startFlatWidth : 0;
    this.first = false;

    let chunk: TerrainChunk;
    if (kind === 'blocks') chunk = this.blocksChunk(startX);
    else if (kind === 'gap') chunk = this.gapChunk(startX);
    else if (kind === 'platform') chunk = this.platformChunk(startX);
    else {
      chunk = empty(
        'flat',
        startX,
        width || between(this.rng, this.o.flatWidth),
      );
    }

    this.cursor = chunk.endX;
    return chunk;
  }

  private pickKind(): ChunkKind {
    const w = this.o.weights;
    const kinds: ChunkKind[] = ['flat', 'blocks', 'gap', 'platform'];
    let roll = this.rng() * kinds.reduce((sum, k) => sum + w[k], 0);
    for (const k of kinds) {
      roll -= w[k];
      if (roll < 0) return k;
    }
    return 'flat';
  }

  private blocksChunk(startX: number): TerrainChunk {
    const o = this.o;
    const width = between(this.rng, o.blocksWidth);
    const lo = startX + o.blockEdgeMargin;
    const hi = startX + width - o.blockEdgeMargin - o.blockWidth;
    const make = (x: number): Block => ({
      x,
      width: o.blockWidth,
      height: o.blockHeight,
    });

    const chunk = empty('blocks', startX, width);
    if (hi - lo >= o.blockMinSpacing && this.rng() < 0.5) {
      const x1 = lo + this.rng() * (hi - o.blockMinSpacing - lo);
      const x2 = between(this.rng, [x1 + o.blockMinSpacing, hi]);
      chunk.blocks.push(make(x1), make(x2));
    } else {
      chunk.blocks.push(make(lo + this.rng() * Math.max(0, hi - lo)));
    }
    return chunk;
  }

  // [plain ground][hole][plain ground]
  private gapChunk(startX: number): TerrainChunk {
    const o = this.o;
    const before = between(this.rng, o.gapPad);
    const width = between(this.rng, o.gapWidth);
    const after = between(this.rng, o.gapPad);
    const chunk = empty('gap', startX, before + width + after);
    chunk.gaps.push({ x: startX + before, width });
    return chunk;
  }

  // [plain ground][one-way ledge][plain ground]
  private platformChunk(startX: number): TerrainChunk {
    const o = this.o;
    const before = between(this.rng, o.platformPad);
    const segments = Math.round(between(this.rng, o.platformSegments));
    const width = 2 * o.platformCapWidth + segments * o.platformSegmentWidth;
    const top = Math.min(
      between(this.rng, o.platformTop),
      o.maxJumpApex * o.maxStepFraction,
    );
    const after = between(this.rng, o.platformPad);
    const chunk = empty('platform', startX, before + width + after);
    chunk.platforms.push({ x: startX + before, width, top });
    return chunk;
  }
}

// Reachability invariant (spec §4): blocks and platforms are no taller than
// the step limit, blocks sit well inside their chunk, and every gap and
// platform has plain ground on both sides.
export function isChunkReachable(
  chunk: TerrainChunk,
  o: Pick<
    TerrainOptions,
    | 'maxJumpApex'
    | 'maxStepFraction'
    | 'blockEdgeMargin'
    | 'blockMinSpacing'
    | 'gapPad'
  > & { maxGapWidth: number },
): boolean {
  const stepLimit = o.maxJumpApex * o.maxStepFraction + 1e-6;
  const blocksOk = chunk.blocks.every(
    (b, i) =>
      b.height <= stepLimit &&
      b.x >= chunk.startX + o.blockEdgeMargin - 1e-6 &&
      b.x + b.width <= chunk.endX - o.blockEdgeMargin + 1e-6 &&
      (i === 0 || b.x - chunk.blocks[i - 1].x >= o.blockMinSpacing - 1e-6),
  );
  const platformsOk = chunk.platforms.every((p) => p.top <= stepLimit);
  const gapsOk = chunk.gaps.every(
    (g) =>
      g.width <= o.maxGapWidth + 1e-6 &&
      g.x - chunk.startX >= o.gapPad[0] - 1e-6 &&
      chunk.endX - (g.x + g.width) >= o.gapPad[0] - 1e-6,
  );
  const kindOk =
    (chunk.kind === 'blocks') === chunk.blocks.length > 0 &&
    (chunk.kind === 'gap') === chunk.gaps.length > 0 &&
    (chunk.kind === 'platform') === chunk.platforms.length > 0;
  return blocksOk && platformsOk && gapsOk && kindOk;
}

export type SurfaceInfo =
  | { kind: 'ground'; base: number; blockTop: number }
  | { kind: 'platform'; base: number; blockTop: 0 }
  | { kind: 'gap'; base: 0; blockTop: 0 };

// Margins for letters near platform ends (spawner placement).
const PLATFORM_INNER_MARGIN = 40;
const PLATFORM_FRINGE = 40;
const GAP_INNER_MARGIN = 12;
// No letters in the landing zone right after a gap.
const GAP_LANDING_ZONE = 110;
// Feet this far below the ground rim can no longer be caught by it.
const RIM_TOLERANCE = 1;

// Chunks chained end to end, generated lazily as the player advances.
export class Terrain {
  private chunks: TerrainChunk[] = [];

  constructor(private readonly generator: TerrainGenerator) {}

  get loadedChunks(): readonly TerrainChunk[] {
    return this.chunks;
  }

  ensureCovered(x: number): void {
    while (
      this.chunks.length === 0 ||
      this.chunks[this.chunks.length - 1].endX < x
    ) {
      this.chunks.push(this.generator.next());
    }
  }

  // Drop chunks that end before minX. Never drops the last chunk.
  prune(minX: number): void {
    while (this.chunks.length > 1 && this.chunks[0].endX < minX) {
      this.chunks.shift();
    }
  }

  gapAt(x: number): Gap | null {
    for (const chunk of this.chunks) {
      for (const g of chunk.gaps) if (x >= g.x && x < g.x + g.width) return g;
    }
    return null;
  }

  // The closest gap to x (used to find where a fallen player came from).
  nearestGap(x: number): Gap | null {
    let best: Gap | null = null;
    let bestDist = Infinity;
    for (const chunk of this.chunks) {
      for (const g of chunk.gaps) {
        const d = x < g.x ? g.x - x : x > g.x + g.width ? x - g.x - g.width : 0;
        if (d < bestDist) {
          best = g;
          bestDist = d;
        }
      }
    }
    return best;
  }

  // True if a gap's far edge lies within `dist` px behind x.
  private gapEndsWithin(x: number, dist: number): boolean {
    for (const chunk of this.chunks) {
      for (const g of chunk.gaps) {
        const end = g.x + g.width;
        if (x >= end && x < end + dist) return true;
      }
    }
    return false;
  }

  platformsIn(x0: number, x1: number): Platform[] {
    const found: Platform[] = [];
    for (const chunk of this.chunks) {
      for (const p of chunk.platforms) {
        if (p.x + p.width >= x0 && p.x <= x1) found.push(p);
      }
    }
    return found;
  }

  // Height of the highest thing that can hold feet at x, or -Infinity over a
  // gap. `feet` is where the feet were: ground and platforms only catch feet
  // that are at or above their top (one-way, and the rim of a gap does not
  // pull a falling player back up).
  supportAt(x: number, feet: number): number {
    let best = this.gapAt(x) || feet < -RIM_TOLERANCE ? -Infinity : 0;
    for (const p of this.platformsIn(x, x)) {
      if (p.top <= feet + RIM_TOLERANCE && p.top > best) best = p.top;
    }
    return best;
  }

  blocksIn(x0: number, x1: number): Block[] {
    const found: Block[] = [];
    for (const chunk of this.chunks) {
      if (chunk.endX < x0 || chunk.startX > x1) continue;
      for (const b of chunk.blocks) {
        if (b.x + b.width >= x0 && b.x <= x1) found.push(b);
      }
    }
    return found;
  }

  // Top of the tallest block overlapping [x0, x1], or 0 if none.
  blockTopIn(x0: number, x1: number): number {
    return this.blocksIn(x0, x1).reduce((m, b) => Math.max(m, b.height), 0);
  }

  // What a letter at x would sit above, or null if x is not a place for a
  // letter (the fringe around a platform's ends).
  describeAt(x: number, radius: number): SurfaceInfo | null {
    const gap = this.gapAt(x);
    if (gap) {
      const inside =
        x >= gap.x + GAP_INNER_MARGIN &&
        x <= gap.x + gap.width - GAP_INNER_MARGIN;
      return inside ? { kind: 'gap', base: 0, blockTop: 0 } : null;
    }
    if (this.gapEndsWithin(x, GAP_LANDING_ZONE)) return null;
    for (const p of this.platformsIn(
      x - PLATFORM_FRINGE,
      x + PLATFORM_FRINGE,
    )) {
      if (
        x >= p.x + PLATFORM_INNER_MARGIN &&
        x <= p.x + p.width - PLATFORM_INNER_MARGIN
      ) {
        return { kind: 'platform', base: p.top, blockTop: 0 };
      }
      return null;
    }
    return {
      kind: 'ground',
      base: 0,
      blockTop: this.blockTopIn(x - radius - 4, x + radius + 4),
    };
  }
}

// Where a character that fell into `gap` comes back. Negative offsetX = behind
// the gap (the side it came from), positive = past the far edge.
export function respawnX(gap: Gap, offsetX: number): number {
  return offsetX < 0 ? gap.x + offsetX : gap.x + gap.width + offsetX;
}
