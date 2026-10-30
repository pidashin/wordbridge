// Pure round countdown: no Phaser imports.

export class RoundTimer {
  remaining: number;

  constructor(seconds: number) {
    this.remaining = seconds;
  }

  get expired(): boolean {
    return this.remaining <= 0;
  }

  tick(dt: number): void {
    this.remaining = Math.max(0, this.remaining - dt);
  }

  penalise(seconds: number): void {
    this.remaining = Math.max(0, this.remaining - seconds);
  }
}
