import Phaser from 'phaser';
import { STARTING_LIVES } from '@tito/shared';
import { save } from '../systems/SaveManager';
import { createButton, createPanel, createTitle } from '../ui/Widgets';

export class GameOverScene extends Phaser.Scene {
  private info!: { world: number; level: number; score: number };

  constructor() {
    super('GameOver');
  }

  init(data: { world: number; level: number; score: number }): void {
    this.info = data;
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x0d1117).setOrigin(0);
    createPanel(this, width / 2, height / 2, 500, 330);

    createTitle(this, width / 2, height / 2 - 110, 'GAME OVER', 44);

    this.add
      .text(width / 2, height / 2 - 50, `Nivel ${this.info.world}-${this.info.level}`, {
        fontSize: '18px',
        color: '#c9d1d9',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 - 20, `Puntaje: ${this.info.score.toLocaleString('es-MX')}`, {
        fontSize: '20px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    save.progress.lives = STARTING_LIVES;
    save.save();

    createButton(
      this,
      width / 2,
      height / 2 + 40,
      'REINTENTAR NIVEL',
      () =>
        this.scene.start('Game', {
          world: this.info.world,
          level: this.info.level,
          lives: STARTING_LIVES,
        }),
      { width: 340 },
    );

    createButton(this, width / 2, height / 2 + 105, 'MAPA DE MUNDOS', () => this.scene.start('WorldMap'), {
      width: 340,
      color: 0x30363d,
      hoverColor: 0x3d444d,
    });

    this.input.keyboard?.on('keydown-ENTER', () =>
      this.scene.start('Game', {
        world: this.info.world,
        level: this.info.level,
        lives: STARTING_LIVES,
      }),
    );
  }
}
