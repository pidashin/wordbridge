// Pure terrain logic: no Phaser imports. Elevation is height above the base
// ground line in px (positive = up); the scene converts it to screen y.

export type ChunkKind = 'flat' | 'hill' | 'blocks';

export type Block = {
  x: number; // left edge
  width: number;
  height: number; // above the (flat) surface it sits on
};

export type TerrainChunk = {
  kind: ChunkKind;
  startX: number;
  endX: number;
  // Peak elevation for a hill, 0 otherwise.
  amplitude: number;
  blocks: Block[];
};

export type TerrainOptions = {
  startX: number;
  startFlatWidth: number;
  flatWidth: [number, number];
  hillWidth: [number, number];
  hillAmplitude: [number, number];
  hillChance: number;
  blockChance: number;
  blocksWidth: [number, number];
  blockWidth: number;
  blockHeight: number;
  blockEdgeMargin: number;
  blockMinSpacing: number;
  maxJumpApex: number;
  maxStepFraction: number;
  maxSlope: number;
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

// Hills are a raised cosine: zero slope at both ends, so every chunk joins the
// next at elevation 0 without a step.
export function chunkElevation(chunk: TerrainChunk, x: number): number {
  if (chunk.kind !== 'hill') return 0;
  const t = (x - chunk.startX) / (chunk.endX - chunk.startX);
  return (chunk.amplitude * (1 - Math.cos(2 * Math.PI * t))) / 2;
}

// Reachability invariant (spec §4): a hill rises at most maxStepFraction of
// the jump apex and never exceeds maxSlope; blocks are no taller than that
// step limit and sit well inside flat ground. So every surface stays
// runnable and every obstacle is clearable with a normal jump.
export function isChunkReachable(
  chunk: TerrainChunk,
  o: Pick<
    TerrainOptions,
    | 'maxJumpApex'
    | 'maxStepFraction'
    | 'maxSlope'
    | 'blockEdgeMargin'
    | 'blockMinSpacing'
  >,
): boolean {
  const stepLimit = o.maxJumpApex * o.maxStepFraction + 1e-6;
  if (chunk.kind === 'hill') {
    const width = chunk.endX - chunk.startX;
    const slope = (chunk.amplitude * Math.PI) / width;
    return chunk.amplitude <= stepLimit && slope <= o.maxSlope + 1e-6;
  }
  if (chunk.kind === 'flat') return chunk.blocks.length === 0;
  return chunk.blocks.every(
    (b, i) =>
      b.height <= stepLimit &&
      b.x >= chunk.startX + o.blockEdgeMargin - 1e-6 &&
      b.x + b.width <= chunk.endX - o.blockEdgeMargin + 1e-6 &&
      (i === 0 || b.x - chunk.blocks[i - 1].x >= o.blockMinSpacing - 1e-6),
  );
}

function between(rng: Rng, [min, max]: [number, number]): number {
  return min + rng() * (max - min);
}

export class TerrainGenerator {
  private cursor: number;
  private first = true;

  constructor(
    private readonly options: TerrainOptions,
    private readonly rng: Rng,
  ) {
    this.cursor = options.startX;
  }

  next(): TerrainChunk {
    const o = this.options;
    const startX = this.cursor;
    let chunk: TerrainChunk;

    if (this.first) {
      this.first = false;
      chunk = flat(startX, o.startFlatWidth);
    } else {
      const roll = this.rng();
      if (roll < o.hillChance) {
        const width = between(this.rng, o.hillWidth);
        const maxAmplitude = Math.min(
          o.maxJumpApex * o.maxStepFraction,
          (o.maxSlope * width) / Math.PI,
        );
        const amplitude = Math.min(
          between(this.rng, o.hillAmplitude),
          maxAmplitude,
        );
        chunk = {
          kind: 'hill',
          startX,
          endX: startX + width,
          amplitude,
          blocks: [],
        };
      } else if (this.rng() < o.blockChance) {
        chunk = this.blocksChunk(startX);
      } else {
        chunk = flat(startX, between(this.rng, o.flatWidth));
      }
    }

    this.cursor = chunk.endX;
    return chunk;
  }

  private blocksChunk(startX: number): TerrainChunk {
    const o = this.options;
    const width = between(this.rng, o.blocksWidth);
    const lo = startX + o.blockEdgeMargin;
    const hi = startX + width - o.blockEdgeMargin - o.blockWidth;
    const make = (x: number): Block => ({
      x,
      width: o.blockWidth,
      height: o.blockHeight,
    });

    const blocks: Block[] = [];
    if (hi - lo >= o.blockMinSpacing && this.rng() < 0.5) {
      const x1 = lo + this.rng() * (hi - o.blockMinSpacing - lo);
      const x2 = between(this.rng, [x1 + o.blockMinSpacing, hi]);
      blocks.push(make(x1), make(x2));
    } else {
      blocks.push(make(lo + this.rng() * Math.max(0, hi - lo)));
    }
    return {
      kind: 'blocks',
      startX,
      endX: startX + width,
      amplitude: 0,
      blocks,
    };
  }
}

function flat(startX: number, width: number): TerrainChunk {
  return {
    kind: 'flat',
    startX,
    endX: startX + width,
    amplitude: 0,
    blocks: [],
  };
}

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

  elevationAt(x: number): number {
    for (const chunk of this.chunks) {
      if (x < chunk.endX) {
        return chunkElevation(chunk, Math.max(x, chunk.startX));
      }
    }
    return 0;
  }

  // Highest surface in [x0, x1], sampled every 8px.
  maxElevationIn(x0: number, x1: number): number {
    let max = this.elevationAt(x0);
    for (let x = x0 + 8; x < x1; x += 8) {
      max = Math.max(max, this.elevationAt(x));
    }
    return Math.max(max, this.elevationAt(x1));
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
}
