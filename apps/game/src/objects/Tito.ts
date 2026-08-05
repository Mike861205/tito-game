import Phaser from 'phaser';
import { PHYSICS, TITO_FRAME_HEIGHT, TITO_FRAME_WIDTH, type PowerUp } from '@tito/shared';
import type { InputState } from '../systems/InputController';
import { frameCount } from '../systems/AssetManifest';

export type DeathCause = 'enemigo' | 'caida' | 'pinchos' | 'lava' | 'tiempo' | 'desconocido';

/**
 * Registra las animaciones de Tito (se llama desde Preload y desde el constructor).
 * Los rangos se recortan al numero real de frames de tu PNG, asi que la hoja
 * puede tener menos de 12 frames sin romper el juego.
 * `key` permite registrar tambien la hoja grande del menu (`tito-hd`).
 */
export function createTitoAnimations(scene: Phaser.Scene, key = 'tito'): void {
  const anims = scene.anims;
  if (anims.exists(`${key}-idle`)) return;
  if (!scene.textures.exists(key)) return;

  const last = Math.max(0, frameCount(scene, key) - 1);
  const f = (index: number): number => Math.min(index, last);
  const range = (start: number, end: number): Phaser.Types.Animations.AnimationFrame[] =>
    anims.generateFrameNumbers(key, { start: f(start), end: f(end) });

  anims.create({ key: `${key}-idle`, frames: range(0, 1), frameRate: 3, repeat: -1 });
  anims.create({ key: `${key}-run`, frames: range(2, 7), frameRate: 14, repeat: -1 });
  anims.create({ key: `${key}-jump`, frames: [{ key, frame: f(8) }], frameRate: 1 });
  anims.create({ key: `${key}-fall`, frames: [{ key, frame: f(9) }], frameRate: 1 });
  anims.create({ key: `${key}-hurt`, frames: [{ key, frame: f(10) }], frameRate: 1 });
  anims.create({ key: `${key}-crouch`, frames: [{ key, frame: f(11) }], frameRate: 1 });
}

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
  isFlying = false;
  flightEnergy = 0;

  private lastGroundedAt = 0;
  private jumpBufferedAt = -9999;
  private jumpStartedAt = -9999;
  private isJumping = false;
  private canFlyThisJump = false;
  private frictionScale = 1;
  private capeVisual: Phaser.GameObjects.Graphics;

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

    // La capa mejorada aparece solo al ganar el premio. Se dibuja por separado
    // para poder ondearla segun la velocidad y la fase del vuelo.
    this.capeVisual = scene.add.graphics().setDepth(19).setVisible(false);
    this.once('destroy', () => this.capeVisual.destroy());

    this.createAnimations();
    this.play('tito-idle');
  }

  setFrictionScale(scale: number): void {
    this.frictionScale = scale;
  }

  private createAnimations(): void {
    createTitoAnimations(this.scene);
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil || this.hasStar;
  }

  get hasStar(): boolean {
    return this.scene.time.now < this.starUntil;
  }

  handleInput(input: InputState, delta: number): void {
    if (this.isDead) {
      this.capeVisual.setVisible(false);
      return;
    }

    const now = this.scene.time.now;
    const body = this.body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) {
      this.lastGroundedAt = now;
      this.isJumping = false;
      this.isFlying = false;
      this.canFlyThisJump = false;
      body.setGravityY(0);
    }

    const crouching = input.down && onGround;
    const hasCape = this.power === 'capa';
    const maxSpeed = input.sprint
      ? hasCape
        ? PHYSICS.capeSprintSpeed
        : PHYSICS.sprintSpeed
      : PHYSICS.runSpeed;
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

    // La energia de vuelo se gana manteniendo una carrera rapida. Al obtener
    // el premio empieza llena para que el jugador pueda descubrirla enseguida.
    if (hasCape && onGround && input.sprint && Math.abs(body.velocity.x) >= PHYSICS.capeMinTakeoffSpeed * 0.7) {
      this.flightEnergy = Math.min(100, this.flightEnergy + PHYSICS.capeChargePerSecond * dt);
    }

    // Jump buffer
    if (input.jumpJustPressed) this.jumpBufferedAt = now;

    const canCoyote = now - this.lastGroundedAt <= PHYSICS.coyoteTimeMs;
    const bufferedJump = now - this.jumpBufferedAt <= PHYSICS.jumpBufferMs;

    if (bufferedJump && canCoyote && !this.isJumping) {
      const momentum = Phaser.Math.Clamp(Math.abs(body.velocity.x) / PHYSICS.sprintSpeed, 0, 1);
      const capeBonus = hasCape ? 25 * (this.flightEnergy / 100) : 0;
      body.velocity.y = PHYSICS.jumpVelocity - PHYSICS.momentumJumpBoost * momentum - capeBonus;
      this.isJumping = true;
      this.canFlyThisJump = hasCape && Math.abs(body.velocity.x) >= PHYSICS.capeMinTakeoffSpeed;
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

    // Con impulso suficiente, mantener salto convierte el planeo en vuelo. Sin
    // carga, la capa todavia reduce la caida y permite corregir el aterrizaje.
    const wantsFlight =
      hasCape &&
      !onGround &&
      !input.down &&
      input.jumpDown &&
      this.canFlyThisJump &&
      this.flightEnergy > 0;
    const wasFlying = this.isFlying;
    this.isFlying = wantsFlight;
    if (wantsFlight) {
      body.setGravityY(-PHYSICS.capeGravityReduction);
      body.velocity.y = Math.max(body.velocity.y - PHYSICS.capeFlightLift * dt, -275);
      this.flightEnergy = Math.max(0, this.flightEnergy - PHYSICS.capeFlightDrainPerSecond * dt);
      if (!wasFlying) this.scene.events.emit('tito:flight');
    } else if (hasCape && !onGround && input.jumpDown && !input.down) {
      body.setGravityY(-PHYSICS.capeGlideGravityReduction);
      body.velocity.y = Math.min(body.velocity.y, 240);
    } else if (!onGround) {
      body.setGravityY(0);
    }

    this.updateAnimation(onGround, crouching);
    this.updateTint();
    this.updateCapeVisual();
  }

  private updateAnimation(onGround: boolean, crouching: boolean): void {
    if (!onGround) {
      this.play(this.isFlying || this.body.velocity.y < 0 ? 'tito-jump' : 'tito-fall', true);
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
      if (this.power === 'fuego') this.setTint(0xffb74d);
      else if (this.power === 'hielo') this.setTint(0x81d4fa);
      else if (this.power === 'capa') this.setTint(0xfff0c2);
      else this.clearTint();
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
    this.canFlyThisJump = this.power === 'capa';
  }

  applyPowerUp(power: PowerUp): void {
    if (power === 'estrella') {
      this.starUntil = this.scene.time.now + 8000;
      return;
    }
    this.power = power;
    this.isFlying = false;
    this.canFlyThisJump = false;
    this.body.setGravityY(0);
    if (power === 'capa') this.flightEnergy = 100;
    else this.flightEnergy = 0;
    this.setScale(power === 'grande' || power === 'fuego' || power === 'hielo' ? 1.25 : 1);
    if (power === 'fuego') this.setTint(0xffb74d);
    if (power === 'hielo') this.setTint(0x81d4fa);
    this.updateCapeVisual();
  }

  /** Devuelve true si Tito muere con este golpe. */
  takeHit(): boolean {
    if (this.isInvulnerable || this.isDead) return false;

    if (this.power !== 'none') {
      this.power = 'none';
      this.isFlying = false;
      this.flightEnergy = 0;
      this.body.setGravityY(0);
      this.capeVisual.setVisible(false);
      this.clearTint();
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
    this.isFlying = false;
    this.body.setGravityY(0);
    this.capeVisual.setVisible(false);
    this.body.setVelocity(0, -420);
    this.body.checkCollision.none = true;
    this.setCollideWorldBounds(false);
    this.play('tito-hurt', true);
    // Salto de despedida derechito: nada de girar como trompo.
    this.setAngularVelocity?.(0);
    this.setAngle(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 0.92,
      scaleY: this.scaleY * 1.08,
      duration: 180,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.scene.events.emit('tito:died', cause);
  }

  respawn(x: number, y: number): void {
    this.isDead = false;
    this.power = 'none';
    this.isFlying = false;
    this.flightEnergy = 0;
    this.canFlyThisJump = false;
    this.capeVisual.setVisible(false);
    this.scene.tweens.killTweensOf(this);
    this.setScale(1);
    this.setPosition(x, y);
    this.setAngle(0);
    this.body.setVelocity(0, 0);
    this.body.checkCollision.none = false;
    this.setCollideWorldBounds(true);
    this.invulnerableUntil = this.scene.time.now + PHYSICS.invulnerabilityMs;
    this.play('tito-idle', true);
  }

  private updateCapeVisual(): void {
    if (this.power !== 'capa' || this.isDead) {
      this.capeVisual.setVisible(false);
      return;
    }

    const cape = this.capeVisual;
    const speed = Math.abs(this.body.velocity.x);
    const wave = Math.sin(this.scene.time.now / (this.isFlying ? 70 : 115)) * (this.isFlying ? 3.5 : 2);
    cape.clear().setVisible(true).setPosition(this.x - this.facing * 2, this.y - 34);
    cape.setScale(this.facing, 1);
    cape.setRotation(this.facing * (this.isFlying ? -0.24 : -0.05 - Math.min(0.18, speed / 1800)));

    cape.fillStyle(0x7a1525, 0.34);
    cape.fillTriangle(-2, 4, -34, 10 + wave, -23, 35 + wave);
    cape.fillStyle(0xf4512c, 0.98);
    cape.beginPath();
    cape.moveTo(-1, 0);
    cape.lineTo(-12, 3 + wave * 0.35);
    cape.lineTo(-24, 5 + wave * 0.7);
    cape.lineTo(-34, 8 + wave);
    cape.lineTo(-31, 19 + wave);
    cape.lineTo(-21, 34 + wave);
    cape.lineTo(-12, 28 + wave * 0.5);
    cape.lineTo(-5, 16);
    cape.closePath();
    cape.fillPath();
    cape.lineStyle(2, 0xffc857, 0.9);
    cape.strokePath();
    cape.fillStyle(0xffdf72, 0.9);
    cape.fillTriangle(-8, 7, -19, 11 + wave, -12, 21 + wave);
  }
}
