import Phaser from 'phaser';
import type { EnemyKind } from '@tito/shared';
import { playAnim } from '../systems/AssetManifest';
import type { BossAttackKind, BossProfile } from './BossProfiles';

export type EnemyAttackKind = 'fire' | 'bubble' | 'spirit' | BossAttackKind;
export interface EnemyAttackEvent {
  x: number;
  y: number;
  direction: 1 | -1;
  attack: EnemyAttackKind;
  speed?: number;
  verticalSpeed?: number;
  scale?: number;
  tint?: number;
}

export interface EnemyEggEvent {
  x: number;
  y: number;
  kind: EnemyKind;
}

interface EnemyConfig {
  texture: string;
  speed: number;
  hp: number;
  /** Se puede eliminar pisandolo */
  stompable: boolean;
  /** Ignora la gravedad y las paredes */
  flying: boolean;
  score: number;
  bodyScale: number;
  displayWidth: number;
  displayHeight: number;
  /** Distancia maxima que recorre a cada lado de su punto de aparicion. */
  patrolRange: number;
}

const CONFIG: Record<EnemyKind, EnemyConfig> = {
  goomb: { texture: 'enemy-goomb', speed: 76, hp: 1, stompable: true, flying: false, score: 200, bodyScale: 0.68, displayWidth: 48, displayHeight: 54, patrolRange: 120 },
  spiker: { texture: 'enemy-spiker', speed: 66, hp: 2, stompable: false, flying: false, score: 350, bodyScale: 0.72, displayWidth: 58, displayHeight: 50, patrolRange: 145 },
  flyer: { texture: 'enemy-flyer', speed: 104, hp: 1, stompable: true, flying: true, score: 300, bodyScale: 0.62, displayWidth: 48, displayHeight: 62, patrolRange: 175 },
  slider: { texture: 'enemy-slider', speed: 172, hp: 2, stompable: true, flying: false, score: 450, bodyScale: 0.72, displayWidth: 62, displayHeight: 54, patrolRange: 210 },
  ghost: { texture: 'enemy-ghost', speed: 76, hp: 2, stompable: false, flying: true, score: 500, bodyScale: 0.68, displayWidth: 50, displayHeight: 60, patrolRange: 170 },
  boss: { texture: 'enemy-boss', speed: 96, hp: 5, stompable: true, flying: false, score: 5000, bodyScale: 0.82, displayWidth: 88, displayHeight: 88, patrolRange: 180 },
};

/** Si no pusiste `enemies/boss.png`, el jefe reusa el sprite de goomb escalado. */
function resolveTexture(scene: Phaser.Scene, texture: string): string {
  return scene.textures.exists(texture) ? texture : 'enemy-goomb';
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly kind: EnemyKind;
  readonly config: EnemyConfig;
  readonly bossProfile?: BossProfile;
  readonly maxHp: number;
  readonly scoreValue: number;
  hp: number;
  private homeX: number;
  private homeY: number;
  private phase: number;
  private target?: Phaser.GameObjects.Sprite;
  private frozenUntil = 0;
  private baseSpeed: number;
  private baseScaleX = 1;
  private baseScaleY = 1;
  private nextActionAt = 0;
  private nextAttackAt = 0;
  private nextEggAt = 0;
  private mini = false;
  private direction: 1 | -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: EnemyKind,
    isBoss = false,
    bossProfile?: BossProfile,
  ) {
    const cfg = CONFIG[kind];
    const textureKey = resolveTexture(scene, bossProfile?.texture ?? cfg.texture);
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.config = cfg;
    this.bossProfile = bossProfile;
    this.maxHp = bossProfile?.maxHp ?? (isBoss ? 8 : cfg.hp);
    this.scoreValue = bossProfile?.score ?? cfg.score;
    this.hp = this.maxHp;
    this.homeX = x;
    this.homeY = y;
    this.phase = Math.random() * Math.PI * 2;
    this.direction = Math.random() < 0.5 ? -1 : 1;
    this.baseSpeed = bossProfile?.speed ?? cfg.speed;
    this.nextActionAt = scene.time.now + Phaser.Math.Between(500, 1300);
    this.nextAttackAt = scene.time.now + Phaser.Math.Between(1400, 2600);
    this.nextEggAt = scene.time.now + Phaser.Math.Between(5200, 8000);

    this.setOrigin(0.5, 1).setDepth(15);
    if (isBoss) {
      if (!bossProfile && textureKey !== 'enemy-boss') this.setTint(0xff5252);
    }
    this.setDisplaySize(
      bossProfile?.width ?? (isBoss ? 88 : cfg.displayWidth),
      bossProfile?.height ?? (isBoss ? 88 : cfg.displayHeight),
    );
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;

    const w = this.width * cfg.bodyScale;
    const h = this.height * cfg.bodyScale;
    this.body.setSize(w, h);
    this.body.setOffset((this.width - w) / 2, this.height - h);

    if (cfg.flying || bossProfile?.movement === 'hover') {
      this.body.setAllowGravity(false);
      if (bossProfile) this.body.setCollideWorldBounds(true);
    } else {
      this.body.setBounce(1, 0);
      this.body.setCollideWorldBounds(true);
      this.body.onWorldBounds = true;
    }

    this.setVelocityX(this.direction * this.baseSpeed);
    if (bossProfile) this.setData({ boss: true, bossId: bossProfile.id, bossName: bossProfile.name });
    playAnim(this, `${textureKey}-walk`);
  }

  /** Reinicia la marcha despues de incorporar el sprite al grupo de fisica. */
  startMoving(): this {
    if (this.active && this.body.enable) this.setVelocityX(this.direction * this.baseSpeed);
    playAnim(this, `${this.texture.key}-walk`);
    return this;
  }

  setTarget(target: Phaser.GameObjects.Sprite): void {
    this.target = target;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    if (time < this.frozenUntil) {
      this.setTint(0x81d4fa);
      this.setVelocityX(0);
      if (this.config.flying) this.setVelocityY(0);
      return;
    }
    if (this.isTinted) this.clearTint();

    if (this.bossProfile) {
      this.updateBoss(time);
      this.tryBossSpecialAttack(time);
      this.setFlipX(this.direction < 0);
      return;
    }

    switch (this.kind) {
      case 'goomb': {
        // El conejo alterna patrulla y pequenos saltos cuando Tito esta cerca.
        if (
          this.body.blocked.down &&
          time >= this.nextActionAt &&
          (!this.target || Math.abs(this.target.x - this.x) < 360)
        ) {
          this.setVelocityY(-235);
          this.nextActionAt = time + Phaser.Math.Between(900, 1500);
        }
        this.patrol(1);
        break;
      }
      case 'spiker': {
        if (this.target && Math.abs(this.target.x - this.x) < 230) {
          this.chase(this.target.x, 1.55);
        } else {
          this.patrol(1);
        }
        break;
      }
      case 'flyer': {
        const desiredY = this.homeY + Math.sin(time / 420 + this.phase) * 46;
        this.setVelocityY(Phaser.Math.Clamp((desiredY - this.y) * 3.4, -135, 135));
        if (this.target && Math.abs(this.target.x - this.x) < 210) {
          this.chase(this.target.x, 1.25);
        } else {
          this.patrol(1);
        }
        break;
      }
      case 'ghost': {
        if (this.target) {
          const dx = this.target.x - this.x;
          const dy = this.target.y - 20 - this.y;
          const len = Math.hypot(dx, dy) || 1;
          this.direction = dx < 0 ? -1 : 1;
          this.setVelocity((dx / len) * this.config.speed, (dy / len) * this.config.speed);
        } else {
          this.patrol(0.9);
        }
        this.setAlpha(0.82 + Math.sin(time / 300 + this.phase) * 0.14);
        break;
      }
      default: {
        if (this.kind === 'slider' && this.target && Math.abs(this.target.x - this.x) < 260) {
          this.chase(this.target.x, 1.35);
        } else {
          this.patrol(1);
        }
        break;
      }
    }

    this.applyCreatureMotion(time);
    this.trySpecialAttack(time);
    // Los nuevos artes miran a la derecha de origen.
    this.setFlipX(this.direction < 0);
  }

  /** Mantiene una patrulla visible de ida y vuelta, incluso sin paredes. */
  private patrol(speedMultiplier: number): void {
    const range = this.bossProfile?.patrolRange ?? this.config.patrolRange;
    if (this.body.blocked.left || this.x <= this.homeX - range) this.direction = 1;
    if (this.body.blocked.right || this.x >= this.homeX + range) this.direction = -1;

    const desired = this.direction * this.baseSpeed * speedMultiplier;
    if (Math.abs(this.body.velocity.x - desired) > 1) this.setVelocityX(desired);
  }

  private chase(targetX: number, speedMultiplier: number): void {
    const dx = targetX - this.x;
    if (Math.abs(dx) > 3) this.direction = dx < 0 ? -1 : 1;
    this.setVelocityX(this.direction * this.baseSpeed * speedMultiplier);
  }

  private trySpecialAttack(time: number): void {
    if (!this.target || this.mini || this.kind === 'boss') return;
    const dx = this.target.x - this.x;
    const distance = Math.abs(dx);
    if (distance > 520) return;

    if (time >= this.nextAttackAt && ['spiker', 'flyer', 'ghost'].includes(this.kind)) {
      const attack: EnemyAttackKind = this.kind === 'spiker' ? 'fire' : this.kind === 'flyer' ? 'bubble' : 'spirit';
      this.scene.events.emit('enemy:attack', {
        x: this.x + Math.sign(dx || 1) * this.displayWidth * 0.35,
        y: this.y - this.displayHeight * 0.55,
        direction: (dx < 0 ? -1 : 1) as 1 | -1,
        attack,
      } satisfies EnemyAttackEvent);
      this.nextAttackAt = time + Phaser.Math.Between(2200, 3600);
    }

    if (time >= this.nextEggAt && (this.kind === 'spiker' || this.kind === 'flyer')) {
      this.scene.events.emit('enemy:egg', {
        x: this.x,
        y: this.y - 10,
        kind: this.kind,
      } satisfies EnemyEggEvent);
      this.nextEggAt = time + Phaser.Math.Between(8500, 12000);
    }
  }

  private updateBoss(time: number): void {
    const profile = this.bossProfile!;
    const targetX = this.target?.x ?? this.homeX;
    const close = Math.abs(targetX - this.x) < 520;
    const enraged = this.hp <= this.maxHp / 2;
    const pulse = Math.sin(time / 170 + this.phase);

    switch (profile.movement) {
      case 'hover': {
        const desiredY = this.homeY - 36 + Math.sin(time / (enraged ? 260 : 360) + this.phase) * 42;
        this.setVelocityY(Phaser.Math.Clamp((desiredY - this.y) * 3.2, -170, 170));
        if (close) this.chase(targetX, enraged ? 1.35 : 0.92);
        else this.patrol(0.78);
        this.setAngle(pulse * 3);
        break;
      }
      case 'charge': {
        if (close && time >= this.nextActionAt) {
          this.direction = targetX < this.x ? -1 : 1;
          this.setVelocityX(this.direction * this.baseSpeed * (enraged ? 2.8 : 2.25));
          this.nextActionAt = time + Phaser.Math.Between(enraged ? 900 : 1250, enraged ? 1350 : 1850);
        } else if (Math.abs(this.body.velocity.x) < this.baseSpeed * 1.5) {
          this.patrol(enraged ? 1.2 : 0.85);
        }
        this.setAngle(pulse * 1.5);
        break;
      }
      case 'leap': {
        this.patrol(enraged ? 1.35 : 0.95);
        if (this.body.blocked.down && close && time >= this.nextActionAt) {
          this.direction = targetX < this.x ? -1 : 1;
          this.setVelocity(this.direction * this.baseSpeed * 1.55, enraged ? -410 : -345);
          this.nextActionAt = time + Phaser.Math.Between(enraged ? 800 : 1200, enraged ? 1250 : 1800);
        }
        this.setAngle(0);
        break;
      }
      default: {
        this.patrol(enraged ? 1.2 : 0.78);
        if (this.body.blocked.down && close && time >= this.nextActionAt) {
          this.setVelocityY(enraged ? -330 : -270);
          this.nextActionAt = time + Phaser.Math.Between(enraged ? 900 : 1350, enraged ? 1400 : 2100);
        }
        this.setAngle(0);
      }
    }

    const stride = Math.min(1, Math.abs(this.body.velocity.x) / Math.max(1, this.baseSpeed));
    this.setScale(
      this.baseScaleX * (1 + Math.abs(pulse) * 0.025 * stride),
      this.baseScaleY * (1 - Math.abs(pulse) * 0.018 * stride),
    );
  }

  private tryBossSpecialAttack(time: number): void {
    const profile = this.bossProfile;
    if (!profile || !this.target) return;
    const dx = this.target.x - this.x;
    if (Math.abs(dx) > 780) return;
    const direction = (dx < 0 ? -1 : 1) as 1 | -1;
    const enraged = this.hp <= this.maxHp / 2;

    if (time >= this.nextAttackAt) {
      const shots = enraged ? 3 : profile.tier === 'final' ? 2 : 1;
      for (let index = 0; index < shots; index++) {
        const centered = index - (shots - 1) / 2;
        this.scene.events.emit('enemy:attack', {
          x: this.x + direction * this.displayWidth * 0.38,
          y: this.y - this.displayHeight * 0.58 + centered * 10,
          direction,
          attack: profile.attack,
          speed: 225 + profile.world * 16 + (enraged ? 45 : 0),
          verticalSpeed: centered * 82,
          scale: profile.tier === 'final' ? 1.35 : 1.12,
          tint: profile.accent,
        } satisfies EnemyAttackEvent);
      }
      this.nextAttackAt = time + Phaser.Math.Between(enraged ? 1050 : 1550, enraged ? 1650 : 2450);
    }

    if (time >= this.nextEggAt) {
      this.scene.events.emit('enemy:egg', {
        x: this.x - direction * 24,
        y: this.y - this.displayHeight * 0.45,
        kind: profile.summon,
      } satisfies EnemyEggEvent);
      this.nextEggAt = time + Phaser.Math.Between(enraged ? 4400 : 6200, enraged ? 6500 : 8800);
    }
  }

  private applyCreatureMotion(time: number): void {
    if (this.kind === 'boss') return;
    const pulse = Math.sin(time / (this.config.flying ? 150 : 105) + this.phase);
    if (this.config.flying) {
      this.setAngle(pulse * 4);
      this.setScale(this.baseScaleX * (1 + pulse * 0.025), this.baseScaleY * (1 - pulse * 0.025));
    } else {
      const step = Math.abs(pulse) * Math.min(1, Math.abs(this.body.velocity.x) / this.baseSpeed);
      this.setAngle(0);
      this.setScale(this.baseScaleX * (1 + step * 0.025), this.baseScaleY * (1 - step * 0.035));
    }
  }

  makeMini(): this {
    this.mini = true;
    this.hp = 1;
    this.baseSpeed *= 1.18;
    this.setDisplaySize(this.config.displayWidth * 0.58, this.config.displayHeight * 0.58);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.setData('mini', true);
    return this;
  }

  freeze(durationMs = 2400): void {
    const adjusted = this.bossProfile ? Math.min(durationMs, 850) : durationMs;
    this.frozenUntil = Math.max(this.frozenUntil, this.scene.time.now + adjusted);
    this.setTint(0x81d4fa);
  }

  /** Devuelve true si el enemigo muere. */
  damage(amount = 1): boolean {
    const wasEnraged = this.hp <= this.maxHp / 2;
    this.hp -= amount;
    if (this.bossProfile) {
      this.scene.events.emit('boss:health', this, Math.max(0, this.hp), this.maxHp);
      if (!wasEnraged && this.hp > 0 && this.hp <= this.maxHp / 2) {
        this.scene.events.emit('boss:phase', this.bossProfile);
      }
    }
    if (this.hp > 0) {
      this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 80, yoyo: true, repeat: 1 });
      return false;
    }
    return true;
  }

  squash(): void {
    this.body.enable = false;
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.2,
      alpha: 0,
      duration: 180,
      onComplete: () => this.destroy(),
    });
  }

  knockOut(): void {
    this.body.enable = false;
    this.setVelocity(Phaser.Math.Between(-120, 120), -320);
    this.body.setAllowGravity(true);
    this.scene.tweens.add({ targets: this, angle: 180, alpha: 0, duration: 700, onComplete: () => this.destroy() });
  }
}

export function enemyScore(kind: EnemyKind): number {
  return CONFIG[kind].score;
}

export function isStompable(kind: EnemyKind): boolean {
  return CONFIG[kind].stompable;
}
