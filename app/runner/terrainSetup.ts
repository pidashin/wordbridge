import { MAX_JUMP_APEX, RUNNER_CONFIG } from './config';
import { Terrain, TerrainGenerator, createRng } from './logic/terrainGenerator';

// Builds the endless terrain from config. flatOnly is for the title and
// result backdrops.
export function createTerrain(startX: number, flatOnly = false): Terrain {
  const t = RUNNER_CONFIG.terrain;
  const ob = RUNNER_CONFIG.obstacles;
  const seed = t.seed ?? Math.floor(Math.random() * 0x7fffffff);
  return new Terrain(
    new TerrainGenerator(
      {
        startX,
        startFlatWidth: t.startFlatWidth,
        flatWidth: [...t.flatWidth],
        hillWidth: [...t.hillWidth],
        hillAmplitude: [...t.hillAmplitude],
        hillChance: flatOnly ? 0 : t.hillChance,
        blockChance: flatOnly ? 0 : t.blockChance,
        blocksWidth: [...t.blocksWidth],
        blockWidth: ob.block.width,
        blockHeight: ob.block.height,
        blockEdgeMargin: ob.edgeMargin,
        blockMinSpacing: ob.minSpacing,
        maxJumpApex: MAX_JUMP_APEX,
        maxStepFraction: t.maxStepFraction,
        maxSlope: t.maxSlope,
      },
      createRng(seed),
    ),
  );
}
