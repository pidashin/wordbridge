import * as Phaser from 'phaser';
import { PLAYER_RUN_KEYS } from '../assets';
import { RUNNER_CONFIG } from '../config';
import { readBest } from '../storage';
import { SESSION_KEY } from '../session';
import type { RunnerSession } from '../session';
import { createBackdrop } from '../view/backdrop';
import { COLORS, addButton, addText } from '../view/ui';
import { GAME_SCENE_KEY, TITLE_SCENE_KEY } from './keys';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super(TITLE_SCENE_KEY);
  }

  create(): void {
    const session = this.registry.get(SESSION_KEY) as RunnerSession;
    const { width, height } = RUNNER_CONFIG.game;
    const cx = width / 2;
    const canPlay = session.words.length >= RUNNER_CONFIG.words.minPool;

    createBackdrop(this);

    this.add
      .image(width - 220, RUNNER_CONFIG.terrain.baseY, PLAYER_RUN_KEYS[1])
      .setOrigin(
        0.5,
        1 - RUNNER_CONFIG.player.footMargin / RUNNER_CONFIG.player.size,
      )
      .setDepth(20);

    addText(this, cx, 110, 'Word Runner', {
      size: 96,
      strokeWidth: 10,
    }).setOrigin(0.5);
    addText(
      this,
      cx,
      200,
      session.user ? `Hi, ${session.user.username}!` : 'Playing as guest',
      { size: 34 },
    ).setOrigin(0.5);

    const source = addText(
      this,
      cx,
      250,
      canPlay
        ? `Words: ${session.sourceLabel} (${session.words.length})`
        : `Not enough words to play: need at least ${RUNNER_CONFIG.words.minPool}, found ${session.words.length}.`,
      {
        size: 26,
        color: canPlay ? COLORS.white : '#ffb4b4',
        wrap: 900,
        align: 'center',
      },
    ).setOrigin(0.5);
    source.setName('source');

    const start = addButton(this, cx, 370, 'Start', () => this.start(), {
      width: 280,
      height: 76,
      size: 38,
    });
    start.setEnabled(canPlay);

    const best = readBest(session.user?.id ?? null);
    if (best) {
      addText(
        this,
        cx,
        470,
        `Best: ${best.words} word${best.words === 1 ? '' : 's'} (${best.wrongLetters} wrong)`,
        { size: 26, color: COLORS.gold },
      ).setOrigin(0.5);
    }

    addText(
      this,
      cx,
      height - 30,
      'Jump: Space / Up / click / tap. Hold to jump higher. P or Esc pauses.',
      { size: 22, stroke: null, color: COLORS.cream },
    )
      .setOrigin(0.5)
      .setShadow(1, 1, '#000', 3);

    addButton(this, 90, 36, 'Home', () => session.onExit(), {
      width: 130,
      height: 44,
      size: 22,
      fill: 0x6b7280,
    });

    this.input.keyboard?.on('keydown-ENTER', () => canPlay && this.start());
  }

  private start(): void {
    this.scene.start(GAME_SCENE_KEY);
  }
}
