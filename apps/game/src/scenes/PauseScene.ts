import Phaser from 'phaser';
import { save } from '../systems/SaveManager';
import { audio } from '../systems/AudioManager';
import { createButton, createPanel, createTitle } from '../ui/Widgets';

export class PauseScene extends Phaser.Scene {
  private levelInfo!: { world: number; level: number };

  constructor() {
    super('Pause');
  }

  init(data: { world: number; level: number }): void {
    this.levelInfo = data;
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0);
    createPanel(this, width / 2, height / 2, 420, 380);
    createTitle(this, width / 2, height / 2 - 140, 'PAUSA', 36);

    this.add
      .text(width / 2, height / 2 - 104, `Nivel ${this.levelInfo.world}-${this.levelInfo.level}`, {
        fontSize: '16px',
        color: '#c9d1d9',
      })
      .setOrigin(0.5);

    const savedFlag = save.getCheckpoint(this.levelInfo.world, this.levelInfo.level);
    this.add
      .text(
        width / 2,
        height / 2 - 80,
        savedFlag === null ? 'Aún no hay una bandera guardada' : `Bandera ${savedFlag + 1} guardada`,
        { fontSize: '13px', color: savedFlag === null ? '#8b949e' : '#78f3ff', fontStyle: 'bold' },
      )
      .setOrigin(0.5);

    createButton(this, width / 2, height / 2 - 44, 'CONTINUAR', () => this.resume(), { width: 300 });

    createButton(
      this,
      width / 2,
      height / 2 + 16,
      `COACH IA: ${save.settings.aiCoach ? 'ON' : 'OFF'}`,
      () => {
        save.saveSettings({ aiCoach: !save.settings.aiCoach });
        this.scene.restart();
      },
      { width: 300, color: 0x6e40c9, hoverColor: 0x8957e5 },
    );

    createButton(
      this,
      width / 2,
      height / 2 + 76,
      `SONIDO: ${Math.round(save.settings.sfxVolume * 100)}%`,
      () => {
        const next = save.settings.sfxVolume >= 1 ? 0 : save.settings.sfxVolume + 0.25;
        save.saveSettings({ sfxVolume: next });
        audio.setVolume(next);
        this.scene.restart();
      },
      { width: 300, color: 0x1f6feb, hoverColor: 0x2f81f7 },
    );

    createButton(
      this,
      width / 2,
      height / 2 + 140,
      'SALIR Y GUARDAR',
      () => {
        save.save();
        this.scene.get('Game').events.emit('game:exit');
        this.scene.stop('Hud');
        this.scene.stop('Game');
        this.scene.stop();
        this.scene.start('WorldMap');
      },
      { width: 300, color: 0xda3633, hoverColor: 0xf85149 },
    );

    this.input.keyboard?.on('keydown-ESC', () => this.resume());
    this.input.keyboard?.on('keydown-P', () => this.resume());
  }

  private resume(): void {
    this.scene.resume('Game');
    this.scene.stop();
  }
}
