import * as Phaser from 'phaser';
import { RUNNER_CONFIG } from '../config';
import { DEFAULT_THEME } from '../themes';
import { createTerrain } from '../terrainSetup';
import { Background } from './Background';
import { TerrainView } from './TerrainView';

// Static meadow scene behind the title and result screens.
export function createBackdrop(scene: Phaser.Scene): void {
  const { width } = RUNNER_CONFIG.game;
  new Background(scene, DEFAULT_THEME).update(0);
  const terrain = createTerrain(-200, true);
  terrain.ensureCovered(width + 200);
  new TerrainView(scene, terrain, DEFAULT_THEME).sync(0, width);
}
