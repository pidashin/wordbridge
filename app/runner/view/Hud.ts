import * as Phaser from 'phaser';
import { RUNNER_CONFIG } from '../config';
import type { WordProgress } from '../logic/wordProgress';
import { COLORS, addText } from './ui';

const DEPTH_HUD = 100;
const BOX_W = 44;
const BOX_H = 52;
const BOX_GAP = 6;
const PAD = 12;

// Screen-space HUD: slots + meaning (top-left), timer (top-center), words
// completed (top-right).
export class Hud {
  private panel: Phaser.GameObjects.Graphics;
  private slotObjects: Phaser.GameObjects.GameObject[] = [];
  private meaning: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private wordsText: Phaser.GameObjects.Text;
  private highlight: Phaser.Tweens.Tween | null = null;
  private lastSecond = -1;

  constructor(private readonly scene: Phaser.Scene) {
    const { width } = RUNNER_CONFIG.game;
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_HUD);
    this.meaning = addText(scene, 28, 0, '', {
      size: 26,
      stroke: null,
      wrap: 420,
    })
      .setScrollFactor(0)
      .setDepth(DEPTH_HUD + 1);
    this.timerText = addText(scene, width / 2, 14, '', {
      size: 52,
      strokeWidth: 8,
    })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_HUD);
    // Right-aligned, leaving the far top-right corner to the exit button.
    this.wordsText = addText(scene, width - 96, 18, '', { size: 34 })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_HUD);
  }

  setWord(progress: WordProgress): void {
    this.scene.tweens.killTweensOf(this.slotObjects);
    this.slotObjects.forEach((o) => o.destroy());
    this.slotObjects = [];
    this.highlight?.stop();

    const slots = progress.slots;
    const rowWidth = slots.length * (BOX_W + BOX_GAP) - BOX_GAP;
    const left = 28;
    const top = 24;
    slots.forEach((char, i) =>
      this.addSlot(
        left + i * (BOX_W + BOX_GAP),
        top,
        char,
        i === progress.nextIndex,
      ),
    );

    this.meaning.setText(progress.word.zh || ' ');
    this.meaning.setPosition(left, top + BOX_H + 10);

    const panelW = Math.max(rowWidth, this.meaning.width) + PAD * 2 + 4;
    const panelH = BOX_H + 10 + this.meaning.height + PAD * 2;
    this.panel.clear();
    this.panel.fillStyle(0x1f2937, 0.5);
    this.panel.fillRoundedRect(left - PAD, top - PAD, panelW, panelH, 16);
  }

  setWordsCompleted(n: number): void {
    this.wordsText.setText(`Words: ${n}`);
  }

  setTime(seconds: number): void {
    const whole = Math.ceil(seconds);
    if (whole !== this.lastSecond) {
      this.lastSecond = whole;
      const m = Math.floor(whole / 60);
      const s = String(whole % 60).padStart(2, '0');
      this.timerText.setText(`${m}:${s}`);
    }
    const warn = seconds <= RUNNER_CONFIG.round.warnSeconds;
    this.timerText.setColor(warn ? '#ff4d4d' : '#ffffff');
  }

  flashTimer(): void {
    this.timerText.setScale(1.3);
    this.scene.tweens.add({
      targets: this.timerText,
      scale: 1,
      duration: 300,
      ease: 'Quad.Out',
    });
  }

  private addSlot(
    x: number,
    y: number,
    char: string | null,
    isNext: boolean,
  ): void {
    const filled = char !== null;
    const box = this.scene.add
      .rectangle(
        x,
        y,
        BOX_W,
        BOX_H,
        filled ? COLORS.green : 0xffffff,
        filled ? 1 : 0.9,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(isNext ? 5 : 3, isNext ? COLORS.orange : 0x4a2a18)
      .setScrollFactor(0)
      .setDepth(DEPTH_HUD + 1);
    this.slotObjects.push(box);
    if (isNext) {
      this.highlight = this.scene.tweens.add({
        targets: box,
        alpha: 0.55,
        duration: 450,
        yoyo: true,
        repeat: -1,
      });
    }
    if (filled) {
      const text = addText(this.scene, x + BOX_W / 2, y + BOX_H / 2, char, {
        size: 34,
        stroke: null,
      })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH_HUD + 2);
      this.slotObjects.push(text);
      this.scene.tweens.add({
        targets: [box, text],
        scale: { from: 1.25, to: 1 },
        duration: 160,
      });
    }
  }
}
