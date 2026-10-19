// Pure runner physics: no Phaser imports. Elevation is the feet height above
// the base ground line (positive = up), matching terrainGenerator.

export type PlayerBodyParams = {
  gravity: number;
  jumpVelocity: number;
  cutVelocity: number;
  bufferSeconds: number;
  groundSnap: number;
  doubleJump: boolean;
};

export type PlayerInput = {
  jumpPressed: boolean; // true only on the frame the button went down
  jumpHeld: boolean;
};

export type PlayerStep = { jumped: boolean; landed: boolean };

export class PlayerBody {
  x: number;
  elevation = 0;
  vy = 0;
  grounded = true;
  private bufferLeft = 0;
  private airJumpsLeft = 0;

  constructor(
    private readonly p: PlayerBodyParams,
    startX: number,
  ) {
    this.x = startX;
  }

  update(
    dt: number,
    input: PlayerInput,
    runSpeed: number,
    surfaceAt: (x: number) => number,
  ): PlayerStep {
    const p = this.p;
    const step: PlayerStep = { jumped: false, landed: false };

    this.x += runSpeed * dt;
    this.bufferLeft = input.jumpPressed
      ? p.bufferSeconds
      : Math.max(0, this.bufferLeft - dt);
    const surface = surfaceAt(this.x);

    if (this.grounded) {
      if (this.bufferLeft > 0) {
        this.startJump(step);
        this.airJumpsLeft = p.doubleJump ? 1 : 0;
      } else if (this.elevation - surface > p.groundSnap) {
        this.grounded = false; // surface fell away faster than the snap
        this.vy = 0;
        this.airJumpsLeft = 0;
      } else {
        this.elevation = surface;
        return step;
      }
    } else if (input.jumpPressed && this.airJumpsLeft > 0) {
      this.airJumpsLeft -= 1;
      this.startJump(step);
    }

    if (this.vy > p.cutVelocity && !input.jumpHeld) this.vy = p.cutVelocity;

    this.vy -= p.gravity * dt;
    this.elevation += this.vy * dt;

    if (this.elevation <= surface) {
      this.elevation = surface;
      if (this.vy <= 0) {
        this.vy = 0;
        this.grounded = true;
        step.landed = true;
      }
    }
    return step;
  }

  private startJump(step: PlayerStep): void {
    this.vy = this.p.jumpVelocity;
    this.grounded = false;
    this.bufferLeft = 0;
    step.jumped = true;
  }
}
