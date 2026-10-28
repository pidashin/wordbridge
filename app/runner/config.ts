// All Word Runner tunables live here so playtests only change numbers.

// true: play with the built-in demo word list and never touch GraphQL.
// false: load the full word list through GET_WORDS (needs the database).
export const USE_DEMO_WORDS = true;

const GRAVITY = 2000; // px/s²
const JUMP_VELOCITY = 800; // px/s, full-hold jump
const CUT_VELOCITY = 440; // upward speed after releasing the button early
const RUN_SPEED = 280; // px/s

// Airborne distance of the shortest (tap) jump at base speed. Gaps stay under
// 70% of it so a tap always clears them, with coyote time as extra grace.
const TAP_AIR_DISTANCE = ((2 * CUT_VELOCITY) / GRAVITY) * RUN_SPEED;

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
    chunkWeights: { flat: 0.2, blocks: 0.25, gap: 0.3, platform: 0.25 },
    flatWidth: [320, 640] as [number, number],
    blocksWidth: [560, 960] as [number, number],
    // A gap is a hole in the ground. Plain flat ground (no block, no
    // platform) of padWidth lies on both sides, so there is always a safe
    // respawn spot.
    gap: {
      width: [64, Math.floor(0.7 * TAP_AIR_DISTANCE)] as [number, number],
      padWidth: [230, 320] as [number, number],
    },
    // One-way ledges. Top is the height above the ground; the maximum is
    // maxStepFraction of the real jump apex (spec §4).
    platform: {
      top: [64, 96] as [number, number],
      segments: [3, 5] as [number, number],
      segmentWidth: 64,
      capWidth: 32,
      thickness: 44,
      padWidth: [170, 260] as [number, number],
    },
    maxStepFraction: 0.6,
    // null = new random layout every run.
    seed: null as number | null,
  },
  obstacles: {
    block: { width: 64, height: 56 },
    // Keep blocks away from chunk ends so landings stay clean.
    edgeMargin: 180,
    minSpacing: 260,
    // Hit = slow down briefly; no time penalty.
    slowFactor: 0.4,
    slowSeconds: 0.8,
    footHalfWidth: 18,
    hitLeniency: 6,
    hitHeadroom: 8,
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
    // the gap edge: negative = behind the gap (side it came from), positive =
    // past the far edge. Flip the sign to change the rule.
    offsetX: -150,
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
    distractorRatio: [0.4, 0.6] as [number, number],
    // Distance between consecutive letters: sparse, a stretch of running
    // (1.6-2.9 s at base speed) between letters.
    spacing: [450, 800] as [number, number],
    firstLetterOffset: 650,
    despawnBehind: 160,
    // Letters this far past the right screen edge may still be rewritten.
    provisionalMargin: 60,
    // Letter centre height above the local surface, as a fraction of the max
    // jump apex. High must stay <= 0.8 (spec §4).
    bandFractions: { ground: 0.25, low: 0.62, high: 0.8 },
    bandWeights: { ground: 0.3, low: 0.4, high: 0.3 },
    // Letters above a platform: height over the platform top as a fraction of
    // the max jump apex (<= 0.8), so the second jump from the platform is
    // needed to reach them.
    platformFractions: [0.7, 0.8] as [number, number],
    // Extra clearance between a letter and a block top.
    blockClearance: 6,
  },
  ui: {
    font: 'system-ui, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
    resultRows: 9,
  },
} as const;

export const MAX_JUMP_APEX = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
