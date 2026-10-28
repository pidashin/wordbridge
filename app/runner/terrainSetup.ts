import { MAX_JUMP_APEX, RUNNER_CONFIG } from './config';
import { Terrain, TerrainGenerator, createRng } from './logic/terrainGenerator';
import type { TerrainOptions } from './logic/terrainGenerator';

export function terrainOptions(
  startX: number,
  flatOnly = false,
): TerrainOptions {
  const t = RUNNER_CONFIG.terrain;
  const ob = RUNNER_CONFIG.obstacles;
  return {
    startX,
    startFlatWidth: t.startFlatWidth,
    weights: flatOnly
      ? { flat: 1, blocks: 0, gap: 0, platform: 0 }
      : { ...t.chunkWeights },
    flatWidth: [...t.flatWidth],
    blocksWidth: [...t.blocksWidth],
    blockWidth: ob.block.width,
    blockHeight: ob.block.height,
    blockEdgeMargin: ob.edgeMargin,
    blockMinSpacing: ob.minSpacing,
    gapWidth: [...t.gap.width],
    gapPad: [...t.gap.padWidth],
    platformTop: [...t.platform.top],
    platformSegments: [...t.platform.segments],
    platformSegmentWidth: t.platform.segmentWidth,
    platformCapWidth: t.platform.capWidth,
    platformPad: [...t.platform.padWidth],
    maxJumpApex: MAX_JUMP_APEX,
    maxStepFraction: t.maxStepFraction,
  };
}

// Builds the endless route from config. flatOnly is for the title and result
// backdrops.
export function createTerrain(startX: number, flatOnly = false): Terrain {
  const seed =
    RUNNER_CONFIG.terrain.seed ?? Math.floor(Math.random() * 0x7fffffff);
  return new Terrain(
    new TerrainGenerator(terrainOptions(startX, flatOnly), createRng(seed)),
  );
}
