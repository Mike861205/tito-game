import Phaser from 'phaser';
import { PHYSICS, TITO_FRAME_HEIGHT, TITO_FRAME_WIDTH, type PowerUp } from '@tito/shared';
import type { InputState } from '../systems/InputController';

export type DeathCause = 'enemigo' | 'caida' | 'pinchos' | 'lava' | 'tiempo' | 'desconocido';

/**
 * TITO - el protagonista.
 * Controles pulidos estilo Mario: salto variable, coyote time,
 * jump buffer, aceleracion/friccion y rebote al pisar enemigos.
 */
export class Tito extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  power: PowerUp = 'none';
  invulnerableUntil = 0;
  starUntil = 0;
  isDead = false;
  facing: 1 | -1 = 1;

  private lastGroundedAt = 0;
  private jumpBufferedAt = -9999;
  private jumpStartedAt = -9999;
  private isJumping = false;
  private frictionScale = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'tito', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.setDepth(20);
    this.body.setSize(24, 38);
    this.body.setOffset((TITO_FRAME_WIDTH - 24) / 2, TITO_FRAME_HEIGHT - 38);
    this.body.setMaxVelocityY(PHYSICS.maxFallSpeed);
    this.body.setCollideWorldBounds(true);

    this.createAnimations();
    this.play('tito-idle');
  }

  setFrictionScale(scale: number): void {
    this.frictionScale = scale;
  }

  private createAnimations(): void {
    const anims = this.scene.anims;
    if (anims.exists('tito-idle')) return;

    anims.create({
      key: 'tito-idle',
      frames: anims.generateFrameNumbers('tito', { start: 0, end: 1 }),
      frameRate: 3,
      repeat: -1,
    });
    anims.create({
      key: 'tito-run',
      frames: anims.generateFrameNumbers('tito', { start: 2, end: 7 }),
      frameRate: 14,
      repeat: -1,
    });
    anims.create({ key: 'tito-jump', frames: [{ key: 'tito', frame: 8 }], frameRate: 1 });
    anims.create({ key: 'tito-fall', frames: [{ key: 'tito', frame: 9 }], frameRate: 1 });
    anims.create({ key: 'tito-hurt', frames: [{ key: 'tito', frame: 10 }], frameRate: 1 });
    anims.create({ key: 'tito-crouch', frames: [{ key: 'tito', frame: 11 }], frameRate: 1 });
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil || this.hasStar;
  }

  get hasStar(): boolean {
    return this.scene.time.now < this.starUntil;
  }

  handleInput(input: InputState, delta: number): void {
    if (this.isDead) return;

    const now = this.scene.time.now;
    const body = this.body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) {
      this.lastGroundedAt = now;
      this.isJumping = false;
    }

    const crouching = input.down && onGround;
    const maxSpeed = input.sprint ? PHYSICS.sprintSpeed : PHYSICS.runSpeed;
    const dt = delta / 1000;

    // Movimiento horizontal con aceleracion e inercia
    if (!crouching && (input.left || input.right)) {
      const dir = input.left ? -1 : 1;
      this.facing = dir;
      const accel = PHYSICS.acceleration * (onGround ? 1 : 0.7) * dt;
      body.velocity.x = Phaser.Math.Clamp(body.velocity.x + dir * accel, -maxSpeed, maxSpeed);
      this.setFlipX(dir === -1);
    } else {
      const fric = (onGround ? PHYSICS.friction * this.frictionScale : PHYSICS.airFriction) * dt;
      if (Math.abs(body.velocity.x) <= fric) body.velocity.x = 0;
      else body.velocity.x -= Math.sign(body.velocity.x) * fric;
    }

    // Jump buffer
    if (input.jumpJustPressed) this.jumpBufferedAt = now;

    const canCoyote = now - this.lastGroundedAt <= PHYSICS.coyoteTimeMs;
    const bufferedJump = now - this.jumpBufferedAt <= PHYSICS.jumpBufferMs;

    if (bufferedJump && canCoyote && !this.isJumping) {
      body.velocity.y = PHYSICS.jumpVelocity;
      this.isJumping = true;
      this.jumpStartedAt = now;
      this.jumpBufferedAt = -9999;
      this.lastGroundedAt = -9999;
      this.scene.events.emit('tito:jump');
    }

    // Salto variable: mantener el boton da mas altura
    if (this.isJumping && input.jumpDown && now - this.jumpStartedAt < PHYSICS.maxJumpHoldMs) {
      body.velocity.y = Math.min(body.velocity.y, PHYSICS.jumpHoldBoost * 0.55);
    }
    if (this.isJumping && !input.jumpDown && body.velocity.y < 0) {
      body.velocity.y *= 0.55;
      this.isJumping = false;
    }

    this.updateAnimation(onGround, crouching);
    this.updateTint();
  }

  private updateAnimation(onGround: boolean, crouching: boolean): void {
    if (!onGround) {
      this.play(this.body.velocity.y < 0 ? 'tito-jump' : 'tito-fall', true);
    } else if (crouching) {
      this.play('tito-crouch', true);
    } else if (Math.abs(this.body.velocity.x) > 15) {
      this.play('tito-run', true);
      this.anims.msPerFrame = Math.max(40, 1400 / Math.abs(this.body.velocity.x));
    } else {
      this.play('tito-idle', true);
    }
  }

  private updateTint(): void {
    if (this.hasStar) {
      this.setTint(Phaser.Display.Color.HSVColorWheel()[Math.floor(this.scene.time.now / 40) % 360]!.color);
    } else if (this.scene.time.now < this.invulnerableUntil) {
      this.setAlpha(Math.floor(this.scene.time.now / 80) % 2 === 0 ? 0.35 : 1);
    } else {
      this.clearTint();
      this.setAlpha(1);
    }
  }

  bounce(): void {
    this.body.velocity.y = PHYSICS.enemyStompBounce;
    this.isJumping = false;
  }

  springJump(): void {
    this.body.velocity.y = PHYSICS.jumpVelocity * 1.55;
    this.isJumping = false;
  }

  applyPowerUp(power: PowerUp): void {
    if (power === 'estrella') {
      this.starUntil = this.scene.time.now + 8000;
      return;
    }
    this.power = power;
    this.setScale(power === 'grande' || power === 'fuego' ? 1.25 : 1);
  }

  /** Devuelve true si Tito muere con este golpe. */
  takeHit(): boolean {
    if (this.isInvulnerable || this.isDead) return false;

    if (this.power !== 'none') {
      this.power = 'none';
      this.setScale(1);
      this.invulnerableUntil = this.scene.time.now + PHYSICS.invulnerabilityMs;
      this.scene.events.emit('tito:hurt');
      return false;
    }
    return true;
  }

  die(cause: DeathCause): void {
    if (this.isDead) return;
    this.isDead = true;
    this.body.setVelocity(0, -420);
    this.body.checkCollision.none = true;
    this.setCollideWorldBounds(false);
    this.play('tito-hurt', true);
    this.setAngularVelocity?.(180);
    this.scene.events.emit('tito:died', cause);
  }

  respawn(x: number, y: number): void {
    this.isDead = false;
    this.power = 'none';
    this.setScale(1);
    this.setPosition(x, y);
    this.setAngle(0);
    this.body.setVelocity(0, 0);
    this.body.checkCollision.none = false;
    this.setCollideWorldBounds(true);
    this.invulnerableUntil = this.scene.time.now + PHYSICS.invulnerabilityMs;
    this.play('tito-idle', true);
  }
}
