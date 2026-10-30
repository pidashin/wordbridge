import * as Phaser from 'phaser';
import { RUNNER_CONFIG } from '../config';
import type { Theme } from '../themes';

const DEPTH_SKY = -30;
const DEPTH_LAYERS = -20;

// Screen-fixed sky and parallax layers; layer textures scroll via
// tilePositionX so the background never runs out.
export class Background {
  private layers: { sprite: Phaser.GameObjects.TileSprite; factor: number }[] =
    [];

  constructor(scene: Phaser.Scene, theme: Theme) {
    const { width, height } = RUNNER_CONFIG.game;

    this.createSky(scene, theme, width, height);

    theme.layers.forEach((layer, i) => {
      const source = scene.textures.get(layer.key).getSourceImage();
      const sprite = scene.add
        .tileSprite(0, layer.y, width, source.height, layer.key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH_LAYERS + i);
      this.layers.push({ sprite, factor: layer.scrollFactor });
    });
  }

  update(cameraScrollX: number): void {
    for (const { sprite, factor } of this.layers) {
      sprite.tilePositionX = cameraScrollX * factor;
    }
  }

  private createSky(
    scene: Phaser.Scene,
    theme: Theme,
    width: number,
    height: number,
  ): void {
    const key = `sky-${theme.id}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const texture = scene.textures.createCanvas(key, 2, height);
    if (!texture) return;

    const ctx = texture.getContext();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, theme.sky.top);
    gradient.addColorStop(1, theme.sky.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, height);
    texture.refresh();

    scene.add
      .image(0, 0, key)
      .setOrigin(0, 0)
      .setDisplaySize(width, height)
      .setScrollFactor(0)
      .setDepth(DEPTH_SKY);
  }
}
