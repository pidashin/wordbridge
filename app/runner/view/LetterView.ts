import * as Phaser from 'phaser';
import { RUNNER_CONFIG } from '../config';
import type { Letter } from '../logic/letterSpawner';
import { COLORS, addText } from './ui';

const DEPTH_LETTER = 15;

// A procedurally drawn letter bubble (no art files).
export class LetterView {
  readonly container: Phaser.GameObjects.Container;
  private readonly bubble: Phaser.GameObjects.Arc;
  private readonly text: Phaser.GameObjects.Text;
  private readonly phase = Math.random() * Math.PI * 2;
  private gone = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly letter: Letter,
  ) {
    const r = RUNNER_CONFIG.letters.radius;
    this.bubble = scene.add
      .circle(0, 0, r, 0xffffff)
      .setStrokeStyle(4, 0xf58a1f);
    this.text = addText(scene, 0, -1, letter.char, {
      size: 30,
      color: COLORS.ink,
      stroke: null,
    }).setOrigin(0.5);
    this.container = scene.add
      .container(letter.x, 0, [this.bubble, this.text])
      .setDepth(DEPTH_LETTER);
    this.container.setScale(0.2);
    scene.tweens.add({
      targets: this.container,
      scale: 1,
      duration: 180,
      ease: 'Back.Out',
    });
  }

  setChar(char: string): void {
    this.text.setText(char);
  }

  update(timeMs: number): void {
    if (this.gone) return;
    const baseY = RUNNER_CONFIG.terrain.baseY - this.letter.elevation;
    this.container.y = baseY + Math.sin(timeMs / 350 + this.phase) * 3;
  }

  pop(correct: boolean): void {
    this.gone = true;
    this.bubble.setFillStyle(correct ? COLORS.green : COLORS.red);
    this.text.setColor('#ffffff');
    this.scene.tweens.add({
      targets: this.container,
      scale: correct ? 1.7 : 0.6,
      alpha: 0,
      duration: correct ? 260 : 220,
      ease: 'Quad.Out',
      onComplete: () => this.container.destroy(),
    });
  }

  destroy(): void {
    this.gone = true;
    this.container.destroy();
  }
}
