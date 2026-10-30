import { MAX_JUMP_APEX, RUNNER_CONFIG } from './config';
import type { Band, LetterOptions } from './logic/letterSpawner';

// Spawner options from config. Band heights are fractions of the real jump
// apex, measured from the surface a letter belongs to.
export function letterOptions(): LetterOptions {
  const { game, letters: lc, jump, run, hit, terrain } = RUNNER_CONFIG;
  const bandHeights: Record<Band, number> = {
    ground: lc.bandFractions.ground * MAX_JUMP_APEX,
    low: lc.bandFractions.low * MAX_JUMP_APEX,
    high: lc.bandFractions.high * MAX_JUMP_APEX,
  };
  return {
    aheadPx: lc.aheadScreens * game.width,
    targetWindowPx: lc.targetWindowScreens * game.width,
    distractorRatio: [...lc.distractorRatio],
    spacing: [...lc.spacing],
    firstLetterOffset: lc.firstLetterOffset,
    despawnBehind: lc.despawnBehind,
    provisionalMargin: lc.provisionalMargin,
    radius: lc.radius,
    blockClearance: lc.blockClearance,
    bandHeights,
    bandWeights: { ...lc.bandWeights },
    featureBias: lc.featureBias,
    underChance: lc.underChance,
    underMargin: lc.underMargin,
    maxElevation: terrain.baseY - lc.ceilingY,
    transit: {
      chance: lc.transit.chance,
      takeoffDistance: lc.transit.takeoffDistance,
      approachDistance: [...lc.transit.approachDistance],
      departDistance: [...lc.transit.departDistance],
    },
    physics: {
      gravity: jump.gravity,
      velocity: jump.velocity,
      speed: run.speed,
      centerOffset: hit.playerCenterOffset,
    },
  };
}

// How far ahead of the player the terrain must exist: the farthest a letter
// can be spawned (target window) plus one spacing.
export function terrainReach(): number {
  const { game, letters: lc, terrain } = RUNNER_CONFIG;
  return (
    Math.max(
      terrain.aheadPx,
      lc.aheadScreens * game.width,
      lc.targetWindowScreens * game.width,
    ) + lc.spacing[1]
  );
}
