import Phaser from 'phaser';
import type { EnemyKind } from '@tito/shared';

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
}

const CONFIG: Record<EnemyKind, EnemyConfig> = {
  goomb: { texture: 'enemy-goomb', speed: 60, hp: 1, stompable: true, flying: false, score: 200, bodyScale: 0.8 },
  spiker: { texture: 'enemy-spiker', speed: 45, hp: 1, stompable: false, flying: false, score: 300, bodyScale: 0.7 },
  flyer: { texture: 'enemy-flyer', speed: 80, hp: 1, stompable: true, flying: true, score: 250, bodyScale: 0.7 },
  slider: { texture: 'enemy-slider', speed: 160, hp: 1, stompable: true, flying: false, score: 350, bodyScale: 0.85 },
  ghost: { texture: 'enemy-ghost', speed: 55, hp: 2, stompable: false, flying: true, score: 400, bodyScale: 0.75 },
  boss: { texture: 'enemy-goomb', speed: 90, hp: 5, stompable: true, flying: false, score: 5000, bodyScale: 1 },
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly kind: EnemyKind;
  readonly config: EnemyConfig;
  hp: number;
  private homeY: number;
  private phase: number;
  private target?: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind, isBoss = false) {
    const cfg = CONFIG[kind];
    super(scene, x, y, cfg.texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.config = cfg;
    this.hp = cfg.hp;
    this.homeY = y;
    this.phase = Math.random() * Math.PI * 2;

    this.setOrigin(0.5, 1).setDepth(15);
    if (isBoss) {
      this.setScale(2.2);
      this.hp = 8;
      this.setTint(0xff5252);
    }

    const w = this.width * cfg.bodyScale;
    const h = this.height * cfg.bodyScale;
    this.body.setSize(w, h);
    this.body.setOffset((this.width - w) / 2, this.height - h);

    if (cfg.flying) {
      this.body.setAllowGravity(false);
    } else {
      this.body.setBounce(1, 0);
      this.body.setCollideWorldBounds(true);
      this.body.onWorldBounds = true;
    }

    this.setVelocityX(Math.random() < 0.5 ? -cfg.speed : cfg.speed);
  }

  setTarget(target: Phaser.GameObjects.Sprite): void {
    this.target = target;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    switch (this.kind) {
      case 'flyer': {
        this.y = this.homeY + Math.sin(time / 420 + this.phase) * 46;
        if (this.body.blocked.left || this.body.blocked.right) {
          this.setVelocityX(-this.body.velocity.x);
        }
        break;
      }
      case 'ghost': {
        if (this.target) {
          const dx = this.target.x - this.x;
          const dy = this.target.y - 20 - this.y;
          const len = Math.hypot(dx, dy) || 1;
          this.setVelocity((dx / len) * this.config.speed, (dy / len) * this.config.speed);
        }
        this.setAlpha(0.6 + Math.sin(time / 300 + this.phase) * 0.25);
        break;
      }
      default: {
        // Patrulla: da la vuelta al chocar o al llegar al borde de la plataforma
        if (this.body.blocked.left) this.setVelocityX(this.config.speed);
        else if (this.body.blocked.right) this.setVelocityX(-this.config.speed);
        break;
      }
    }

    this.setFlipX(this.body.velocity.x > 0);
  }

  /** Devuelve true si el enemigo muere. */
  damage(amount = 1): boolean {
    this.hp -= amount;
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
