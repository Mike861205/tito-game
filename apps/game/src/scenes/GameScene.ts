import Phaser from 'phaser';
import {
  SCORE,
  TILE_SIZE,
  getLevelDesign,
  getWorld,
  type LevelDesign,
  type EnemyKind,
  type PowerUp,
} from '@tito/shared';
import { Tito, type DeathCause } from '../objects/Tito';
import {
  Enemy,
  isStompable,
  type EnemyAttackEvent,
  type EnemyEggEvent,
} from '../objects/Enemy';
import type { BossProfile } from '../objects/BossProfiles';
import { InputController } from '../systems/InputController';
import { buildLevel, type BuiltLevel } from '../systems/LevelBuilder';
import { playAnim } from '../systems/AssetManifest';
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
  flightEnergy: number;
  flying: boolean;
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
  private projectiles!: Phaser.Physics.Arcade.Group;
  private rocks!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private enemyEggs!: Phaser.Physics.Arcade.Group;
  private spawnedMinis = 0;
  private ropeGraphics?: Phaser.GameObjects.Graphics;
  private grappleAnchor?: Phaser.Physics.Arcade.Sprite;
  private grappleLength = 100;
  private nextPowerShotAt = 0;
  private nextRockAt = 0;
  private nextMovementHudAt = 0;
  private powerRewardsGiven = 0;
  private bossEnemy?: Enemy;
  private bossHud?: Phaser.GameObjects.Container;
  private bossHealthFill?: Phaser.GameObjects.Rectangle;
  private nextBossGateTipAt = 0;

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
    this.runTicket = null;
    this.grappleAnchor = undefined;
    this.grappleLength = 100;
    this.nextPowerShotAt = 0;
    this.nextRockAt = 0;
    this.nextMovementHudAt = 0;
    this.powerRewardsGiven = 0;
    this.spawnedMinis = 0;
    this.bossEnemy = undefined;
    this.bossHud = undefined;
    this.bossHealthFill = undefined;
    this.nextBossGateTipAt = 0;
  }

  create(): void {
    const world = getWorld(this.design.world);

    this.built = buildLevel(this, this.design);
    this.physics.world.setBounds(0, 0, this.built.widthPx, this.built.heightPx + 200);

    // --- Tito ---
    let startX = this.built.spawnX;
    let startY = this.built.spawnY;
    const savedCheckpoint = save.getCheckpoint(this.design.world, this.design.level);
    if (savedCheckpoint !== null) {
      for (const child of this.built.checkpoints.getChildren()) {
        const cp = child as Phaser.Physics.Arcade.Sprite;
        const index = Number(cp.getData('index'));
        if (index > savedCheckpoint) continue;
        cp.setData('taken', true);
        this.activateCheckpointVisual(cp, true);
        if (index === savedCheckpoint) {
          startX = cp.x;
          startY = cp.y;
        }
      }
    }
    this.tito = new Tito(this, startX, startY);
    this.tito.setFrictionScale(world.modifiers?.frictionScale ?? 1);
    this.respawnPoint = { x: startX, y: startY };
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.rocks = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group({ allowGravity: false });
    this.enemyEggs = this.physics.add.group();
    this.ropeGraphics = this.add.graphics().setDepth(19);

    // --- Camara ---
    this.cameras.main.setBounds(0, 0, this.built.widthPx, this.built.heightPx);
    this.cameras.main.startFollow(this.tito, true, 0.12, 0.12, 0, 90);
    this.cameras.main.setDeadzone(180, 120);

    // --- Colisiones ---
    this.physics.add.collider(this.tito, this.built.layer);
    this.physics.add.collider(this.built.enemies, this.built.layer);
    this.physics.add.collider(this.tito, this.built.platforms);
    this.physics.add.collider(this.built.enemies, this.built.platforms);
    this.physics.add.collider(this.projectiles, this.built.layer, (shot) => shot.destroy());
    this.physics.add.collider(this.rocks, this.built.layer, (rock) => rock.destroy());
    this.physics.add.collider(this.enemyProjectiles, this.built.layer, (shot) => shot.destroy());
    this.physics.add.collider(this.enemyEggs, this.built.layer);
    this.physics.add.overlap(this.projectiles, this.built.enemies, (shot, enemy) =>
      this.hitEnemyWithProjectile(shot as Phaser.Physics.Arcade.Sprite, enemy as Enemy),
    );
    this.physics.add.overlap(this.rocks, this.built.enemies, (rock, enemy) =>
      this.hitEnemyWithRock(rock as Phaser.Physics.Arcade.Sprite, enemy as Enemy),
    );
    this.physics.add.overlap(this.tito, this.enemyProjectiles, (_player, shot) =>
      this.hitByEnemyProjectile(shot as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.projectiles, this.enemyEggs, (shot, egg) => {
      shot.destroy();
      this.breakEnemyEgg(egg as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.rocks, this.enemyEggs, (rock, egg) => {
      rock.destroy();
      this.breakEnemyEgg(egg as Phaser.Physics.Arcade.Sprite);
    });

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
    this.bossEnemy = this.built.enemies.getChildren().find(
      (enemy): enemy is Enemy => enemy instanceof Enemy && Boolean(enemy.bossProfile),
    );
    if (this.bossEnemy) this.built.goal.setTint(0x637083).setAlpha(0.62);

    // --- Entrada ---
    this.controls = new InputController(this);
    this.controls.onPause(() => this.togglePause());

    // --- HUD ---
    this.scene.launch('Hud', { gameScene: this });
    this.emitHud();
    if (this.bossEnemy?.bossProfile) {
      this.createBossHud(this.bossEnemy);
      this.time.delayedCall(650, () => {
        const profile = this.bossEnemy?.bossProfile;
        if (profile) this.events.emit('hud:tip', `${profile.name}: ${profile.title}`, 'Primero observo su patrón; luego ataco.');
      });
    }

    // --- Sonidos por evento ---
    const onJump = (): void => audio.play('jump');
    const onFlight = (): void => {
      audio.play('spring');
      this.showFloatingText(this.tito.x, this.tito.y - 62, '¡A VOLAR!', '#ffd166');
    };
    const onHurt = (): void => audio.play('hurt');
    const onDied = (cause: DeathCause): void => this.onDeath(cause);
    const onEnemyAttack = (data: EnemyAttackEvent): void => this.spawnEnemyProjectile(data);
    const onEnemyEgg = (data: EnemyEggEvent): void => this.spawnEnemyEgg(data);
    const onBossHealth = (boss: Enemy): void => this.refreshBossHud(boss);
    const onBossPhase = (profile: BossProfile): void => {
      this.cameras.main.shake(180, 0.008);
      this.events.emit('hud:tip', `${profile.name} entró en fase de furia.`, '¡Ahora ataca más rápido!');
    };
    const onPauseRequest = (): void => this.togglePause();
    const onExit = (): void => this.prepareExit();
    this.events.on('tito:jump', onJump);
    this.events.on('tito:flight', onFlight);
    this.events.on('tito:hurt', onHurt);
    this.events.on('tito:died', onDied);
    this.events.on('enemy:attack', onEnemyAttack);
    this.events.on('enemy:egg', onEnemyEgg);
    this.events.on('boss:health', onBossHealth);
    this.events.on('boss:phase', onBossPhase);
    this.events.on('game:pause-request', onPauseRequest);
    this.events.on('game:exit', onExit);

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
      this.events.off('tito:jump', onJump);
      this.events.off('tito:flight', onFlight);
      this.events.off('tito:hurt', onHurt);
      this.events.off('tito:died', onDied);
      this.events.off('enemy:attack', onEnemyAttack);
      this.events.off('enemy:egg', onEnemyEgg);
      this.events.off('boss:health', onBossHealth);
      this.events.off('boss:phase', onBossPhase);
      this.events.off('game:pause-request', onPauseRequest);
      this.events.off('game:exit', onExit);
      this.releaseGrapple();
      this.ropeGraphics?.destroy();
    });
  }

  override update(_time: number, delta: number): void {
    if (this.finished) return;

    this.elapsedMs += delta;
    const input = this.controls.read();
    this.tito.handleInput(input, delta);
    this.handleActions(input, delta);
    if (this.tito.power === 'capa' && this.time.now >= this.nextMovementHudAt) {
      this.nextMovementHudAt = this.time.now + 120;
      this.emitHud();
    }

    if (this.tito.isDead) {
      if (this.tito.y > this.built.heightPx + 260) this.tito.setActive(false);
      return;
    }

    this.checkHazardTiles();
    this.checkBlockHit();

    if (this.tito.y > this.built.heightPx + 60) this.tito.die('caida');
    if (this.tito.body.blocked.down) this.comboCount = 0;
  }

  private spawnEnemyProjectile(data: EnemyAttackEvent): void {
    if (this.finished || this.tito.isDead || this.enemyProjectiles.countActive(true) >= 18) return;
    const bossAttack = ['thorn', 'sand', 'ice', 'shock', 'magma'].includes(data.attack);
    const texture = bossAttack ? 'boss-orb' : data.attack === 'bubble' ? 'enemy-bubble' : 'enemy-fire';
    const shot = this.enemyProjectiles.create(data.x, data.y, texture) as Phaser.Physics.Arcade.Sprite;
    const speed = data.attack === 'bubble' ? 190 : data.attack === 'spirit' ? 230 : 280;
    shot
      .setData('attack', data.attack)
      .setVelocity(data.direction * (data.speed ?? speed), data.verticalSpeed ?? 0)
      .setDepth(18)
      .setScale(data.scale ?? 1);
    if (data.tint) shot.setTint(data.tint);
    if (data.attack === 'spirit') shot.setTint(0x7c4dff).setScale(1.18);
    if (data.attack === 'bubble') {
      this.tweens.add({ targets: shot, y: shot.y - 22, duration: 420, yoyo: true, repeat: 2 });
    }
    if (bossAttack) {
      shot.setAngularVelocity(data.direction * 220);
      this.tweens.add({ targets: shot, scale: (data.scale ?? 1) * 1.18, duration: 180, yoyo: true, repeat: -1 });
    }
    this.time.delayedCall(3000, () => shot.active && shot.destroy());
  }

  private hitByEnemyProjectile(shot: Phaser.Physics.Arcade.Sprite): void {
    if (!shot.active || this.tito.isDead) return;
    shot.destroy();
    this.cameras.main.shake(90, 0.004);
    if (this.tito.takeHit()) this.tito.die('enemigo');
  }

  private spawnEnemyEgg(data: EnemyEggEvent): void {
    if (this.finished || this.spawnedMinis >= 12 || this.enemyEggs.countActive(true) >= 4) return;
    const egg = this.enemyEggs.create(data.x, data.y, 'enemy-egg') as Phaser.Physics.Arcade.Sprite;
    egg.setData('kind', data.kind).setDepth(17).setBounce(0.35).setVelocity(Phaser.Math.Between(-45, 45), -150);
    this.tweens.add({ targets: egg, angle: { from: -8, to: 8 }, duration: 180, yoyo: true, repeat: 10 });
    this.time.delayedCall(2600, () => this.hatchEnemyEgg(egg));
  }

  private hatchEnemyEgg(egg: Phaser.Physics.Arcade.Sprite): void {
    if (!egg.active || this.finished || this.spawnedMinis >= 12) return;
    const kind = egg.getData('kind') as EnemyKind;
    const { x, y } = egg;
    egg.destroy();
    const mini = new Enemy(this, x, y, kind).makeMini();
    mini.setTarget(this.tito);
    this.built.enemies.add(mini);
    mini.startMoving();
    this.spawnedMinis++;
    this.showFloatingText(x, y - 28, '¡NACIÓ UN MINI!', '#ffcc80');
    mini.setAlpha(0.2);
    this.tweens.add({ targets: mini, alpha: 1, duration: 240, ease: 'Back.easeOut' });
  }

  private breakEnemyEgg(egg: Phaser.Physics.Arcade.Sprite): void {
    if (!egg.active) return;
    const { x, y } = egg;
    egg.destroy();
    this.addScore(150, x, y - 10);
    this.showFloatingText(x, y - 34, 'HUEVO DETENIDO', '#fff8e1');
  }

  private handleActions(input: ReturnType<InputController['read']>, delta: number): void {
    if (input.actionJustPressed || input.rockJustPressed) this.shootEquippedWeapon();
    if (input.ropeJustPressed) this.attachGrapple();

    if (!this.grappleAnchor) return;
    if (!input.ropeDown || !this.grappleAnchor.active) {
      this.releaseGrapple();
      return;
    }

    const anchor = this.grappleAnchor;
    this.ropeGraphics?.clear().lineStyle(3, 0xffd180, 0.95).lineBetween(this.tito.x, this.tito.y - 25, anchor.x, anchor.y);
    const dx = anchor.x - this.tito.x;
    const dy = anchor.y - (this.tito.y - 20);
    const distance = Math.hypot(dx, dy) || 1;
    const dt = delta / 1000;
    const body = this.tito.body;

    // El lazo funciona como arnes: elimina la gravedad, regula la altura y
    // conserva la inercia horizontal para balancearse.
    body.setAllowGravity(false);
    const requestedLength = input.jumpDown ? 62 : input.down ? 150 : 96;
    this.grappleLength = Phaser.Math.Linear(
      this.grappleLength,
      requestedLength,
      Math.min(1, delta * 0.006),
    );

    const stretch = distance - this.grappleLength;
    if (stretch > 0) {
      const pull = Math.min(2800, 900 + stretch * 15);
      body.velocity.x += (dx / distance) * pull * dt;
      body.velocity.y += (dy / distance) * pull * dt;
    }

    if (input.jumpDown) body.velocity.y -= 720 * dt;
    if (input.down) body.velocity.y += 520 * dt;
    if (!input.jumpDown && !input.down && Math.abs(stretch) < 24) body.velocity.y *= 0.9;

    body.velocity.x = Phaser.Math.Clamp(body.velocity.x, -440, 440);
    body.velocity.y = Phaser.Math.Clamp(body.velocity.y, -520, 360);
  }

  private attachGrapple(): void {
    let best: Phaser.Physics.Arcade.Sprite | undefined;
    let bestDistance = 330;
    for (const child of this.built.grappleAnchors.getChildren()) {
      const anchor = child as Phaser.Physics.Arcade.Sprite;
      const dy = this.tito.y - anchor.y;
      const distance = Phaser.Math.Distance.Between(this.tito.x, this.tito.y - 20, anchor.x, anchor.y);
      if (anchor.active && dy > 35 && distance < bestDistance) {
        best = anchor;
        bestDistance = distance;
      }
    }
    if (!best) {
      this.showFloatingText(this.tito.x, this.tito.y - 65, 'Sin agarre cerca', '#ffe082');
      return;
    }
    this.grappleAnchor = best;
    this.grappleLength = 96;
    this.tito.body.setAllowGravity(false);
    this.tito.body.velocity.y = Math.min(this.tito.body.velocity.y, -120);
    best.setTint(0xffffff);
    this.showFloatingText(this.tito.x, this.tito.y - 68, 'LAZO VOLADOR', '#ffe082');
    audio.play('spring');
  }

  private releaseGrapple(): void {
    this.grappleAnchor?.clearTint();
    this.grappleAnchor = undefined;
    if (this.tito?.body) this.tito.body.setAllowGravity(true);
    this.ropeGraphics?.clear();
  }

  private shootEquippedWeapon(): void {
    if (this.tito.power !== 'fuego' && this.tito.power !== 'hielo') {
      this.throwRock();
      return;
    }
    if (this.time.now < this.nextPowerShotAt) return;
    this.nextPowerShotAt = this.time.now + 420;
    const element = this.tito.power;
    const shot = this.projectiles.create(
      this.tito.x + this.tito.facing * 24,
      this.tito.y - 28,
      element === 'fuego' ? 'projectile-fire' : 'projectile-ice',
    ) as Phaser.Physics.Arcade.Sprite;
    shot.setData('element', element).setVelocityX(this.tito.facing * 440).setDepth(18);
    (shot.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.time.delayedCall(1400, () => shot.active && shot.destroy());
    audio.play('block');
  }

  private throwRock(): void {
    if (this.time.now < this.nextRockAt) return;
    this.nextRockAt = this.time.now + 850;
    const rock = this.rocks.create(this.tito.x + this.tito.facing * 20, this.tito.y - 30, 'throw-rock') as Phaser.Physics.Arcade.Sprite;
    rock.setVelocity(this.tito.facing * 310, -260).setAngularVelocity(this.tito.facing * 540).setDepth(18);
    rock.setBounce(0.25);
    this.time.delayedCall(1800, () => rock.active && rock.destroy());
  }

  private hitEnemyWithProjectile(shot: Phaser.Physics.Arcade.Sprite, enemy: Enemy): void {
    if (!shot.active || !enemy.active) return;
    const element = shot.getData('element') as 'fuego' | 'hielo';
    shot.destroy();
    if (element === 'hielo') enemy.freeze();
    if (enemy.damage(element === 'fuego' ? 2 : 1)) this.defeatEnemy(enemy, true);
    else {
      this.refreshBossHud(enemy);
      this.showFloatingText(enemy.x, enemy.y - 24, element === 'hielo' ? 'CONGELADO' : '¡FUEGO!', element === 'hielo' ? '#81d4fa' : '#ffb74d');
    }
  }

  private hitEnemyWithRock(rock: Phaser.Physics.Arcade.Sprite, enemy: Enemy): void {
    if (!rock.active || !enemy.active) return;
    rock.destroy();
    if (enemy.damage()) this.defeatEnemy(enemy, true);
    else {
      this.refreshBossHud(enemy);
      this.showFloatingText(enemy.x, enemy.y - 24, '¡ROCA!', '#bcaaa4');
    }
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
      const coin = this.add.image(x, y - 12, 'coin').setDepth(12).setDisplaySize(21, 21);
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

    // El primer bloque de premio de cada nivel entrega la capa para que deba
    // ganarse dentro del recorrido. Los siguientes alternan armas y capa.
    const laterPrizes: PowerUp[] = ['fuego', 'hielo', 'capa', 'capa'];
    const kind: PowerUp =
      this.powerRewardsGiven === 0 ? 'capa' : laterPrizes[Math.floor(Math.random() * laterPrizes.length)]!;
    this.powerRewardsGiven++;
    const item = this.physics.add.sprite(x, y - TILE_SIZE, `powerup-${kind}`).setDepth(12);
    playAnim(item, `powerup-${kind}-idle`);
    if (kind === 'capa' && !item.anims.isPlaying) {
      this.tweens.add({
        targets: item,
        angle: { from: -8, to: 8 },
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    item.setVelocityX(80).setBounceX(1).setCollideWorldBounds(true);
    this.physics.add.collider(item, this.built.layer);
    this.physics.add.overlap(this.tito, item, () => {
      this.tito.applyPowerUp(kind);
      if (kind === 'capa') {
        this.events.emit(
          'hud:tip',
          'Corre con SHIFT hasta tomar impulso, salta y mantén ESPACIO para volar. Pulsa ↓ para descender.',
          '¡La velocidad me lleva más alto!',
        );
      }
      this.showFloatingText(
        item.x,
        item.y - 24,
        kind === 'fuego' ? 'ARMA: FUEGO' : kind === 'hielo' ? 'ARMA: HIELO' : '¡CAPA ALADA!',
        kind === 'fuego' ? '#ffb74d' : kind === 'hielo' ? '#81d4fa' : '#ffd166',
      );
      this.addScore(kind === 'capa' ? 1500 : 1000, item.x, item.y);
      audio.play('power');
      item.destroy();
      this.emitHud();
    });
  }

  private collectCoin(coin: Phaser.Physics.Arcade.Sprite): void {
    if (!coin.active) return;
    const units = Number(coin.getData('units') ?? 1);
    const points = Number(coin.getData('score') ?? SCORE.silverCoin);
    const currency = String(coin.getData('currency') ?? 'silver');
    coin.disableBody(true, true);
    this.coins += units;
    this.addScore(points, coin.x, coin.y);
    if (currency === 'gold') this.showFloatingText(coin.x, coin.y - 24, 'CENTENARIO +5', '#ffd54f');
    if (currency === 'note') this.showFloatingText(coin.x, coin.y - 24, 'BILLETE +10', '#80deea');
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
    if (playAnim(spring, 'spring-bounce', false)) {
      spring.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spring.setFrame(0));
    } else {
      this.tweens.add({ targets: spring, scaleY: 0.6, duration: 90, yoyo: true });
    }
  }

  private hitCheckpoint(cp: Phaser.Physics.Arcade.Sprite): void {
    if (cp.getData('taken')) return;
    cp.setData('taken', true);
    this.activateCheckpointVisual(cp, false);
    this.respawnPoint = { x: cp.x, y: cp.y };
    const checkpointIndex = Number(cp.getData('index'));
    save.setCheckpoint(this.design.world, this.design.level, checkpointIndex);
    save.progress.lives = this.lives;
    save.save();
    this.addScore(SCORE.checkpoint, cp.x, cp.y - 40);
    audio.play('checkpoint');
    this.showFloatingText(cp.x, cp.y - 78, `BANDERA ${checkpointIndex + 1} GUARDADA`, '#78f3ff');
  }

  private activateCheckpointVisual(cp: Phaser.Physics.Arcade.Sprite, restored: boolean): void {
    if (!playAnim(cp, 'checkpoint-on', false)) cp.setTint(0xbffcff);
    if (cp.getData('glow')) return;

    const glow = this.add
      .ellipse(cp.x, cp.y - cp.displayHeight * 0.48, cp.displayWidth * 1.8, cp.displayHeight * 1.05, 0x51dcff, 0.16)
      .setDepth(7)
      .setBlendMode(Phaser.BlendModes.ADD);
    cp.setData('glow', glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: restored ? 0.08 : 0.28, to: 0.08 },
      scaleX: { from: 0.82, to: 1.15 },
      scaleY: { from: 0.9, to: 1.08 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    if (!restored) {
      for (let i = 0; i < 8; i++) {
        const spark = this.add
          .circle(cp.x + Phaser.Math.Between(-18, 18), cp.y - Phaser.Math.Between(20, 66), Phaser.Math.FloatBetween(1.5, 3), i % 2 ? 0xffffff : 0x63e9ff, 0.95)
          .setDepth(13)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: spark,
          y: spark.y - Phaser.Math.Between(24, 58),
          x: spark.x + Phaser.Math.Between(-12, 12),
          alpha: 0,
          scale: 0.2,
          duration: Phaser.Math.Between(500, 900),
          onComplete: () => spark.destroy(),
        });
      }
    }
  }

  private hitEnemy(enemy: Enemy): void {
    if (!enemy.active || this.tito.isDead) return;

    const stomping =
      this.tito.body.velocity.y > 60 && this.tito.y - this.tito.body.height * 0.4 < enemy.y - enemy.displayHeight * 0.5;

    if (this.tito.hasStar) {
      if (enemy.bossProfile) {
        this.tito.bounce();
        if (enemy.damage(2)) this.defeatEnemy(enemy, true);
        else this.refreshBossHud(enemy);
      } else {
        this.defeatEnemy(enemy, true);
      }
      return;
    }

    if (stomping && isStompable(enemy.kind)) {
      this.tito.bounce();
      if (enemy.damage()) this.defeatEnemy(enemy, false);
      else {
        audio.play('stomp');
        this.refreshBossHud(enemy);
      }
      return;
    }

    if (this.tito.takeHit()) this.tito.die('enemigo');
  }

  private defeatEnemy(enemy: Enemy, knockOut: boolean): void {
    this.comboCount++;
    const points = enemy.scoreValue + (this.comboCount - 1) * SCORE.enemyCombo;
    this.addScore(points, enemy.x, enemy.y - 20);
    this.enemiesDefeated++;
    audio.play('stomp');
    if (knockOut) enemy.knockOut();
    else enemy.squash();
    if (enemy.bossProfile) this.onBossDefeated(enemy.bossProfile);
    this.emitHud();
  }

  private createBossHud(boss: Enemy): void {
    const profile = boss.bossProfile;
    if (!profile) return;
    const width = 320;
    const background = this.add.rectangle(0, 0, width + 12, 36, 0x07111d, 0.9).setStrokeStyle(2, profile.accent);
    const track = this.add.rectangle(-width / 2, 10, width, 9, 0x263247, 1).setOrigin(0, 0.5);
    this.bossHealthFill = this.add.rectangle(-width / 2, 10, width, 9, profile.accent, 1).setOrigin(0, 0.5);
    const title = this.add.text(0, -8, profile.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.bossHud = this.add.container(this.scale.width / 2, 64, [background, track, this.bossHealthFill, title])
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0);
    this.tweens.add({ targets: this.bossHud, alpha: 1, duration: 260 });
  }

  private refreshBossHud(enemy: Enemy): void {
    if (!enemy.bossProfile || !this.bossHealthFill) return;
    const ratio = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
    this.tweens.add({ targets: this.bossHealthFill, scaleX: ratio, duration: 140, ease: 'Sine.easeOut' });
  }

  private onBossDefeated(profile: BossProfile): void {
    this.cameras.main.flash(220, 255, 226, 112);
    this.cameras.main.shake(260, 0.012);
    this.events.emit('hud:tip', `${profile.name} fue derrotado. La salida está abierta.`, '¡Esa batalla fue épica!');
    if (this.bossHud) this.tweens.add({ targets: this.bossHud, alpha: 0, y: 52, duration: 360 });
    this.built.goal.clearTint().setAlpha(1);
  }

  private hasLivingBoss(): boolean {
    return this.built.enemies.getChildren().some(
      (child) => child instanceof Enemy && Boolean(child.bossProfile) && child.active && child.body.enable,
    );
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
    this.releaseGrapple();
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
    if (this.hasLivingBoss()) {
      if (this.time.now >= this.nextBossGateTipAt) {
        this.nextBossGateTipAt = this.time.now + 1800;
        this.events.emit('hud:tip', 'La bandera está protegida por el jefe.', '¡Primero debo vencerlo!');
      }
      return;
    }
    this.finished = true;
    this.releaseGrapple();
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
    save.clearCheckpoint(this.design.world, this.design.level);
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

  private prepareExit(): void {
    if (this.finished) return;
    this.finished = true;
    this.releaseGrapple();
    save.progress.lives = this.lives;
    save.save();
    void this.finishRun(false);
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
      flightEnergy: this.tito?.flightEnergy ?? 0,
      flying: this.tito?.isFlying ?? false,
    };
    this.events.emit('hud:update', data);
  }
}
