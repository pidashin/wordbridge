import * as Phaser from 'phaser';
import { RUNNER_CONFIG } from '../config';
import type { Theme } from '../themes';
import type {
  Gap,
  Platform,
  Terrain,
  TerrainChunk,
} from '../logic/terrainGenerator';

const DEPTH_PIT = 5;
const DEPTH_BODY = 10;
const DEPTH_GRASS = 11;
const DEPTH_PLATFORM = 12;
// The dirt body starts this far below the surface; the grass strip covers
// the seam.
const BODY_INSET = 8;
// Only the top of the ground tile (grass, dirt, pebbles) is drawn as a strip;
// the flat dirt body below it is filled in code.
const STRIP_HEIGHT = 46;
const STRIP_FRAME = 'top';

type ChunkVisual = { objects: Phaser.GameObjects.GameObject[] };

// Draws the flat route per chunk: grass-topped ground in runs between gaps,
// dark pits, one-way platforms and low blocks. Chunks are built when they near
// the camera and destroyed when the terrain prunes them.
export class TerrainView {
  private visuals = new Map<TerrainChunk, ChunkVisual>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly terrain: Terrain,
    private readonly theme: Theme,
  ) {
    const texture = scene.textures.get(theme.ground.key);
    if (!texture.has(STRIP_FRAME)) {
      texture.add(
        STRIP_FRAME,
        0,
        0,
        0,
        texture.getSourceImage().width,
        STRIP_HEIGHT,
      );
    }
  }

  sync(viewLeft: number, viewRight: number, margin = 160): void {
    const loaded = new Set(this.terrain.loadedChunks);

    for (const [chunk, visual] of this.visuals) {
      if (!loaded.has(chunk)) {
        visual.objects.forEach((o) => o.destroy());
        this.visuals.delete(chunk);
      }
    }

    for (const chunk of loaded) {
      if (this.visuals.has(chunk)) continue;
      if (chunk.endX < viewLeft - margin || chunk.startX > viewRight + margin) {
        continue;
      }
      this.visuals.set(chunk, { objects: this.build(chunk) });
    }
  }

  private build(chunk: TerrainChunk): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const { baseY } = RUNNER_CONFIG.terrain;

    // Solid ground = the chunk minus its gaps.
    let x = chunk.startX;
    for (const gap of chunk.gaps) {
      this.addGround(objects, x, gap.x);
      this.addPit(objects, gap);
      x = gap.x + gap.width;
    }
    this.addGround(objects, x, chunk.endX);
    this.addLips(objects, chunk);

    for (const p of chunk.platforms) this.addPlatform(objects, p);

    const block = RUNNER_CONFIG.obstacles.block;
    for (const b of chunk.blocks) {
      objects.push(
        this.scene.add
          .image(b.x, baseY + 1, 'block')
          .setOrigin(0, 1)
          .setDisplaySize(block.width, b.height)
          .setDepth(DEPTH_PLATFORM),
      );
    }
    return objects;
  }

  private addGround(
    objects: Phaser.GameObjects.GameObject[],
    x0: number,
    x1: number,
  ): void {
    if (x1 - x0 <= 0) return;
    const { baseY } = RUNNER_CONFIG.terrain;
    const { height } = RUNNER_CONFIG.game;
    const body = this.scene.add.graphics().setDepth(DEPTH_BODY);
    body.fillStyle(
      Phaser.Display.Color.HexStringToColor(this.theme.ground.bodyColor).color,
    );
    body.fillRect(x0, baseY + BODY_INSET, x1 - x0, height - baseY);
    const strip = this.scene.add
      .tileSprite(
        x0,
        baseY,
        x1 - x0,
        STRIP_HEIGHT,
        this.theme.ground.key,
        STRIP_FRAME,
      )
      .setOrigin(0, 0)
      .setDepth(DEPTH_GRASS);
    // Keep the tile pattern fixed to the world so chunks line up.
    strip.tilePositionX = x0;
    objects.push(body, strip);
  }

  private addPit(objects: Phaser.GameObjects.GameObject[], gap: Gap): void {
    const { baseY } = RUNNER_CONFIG.terrain;
    const { height } = RUNNER_CONFIG.game;
    const pit = this.scene.add
      .rectangle(
        gap.x,
        baseY,
        gap.width,
        height - baseY,
        Phaser.Display.Color.HexStringToColor(this.theme.pit.color).color,
      )
      .setOrigin(0, 0)
      .setDepth(DEPTH_PIT);
    objects.push(pit);
  }

  // Rounded grass lip on the ground edge beside each gap.
  private addLips(
    objects: Phaser.GameObjects.GameObject[],
    chunk: TerrainChunk,
  ): void {
    const { baseY } = RUNNER_CONFIG.terrain;
    const lipWidth = this.scene.textures
      .get(this.theme.pit.lip.key)
      .getSourceImage().width;
    for (const g of chunk.gaps) {
      objects.push(
        this.scene.add
          .image(g.x - lipWidth, baseY, this.theme.pit.lip.key)
          .setOrigin(0, 0)
          .setDepth(DEPTH_GRASS + 0.5),
        this.scene.add
          .image(g.x + g.width, baseY, this.theme.pit.lip.key)
          .setOrigin(0, 0)
          .setFlipX(true)
          .setDepth(DEPTH_GRASS + 0.5),
      );
    }
  }

  private addPlatform(
    objects: Phaser.GameObjects.GameObject[],
    p: Platform,
  ): void {
    const { baseY, platform } = RUNNER_CONFIG.terrain;
    const t = this.theme.platform;
    const y = baseY - p.top;
    const add = (key: string, x: number) =>
      objects.push(
        this.scene.add
          .image(x, y, key)
          .setOrigin(0, 0)
          .setDepth(DEPTH_PLATFORM),
      );
    const segments = Math.round(
      (p.width - 2 * platform.capWidth) / platform.segmentWidth,
    );
    add(t.left.key, p.x);
    for (let i = 0; i < segments; i++) {
      add(t.mid.key, p.x + platform.capWidth + i * platform.segmentWidth);
    }
    add(
      t.right.key,
      p.x + platform.capWidth + segments * platform.segmentWidth,
    );
  }
}
