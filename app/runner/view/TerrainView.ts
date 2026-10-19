import * as Phaser from 'phaser';
import { RUNNER_CONFIG } from '../config';
import type { Theme } from '../themes';
import { chunkElevation } from '../logic/terrainGenerator';
import type { Terrain, TerrainChunk } from '../logic/terrainGenerator';

const DEPTH_BODY = 10;
const DEPTH_GRASS = 11;
// The dirt body starts this far below the surface; the grass strips cover
// the seam.
const BODY_INSET = 8;
// Only the top of the tile (grass, dirt, pebbles) is drawn rotated; the flat
// body below it is filled in code, so no rotated edge shows deep in the dirt.
const STRIP_HEIGHT = 46;

type ChunkVisual = {
  body: Phaser.GameObjects.Graphics;
  strips: Phaser.GameObjects.Image[];
};

// Draws terrain chunks as a flat dirt body plus 8px grass strips, each
// rotated to the local slope. Chunks are built when they near the camera and
// destroyed when the terrain prunes them.
export class TerrainView {
  private visuals = new Map<TerrainChunk, ChunkVisual>();
  private frameCount: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly terrain: Terrain,
    private readonly theme: Theme,
  ) {
    const { stripWidth } = RUNNER_CONFIG.terrain;
    const texture = scene.textures.get(theme.ground.key);
    const source = texture.getSourceImage();
    this.frameCount = Math.floor(source.width / stripWidth);
    for (let i = 0; i < this.frameCount; i++) {
      if (!texture.has(this.frameName(i))) {
        texture.add(
          this.frameName(i),
          0,
          i * stripWidth,
          0,
          stripWidth,
          STRIP_HEIGHT,
        );
      }
    }
  }

  sync(viewLeft: number, viewRight: number, margin = 160): void {
    const loaded = new Set(this.terrain.loadedChunks);

    for (const [chunk, visual] of this.visuals) {
      if (!loaded.has(chunk)) {
        this.destroyVisual(visual);
        this.visuals.delete(chunk);
      }
    }

    for (const chunk of loaded) {
      if (this.visuals.has(chunk)) continue;
      if (chunk.endX < viewLeft - margin || chunk.startX > viewRight + margin) {
        continue;
      }
      this.visuals.set(chunk, this.build(chunk));
    }
  }

  private frameName(i: number): string {
    return `strip${i}`;
  }

  private build(chunk: TerrainChunk): ChunkVisual {
    const { baseY, stripWidth } = RUNNER_CONFIG.terrain;
    const { height } = RUNNER_CONFIG.game;
    const surfaceY = (x: number) =>
      baseY -
      chunkElevation(chunk, Phaser.Math.Clamp(x, chunk.startX, chunk.endX));

    const body = this.scene.add.graphics().setDepth(DEPTH_BODY);
    body.fillStyle(
      Phaser.Display.Color.HexStringToColor(this.theme.ground.bodyColor).color,
    );
    const strips: Phaser.GameObjects.Image[] = [];

    const count = Math.ceil((chunk.endX - chunk.startX) / stripWidth);
    const half = stripWidth / 2;
    for (let i = 0; i < count; i++) {
      const x = chunk.startX + (i + 0.5) * stripWidth;
      const y = surfaceY(x);
      const angle = Math.atan2(
        surfaceY(x + half) - surfaceY(x - half),
        stripWidth,
      );

      body.fillRect(
        x - half - 0.5,
        y + BODY_INSET,
        stripWidth + 1,
        height - y - BODY_INSET + 1,
      );

      const frameIndex =
        ((Math.floor(x / stripWidth) % this.frameCount) + this.frameCount) %
        this.frameCount;
      const strip = this.scene.add
        .image(x, y, this.theme.ground.key, this.frameName(frameIndex))
        .setOrigin(0.5, 0)
        .setRotation(angle)
        // Slight overlap hides hairline gaps between rotated neighbours.
        .setScale((stripWidth + 1.5) / stripWidth, 1)
        .setDepth(DEPTH_GRASS);
      strips.push(strip);
    }

    return { body, strips };
  }

  private destroyVisual(visual: ChunkVisual): void {
    visual.body.destroy();
    visual.strips.forEach((s) => s.destroy());
  }
}
