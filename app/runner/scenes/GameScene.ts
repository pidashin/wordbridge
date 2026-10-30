import * as Phaser from 'phaser';
import { PLAYER_JUMP_KEY, PLAYER_RUN_KEYS } from '../assets';
import { RUNNER_CONFIG } from '../config';
import { MudEffect, touchesLetter } from '../logic/collision';
import { LetterSpawner } from '../logic/letterSpawner';
import type { Letter } from '../logic/letterSpawner';
import { PlayerBody } from '../logic/playerBody';
import { RoundTimer } from '../logic/roundTimer';
import { createRng, respawnX } from '../logic/terrainGenerator';
import type { Terrain } from '../logic/terrainGenerator';
import { WordDeck } from '../logic/wordPool';
import { WordProgress } from '../logic/wordProgress';
import { SESSION_KEY } from '../session';
import type { RunnerSession, SpelledWord } from '../session';
import { letterOptions, terrainReach } from '../letterSetup';
import { createTerrain } from '../terrainSetup';
import { DEFAULT_THEME } from '../themes';
import { Background } from '../view/Background';
import { Hud } from '../view/Hud';
import { LetterView } from '../view/LetterView';
import { TerrainView } from '../view/TerrainView';
import { COLORS, addButton, addText } from '../view/ui';
import { GAME_SCENE_KEY, RESULT_SCENE_KEY, TITLE_SCENE_KEY } from './keys';

const DEPTH_PLAYER = 20;
const DEPTH_IN_PIT = 8;
const DEPTH_FX = 90;
const DEPTH_FLASH = 99;
const DEPTH_PAUSE = 200;
// Above the pause shade so the exit button works while paused.
const DEPTH_EXIT = DEPTH_PAUSE + 5;

export class GameScene extends Phaser.Scene {
  private session!: RunnerSession;
  private runner!: PlayerBody;
  private terrain!: Terrain;
  private terrainView!: TerrainView;
  private background!: Background;
  private sprite!: Phaser.GameObjects.Image;
  private hud!: Hud;
  private flash!: Phaser.GameObjects.Rectangle;

  private spawner!: LetterSpawner;
  private letterViews = new Map<number, LetterView>();
  private deck!: WordDeck;
  private progress!: WordProgress;
  private timer!: RoundTimer;
  private stuck = false;
  private mud!: MudEffect;
  private speedFactor = 1;
  private splashTimer = 0;
  private spelled: SpelledWord[] = [];
  private wrongTotal = 0;

  private jumpKeys: Phaser.Input.Keyboard.Key[] = [];
  private pauseKeys: Phaser.Input.Keyboard.Key[] = [];
  private pointerPressed = false;
  private animTime = 0;
  private invulnerableLeft = 0;
  private tilt = 0;
  private paused = false;
  private ended = false;
  private pauseLayer: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(GAME_SCENE_KEY);
  }

  init(): void {
    this.letterViews = new Map();
    this.stuck = false;
    this.spelled = [];
    this.wrongTotal = 0;
    this.pointerPressed = false;
    this.animTime = 0;
    this.speedFactor = 1;
    this.splashTimer = 0;
    this.invulnerableLeft = 0;
    this.tilt = 0;
    this.paused = false;
    this.ended = false;
    this.pauseLayer = [];
  }

  create(): void {
    this.session = this.registry.get(SESSION_KEY) as RunnerSession;
    const { player, camera, game, round, obstacles, jump, respawn } =
      RUNNER_CONFIG;
    const theme = DEFAULT_THEME;

    this.background = new Background(this, theme);
    this.terrain = createTerrain(-player.startX - game.width / 2);
    this.terrain.ensureCovered(player.startX + terrainReach());
    this.terrainView = new TerrainView(this, this.terrain, theme);

    this.runner = new PlayerBody(
      {
        gravity: jump.gravity,
        jumpVelocity: jump.velocity,
        cutVelocity: jump.cutVelocity,
        bufferSeconds: jump.bufferSeconds,
        coyoteSeconds: jump.coyoteSeconds,
        fallLimit: respawn.fallLimit,
        footHalfWidth: obstacles.footHalfWidth,
        doubleJump: jump.doubleJump,
      },
      player.startX,
    );

    this.sprite = this.add
      .image(player.startX, RUNNER_CONFIG.terrain.baseY, PLAYER_RUN_KEYS[0])
      .setOrigin(0.5, 1 - player.footMargin / player.size)
      .setDepth(DEPTH_PLAYER);

    this.cameras.main.startFollow(
      this.sprite,
      false,
      camera.lerpX,
      0,
      (0.5 - camera.playerScreenX) * -game.width,
      0,
    );
    this.cameras.main.scrollY = 0;

    this.timer = new RoundTimer(round.seconds);
    this.mud = new MudEffect(
      RUNNER_CONFIG.terrain.mud.speedFactor,
      RUNNER_CONFIG.terrain.mud.recoverSeconds,
    );
    this.deck = new WordDeck(
      this.session.words,
      createRng(Math.floor(Math.random() * 0x7fffffff)),
    );
    this.progress = new WordProgress(this.deck.next() ?? { en: 'a', zh: '' });

    this.spawner = new LetterSpawner(
      letterOptions(),
      createRng(Math.floor(Math.random() * 0x7fffffff)),
      {
        describeAt: (x, r) => this.terrain.describeAt(x, r),
        featuresIn: (a, b) => this.terrain.featuresIn(a, b),
      },
      player.startX,
    );
    this.spawner.setTarget(this.progress.target);
    this.syncLetters(
      this.spawner.update(
        player.startX,
        this.cameras.main.scrollX,
        this.cameras.main.scrollX + game.width,
      ),
    );

    this.hud = new Hud(this);
    this.hud.setWord(this.progress);
    this.hud.setWordsCompleted(0);
    this.hud.setTime(round.seconds);

    // Exit to the title screen, also while paused. Nothing is recorded.
    const exit = addButton(
      this,
      game.width - 36,
      36,
      'X',
      () => this.scene.start(TITLE_SCENE_KEY),
      { width: 56, height: 56, size: 30, fill: 0x6b7280 },
    );
    exit.container.setDepth(DEPTH_EXIT);

    this.flash = this.add
      .rectangle(0, 0, game.width, game.height, 0xff2222, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_FLASH);

    this.setupInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tweens.killAll();
    });
  }

  update(time: number, delta: number): void {
    if (this.pauseKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
      this.togglePause();
    }
    if (this.paused || this.ended) return;

    const { run, camera, game } = RUNNER_CONFIG;
    const dt = Math.min(delta / 1000, camera.maxDeltaSeconds);

    this.timer.tick(dt);
    this.hud.setTime(this.timer.remaining);
    if (this.timer.expired) {
      this.endRound('time');
      return;
    }

    const pressed = this.consumeJumpPress();
    const held =
      this.jumpKeys.some((k) => k.isDown) || this.input.activePointer.isDown;
    const touchingMud =
      this.runner.grounded &&
      this.runner.elevation < 1 &&
      this.terrain.mudAt(this.runner.x) !== null;
    this.speedFactor = this.mud.speed(dt, touchingMud);
    if (touchingMud) this.splash(dt);
    const step = this.runner.update(
      dt,
      { jumpPressed: pressed, jumpHeld: held },
      run.speed * this.speedFactor,
      {
        supportAt: (x, feet) => this.terrain.supportAt(x, feet),
        wallLimit: (x0, x1, feet, half) =>
          this.terrain.wallLimit(x0, x1, feet, half),
      },
    );
    // Pushing against a crate's side: stays put (camera and parallax follow
    // the fox, so they stop too) until the player jumps.
    this.stuck = step.blocked && this.runner.grounded;
    this.invulnerableLeft = Math.max(0, this.invulnerableLeft - dt);
    if (step.fell) this.respawn();

    this.terrain.ensureCovered(this.runner.x + terrainReach());
    this.terrain.prune(this.runner.x - RUNNER_CONFIG.terrain.behindPx);

    this.sprite.setPosition(
      this.runner.x,
      RUNNER_CONFIG.terrain.baseY - this.runner.elevation,
    );
    this.updateSprite(dt, time);

    const cam = this.cameras.main;
    this.checkLetters();
    if (this.ended) return;
    this.syncLetters(
      this.spawner.update(this.runner.x, cam.scrollX, cam.scrollX + game.width),
    );
    for (const view of this.letterViews.values()) view.update(time);

    this.terrainView.sync(cam.scrollX, cam.scrollX + cam.width);
    this.background.update(cam.scrollX);
  }

  // Little brown droplets thrown up while wading through mud.
  private splash(dt: number): void {
    this.splashTimer -= dt;
    if (this.splashTimer > 0) return;
    this.splashTimer = 0.09;
    const baseY = RUNNER_CONFIG.terrain.baseY;
    for (let i = 0; i < 2; i++) {
      const drop = this.add
        .circle(
          this.runner.x - 10 + Math.random() * 30,
          baseY + 4,
          4 + Math.random() * 3,
          0x6b4a2b,
        )
        .setDepth(DEPTH_FX);
      this.tweens.add({
        targets: drop,
        x: drop.x - 20 + Math.random() * 60,
        y: baseY - 30 - Math.random() * 30,
        alpha: 0,
        duration: 380,
        ease: 'Quad.Out',
        onComplete: () => drop.destroy(),
      });
    }
  }

  // Fell into a gap: back onto solid ground, no penalty, brief invulnerability.
  private respawn(): void {
    const { respawn, game, camera } = RUNNER_CONFIG;
    const gap = this.terrain.nearestGap(this.runner.x);
    if (!gap) return;
    this.runner.respawn(respawnX(gap, respawn.offsetX));
    this.invulnerableLeft = respawn.invulnerableSeconds;
    this.sprite.setPosition(this.runner.x, RUNNER_CONFIG.terrain.baseY);
    this.cameras.main.scrollX =
      this.runner.x - game.width * camera.playerScreenX;
    this.respawnEffect(this.runner.x, RUNNER_CONFIG.terrain.baseY - 50);
  }

  // Expanding ring, sparkles and a pop-in.
  private respawnEffect(x: number, y: number): void {
    const ring = this.add
      .circle(x, y, 20)
      .setStrokeStyle(6, 0xffffff)
      .setDepth(DEPTH_FX);
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 500,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });
    this.burstStars(x, y, 12);
    this.sprite.setScale(0.3);
    this.tweens.add({
      targets: this.sprite,
      scale: 1,
      duration: 300,
      ease: 'Back.Out',
    });
  }

  private checkLetters(): void {
    const { hit, letters: lc } = RUNNER_CONFIG;
    const near = this.spawner.letters.filter(
      (l) => Math.abs(l.x - this.runner.x) < 120,
    );
    for (const letter of near) {
      if (this.ended) return;
      if (
        touchesLetter(
          this.runner.x,
          this.runner.elevation,
          letter,
          hit,
          lc.radius,
        )
      ) {
        this.collect(letter);
      }
    }
  }

  private collect(letter: Letter): void {
    const view = this.letterViews.get(letter.id);
    this.spawner.remove(letter);
    this.letterViews.delete(letter.id);

    const result = this.progress.touch(letter.char);
    view?.pop(result === 'correct');

    if (result === 'wrong') {
      this.onWrong(letter);
      return;
    }

    this.floatText(letter.x, this.letterY(letter) - 30, '+1', '#7CFC5A');
    this.hud.setWord(this.progress);
    if (this.progress.complete) this.completeWord();
    else this.spawner.setTarget(this.progress.target);
  }

  private onWrong(letter: Letter): void {
    const { round } = RUNNER_CONFIG;
    this.wrongTotal += 1;
    this.timer.penalise(round.wrongPenalty);
    this.hud.setTime(this.timer.remaining);
    this.hud.flashTimer();
    this.floatText(
      letter.x,
      this.letterY(letter) - 30,
      `-${round.wrongPenalty}s`,
      '#ff5a5a',
    );
    this.cameras.main.shake(180, 0.01);
    this.flash.setAlpha(0.35);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 });
    if (this.timer.expired) this.endRound('time');
  }

  private completeWord(): void {
    const done = this.progress;
    this.spelled.push({
      en: done.word.en,
      zh: done.word.zh,
      wrongLetters: done.wrongLetters,
    });
    this.hud.setWordsCompleted(this.spelled.length);
    this.celebrate(done.word.en);

    const next = this.deck.next();
    if (!next) {
      this.endRound('words');
      return;
    }
    this.progress = new WordProgress(next);
    this.hud.setWord(this.progress);
    this.spawner.setTarget(this.progress.target);
  }

  private celebrate(word: string): void {
    this.burstStars(this.sprite.x, this.sprite.y - 50, 18);
    const banner = addText(
      this,
      RUNNER_CONFIG.game.width / 2,
      190,
      `${word}!`,
      {
        size: 72,
        color: COLORS.gold,
        strokeWidth: 10,
      },
    )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_FX);
    banner.setScale(0.4);
    this.tweens.add({
      targets: banner,
      scale: 1,
      duration: 220,
      ease: 'Back.Out',
    });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: 160,
      delay: 700,
      duration: 350,
      onComplete: () => banner.destroy(),
    });
  }

  private burstStars(x: number, y: number, count: number): void {
    const colors = [0xffd93b, 0xff8a3d, 0x7cfc5a, 0x6ec6ff, 0xff7ab8];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 70 + Math.random() * 90;
      const star = this.add
        .star(x, y, 5, 4, 10, colors[i % colors.length])
        .setDepth(DEPTH_FX);
      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 20,
        angle: 180,
        alpha: 0,
        scale: 0.3,
        duration: 650 + Math.random() * 250,
        ease: 'Quad.Out',
        onComplete: () => star.destroy(),
      });
    }
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const label = addText(this, x, y, text, { size: 34, color, strokeWidth: 7 })
      .setOrigin(0.5)
      .setDepth(DEPTH_FX);
    this.tweens.add({
      targets: label,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Quad.Out',
      onComplete: () => label.destroy(),
    });
  }

  private letterY(letter: Letter): number {
    return RUNNER_CONFIG.terrain.baseY - letter.elevation;
  }

  private syncLetters(update: {
    spawned: Letter[];
    rewritten: Letter[];
    removed: Letter[];
  }): void {
    for (const l of update.spawned) {
      this.letterViews.set(l.id, new LetterView(this, l));
    }
    for (const l of update.rewritten)
      this.letterViews.get(l.id)?.setChar(l.char);
    for (const l of update.removed) {
      this.letterViews.get(l.id)?.destroy();
      this.letterViews.delete(l.id);
    }
  }

  private updateSprite(dt: number, timeMs: number): void {
    const { player } = RUNNER_CONFIG;
    let targetTilt: number;

    this.sprite.setAlpha(
      this.invulnerableLeft > 0 && Math.sin(timeMs / 45) > 0 ? 0.35 : 1,
    );
    if (this.stuck) {
      // Stuck against a crate: standing pose, no run-cycle scrubbing.
      this.sprite.setTexture(PLAYER_RUN_KEYS[1]);
      targetTilt = 0;
    } else if (this.runner.grounded) {
      // Slower strides while slowed down by mud.
      this.animTime += dt * this.speedFactor;
      const frame =
        Math.floor(this.animTime * player.runFramesPerSecond) %
        PLAYER_RUN_KEYS.length;
      this.sprite.setTexture(PLAYER_RUN_KEYS[frame]);
      targetTilt = 0;
    } else {
      this.sprite.setTexture(PLAYER_JUMP_KEY);
      targetTilt = Phaser.Math.Clamp(-this.runner.vy / 2200, -0.4, 0.4);
    }

    // Below the ground rim the character is falling inside a pit: draw it
    // behind the ground so it disappears behind the far wall.
    this.sprite.setDepth(
      this.runner.elevation < -8 ? DEPTH_IN_PIT : DEPTH_PLAYER,
    );
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 12);
    this.sprite.setRotation(this.tilt);
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (keyboard) {
      const codes = Phaser.Input.Keyboard.KeyCodes;
      this.jumpKeys = [keyboard.addKey(codes.SPACE), keyboard.addKey(codes.UP)];
      this.pauseKeys = [keyboard.addKey(codes.P), keyboard.addKey(codes.ESC)];
    }
    // A press on a button (the exit X, pause menu) must not make the fox jump.
    this.input.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        over: Phaser.GameObjects.GameObject[],
      ) => {
        if (over.length === 0 && !this.paused && !this.ended) {
          this.pointerPressed = true;
        }
      },
    );
  }

  private consumeJumpPress(): boolean {
    const keyPressed = this.jumpKeys.some((k) =>
      Phaser.Input.Keyboard.JustDown(k),
    );
    const pressed = keyPressed || this.pointerPressed;
    this.pointerPressed = false;
    return pressed;
  }

  private togglePause(): void {
    if (this.ended) return;
    if (this.paused) this.resume();
    else this.pause();
  }

  private pause(): void {
    const { width, height } = RUNNER_CONFIG.game;
    this.paused = true;
    this.pointerPressed = false;
    this.tweens.pauseAll();

    const cx = width / 2;
    const shade = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_PAUSE);
    const title = addText(this, cx, 200, 'Paused', {
      size: 80,
      strokeWidth: 10,
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_PAUSE + 1);
    const resume = addButton(this, cx, 320, 'Resume (P)', () => this.resume());
    const restart = addButton(
      this,
      cx,
      405,
      'Restart',
      () => this.scene.restart(),
      { fill: 0x4a8fe0 },
    );
    const quit = addButton(
      this,
      cx,
      490,
      'Quit',
      () => this.scene.start(TITLE_SCENE_KEY),
      { fill: 0x6b7280 },
    );
    for (const b of [resume, restart, quit]) {
      b.container.setDepth(DEPTH_PAUSE + 1);
    }
    this.pauseLayer = [
      shade,
      title,
      resume.container,
      restart.container,
      quit.container,
    ];
  }

  private resume(): void {
    this.paused = false;
    this.pointerPressed = false;
    this.pauseLayer.forEach((o) => o.destroy());
    this.pauseLayer = [];
    this.tweens.resumeAll();
  }

  private endRound(endedBy: 'time' | 'words'): void {
    if (this.ended) return;
    this.ended = true;
    this.scene.start(RESULT_SCENE_KEY, {
      spelled: this.spelled,
      wrongLetters: this.wrongTotal,
      endedBy,
    });
  }
}
