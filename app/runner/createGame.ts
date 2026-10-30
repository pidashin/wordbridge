import * as Phaser from 'phaser';
import { RUNNER_CONFIG } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { TitleScene } from './scenes/TitleScene';
import { SESSION_KEY } from './session';
import type { RunnerSession } from './session';

export function createGame(
  parent: HTMLElement,
  input: RunnerSession,
): Phaser.Game {
  const { width, height } = RUNNER_CONFIG.game;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    banner: false,
    disableContextMenu: true,
    backgroundColor: '#6ec6ff',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height,
    },
    scene: [BootScene, TitleScene, GameScene, ResultScene],
  });
  game.registry.set(SESSION_KEY, input);
  return game;
}
