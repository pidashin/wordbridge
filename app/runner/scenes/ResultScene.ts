import * as Phaser from 'phaser';
import { RUNNER_CONFIG } from '../config';
import { isBetter, readBest, writeBest } from '../storage';
import { SESSION_KEY } from '../session';
import type { RoundResult, RunnerSession } from '../session';
import { createBackdrop } from '../view/backdrop';
import { COLORS, DEPTH_UI, addButton, addText } from '../view/ui';
import { GAME_SCENE_KEY, RESULT_SCENE_KEY } from './keys';

export type ResultData = RoundResult & { endedBy: 'time' | 'words' };

export class ResultScene extends Phaser.Scene {
  constructor() {
    super(RESULT_SCENE_KEY);
  }

  create(data: ResultData): void {
    const session = this.registry.get(SESSION_KEY) as RunnerSession;
    const { width } = RUNNER_CONFIG.game;
    const cx = width / 2;
    const ink = COLORS.ink;

    const userId = session.user?.id ?? null;
    const score = {
      words: data.spelled.length,
      wrongLetters: data.wrongLetters,
    };
    const previousBest = readBest(userId);
    const newBest = isBetter(score, previousBest);
    if (newBest) writeBest(userId, score);
    const best = newBest ? score : previousBest;

    createBackdrop(this);
    this.add
      .rectangle(cx, 360, 1000, 660, 0xfff8e7, 0.96)
      .setStrokeStyle(6, 0x4a2a18)
      .setDepth(DEPTH_UI - 1);

    addText(
      this,
      cx,
      70,
      data.endedBy === 'time' ? "Time's up!" : 'All words done!',
      {
        size: 56,
        color: ink,
        stroke: null,
      },
    ).setOrigin(0.5);
    addText(
      this,
      cx,
      135,
      `${score.words} word${score.words === 1 ? '' : 's'} spelled`,
      { size: 44, color: '#e07b00', stroke: null },
    ).setOrigin(0.5);
    addText(this, cx, 185, `Wrong letters: ${score.wrongLetters}`, {
      size: 26,
      color: ink,
      stroke: null,
    }).setOrigin(0.5);
    addText(
      this,
      cx,
      222,
      newBest
        ? 'New best!'
        : `Best: ${best?.words ?? 0} word${best?.words === 1 ? '' : 's'} (${best?.wrongLetters ?? 0} wrong)`,
      { size: 26, color: newBest ? '#d4a000' : ink, stroke: null },
    ).setOrigin(0.5);

    this.addWordList(data, cx);

    addButton(
      this,
      cx - 160,
      650,
      'Play again',
      () => this.scene.start(GAME_SCENE_KEY),
      {
        width: 270,
        height: 64,
      },
    );
    addButton(this, cx + 160, 650, 'Back home', () => session.onExit(), {
      width: 270,
      height: 64,
      fill: 0x4a8fe0,
    });
    this.input.keyboard?.on('keydown-ENTER', () =>
      this.scene.start(GAME_SCENE_KEY),
    );
  }

  private addWordList(data: ResultData, cx: number): void {
    const rows = RUNNER_CONFIG.ui.resultRows;
    const capacity = rows * 2;
    const shown = data.spelled.slice(0, capacity);
    const top = 275;
    const rowH = 38;

    shown.forEach((w, i) => {
      const col = Math.floor(i / rows);
      const x = cx - 460 + col * 470;
      const y = top + (i % rows) * rowH;
      const label = addText(this, x, y, w.en, {
        size: 26,
        color: w.wrongLetters === 0 ? '#2a8a3a' : COLORS.ink,
        stroke: null,
      });
      addText(this, x + 130, y + 1, truncate(w.zh, 12), {
        size: 22,
        color: COLORS.ink,
        stroke: null,
      });
      label.setData('word', w.en);
    });

    if (data.spelled.length > capacity) {
      addText(
        this,
        cx,
        top + rows * rowH - 4,
        `...and ${data.spelled.length - capacity} more`,
        {
          size: 22,
          color: COLORS.ink,
          stroke: null,
        },
      ).setOrigin(0.5, 0);
    }
    if (data.spelled.length === 0) {
      addText(this, cx, top + 60, 'No words completed this time. Try again!', {
        size: 28,
        color: COLORS.ink,
        stroke: null,
      }).setOrigin(0.5);
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}
