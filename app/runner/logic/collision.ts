// Pure hit tests: no Phaser imports. Elevations are feet/centre heights above
// the base ground line (positive = up).

import type { Block } from './terrainGenerator';

export type HitShape = { playerCenterOffset: number; playerRadius: number };

// Player touch circle against a letter bubble.
export function touchesLetter(
  playerX: number,
  playerElevation: number,
  letter: { x: number; elevation: number },
  player: HitShape,
  letterRadius: number,
): boolean {
  const dx = letter.x - playerX;
  const dy = letter.elevation - (playerElevation + player.playerCenterOffset);
  const reach = player.playerRadius + letterRadius;
  return dx * dx + dy * dy < reach * reach;
}

export type BlockHitRules = {
  footHalfWidth: number;
  hitLeniency: number;
  hitHeadroom: number;
};

// Feet box against a block. Slightly forgiving at the edges and top.
export function hitsBlock(
  playerX: number,
  feetElevation: number,
  block: Block,
  rules: BlockHitRules,
): boolean {
  const left = playerX - rules.footHalfWidth + rules.hitLeniency;
  const right = playerX + rules.footHalfWidth - rules.hitLeniency;
  return (
    right > block.x &&
    left < block.x + block.width &&
    feetElevation < block.height - rules.hitHeadroom
  );
}

// Short slowdown after a block hit; the round timer is unaffected.
export class Stumble {
  private left = 0;

  constructor(
    private readonly seconds: number,
    private readonly slowFactor: number,
  ) {}

  get active(): boolean {
    return this.left > 0;
  }

  start(): void {
    this.left = this.seconds;
  }

  cancel(): void {
    this.left = 0;
  }

  speedFactor(dt: number): number {
    if (this.left <= 0) return 1;
    this.left = Math.max(0, this.left - dt);
    return this.slowFactor;
  }
}
