// Pure hit tests and effects: no Phaser imports. Elevations are feet/centre
// heights above the base ground line (positive = up).

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

// Mud: slows the runner while the feet touch it, with a short linger after
// leaving. Jumping over a patch avoids it.
export class MudEffect {
  private left = 0;

  constructor(
    private readonly speedFactor: number,
    private readonly recoverSeconds: number,
  ) {}

  get active(): boolean {
    return this.left > 0;
  }

  speed(dt: number, touchingMud: boolean): number {
    if (touchingMud) this.left = this.recoverSeconds;
    else this.left = Math.max(0, this.left - dt);
    return this.left > 0 ? this.speedFactor : 1;
  }
}
