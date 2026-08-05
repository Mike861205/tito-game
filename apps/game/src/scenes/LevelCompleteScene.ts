import Phaser from 'phaser';
import { getWorld, nextLevel } from '@tito/shared';
import { save } from '../systems/SaveManager';
import { createButton, createPanel, createTitle, formatTime } from '../ui/Widgets';

export interface LevelCompleteData {
  world: number;
  level: number;
  score: number;
  baseScore: number;
  timeBonus: number;
  livesBonus: number;
  noDamage: number;
  stars: number;
  coins: number;
  timeMs: number;
  lives: number;
}

export class LevelCompleteScene extends Phaser.Scene {
  private result!: LevelCompleteData;
  private navigating = false;

  constructor() {
    super('LevelComplete');
  }

  init(data: LevelCompleteData): void {
    this.result = data;
    this.navigating = false;
  }

  create(): void {
    const { width, height } = this.scale;
    const world = getWorld(this.result.world);
    const next = nextLevel(this.result.world, this.result.level);

    this.add.rectangle(0, 0, width, height, world.skyBottom).setOrigin(0);
    this.add.tileSprite(0, 0, width, height, `sky-w${world.id}`).setOrigin(0).setAlpha(0.85);
    createPanel(this, width / 2, height / 2, 620, 430);

    createTitle(this, width / 2, 100, next ? 'NIVEL COMPLETADO' : 'JUEGO COMPLETADO', 34);
    this.add
      .text(width / 2, 140, `${world.name} - ${this.result.world}-${this.result.level}`, {
        fontSize: '17px',
        color: '#c9d1d9',
      })
      .setOrigin(0.5);

    // Estrellas animadas
    for (let i = 0; i < 3; i++) {
      const star = this.add
        .text(width / 2 - 70 + i * 70, 195, '*', {
          fontSize: '56px',
          color: i < this.result.stars ? '#ffd54f' : '#30363d',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setScale(0);
      this.tweens.add({
        targets: star,
        scale: 1,
        duration: 320,
        delay: 200 + i * 220,
        ease: 'Back.easeOut',
      });
    }

    const rows: Array<[string, string]> = [
      ['Puntaje del nivel', this.result.baseScore.toLocaleString('es-MX')],
      ['Bono de tiempo', `+${this.result.timeBonus.toLocaleString('es-MX')}`],
      ['Bono de vidas', `+${this.result.livesBonus.toLocaleString('es-MX')}`],
      ['Sin morir', this.result.noDamage ? `+${this.result.noDamage.toLocaleString('es-MX')}` : '-'],
      ['Valor del tesoro', `${this.result.coins}`],
      ['Tiempo', formatTime(this.result.timeMs)],
    ];

    rows.forEach(([label, value], i) => {
      const y = 250 + i * 26;
      this.add.text(width / 2 - 260, y, label, { fontSize: '16px', color: '#8b949e' }).setOrigin(0, 0.5);
      this.add
        .text(width / 2 + 260, y, value, { fontSize: '16px', color: '#e6edf3', fontStyle: 'bold' })
        .setOrigin(1, 0.5);
    });

    this.add
      .text(width / 2, 425, `TOTAL: ${this.result.score.toLocaleString('es-MX')}`, {
        fontSize: '26px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    if (next) {
      createButton(
        this,
        width / 2 - 160,
        height - 60,
        `SIGUIENTE ${next.world}-${next.level}`,
        () => this.goToLevel(next.world, next.level),
        { width: 280 },
      );
    } else {
      this.add
        .text(width / 2, height - 100, 'Felicidades! Tito salvo los 5 mundos.', {
          fontSize: '18px',
          color: '#4caf50',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    }

    createButton(this, width / 2 + 160, height - 60, 'MAPA DE MUNDOS', () => this.goToMap(), {
      width: 280,
      color: 0x30363d,
      hoverColor: 0x3d444d,
    });

    save.progress.lives = this.result.lives;
    save.save();

    const onEnter = (): void => {
      if (next) this.goToLevel(next.world, next.level);
      else this.goToMap();
    };
    this.input.keyboard?.on('keydown-ENTER', onEnter);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ENTER', onEnter);
    });
  }

  private goToLevel(world: number, level: number): void {
    if (this.navigating) return;
    this.navigating = true;
    this.input.enabled = false;
    // Hacer el cambio en el siguiente tick evita desmontar la escena dentro
    // del mismo pointerdown que pulso el boton.
    this.time.delayedCall(0, () => {
      this.scene.stop('Hud');
      this.scene.stop('Pause');
      this.scene.start('Game', { world, level, lives: this.result.lives });
    });
  }

  private goToMap(): void {
    if (this.navigating) return;
    this.navigating = true;
    this.input.enabled = false;
    this.time.delayedCall(0, () => {
      this.scene.stop('Hud');
      this.scene.stop('Pause');
      this.scene.start('WorldMap');
    });
  }
}
