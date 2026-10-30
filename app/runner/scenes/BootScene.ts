import * as Phaser from 'phaser';
import { COMMON_ASSETS, RUNNER_ASSET_BASE } from '../assets';
import { THEMES } from '../themes';
import { BOOT_SCENE_KEY, TITLE_SCENE_KEY } from './keys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(BOOT_SCENE_KEY);
  }

  preload(): void {
    this.load.setPath(RUNNER_ASSET_BASE);
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`Word Runner: failed to load ${file.key} (${file.url})`);
    });

    for (const asset of COMMON_ASSETS) {
      this.load.svg(asset.key, asset.file, {
        width: asset.width,
        height: asset.height,
      });
    }
    for (const theme of THEMES) {
      for (const layer of theme.layers) this.load.svg(layer.key, layer.file);
      this.load.svg(theme.ground.key, theme.ground.file);
      for (const art of [
        theme.platform.left,
        theme.platform.mid,
        theme.platform.right,
        theme.pit.lip,
        theme.mud,
      ]) {
        this.load.svg(art.key, art.file);
      }
    }
  }

  create(): void {
    this.scene.start(TITLE_SCENE_KEY);
  }
}
