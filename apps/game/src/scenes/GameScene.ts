import Phaser from 'phaser';
import {
  SCORE,
  TILE_SIZE,
  getLevelDesign,
  getWorld,
  type LevelDesign,
  type PowerUp,
} from '@tito/shared';
import { Tito, type DeathCause } from '../objects/Tito';
import { Enemy, enemyScore, isStompable } from '../objects/Enemy';
import { InputController } from '../systems/InputController';
import { buildLevel, type BuiltLevel } from '../systems/LevelBuilder';
import { TILE_INDEX } from '../systems/TextureFactory';
import { save } from '../systems/SaveManager';
import { api } from '../systems/ApiClient';
import { audio } from '../systems/AudioManager';

export interface GameSceneData {
  world: number;
  level: number;
  lives?: number;
}

export interface HudData {
  world: number;
  level: number;
  levelName: string;
  score: number;
  coins: number;
  lives: number;
  timeLeft: number;
  power: PowerUp;
}

export class GameScene extends Phaser.Scene {
  private design!: LevelDesign;
  private built!: BuiltLevel;
  private tito!: Tito;
  private controls!: InputController;

  private score = 0;
  private coins = 0;
  private enemiesDefeated = 0;
  private deaths = 0;
  private lives = 3;
  private comboCount = 0;
  private startedAt = 0;
  private elapsedMs = 0;
  private timeLeft = 0;
  private finished = false;
  private respawnPoint = { x: 0, y: 0 };
  private runTicket: { runId: string; nonce: string } | null = null;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.design = getLevelDesign(data.world, data.level);
    this.lives = data.lives ?? save.progress.lives;
    this.score = 0;
    this.coins = 0;
    this.enemiesDefeated = 0;
    this.deaths = 0;
    this.comboCount = 0;
    this.elapsedMs = 0;
    this.finished = false;
    this.timeLeft = this.design.timeLimit;
  }

  create(): void {
    const world = getWorld(this.design.world);

    this.built = buildLevel(this, this.design);
    this.physics.world.setBounds(0, 0, this.built.widthPx, this.built.heightPx + 200);

    // --- Tito ---
    this.tito = new Tito(this, this.built.spawnX, this.built.spawnY);
    this.tito.setFrictionScale(world.modifiers?.frictionScale ?? 1);
    this.respawnPoint = { x: this.built.spawnX, y: this.built.spawnY };

    // --- Camara ---
    this.cameras.main.setBounds(0, 0, this.built.widthPx, this.built.heightPx);
    this.cameras.main.startFollow(this.tito, true, 0.12, 0.12, 0, 90);
    this.cameras.main.setDeadzone(180, 120);

    // --- Colisiones ---
    this.physics.add.collider(this.tito, this.built.layer);
    this.physics.add.collider(this.built.enemies, this.built.layer);
    this.physics.add.collider(this.tito, this.built.platforms);
    this.physics.add.collider(this.built.enemies, this.built.platforms);

    this.physics.add.overlap(this.tito, this.built.coins, (_p, c) =>
      this.collectCoin(c as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.tito, this.built.gems, (_p, g) =>
      this.collectGem(g as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.tito, this.built.springs, (_p, s) =>
      this.hitSpring(s as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.tito, this.built.checkpoints, (_p, c) =>
      this.hitCheckpoint(c as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.tito, this.built.enemies, (_p, e) =>
      this.hitEnemy(e as Enemy),
    );
    this.physics.add.overlap(this.tito, this.built.goal, () => this.completeLevel());

    this.built.enemies.getChildren().forEach((e) => {
      if (e instanceof Enemy) e.setTarget(this.tito);
    });

    // --- Entrada ---
    this.controls = new InputController(this);
    this.controls.onPause(() => this.togglePause());

    // --- HUD ---
    this.scene.launch('Hud', { gameScene: this });
    this.emitHud();

    // --- Sonidos por evento ---
    this.events.on('tito:jump', () => audio.play('jump'));
    this.events.on('tito:hurt', () => audio.play('hurt'));
    this.events.on('tito:died', (cause: DeathCause) => this.onDeath(cause));

    // --- Temporizador ---
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.finished || this.tito.isDead) return;
        this.timeLeft--;
        this.emitHud();
        if (this.timeLeft <= 0) this.tito.die('tiempo');
      },
    });

    // --- Run verificado en el servidor ---
    this.startedAt = this.time.now;
    void api.startRun(this.design.world, this.design.level).then((ticket) => {
      this.runTicket = ticket;
    });

    this.cameras.main.fadeIn(350, 0, 0, 0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.events.removeAllListeners();
    });
  }

  override update(_time: number, delta: number): void {
    if (this.finished) return;

    this.elapsedMs += delta;
    const input = this.controls.read();
    this.tito.handleInput(input, delta);

    if (this.tito.isDead) {
      if (this.tito.y > this.built.heightPx + 260) this.tito.setActive(false);
      return;
    }

    this.checkHazardTiles();
    this.checkBlockHit();

    if (this.tito.y > this.built.heightPx + 60) this.tito.die('caida');
    if (this.tito.body.blocked.down) this.comboCount = 0;
  }

  /** Pinchos y lava (no tienen colision fisica, se detectan por tile). */
  private checkHazardTiles(): void {
    const layer = this.built.layer;
    const points = [
      { x: this.tito.x, y: this.tito.y - 4 },
      { x: this.tito.x - 8, y: this.tito.y - 4 },
      { x: this.tito.x + 8, y: this.tito.y - 4 },
      { x: this.tito.x, y: this.tito.y - 20 },
    ];
    for (const p of points) {
      const tile = layer.getTileAtWorldXY(p.x, p.y);
      if (!tile) continue;
      if (tile.index === TILE_INDEX.SPIKE) {
        if (this.tito.takeHit()) this.tito.die('pinchos');
        return;
      }
      if (tile.index === TILE_INDEX.LAVA) {
        this.tito.die('lava');
        return;
      }
    }
  }

  /** Golpear bloques "?" / power / ladrillos desde abajo. */
  private checkBlockHit(): void {
    if (!this.tito.body.blocked.up) return;
    const layer = this.built.layer;
    const headY = this.tito.y - this.tito.body.height - 6;

    for (const dx of [-10, 0, 10]) {
      const tile = layer.getTileAtWorldXY(this.tito.x + dx, headY);
      if (!tile) continue;

      if (tile.index === TILE_INDEX.QUESTION || tile.index === TILE_INDEX.POWER) {
        const isPower = tile.index === TILE_INDEX.POWER;
        layer.putTileAt(TILE_INDEX.USED, tile.x, tile.y);
        layer.getTileAt(tile.x, tile.y)?.setCollision(true, true, true, true);
        this.spawnFromBlock(tile.getCenterX(), tile.getCenterY(), isPower);
        audio.play('block');
        this.cameras.main.shake(80, 0.004);
        return;
      }

      if (tile.index === TILE_INDEX.BRICK) {
        if (this.tito.power !== 'none') {
          layer.removeTileAt(tile.x, tile.y);
          this.addScore(50, tile.getCenterX(), tile.getCenterY());
          audio.play('block');
        } else {
          audio.play('block');
        }
        return;
      }
    }
  }

  private spawnFromBlock(x: number, y: number, isPower: boolean): void {
    if (!isPower) {
      const coin = this.add.image(x, y - 12, 'coin').setDepth(12);
      this.tweens.add({
        targets: coin,
        y: y - 60,
        alpha: 0,
        duration: 450,
        onComplete: () => coin.destroy(),
      });
      this.coins++;
      this.addScore(SCORE.coin, x, y - 20);
      audio.play('coin');
      return;
    }

    const kinds: PowerUp[] = ['grande', 'fuego', 'estrella'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
    const item = this.physics.add.sprite(x, y - TILE_SIZE, `powerup-${kind}`).setDepth(12);
    item.setVelocityX(80).setBounceX(1).setCollideWorldBounds(true);
    this.physics.add.collider(item, this.built.layer);
    this.physics.add.overlap(this.tito, item, () => {
      this.tito.applyPowerUp(kind);
      this.addScore(1000, item.x, item.y);
      audio.play('power');
      item.destroy();
      this.emitHud();
    });
  }

  private collectCoin(coin: Phaser.Physics.Arcade.Sprite): void {
    if (!coin.active) return;
    coin.disableBody(true, true);
    this.coins++;
    this.addScore(SCORE.coin, coin.x, coin.y);
    audio.play('coin');
    if (this.coins > 0 && this.coins % 100 === 0) this.lives = Math.min(9, this.lives + 1);
    this.emitHud();
  }

  private collectGem(gem: Phaser.Physics.Arcade.Sprite): void {
    if (!gem.active) return;
    gem.disableBody(true, true);
    this.addScore(SCORE.gem, gem.x, gem.y);
    audio.play('gem');
    this.emitHud();
  }

  private hitSpring(spring: Phaser.Physics.Arcade.Sprite): void {
    if (this.tito.body.velocity.y < 0) return;
    this.tito.springJump();
    audio.play('spring');
    this.tweens.add({ targets: spring, scaleY: 0.6, duration: 90, yoyo: true });
  }

  private hitCheckpoint(cp: Phaser.Physics.Arcade.Sprite): void {
    if (cp.getData('taken')) return;
    cp.setData('taken', true);
    cp.setTint(0x4caf50);
    this.respawnPoint = { x: cp.x, y: cp.y };
    this.addScore(SCORE.checkpoint, cp.x, cp.y - 40);
    audio.play('checkpoint');
    this.showFloatingText(cp.x, cp.y - 70, 'CHECKPOINT', '#4caf50');
  }

  private hitEnemy(enemy: Enemy): void {
    if (!enemy.active || this.tito.isDead) return;

    const stomping =
      this.tito.body.velocity.y > 60 && this.tito.y - this.tito.body.height * 0.4 < enemy.y - enemy.displayHeight * 0.5;

    if (this.tito.hasStar) {
      this.defeatEnemy(enemy, true);
      return;
    }

    if (stomping && isStompable(enemy.kind)) {
      this.tito.bounce();
      if (enemy.damage()) this.defeatEnemy(enemy, false);
      else audio.play('stomp');
      return;
    }

    if (this.tito.takeHit()) this.tito.die('enemigo');
  }

  private defeatEnemy(enemy: Enemy, knockOut: boolean): void {
    this.comboCount++;
    const points = enemyScore(enemy.kind) + (this.comboCount - 1) * SCORE.enemyCombo;
    this.addScore(points, enemy.x, enemy.y - 20);
    this.enemiesDefeated++;
    audio.play('stomp');
    if (knockOut) enemy.knockOut();
    else enemy.squash();
    this.emitHud();
  }

  private addScore(points: number, x?: number, y?: number): void {
    this.score += points;
    if (x !== undefined && y !== undefined) {
      this.showFloatingText(x, y, `+${points}`, '#ffd54f');
    }
    this.emitHud();
  }

  private showFloatingText(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, { fontSize: '16px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({
      targets: label,
      y: y - 42,
      alpha: 0,
      duration: 750,
      onComplete: () => label.destroy(),
    });
  }

  private onDeath(cause: DeathCause): void {
    this.deaths++;
    audio.play('die');
    this.cameras.main.shake(200, 0.008);
    this.lives--;

    void this.requestCoachTip(cause);

    this.time.delayedCall(1400, () => {
      if (this.lives <= 0) {
        this.finishRun(false);
        this.scene.stop('Hud');
        this.scene.start('GameOver', {
          world: this.design.world,
          level: this.design.level,
          score: this.score,
        });
        return;
      }
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.tito.setActive(true);
        this.tito.respawn(this.respawnPoint.x, this.respawnPoint.y);
        this.timeLeft = Math.max(30, Math.min(this.design.timeLimit, this.timeLeft + 30));
        this.emitHud();
        this.cameras.main.fadeIn(200, 0, 0, 0);
      });
    });
  }

  private async requestCoachTip(cause: DeathCause): Promise<void> {
    if (!save.settings.aiCoach || this.deaths % 2 !== 0) return;
    const res = await api.coach({
      world: this.design.world,
      level: this.design.level,
      deaths: this.deaths,
      lastDeathCause: cause,
      timeMs: Math.round(this.elapsedMs),
    });
    if (res) this.events.emit('hud:tip', res.tip, res.taunt);
  }

  private completeLevel(): void {
    if (this.finished) return;
    this.finished = true;
    audio.play('goal');
    this.tito.body.setVelocity(0, 0);

    const timeBonus = Math.max(0, this.timeLeft) * SCORE.timeBonusPerSecond;
    const livesBonus = this.lives * SCORE.livesBonus;
    const noDamage = this.deaths === 0 ? SCORE.noDamageBonus : 0;
    const total = this.score + SCORE.levelClear + timeBonus + livesBonus + noDamage;

    const stars = 1 + (this.deaths === 0 ? 1 : 0) + (this.elapsedMs < this.design.timeLimit * 550 ? 1 : 0);

    this.score = total;
    void this.finishRun(true);

    save.progress.lives = this.lives;
    save.progress.coins += this.coins;
    save.completeLevel(this.design.world, this.design.level, {
      score: total,
      timeMs: Math.round(this.elapsedMs),
      stars,
    });

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      this.scene.start('LevelComplete', {
        world: this.design.world,
        level: this.design.level,
        score: total,
        baseScore: total - timeBonus - livesBonus - noDamage - SCORE.levelClear,
        timeBonus,
        livesBonus,
        noDamage,
        stars,
        coins: this.coins,
        timeMs: Math.round(this.elapsedMs),
        lives: this.lives,
      });
    });
  }

  private async finishRun(completed: boolean): Promise<void> {
    if (!this.runTicket) return;
    const ticket = this.runTicket;
    this.runTicket = null;
    await api.submitScore(
      {
        runId: ticket.runId,
        world: this.design.world,
        level: this.design.level,
        score: this.score,
        timeMs: Math.round(this.elapsedMs),
        coins: this.coins,
        enemiesDefeated: this.enemiesDefeated,
        deaths: this.deaths,
        completed,
      },
      ticket.nonce,
    );
  }

  private togglePause(): void {
    if (this.finished || this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.launch('Pause', { world: this.design.world, level: this.design.level });
  }

  private emitHud(): void {
    const data: HudData = {
      world: this.design.world,
      level: this.design.level,
      levelName: this.design.name,
      score: this.score,
      coins: this.coins,
      lives: this.lives,
      timeLeft: this.timeLeft,
      power: this.tito?.power ?? 'none',
    };
    this.events.emit('hud:update', data);
  }
}
