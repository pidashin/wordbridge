// Pure runner physics: no Phaser imports. Elevation is the feet height above
// the flat base ground line (positive = up), matching terrainGenerator.

export type PlayerBodyParams = {
  gravity: number;
  jumpVelocity: number;
  cutVelocity: number;
  bufferSeconds: number;
  coyoteSeconds: number;
  fallLimit: number;
  doubleJump: boolean;
};

export type PlayerInput = {
  jumpPressed: boolean; // true only on the frame the button went down
  jumpHeld: boolean;
};

export type PlayerStep = { jumped: boolean; landed: boolean; fell: boolean };

// Height of whatever holds the feet at x given where they were; -Infinity
// over a gap.
export type SupportFn = (x: number, feet: number) => number;

export class PlayerBody {
  x: number;
  elevation = 0;
  vy = 0;
  grounded = true;
  private bufferLeft = 0;
  private coyoteLeft = 0;
  private airJumpsLeft = 0;

  constructor(
    private readonly p: PlayerBodyParams,
    startX: number,
  ) {
    this.x = startX;
  }

  // Back on solid ground at x (after falling into a gap).
  respawn(x: number): void {
    this.x = x;
    this.elevation = 0;
    this.vy = 0;
    this.grounded = true;
    this.bufferLeft = 0;
    this.coyoteLeft = 0;
  }

  update(
    dt: number,
    input: PlayerInput,
    runSpeed: number,
    supportAt: SupportFn,
  ): PlayerStep {
    const p = this.p;
    const step: PlayerStep = { jumped: false, landed: false, fell: false };

    this.x += runSpeed * dt;
    this.bufferLeft = input.jumpPressed
      ? p.bufferSeconds
      : Math.max(0, this.bufferLeft - dt);

    if (this.grounded) {
      const support = supportAt(this.x, this.elevation);
      if (support < this.elevation - 0.5) {
        // Ran off an edge: still allowed a jump for a moment (coyote time).
        this.grounded = false;
        this.vy = 0;
        this.airJumpsLeft = 0;
        this.coyoteLeft = p.coyoteSeconds;
      } else {
        this.elevation = support;
        if (this.bufferLeft > 0) {
          this.startJump(step);
          this.airJumpsLeft = p.doubleJump ? 1 : 0;
        } else {
          return step;
        }
      }
    }

    if (!this.grounded && !step.jumped) {
      this.coyoteLeft = Math.max(0, this.coyoteLeft - dt);
      if (this.coyoteLeft > 0 && this.bufferLeft > 0) {
        this.startJump(step);
      } else if (input.jumpPressed && this.airJumpsLeft > 0) {
        this.airJumpsLeft -= 1;
        this.startJump(step);
      }
    }

    if (this.vy > p.cutVelocity && !input.jumpHeld) this.vy = p.cutVelocity;

    const before = this.elevation;
    this.vy -= p.gravity * dt;
    this.elevation += this.vy * dt;

    if (this.vy <= 0) {
      const support = supportAt(this.x, before);
      if (this.elevation <= support) {
        this.elevation = support;
        this.vy = 0;
        this.grounded = true;
        step.landed = true;
      }
    }
    if (this.elevation < p.fallLimit) step.fell = true;
    return step;
  }

  private startJump(step: PlayerStep): void {
    this.vy = this.p.jumpVelocity;
    this.grounded = false;
    this.bufferLeft = 0;
    this.coyoteLeft = 0;
    step.jumped = true;
  }
}
