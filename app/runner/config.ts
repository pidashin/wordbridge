// All Word Runner tunables live here so playtests only change numbers.

const GRAVITY = 2000; // px/s²
const JUMP_VELOCITY = 1000; // px/s, full-hold jump
const CUT_VELOCITY = 530; // upward speed after releasing the button early
const RUN_SPEED = 280; // px/s

// Real jump numbers everything else is derived from.
const FULL_APEX = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY); // 250 px
const FULL_AIR_DISTANCE = ((2 * JUMP_VELOCITY) / GRAVITY) * RUN_SPEED; // 280 px

// Fox as drawn: ears to paws. Platforms leave this plus a margin underneath.
const FOX_HEIGHT = 94;
const PLATFORM_THICKNESS = 32;
const PLATFORM_CLEARANCE = 12;
const MAX_STEP_FRACTION = 0.6;

export const RUNNER_CONFIG = {
  game: {
    width: 1280,
    height: 720,
  },
  run: {
    speed: RUN_SPEED, // px/s, constant
  },
  jump: {
    gravity: GRAVITY,
    velocity: JUMP_VELOCITY,
    // Releasing the button while rising caps upward speed to this (short hop).
    cutVelocity: CUT_VELOCITY,
    // A press this long before landing still triggers a jump on landing.
    bufferSeconds: 0.1,
    // Jump still works this long after running off a ledge or gap edge.
    coyoteSeconds: 0.08,
    // Single jump only; flip when a double jump is wanted.
    doubleJump: false,
  },
  player: {
    startX: 300,
    // Sprite is 112px square with the paws ~4px above the bottom edge.
    size: 112,
    height: FOX_HEIGHT,
    footMargin: 4,
    runFramesPerSecond: 12,
  },
  camera: {
    // Player sits this fraction of the screen width from the left edge.
    playerScreenX: 0.3,
    lerpX: 0.2,
    maxDeltaSeconds: 1 / 30,
  },
  terrain: {
    // World y of the flat ground surface (elevation 0). The route is flat.
    baseY: 600,
    // Chunks are built until this far ahead of the player, pruned behind.
    aheadPx: 1920,
    behindPx: 640,
    startFlatWidth: 1100,
    // Relative chance of each chunk type after the opening flat run.
    chunkWeights: {
      flat: 0.12,
      blocks: 0.2,
      mud: 0.15,
      gap: 0.2,
      platform: 0.13,
      platgap: 0.1,
      stairs: 0.1,
    },
    flatWidth: [320, 640] as [number, number],
    blocksWidth: [560, 960] as [number, number],
    // A gap is a hole in the ground. Up to ~72% of the full jump's airborne
    // distance, so a held jump clears every gap and a tap may not clear the
    // widest. Plain flat ground (no block, mud or platform) lies before it and,
    // longer, after it: the respawn spot is past the far edge.
    gap: {
      width: [96, Math.floor(0.72 * FULL_AIR_DISTANCE)] as [number, number],
      padBefore: [230, 320] as [number, number],
      padAfter: [330, 420] as [number, number],
    },
    // Mud patches on flat ground, kept away from chunk ends.
    mud: {
      chunkWidth: [700, 1100] as [number, number],
      width: [160, 260] as [number, number],
      edgeMargin: 150,
      minSpacing: 300,
      // Run speed factor while touching mud, and how long it lingers after.
      speedFactor: 0.5,
      recoverSeconds: 0.3,
    },
    // One-way ledges, high enough to run underneath. Top is the height above
    // the ground: at least thickness + fox height + margin, at most
    // maxStepFraction of the real jump apex (spec §4).
    platform: {
      top: [
        FOX_HEIGHT + PLATFORM_CLEARANCE + PLATFORM_THICKNESS,
        MAX_STEP_FRACTION * FULL_APEX,
      ] as [number, number],
      segments: [3, 5] as [number, number],
      segmentWidth: 64,
      capWidth: 32,
      thickness: PLATFORM_THICKNESS,
      padWidth: [170, 260] as [number, number],
      // Staircase: tier 2 starts this fraction into tier 1 and reaches at
      // least stairOverhang past its end. Both steps equal one platform top.
      stairOffset: [0.4, 0.6] as [number, number],
      stairOverhang: 96,
    },
    maxStepFraction: MAX_STEP_FRACTION,
    // null = new random layout every run.
    seed: null as number | null,
  },
  obstacles: {
    block: { width: 64, height: 56 },
    // Keep blocks away from chunk ends so landings stay clean.
    edgeMargin: 180,
    minSpacing: 260,
    // Crates are solid: running into one stops the fox until it jumps. The
    // block must stay clearable by the shortest tap jump (apex >= height + 15).
    footHalfWidth: 36,
  },
  round: {
    seconds: 180,
    wrongPenalty: 1.5,
    warnSeconds: 10,
  },
  words: {
    minLength: 3,
    maxLength: 8,
    minPool: 5,
  },
  respawn: {
    // Where the character reappears after falling into a gap, measured from
    // the gap edge: positive = past the far edge, negative = behind the gap
    // (side it came from).
    offsetX: 150,
    invulnerableSeconds: 1,
    // Falling this far below the ground (px) triggers the respawn.
    fallLimit: -240,
  },
  hit: {
    // Player touch circle: centre this far above the feet.
    playerCenterOffset: 42,
    playerRadius: 22,
  },
  letters: {
    radius: 22,
    aheadScreens: 1.5,
    // The current target letter must appear within this many screen widths.
    targetWindowScreens: 2,
    distractorRatio: [0.3, 0.5] as [number, number],
    // Distance between consecutive letters: about one per screen of running
    // (3.6-5 s at base speed).
    spacing: [1000, 1400] as [number, number],
    firstLetterOffset: 900,
    despawnBehind: 160,
    // Letters this far past the right screen edge may still be rewritten.
    provisionalMargin: 60,
    // Letter centre height above the local surface, as a fraction of the max
    // jump apex. High must stay <= 0.8 (spec §4).
    bandFractions: { ground: 0.25, low: 0.62, high: 0.8 },
    bandWeights: { ground: 0.3, low: 0.4, high: 0.3 },
    // Near a gap or platform, chance that the next letter is placed on that
    // feature (on the ledge, in its transit arcs, or over the gap).
    featureBias: 0.6,
    // Letters above a platform use the same bands from its top. Under a
    // platform only the ground band fits below its underside.
    underChance: 0.25,
    // Transit letters sit on real jump arcs around a platform: before its
    // near edge (arc of a full jump taking off takeoffDistance earlier) and
    // past its far edge (the drop after running off the end).
    transit: {
      approachDistance: [50, 130] as [number, number],
      takeoffDistance: 150,
      departDistance: [30, 90] as [number, number],
      chance: 0.7,
    },
    // Extra clearance between a letter and a block top.
    blockClearance: 6,
    // Gap between a letter's top and a platform underside when under it.
    underMargin: 10,
    // Lowest screen y a letter centre may have (keeps letters under the HUD
    // and on screen); bands above it are skipped.
    ceilingY: 150,
    // Placement margins around platforms and gaps (px).
    layout: {
      platformInnerMargin: 80,
      edgeFringe: 30,
      landingZone: 110,
      gapInnerMargin: 12,
    },
  },
  ui: {
    font: 'system-ui, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
    resultRows: 9,
  },
} as const;

export const MAX_JUMP_APEX = FULL_APEX;
