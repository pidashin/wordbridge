// Pure terrain logic: no Phaser imports. Elevation is height above the flat
// base ground line in px (positive = up); the scene converts it to screen y.
// The route is flat: it only varies by gaps (holes), one-way platforms and
// low blocks.

export type ChunkKind =
  'flat' | 'blocks' | 'mud' | 'gap' | 'platform' | 'platgap' | 'stairs';

// Solid crate: blocks the runner from the side, can be landed on and jumped
// from.
export type Block = {
  x: number; // left edge
  width: number;
  height: number; // above the ground
};

// A patch of mud on the ground surface: slows the runner while touched.
export type Mud = { x: number; width: number };

// One-way ledge: jump up through it, land on top. Runners can pass under it.
export type Platform = {
  x: number; // left edge
  width: number;
  top: number; // height above the ground
  bottom: number; // underside height above the ground
  // Position within its chunk: letters' approach arcs start before the first
  // platform and drop arcs follow the last one.
  first: boolean;
  last: boolean;
};

// A hole in the ground.
export type Gap = { x: number; width: number };

// Open air between two platforms of the same height (falling lands on the
// ground below; it is not a respawn).
export type AirGap = Gap & { top: number };

export type TerrainChunk = {
  kind: ChunkKind;
  startX: number;
  endX: number;
  blocks: Block[];
  mud: Mud[];
  platforms: Platform[];
  gaps: Gap[];
  airGaps: AirGap[];
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
  mudChunkWidth: [number, number];
  mudWidth: [number, number];
  mudEdgeMargin: number;
  mudMinSpacing: number;
  gapWidth: [number, number];
  gapPadBefore: [number, number];
  gapPadAfter: [number, number];
  platformTop: [number, number];
  platformThickness: number;
  platformSegments: [number, number];
  platformSegmentWidth: number;
  platformCapWidth: number;
  platformPad: [number, number];
  // Where tier 2 of a staircase starts, as a fraction of tier 1's width.
  stairOffset: [number, number];
  // Tier 2 reaches at least this far past tier 1's end.
  stairOverhang: number;
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
    mud: [],
    platforms: [],
    gaps: [],
    airGaps: [],
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
    else if (kind === 'mud') chunk = this.mudChunk(startX);
    else if (kind === 'gap') chunk = this.gapChunk(startX);
    else if (kind === 'platform') chunk = this.platformChunk(startX);
    else if (kind === 'platgap') chunk = this.platgapChunk(startX);
    else if (kind === 'stairs') chunk = this.stairsChunk(startX);
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
    const kinds: ChunkKind[] = [
      'flat',
      'blocks',
      'mud',
      'gap',
      'platform',
      'platgap',
      'stairs',
    ];
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

  // Flat ground with one or two mud patches, well inside the chunk.
  private mudChunk(startX: number): TerrainChunk {
    const o = this.o;
    const width = between(this.rng, o.mudChunkWidth);
    const chunk = empty('mud', startX, width);
    const w1 = between(this.rng, o.mudWidth);
    const lo = startX + o.mudEdgeMargin;
    const hi = startX + width - o.mudEdgeMargin;
    const x1 = lo + this.rng() * Math.max(0, hi - lo - w1);
    chunk.mud.push({ x: x1, width: w1 });

    const w2 = between(this.rng, o.mudWidth);
    const x2lo = x1 + w1 + o.mudMinSpacing;
    if (x2lo + w2 <= hi && this.rng() < 0.4) {
      chunk.mud.push({
        x: x2lo + this.rng() * (hi - w2 - x2lo),
        width: w2,
      });
    }
    return chunk;
  }

  // [plain ground][hole][longer plain ground: the respawn spot is there]
  private gapChunk(startX: number): TerrainChunk {
    const o = this.o;
    const before = between(this.rng, o.gapPadBefore);
    const width = between(this.rng, o.gapWidth);
    const after = between(this.rng, o.gapPadAfter);
    const chunk = empty('gap', startX, before + width + after);
    chunk.gaps.push({ x: startX + before, width });
    return chunk;
  }

  private ledgeWidth(): number {
    const o = this.o;
    const segments = Math.round(between(this.rng, o.platformSegments));
    return 2 * o.platformCapWidth + segments * o.platformSegmentWidth;
  }

  private ledgeTop(): number {
    const o = this.o;
    return Math.min(
      between(this.rng, o.platformTop),
      o.maxJumpApex * o.maxStepFraction,
    );
  }

  private ledge(x: number, width: number, top: number): Platform {
    return {
      x,
      width,
      top,
      bottom: top - this.o.platformThickness,
      first: true,
      last: true,
    };
  }

  // [plain ground][one-way ledge][plain ground]
  private platformChunk(startX: number): TerrainChunk {
    const o = this.o;
    const before = between(this.rng, o.platformPad);
    const width = this.ledgeWidth();
    const top = this.ledgeTop();
    const after = between(this.rng, o.platformPad);
    const chunk = empty('platform', startX, before + width + after);
    chunk.platforms.push(this.ledge(startX + before, width, top));
    return chunk;
  }

  // [plain ground][ledge][air gap][ledge, same height][plain ground]
  private platgapChunk(startX: number): TerrainChunk {
    const o = this.o;
    const before = between(this.rng, o.platformPad);
    const w1 = this.ledgeWidth();
    const gap = between(this.rng, o.gapWidth);
    const w2 = this.ledgeWidth();
    const top = this.ledgeTop();
    const after = between(this.rng, o.platformPad);
    const chunk = empty('platgap', startX, before + w1 + gap + w2 + after);
    const a = this.ledge(startX + before, w1, top);
    const b = this.ledge(a.x + w1 + gap, w2, top);
    a.last = false;
    b.first = false;
    chunk.platforms.push(a, b);
    chunk.airGaps.push({ x: a.x + w1, width: gap, top });
    return chunk;
  }

  // Two tiers, both steps the same height: ground -> tier 1 -> tier 2, with
  // tier 2 up and ahead (it starts above tier 1 and reaches past its end).
  private stairsChunk(startX: number): TerrainChunk {
    const o = this.o;
    const before = between(this.rng, o.platformPad);
    const step = this.ledgeTop();
    const w1 = this.ledgeWidth();
    const offset = between(this.rng, o.stairOffset) * w1;
    const minW2 = w1 - offset + o.stairOverhang;
    let w2 = this.ledgeWidth();
    while (w2 < minW2) w2 += o.platformSegmentWidth;
    const after = between(this.rng, o.platformPad);
    const chunk = empty('stairs', startX, before + offset + w2 + after);
    const t1 = this.ledge(startX + before, w1, step);
    const t2 = this.ledge(t1.x + offset, w2, 2 * step);
    t1.last = false;
    t2.first = false;
    chunk.platforms.push(t1, t2);
    chunk.endX = Math.max(chunk.endX, t1.x + w1 + after);
    return chunk;
  }
}

// Reachability invariant (spec §4): blocks stay clear of chunk ends and are
// low enough for a tap jump, mud sits well inside its chunk, platforms leave
// room underneath, steps are no taller than the step limit, staircase steps
// are equal, and every gap, air gap and platform has plain ground around it.
export type ReachRules = Pick<
  TerrainOptions,
  | 'maxJumpApex'
  | 'maxStepFraction'
  | 'blockEdgeMargin'
  | 'blockMinSpacing'
  | 'mudEdgeMargin'
  | 'mudMinSpacing'
  | 'gapPadBefore'
  | 'gapPadAfter'
  | 'platformPad'
> & { maxGapWidth: number; minUnderside: number };

export function isChunkReachable(chunk: TerrainChunk, o: ReachRules): boolean {
  const stepLimit = o.maxJumpApex * o.maxStepFraction + 1e-6;
  const blocksOk = chunk.blocks.every(
    (b, i) =>
      b.height <= stepLimit &&
      b.x >= chunk.startX + o.blockEdgeMargin - 1e-6 &&
      b.x + b.width <= chunk.endX - o.blockEdgeMargin + 1e-6 &&
      (i === 0 || b.x - chunk.blocks[i - 1].x >= o.blockMinSpacing - 1e-6),
  );
  const mudOk = chunk.mud.every(
    (m, i) =>
      m.x >= chunk.startX + o.mudEdgeMargin - 1e-6 &&
      m.x + m.width <= chunk.endX - o.mudEdgeMargin + 1e-6 &&
      (i === 0 ||
        m.x - (chunk.mud[i - 1].x + chunk.mud[i - 1].width) >=
          o.mudMinSpacing - 1e-6),
  );
  const gapsOk = chunk.gaps.every(
    (g) =>
      g.width <= o.maxGapWidth + 1e-6 &&
      g.x - chunk.startX >= o.gapPadBefore[0] - 1e-6 &&
      chunk.endX - (g.x + g.width) >= o.gapPadAfter[0] - 1e-6,
  );
  const airOk = chunk.airGaps.every(
    (g) =>
      g.width <= o.maxGapWidth + 1e-6 &&
      chunk.platforms.some((p) => Math.abs(p.x + p.width - g.x) < 1e-6) &&
      chunk.platforms.some((p) => Math.abs(p.x - (g.x + g.width)) < 1e-6),
  );

  const ps = chunk.platforms;
  let platformsOk = true;
  if (ps.length > 0) {
    const first = Math.min(...ps.map((p) => p.x));
    const last = Math.max(...ps.map((p) => p.x + p.width));
    platformsOk =
      first - chunk.startX >= o.platformPad[0] - 1e-6 &&
      chunk.endX - last >= o.platformPad[0] - 1e-6 &&
      ps.length <= 2 &&
      ps.every((p) => p.bottom >= o.minUnderside - 1e-6);
    if (chunk.kind === 'stairs') {
      const [t1, t2] = ps;
      const step1 = t1.top;
      const step2 = t2.top - t1.top;
      platformsOk =
        platformsOk &&
        ps.length === 2 &&
        step1 <= stepLimit &&
        Math.abs(step1 - step2) < 1e-6 &&
        t2.x > t1.x &&
        t2.x + t2.width > t1.x + t1.width &&
        // Standing on tier 1 you can walk under tier 2.
        t2.bottom - t1.top >= o.minUnderside - 1e-6;
    } else {
      platformsOk = platformsOk && ps.every((p) => p.top <= stepLimit);
      if (chunk.kind === 'platgap') {
        platformsOk =
          platformsOk &&
          ps.length === 2 &&
          Math.abs(ps[0].top - ps[1].top) < 1e-6;
      }
    }
  }
  const kindOk =
    (chunk.kind === 'blocks') === chunk.blocks.length > 0 &&
    (chunk.kind === 'mud') === chunk.mud.length > 0 &&
    (chunk.kind === 'gap') === chunk.gaps.length > 0 &&
    (chunk.kind === 'platform') === (ps.length === 1) &&
    (chunk.kind === 'platgap') === (chunk.airGaps.length === 1) &&
    (chunk.kind === 'stairs') ===
      (ps.length === 2 && chunk.airGaps.length === 0);
  return blocksOk && mudOk && gapsOk && airOk && platformsOk && kindOk;
}

// What a letter at x would sit on or near, or null if x is not a place for a
// letter (platform ends, gap lips, the landing zone after a gap).
export type SurfaceInfo =
  | { kind: 'ground'; blockTop: number }
  // `below` is a lower ledge directly under x (staircase overlap).
  | { kind: 'platform'; platform: Platform; below: Platform | null }
  // Over a ground gap (base 0) or an air gap between platforms (base = top).
  | { kind: 'gap'; gap: Gap; base: number }
  | { kind: 'approach'; platform: Platform; distance: number }
  | { kind: 'depart'; platform: Platform; distance: number };

// Geometry margins for letter placement (numbers live in config).
export type LayoutRules = {
  // Half the width of the fox's feet: a crate's top holds the fox while any
  // part of its feet is over it, and its sides stop the fox a foot-width away.
  footHalfWidth: number;
  platformInnerMargin: number;
  edgeFringe: number;
  landingZone: number;
  gapInnerMargin: number;
  approachDistance: [number, number];
  departDistance: [number, number];
};

// Feet this far below a surface can no longer be caught by it.
const RIM_TOLERANCE = 1;

// Chunks chained end to end, generated lazily as the player advances.
export class Terrain {
  private chunks: TerrainChunk[] = [];

  constructor(
    private readonly generator: TerrainGenerator,
    private readonly layout: LayoutRules,
  ) {}

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

  airGapAt(x: number): AirGap | null {
    for (const chunk of this.chunks) {
      for (const g of chunk.airGaps) {
        if (x >= g.x && x < g.x + g.width) return g;
      }
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

  mudAt(x: number): Mud | null {
    for (const chunk of this.chunks) {
      for (const m of chunk.mud) if (x >= m.x && x <= m.x + m.width) return m;
    }
    return null;
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

  gapsIn(x0: number, x1: number): Gap[] {
    const found: Gap[] = [];
    for (const chunk of this.chunks) {
      for (const g of chunk.gaps) {
        if (g.x + g.width >= x0 && g.x <= x1) found.push(g);
      }
    }
    return found;
  }

  featuresIn(x0: number, x1: number): { gaps: Gap[]; platforms: Platform[] } {
    return { gaps: this.gapsIn(x0, x1), platforms: this.platformsIn(x0, x1) };
  }

  // Height of the highest thing that can hold feet at x, or -Infinity over a
  // gap. `feet` is where the feet were: ground, platforms and block tops only
  // catch feet that are at or above their top (platforms are one-way, and the
  // rim of a gap does not pull a falling player back up).
  supportAt(x: number, feet: number): number {
    let best = this.gapAt(x) || feet < -RIM_TOLERANCE ? -Infinity : 0;
    for (const p of this.platformsIn(x, x)) {
      if (p.top <= feet + RIM_TOLERANCE && p.top > best) best = p.top;
    }
    // Crates are solid: with feet below the top the fox is never allowed over
    // the crate (wallLimit), and feet at or above it are caught by the top
    // from a foot-width before the face to a foot-width past the far edge.
    const half = this.layout.footHalfWidth;
    for (const b of this.blocksIn(x - half, x + half)) {
      if (b.height <= feet + RIM_TOLERANCE && b.height > best) best = b.height;
    }
    return best;
  }

  // Blocks are solid from the side: the farthest x the feet may reach moving
  // right from x0 toward x1 at height `feet`. `half` is the foot half-width.
  wallLimit(x0: number, x1: number, feet: number, half: number): number {
    let limit = Infinity;
    for (const b of this.blocksIn(x0, x1 + half)) {
      const wall = b.x - half;
      if (wall >= x0 - 1e-6 && wall < x1 && feet < b.height - RIM_TOLERANCE) {
        limit = Math.min(limit, wall);
      }
    }
    return limit;
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

  describeAt(x: number, radius: number): SurfaceInfo | null {
    const l = this.layout;
    const gap = this.gapAt(x);
    if (gap) {
      const inside =
        x >= gap.x + l.gapInnerMargin &&
        x <= gap.x + gap.width - l.gapInnerMargin;
      return inside ? { kind: 'gap', gap, base: 0 } : null;
    }
    if (this.gapEndsWithin(x, l.landingZone)) return null;

    const air = this.airGapAt(x);
    if (air) {
      const inside =
        x >= air.x + l.gapInnerMargin &&
        x <= air.x + air.width - l.gapInnerMargin;
      return inside ? { kind: 'gap', gap: air, base: air.top } : null;
    }

    const reach = Math.max(l.approachDistance[1], l.departDistance[1]);
    const near = this.platformsIn(x - reach, x + reach);
    const under = near.filter((p) => x >= p.x && x <= p.x + p.width);
    if (under.length > 0) {
      const inner = (p: Platform) =>
        x >= p.x + l.platformInnerMargin &&
        x <= p.x + p.width - l.platformInnerMargin;
      const top = under.reduce((a, b) => (b.top > a.top ? b : a));
      if (!inner(top)) return null;
      // Not right beside another ledge (a staircase step up ahead).
      for (const q of near) {
        if (under.includes(q)) continue;
        if (
          x >= q.x - l.platformInnerMargin &&
          x <= q.x + q.width + l.platformInnerMargin
        ) {
          return null;
        }
      }
      const lower = under.find((p) => p !== top && inner(p)) ?? null;
      return { kind: 'platform', platform: top, below: lower };
    }
    for (const p of near) {
      const end = p.x + p.width;
      if (x >= p.x - l.edgeFringe && x <= end + l.edgeFringe) return null;
      const before = p.x - x;
      if (
        p.first &&
        before >= l.approachDistance[0] &&
        before <= l.approachDistance[1]
      ) {
        return { kind: 'approach', platform: p, distance: before };
      }
      const after = x - end;
      if (
        p.last &&
        after >= l.departDistance[0] &&
        after <= l.departDistance[1]
      ) {
        return { kind: 'depart', platform: p, distance: after };
      }
    }
    return {
      kind: 'ground',
      blockTop: this.blockTopIn(x - radius - 4, x + radius + 4),
    };
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
}

// Where a character that fell into `gap` comes back. Positive offsetX = past
// the far edge, negative = behind the gap (the side it came from).
export function respawnX(gap: Gap, offsetX: number): number {
  return offsetX < 0 ? gap.x + offsetX : gap.x + gap.width + offsetX;
}
