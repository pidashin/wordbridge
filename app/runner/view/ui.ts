import * as Phaser from 'phaser';
import { RUNNER_CONFIG } from '../config';

// Above the terrain (depth 10-11) and player (20).
export const DEPTH_UI = 50;

export const COLORS = {
  ink: '#4a2a18',
  white: '#ffffff',
  cream: '#fff3dc',
  orange: 0xf58a1f,
  green: 0x5fbf4b,
  red: 0xe5484d,
  gold: '#ffd93b',
};

export type TextOptions = {
  size?: number;
  color?: string;
  stroke?: string | null;
  strokeWidth?: number;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
};

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  o: TextOptions = {},
): Phaser.GameObjects.Text {
  const stroke = o.stroke === undefined ? COLORS.ink : o.stroke;
  return scene.add
    .text(x, y, text, {
      fontFamily: RUNNER_CONFIG.ui.font,
      fontSize: `${o.size ?? 28}px`,
      fontStyle: 'bold',
      color: o.color ?? COLORS.white,
      stroke: stroke ?? undefined,
      strokeThickness: stroke ? (o.strokeWidth ?? 6) : 0,
      align: o.align ?? 'left',
      wordWrap: o.wrap ? { width: o.wrap } : undefined,
    })
    .setDepth(DEPTH_UI);
}

export type ButtonOptions = {
  width?: number;
  height?: number;
  fill?: number;
  size?: number;
};

export type Button = {
  container: Phaser.GameObjects.Container;
  setLabel(text: string): void;
  setEnabled(enabled: boolean): void;
};

// Pill button that fires on pointerup.
export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  o: ButtonOptions = {},
): Button {
  const width = o.width ?? 260;
  const height = o.height ?? 64;
  const bg = scene.add
    .rectangle(0, 0, width, height, o.fill ?? COLORS.orange)
    .setStrokeStyle(5, 0x4a2a18);
  const text = addText(scene, 0, 0, label, {
    size: o.size ?? 30,
    stroke: null,
  }).setOrigin(0.5);
  // Children keep their own scroll factor for hit testing, so pin them too
  // (the pause menu is used while the camera is far from the origin).
  bg.setScrollFactor(0);
  text.setScrollFactor(0);
  const container = scene.add
    .container(x, y, [bg, text])
    .setScrollFactor(0)
    .setDepth(DEPTH_UI);
  let enabled = true;

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => enabled && container.setScale(1.05));
  bg.on('pointerdown', () => enabled && container.setScale(0.94));
  bg.on('pointerout', () => container.setScale(1));
  bg.on('pointerup', () => {
    if (!enabled) return;
    container.setScale(1.05);
    onClick();
  });

  return {
    container,
    setLabel: (t) => text.setText(t),
    setEnabled: (e) => {
      enabled = e;
      container.setAlpha(e ? 1 : 0.45);
    },
  };
}
