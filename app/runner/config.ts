// All Word Runner tunables live here so playtests only change numbers.

// true: play with the built-in demo word list and never touch GraphQL.
// false: load the full word list through GET_WORDS (needs the database).
export const USE_DEMO_WORDS = true;

const GRAVITY = 2000; // px/s²
const JUMP_VELOCITY = 800; // px/s, full-hold jump

export const RUNNER_CONFIG = {
  game: {
    width: 1280,
    height: 720,
  },
  run: {
    speed: 280, // px/s, constant
  },
  jump: {
    gravity: GRAVITY,
    velocity: JUMP_VELOCITY,
    // Releasing the button while rising caps upward speed to this (short hop).
    cutVelocity: 440,
    // A press this long before landing still triggers a jump on landing.
    bufferSeconds: 0.1,
    // Max downward surface drop (px/frame) that still keeps the player glued.
    groundSnap: 6,
    // Single jump only; flip when a double jump is wanted.
    doubleJump: false,
  },
  player: {
    startX: 300,
    // Sprite is 112px square with the paws ~4px above the bottom edge.
    size: 112,
    footMargin: 4,
    runFramesPerSecond: 12,
    // Fraction of the surface slope the sprite tilts by while grounded.
    slopeTilt: 0.7,
  },
  camera: {
    // Player sits this fraction of the screen width from the left edge.
    playerScreenX: 0.3,
    lerpX: 0.2,
    maxDeltaSeconds: 1 / 30,
  },
  terrain: {
    // World y of elevation 0 (the flat ground surface).
    baseY: 600,
    stripWidth: 8,
    // Chunks are built until this far ahead of the player, pruned behind.
    aheadPx: 1920,
    behindPx: 640,
    startFlatWidth: 1100,
    flatWidth: [320, 720] as [number, number],
    hillWidth: [520, 920] as [number, number],
    hillAmplitude: [40, 110] as [number, number],
    hillChance: 0.55,
    // Reachability (spec §4): step height <= 60% of the max jump apex.
    maxStepFraction: 0.6,
    // Steepest allowed hill slope (rise/run) so the run stays natural.
    maxSlope: 0.45,
    // null = new random layout every run.
    seed: null as number | null,
    // Chunks of flat ground carrying low blocks (never in the opening flat).
    blockChance: 0.4,
    blocksWidth: [560, 960] as [number, number],
  },
  obstacles: {
    block: { width: 64, height: 56 },
    // Keep blocks away from chunk ends so landings from hills stay clean.
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
    gap: [200, 330] as [number, number],
    firstLetterOffset: 650,
    despawnBehind: 160,
    // Letters this far past the right screen edge may still be rewritten.
    provisionalMargin: 60,
    // Letter centre height above the local surface, as a fraction of the max
    // jump apex. High must stay <= 0.8 (spec §4).
    bandFractions: { ground: 0.25, low: 0.62, high: 0.8 },
    bandWeights: { ground: 0.3, low: 0.4, high: 0.3 },
    // Extra clearance between a letter and a block top.
    blockClearance: 6,
  },
  ui: {
    font: 'system-ui, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
    resultRows: 9,
  },
} as const;

export const MAX_JUMP_APEX = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
